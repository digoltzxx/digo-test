import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting - simple in-memory store (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100 // requests per window
const RATE_WINDOW_MS = 60000 // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  
  if (entry.count >= RATE_LIMIT) {
    return false
  }
  
  entry.count++
  return true
}

// Mask sensitive data in payloads
function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apikey', 'authorization', 'credit_card', 'cvv', 'cpf', 'cnpj']
  const masked: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase()
    if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
      masked[key] = '***MASKED***'
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>)
    } else {
      masked[key] = value
    }
  }
  
  return masked
}

// Validate delivery log input
interface CreateLogInput {
  email_destino: string
  tipo_entrega: string
  status: string
  erro_detalhado?: string
  codigo_erro?: string
  payload_referencia?: Record<string, unknown>
  metadata_adicional?: Record<string, unknown>
  tempo_processamento_ms?: number
  tentativas?: number
  correlation_id?: string
  product_id?: string
}

function validateLogInput(input: unknown): { valid: boolean; error?: string; data?: CreateLogInput } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Request body is required' }
  }
  
  const data = input as Record<string, unknown>
  
  if (!data.email_destino || typeof data.email_destino !== 'string') {
    return { valid: false, error: 'email_destino is required and must be a string' }
  }
  
  if (!data.tipo_entrega || typeof data.tipo_entrega !== 'string') {
    return { valid: false, error: 'tipo_entrega is required and must be a string' }
  }
  
  if (!data.status || typeof data.status !== 'string') {
    return { valid: false, error: 'status is required and must be a string' }
  }
  
  const validStatuses = ['sucesso', 'falha', 'pendente', 'pending', 'completed', 'failed', 'processing']
  if (!validStatuses.includes(data.status as string)) {
    return { valid: false, error: `status must be one of: ${validStatuses.join(', ')}` }
  }
  
  return {
    valid: true,
    data: {
      email_destino: (data.email_destino as string).toLowerCase().trim(),
      tipo_entrega: data.tipo_entrega as string,
      status: data.status as string,
      erro_detalhado: data.erro_detalhado as string | undefined,
      codigo_erro: data.codigo_erro as string | undefined,
      payload_referencia: data.payload_referencia as Record<string, unknown> | undefined,
      metadata_adicional: data.metadata_adicional as Record<string, unknown> | undefined,
      tempo_processamento_ms: typeof data.tempo_processamento_ms === 'number' ? data.tempo_processamento_ms : undefined,
      tentativas: typeof data.tentativas === 'number' ? data.tentativas : 1,
      correlation_id: data.correlation_id as string | undefined,
      product_id: data.product_id as string | undefined,
    }
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now()
  const requestId = crypto.randomUUID().slice(0, 8)
  
  console.log(`[${requestId}] Delivery Logs API - ${req.method} ${new URL(req.url).pathname}`)
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  
  // Extract ID if present in path
  const logId = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null
  
  try {
    // Rate limiting by IP or auth token
    const authHeader = req.headers.get('authorization') || ''
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitKey = authHeader || clientIp
    
    if (!checkRateLimit(rateLimitKey)) {
      console.log(`[${requestId}] Rate limit exceeded for ${rateLimitKey.slice(0, 20)}...`)
      return new Response(JSON.stringify({ 
        error: 'Too many requests', 
        retry_after: 60 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      })
    }
    
    // Verify authentication for all endpoints
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      console.log(`[${requestId}] Missing authorization token`)
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.log(`[${requestId}] Invalid token: ${authError?.message}`)
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log(`[${requestId}] Authenticated user: ${user.id.slice(0, 8)}...`)
    
    // Check if user is admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'moderator'])
    
    const isAdmin = userRoles && userRoles.length > 0
    
    // ===============================
    // GET /api/logs/delivery - List logs
    // ===============================
    if (req.method === 'GET' && !logId) {
      console.log(`[${requestId}] Listing delivery logs`)
      
      // Parse query parameters
      const email = url.searchParams.get('email')
      const status = url.searchParams.get('status')
      const tipo_entrega = url.searchParams.get('tipo_entrega')
      const data_inicio = url.searchParams.get('data_inicio')
      const data_fim = url.searchParams.get('data_fim')
      const correlation_id = url.searchParams.get('correlation_id')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
      const offset = parseInt(url.searchParams.get('offset') || '0')
      
      // Build query
      let query = supabase
        .from('delivery_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      // Apply filters
      if (email) {
        query = query.ilike('user_email', `%${email}%`)
      }
      
      if (status) {
        query = query.eq('delivery_status', status)
      }
      
      if (tipo_entrega) {
        query = query.eq('delivery_type', tipo_entrega)
      }
      
      if (correlation_id) {
        query = query.eq('correlation_id', correlation_id)
      }
      
      if (data_inicio) {
        query = query.gte('created_at', data_inicio)
      }
      
      if (data_fim) {
        query = query.lte('created_at', data_fim)
      }
      
      // Non-admins can only see logs for their own products
      if (!isAdmin) {
        const { data: userProducts } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', user.id)
        
        const productIds = userProducts?.map(p => p.id) || []
        if (productIds.length === 0) {
          return new Response(JSON.stringify({ 
            nodes: [], 
            totalCount: 0,
            limit,
            offset 
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        query = query.in('product_id', productIds)
      }
      
      const { data: logs, error: queryError, count } = await query
      
      if (queryError) {
        console.error(`[${requestId}] Query error:`, queryError)
        return new Response(JSON.stringify({ error: 'Failed to fetch logs' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Map to response format
      const nodes = (logs || []).map(log => ({
        id: log.id,
        createdAt: log.created_at,
        emailDestino: log.user_email,
        tipoEntrega: log.delivery_type,
        status: log.delivery_status,
        erroDetalhado: log.error_message,
        codigoErro: log.codigo_erro,
        payloadReferencia: log.payload_referencia,
        metadataAdicional: log.metadata,
        tempoProcessamentoMs: log.tempo_processamento_ms,
        tentativas: log.retry_count || 1,
        correlationId: log.correlation_id,
        productId: log.product_id,
        saleId: log.sale_id,
        deliveredAt: log.delivered_at,
      }))
      
      const duration = Date.now() - startTime
      console.log(`[${requestId}] Returned ${nodes.length} logs in ${duration}ms`)
      
      return new Response(JSON.stringify({
        nodes,
        totalCount: count || 0,
        limit,
        offset,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // ===============================
    // GET /api/logs/delivery/{id} - Get single log
    // ===============================
    if (req.method === 'GET' && logId) {
      console.log(`[${requestId}] Fetching log: ${logId}`)
      
      let query = supabase
        .from('delivery_logs')
        .select('*')
        .eq('id', logId)
        .single()
      
      const { data: log, error: queryError } = await query
      
      if (queryError || !log) {
        console.log(`[${requestId}] Log not found: ${logId}`)
        return new Response(JSON.stringify({ error: 'Log not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Check access permission (admin or product owner)
      if (!isAdmin) {
        const { data: product } = await supabase
          .from('products')
          .select('user_id')
          .eq('id', log.product_id)
          .single()
        
        if (!product || product.user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Access denied' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
      
      const response = {
        id: log.id,
        createdAt: log.created_at,
        emailDestino: log.user_email,
        tipoEntrega: log.delivery_type,
        status: log.delivery_status,
        erroDetalhado: log.error_message,
        codigoErro: log.codigo_erro,
        payloadReferencia: log.payload_referencia,
        metadataAdicional: log.metadata,
        tempoProcessamentoMs: log.tempo_processamento_ms,
        tentativas: log.retry_count || 1,
        correlationId: log.correlation_id,
        productId: log.product_id,
        saleId: log.sale_id,
        subscriptionId: log.subscription_id,
        deliverableId: log.deliverable_id,
        userName: log.user_name,
        deliveredAt: log.delivered_at,
      }
      
      console.log(`[${requestId}] Returned log details`)
      
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // ===============================
    // POST /api/logs/delivery - Create log
    // ===============================
    if (req.method === 'POST') {
      console.log(`[${requestId}] Creating delivery log`)
      
      const body = await req.json()
      const validation = validateLogInput(body)
      
      if (!validation.valid || !validation.data) {
        console.log(`[${requestId}] Validation error: ${validation.error}`)
        return new Response(JSON.stringify({ error: validation.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      const input = validation.data
      
      // If product_id provided, verify ownership (non-admins)
      if (input.product_id && !isAdmin) {
        const { data: product } = await supabase
          .from('products')
          .select('user_id')
          .eq('id', input.product_id)
          .single()
        
        if (!product || product.user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'Access denied to product' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
      
      // Mask sensitive data in payloads
      const maskedPayload = input.payload_referencia 
        ? maskSensitiveData(input.payload_referencia)
        : null
      
      const maskedMetadata = input.metadata_adicional
        ? maskSensitiveData(input.metadata_adicional)
        : null
      
      // Generate correlation_id if not provided
      const correlationId = input.correlation_id || crypto.randomUUID()
      
      // Map status to database values
      const statusMap: Record<string, string> = {
        'sucesso': 'completed',
        'falha': 'failed',
        'pendente': 'pending',
      }
      const dbStatus = statusMap[input.status] || input.status
      
      // Insert log
      const { data: newLog, error: insertError } = await supabase
        .from('delivery_logs')
        .insert({
          user_email: input.email_destino,
          user_name: null,
          delivery_type: input.tipo_entrega,
          delivery_status: dbStatus,
          error_message: input.erro_detalhado || null,
          codigo_erro: input.codigo_erro || null,
          payload_referencia: maskedPayload,
          metadata: maskedMetadata,
          tempo_processamento_ms: input.tempo_processamento_ms || null,
          retry_count: input.tentativas || 1,
          correlation_id: correlationId,
          product_id: input.product_id || null,
          delivered_at: dbStatus === 'completed' ? new Date().toISOString() : null,
        })
        .select()
        .single()
      
      if (insertError) {
        console.error(`[${requestId}] Insert error:`, insertError)
        return new Response(JSON.stringify({ error: 'Failed to create log' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      const duration = Date.now() - startTime
      console.log(`[${requestId}] Created log ${newLog.id} in ${duration}ms`)
      
      return new Response(JSON.stringify({
        id: newLog.id,
        createdAt: newLog.created_at,
        emailDestino: newLog.user_email,
        tipoEntrega: newLog.delivery_type,
        status: newLog.delivery_status,
        correlationId: newLog.correlation_id,
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    // Method not allowed
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      requestId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
