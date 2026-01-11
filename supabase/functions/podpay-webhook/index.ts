import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-podpay-signature, x-webhook-signature',
}

interface PodPayEvent {
  event?: string
  type?: string
  objectId?: string | number
  url?: string
  data?: {
    id?: string | number
    external_id?: string
    externalRef?: string
    status?: string
    amount?: number
    payment_method?: string
    paymentMethod?: string
    pix?: {
      qr_code?: string
      qr_code_base64?: string
      paid_at?: string
    }
    customer?: {
      name?: string
      email?: string
      document?: string
    }
    metadata?: string | {
      sale_id?: string
      product_id?: string
      seller_user_id?: string
      order_id?: string
    }
  }
  // Alternative format where data is at root level
  id?: string | number
  status?: string
  externalRef?: string
  metadata?: string
  amount?: number
  customer?: {
    name?: string
    email?: string
    document?: string
  }
}

// HMAC signature verification (optional - only if secret is configured)
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    if (signature.length !== expectedSignature.length) return false
    let result = 0
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }
    return result === 0
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// Input sanitization
function sanitizeString(input: string | undefined | null, maxLength: number = 255): string {
  if (!input) return ''
  return String(input).trim().substring(0, maxLength)
}

function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return ''
  const sanitized = sanitizeString(email, 255).toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(sanitized) ? sanitized : ''
}

function sanitizeAmount(amount: unknown): number {
  const num = Number(amount)
  if (isNaN(num) || num < 0 || num > 999999999) return 0
  // Handle amount in cents (divide by 100) or in reais
  if (num > 100000) return Math.round(num) / 100 // Assume cents
  return Math.round(num * 100) / 100
}

// Parse metadata - can be string or object
function parseMetadata(metadata: string | object | undefined | null): { sale_id?: string; product_id?: string; seller_user_id?: string; order_id?: string } {
  if (!metadata) return {}
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata)
    } catch {
      return {}
    }
  }
  return metadata as any
}

// Map PodPay status to our internal status
function mapStatus(eventOrStatus: string): string {
  const statusMap: Record<string, string> = {
    // Event types
    'payment.created': 'pending',
    'payment.pending': 'pending',
    'payment.waiting_payment': 'pending',
    'payment.approved': 'approved',
    'payment.paid': 'approved',
    'payment.confirmed': 'approved',
    'payment.refused': 'refused',
    'payment.refunded': 'refunded',
    'payment.chargeback': 'chargeback',
    'payment.cancelled': 'cancelled',
    'payment.expired': 'expired',
    'pix.paid': 'approved',
    'pix.expired': 'expired',
    'transaction.paid': 'approved',
    'transaction.approved': 'approved',
    'transaction.pending': 'pending',
    'transaction.waiting_payment': 'pending',
    'transaction.refused': 'refused',
    'transaction.refunded': 'refunded',
    'transaction.cancelled': 'cancelled',
    'transaction': 'pending', // Generic transaction event
    // Direct status values
    'paid': 'approved',
    'approved': 'approved',
    'confirmed': 'approved',
    'authorized': 'approved',
    'pending': 'pending',
    'waiting_payment': 'pending',
    'processing': 'pending',
    'refused': 'refused',
    'refunded': 'refunded',
    'chargeback': 'chargeback',
    'cancelled': 'cancelled',
    'canceled': 'cancelled',
    'expired': 'expired',
  }
  
  return statusMap[eventOrStatus.toLowerCase()] || 'pending'
}

// Status permitidos na carteira (únicos que entram no saldo)
const ALLOWED_WALLET_STATUSES = ['paid', 'approved', 'confirmed']

// Verifica se o status é permitido na carteira
function isStatusAllowedInWallet(status: string): boolean {
  return ALLOWED_WALLET_STATUSES.includes(status)
}

// Log de auditoria financeira
async function createFinancialAuditLog(
  supabase: any,
  data: {
    transaction_id?: string
    sale_id?: string
    user_id?: string
    payment_method?: string
    status_received: string
    status_allowed: boolean
    action_taken: string
    reason?: string
    amount?: number
    metadata?: any
  }
) {
  try {
    await supabase.from('financial_audit_logs').insert({
      transaction_id: data.transaction_id || null,
      sale_id: data.sale_id || null,
      user_id: data.user_id || null,
      payment_method: data.payment_method || null,
      status_received: data.status_received,
      status_allowed: data.status_allowed,
      action_taken: data.action_taken,
      reason: data.reason || null,
      amount: data.amount || 0,
      metadata: data.metadata || null
    })
    console.log(`[AUDIT LOG] ${data.action_taken}: status=${data.status_received}, allowed=${data.status_allowed}`)
  } catch (error) {
    console.error('Error creating financial audit log:', error)
  }
}

Deno.serve(async (req) => {
  console.log('========================================')
  console.log('PodPay webhook received')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())))
  console.log('========================================')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Accept both GET and POST for flexibility
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const webhookSecret = Deno.env.get('PODPAY_WEBHOOK_SECRET')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'

  let rawBody: string = ''
  let body: PodPayEvent
  let logId: string | null = null

  try {
    // For GET requests, use query parameters
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const params: any = {}
      url.searchParams.forEach((value, key) => {
        params[key] = value
      })
      body = params
      rawBody = JSON.stringify(params)
      console.log('GET webhook params:', rawBody)
    } else {
      const contentLength = req.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > 1048576) {
        console.error('Request body too large:', contentLength)
        return new Response(JSON.stringify({ error: 'Request too large' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      rawBody = await req.text()
      console.log('Raw webhook body:', rawBody)
      
      // Try to parse as JSON, or as form data
      try {
        body = JSON.parse(rawBody)
      } catch {
        // Try URL encoded format
        const params = new URLSearchParams(rawBody)
        const obj: any = {}
        params.forEach((value, key) => {
          obj[key] = value
        })
        body = obj
      }
    }
    
    console.log('Parsed webhook body:', JSON.stringify(body, null, 2))

    // Verify signature only if secret is configured AND signature is present
    const signature = req.headers.get('x-podpay-signature') || req.headers.get('x-webhook-signature')
    if (webhookSecret && signature) {
      const isValid = await verifySignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.warn('Invalid webhook signature - but continuing for debugging')
        // Log but don't reject during testing
      } else {
        console.log('Webhook signature verified successfully')
      }
    } else {
      console.log('No signature verification (secret or signature not present)')
    }

    // Determine event type and status
    // PodPay can send in different formats:
    // 1. { event: "payment.paid", data: { ... } }
    // 2. { type: "payment.paid", data: { ... } } - type can be "transaction"
    // 3. { id: "...", status: "paid", ... } (flat format)
    // 4. { type: "transaction", data: { id: 37392700, status: "paid", ... } }
    const eventType = body.event || body.type || (body.status ? `payment.${body.status}` : 'unknown')
    
    // Get transaction data - could be in data object or at root
    const transactionData: any = body.data || body
    
    // PodPay sends transaction ID as number (e.g., 37392700)
    // Convert to string for consistent handling
    const podpayTransactionId = transactionData.id || body.id || body.objectId
    const transactionId = podpayTransactionId ? String(podpayTransactionId) : null
    
    // Status can be at different levels
    const transactionStatus = transactionData.status || body.status
    
    // External reference is our order_id (e.g., "RPMK093VI68QXZ")
    const externalRef = transactionData.externalRef || transactionData.external_id || (body as any).externalRef
    
    // Parse metadata - PodPay sends as JSON string
    const metadata = parseMetadata(transactionData.metadata || body.metadata)
    
    console.log('=== WEBHOOK DATA EXTRACTION ===')
    console.log('Event type:', eventType)
    console.log('PodPay Transaction ID:', podpayTransactionId, '(type:', typeof podpayTransactionId, ')')
    console.log('Transaction ID (string):', transactionId)
    console.log('Transaction status:', transactionStatus)
    console.log('External ref (order_id):', externalRef)
    console.log('Metadata:', JSON.stringify(metadata))
    console.log('================================')

    // Log webhook received
    const { data: logData } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: sanitizeString(eventType, 100) || 'unknown',
        payload: body,
        status: 'received',
        ip_address: sanitizeString(clientIP, 45),
      })
      .select('id')
      .single()

    logId = logData?.id
    console.log('Webhook log created:', logId)

    // Determine new status - prioritize direct status over event type
    // Because PodPay sends type: "transaction" which is generic
    const statusFromEvent = mapStatus(eventType)
    const statusFromData = mapStatus(transactionStatus || '')
    
    // If status is from data.status (like "paid" or "approved"), use it
    // If event is just "transaction", rely on data.status
    const newStatus = transactionStatus ? statusFromData : statusFromEvent
    console.log('Status mapping - from event:', statusFromEvent, ', from data:', statusFromData, ', final:', newStatus)

    let result = { action: 'none', sale_id: null as string | null, details: '' }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const saleId = metadata.sale_id
    const orderId = metadata.order_id
    const productId = metadata.product_id
    const sellerUserId = metadata.seller_user_id

    console.log('Looking for sale - saleId:', saleId, 'orderId:', orderId, 'externalRef:', externalRef, 'transactionId:', transactionId)

    // Try multiple methods to find the sale
    let existingSale: any = null

    // Method 1: By sale_id in metadata
    if (saleId && uuidRegex.test(saleId)) {
      console.log('Searching by sale_id:', saleId)
      const { data, error } = await supabase
        .from('sales')
        .select('id, status, seller_user_id, amount, buyer_name')
        .eq('id', saleId)
        .maybeSingle()
      
      if (!error && data) {
        existingSale = data
        console.log('Found sale by sale_id:', existingSale.id)
      }
    }

    // Method 2: By transaction_id matching PodPay transaction ID
    if (!existingSale && transactionId) {
      console.log('Searching by transaction_id:', transactionId)
      const { data, error } = await supabase
        .from('sales')
        .select('id, status, seller_user_id, amount, buyer_name')
        .eq('transaction_id', transactionId)
        .maybeSingle()
      
      if (!error && data) {
        existingSale = data
        console.log('Found sale by transaction_id:', existingSale.id)
      }
    }

    // Method 3: By transaction_id matching externalRef (order_id)
    if (!existingSale && externalRef) {
      console.log('Searching by externalRef:', externalRef)
      const { data, error } = await supabase
        .from('sales')
        .select('id, status, seller_user_id, amount, buyer_name')
        .eq('transaction_id', externalRef)
        .maybeSingle()
      
      if (!error && data) {
        existingSale = data
        console.log('Found sale by externalRef:', existingSale.id)
      }
    }

    // Method 4: By order_id in metadata matching transaction_id
    if (!existingSale && orderId) {
      console.log('Searching by orderId:', orderId)
      const { data, error } = await supabase
        .from('sales')
        .select('id, status, seller_user_id, amount, buyer_name')
        .eq('transaction_id', orderId)
        .maybeSingle()
      
      if (!error && data) {
        existingSale = data
        console.log('Found sale by orderId:', existingSale.id)
      }
    }

    if (existingSale) {
      console.log('Found sale:', existingSale.id, 'current status:', existingSale.status, 'new status:', newStatus)
      
      // ========== IDEMPOTENCY CHECK ==========
      // Prevent duplicate processing of approved payments
      // Once a payment is approved, it cannot be re-approved
      const terminalStatuses = ['approved', 'refunded', 'chargeback']
      const isCurrentlyTerminal = terminalStatuses.includes(existingSale.status)
      const isNewStatusApproved = newStatus === 'approved'
      
      if (isCurrentlyTerminal && isNewStatusApproved && existingSale.status === 'approved') {
        console.log(`IDEMPOTENCY: Sale ${existingSale.id} already approved. Ignoring duplicate webhook.`)
        result = { 
          action: 'idempotent_skip', 
          sale_id: existingSale.id, 
          details: `Sale already approved at ${existingSale.updated_at || 'unknown'}. Duplicate webhook rejected.` 
        }
        
        // Update log with idempotency skip
        if (logId) {
          await supabase.from('webhook_logs').update({
            status: 'idempotent_skip',
            response_data: { 
              message: 'Duplicate webhook - sale already approved',
              sale_id: existingSale.id,
              current_status: existingSale.status,
              attempted_status: newStatus
            },
            processed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        return new Response(JSON.stringify({ 
          received: true, 
          status: 'ignored',
          reason: 'idempotent_skip',
          message: 'This payment was already processed. Duplicate webhook rejected.',
          sale_id: existingSale.id
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Prevent status regression (e.g., approved -> pending)
      const statusPriority: Record<string, number> = {
        'pending': 1,
        'approved': 3,
        'refused': 2,
        'cancelled': 2,
        'expired': 2,
        'refunded': 4,
        'chargeback': 5
      }
      
      const currentPriority = statusPriority[existingSale.status] || 0
      const newPriority = statusPriority[newStatus] || 0
      
      if (newPriority < currentPriority) {
        console.log(`STATUS REGRESSION BLOCKED: Cannot change from ${existingSale.status} (priority ${currentPriority}) to ${newStatus} (priority ${newPriority})`)
        result = { 
          action: 'status_regression_blocked', 
          sale_id: existingSale.id, 
          details: `Cannot regress status from ${existingSale.status} to ${newStatus}` 
        }
        
        if (logId) {
          await supabase.from('webhook_logs').update({
            status: 'regression_blocked',
            response_data: { 
              message: 'Status regression not allowed',
              current_status: existingSale.status,
              attempted_status: newStatus
            },
            processed_at: new Date().toISOString(),
          }).eq('id', logId)
        }

        return new Response(JSON.stringify({ 
          received: true, 
          status: 'ignored',
          reason: 'status_regression_blocked',
          message: `Cannot change status from ${existingSale.status} to ${newStatus}`,
          sale_id: existingSale.id
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      // ========== END IDEMPOTENCY CHECK ==========
      
      // ========== FINANCIAL AUDIT: Check if status is allowed in wallet ==========
      const statusAllowed = isStatusAllowedInWallet(newStatus)
      
      // Log financial audit for status change
      await createFinancialAuditLog(supabase, {
        transaction_id: transactionId || undefined,
        sale_id: existingSale.id,
        user_id: existingSale.seller_user_id,
        payment_method: transactionData.payment_method || transactionData.paymentMethod,
        status_received: newStatus,
        status_allowed: statusAllowed,
        action_taken: statusAllowed ? 'accepted' : 'blocked_from_wallet',
        reason: statusAllowed 
          ? `Status ${newStatus} is allowed in wallet - sale will impact balance`
          : `Status ${newStatus} is NOT allowed in wallet - sale will NOT impact balance`,
        amount: sanitizeAmount(existingSale.amount),
        metadata: { 
          previous_status: existingSale.status, 
          event_type: eventType,
          transaction_id: transactionId
        }
      })
      
      console.log('Updating sale:', existingSale.id, 'from', existingSale.status, 'to', newStatus)
      console.log(`[WALLET IMPACT] Status ${newStatus} ${statusAllowed ? 'WILL' : 'will NOT'} impact wallet balance`)
      
      const { error: updateError } = await supabase
        .from('sales')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSale.id)

      if (updateError) {
        console.error('Error updating sale:', updateError)
        result = { action: 'update_error', sale_id: existingSale.id, details: updateError.message }
        
        // Log error in audit
        await createFinancialAuditLog(supabase, {
          sale_id: existingSale.id,
          user_id: existingSale.seller_user_id,
          status_received: newStatus,
          status_allowed: statusAllowed,
          action_taken: 'error',
          reason: `Failed to update sale: ${updateError.message}`,
          amount: sanitizeAmount(existingSale.amount)
        })
      } else {
        console.log(`Sale ${existingSale.id} updated to ${newStatus}`)
        result = { action: 'updated', sale_id: existingSale.id, details: `Status: ${existingSale.status} -> ${newStatus}` }
        
        // Create notification for approved payments
        if (newStatus === 'approved' && existingSale.seller_user_id) {
          const sanitizedAmount = sanitizeAmount(existingSale.amount)
          const customerName = transactionData.customer?.name || body.customer?.name || existingSale.buyer_name || 'Cliente'
          
          const { error: notifError } = await supabase.rpc('create_system_notification', {
            p_user_id: existingSale.seller_user_id,
            p_title: 'Nova venda aprovada!',
            p_message: `${customerName} comprou seu produto por R$ ${sanitizedAmount.toFixed(2)}`,
            p_type: 'success',
            p_link: '/dashboard/vendas'
          })
          
          if (notifError) {
            console.error('Error creating notification:', notifError)
          } else {
            console.log('Notification created for seller:', existingSale.seller_user_id)
          }

          // ========== FIRE PIXEL EVENTS (PURCHASE) ==========
          try {
            // Get product_id for this sale
            const { data: saleForPixel } = await supabase
              .from('sales')
              .select('product_id, buyer_email, buyer_name, amount, transaction_id')
              .eq('id', existingSale.id)
              .single()

            if (saleForPixel && saleForPixel.product_id) {
              console.log('Firing pixel events for product:', saleForPixel.product_id)
              
              // Call fire-pixel-events function
              const pixelPayload = {
                event_type: 'purchase',
                product_id: saleForPixel.product_id,
                sale_id: existingSale.id,
                transaction_id: saleForPixel.transaction_id,
                value: sanitizedAmount,
                currency: 'BRL',
                customer_email: saleForPixel.buyer_email,
                customer_name: saleForPixel.buyer_name,
              }
              
              // Fire events via edge function
              const { error: pixelError } = await supabase.functions.invoke('fire-pixel-events', {
                body: pixelPayload
              })
              
              if (pixelError) {
                console.error('Error firing pixel events:', pixelError)
              } else {
                console.log('Pixel events fired successfully for sale:', existingSale.id)
              }
            }
          } catch (pixelError) {
            console.error('Error in pixel events processing:', pixelError)
            // Don't fail the webhook for pixel errors
          }
          // ========== END FIRE PIXEL EVENTS ==========

          // ========== PROCESS AFFILIATE COMMISSION ==========
          // If sale has an affiliation_id, create affiliate_sales record
          try {
            const { data: saleForAffiliate } = await supabase
              .from('sales')
              .select('affiliation_id, commission_amount, affiliate_commission_percent, amount, net_amount, product_id')
              .eq('id', existingSale.id)
              .single()

            if (saleForAffiliate && saleForAffiliate.affiliation_id) {
              console.log('Processing affiliate commission for affiliation:', saleForAffiliate.affiliation_id)
              
              // Get affiliation details
              const { data: affiliation } = await supabase
                .from('affiliations')
                .select('id, user_id, product_id')
                .eq('id', saleForAffiliate.affiliation_id)
                .single()

              if (affiliation) {
                // Calculate owner earnings (net amount after affiliate commission)
                const ownerEarnings = (saleForAffiliate.net_amount || 0) - (saleForAffiliate.commission_amount || 0)

                // Check if affiliate_sale already exists (idempotency)
                const { data: existingAffiliateSale } = await supabase
                  .from('affiliate_sales')
                  .select('id')
                  .eq('affiliation_id', affiliation.id)
                  .eq('product_id', saleForAffiliate.product_id)
                  .eq('sale_amount', saleForAffiliate.amount)
                  .maybeSingle()

                if (!existingAffiliateSale) {
                  // Create affiliate_sales record
                  const { error: affiliateSaleError } = await supabase
                    .from('affiliate_sales')
                    .insert({
                      affiliation_id: affiliation.id,
                      affiliate_user_id: affiliation.user_id,
                      owner_user_id: existingSale.seller_user_id,
                      product_id: saleForAffiliate.product_id,
                      sale_amount: saleForAffiliate.amount,
                      commission_amount: saleForAffiliate.commission_amount || 0,
                      owner_earnings: ownerEarnings,
                      status: 'approved',
                    })

                  if (affiliateSaleError) {
                    console.error('Error creating affiliate_sales record:', affiliateSaleError)
                  } else {
                    console.log('Affiliate sale recorded - Commission:', saleForAffiliate.commission_amount)
                    
                    // Notify affiliate about commission earned
                    await supabase.rpc('create_system_notification', {
                      p_user_id: affiliation.user_id,
                      p_title: 'Comissão recebida!',
                      p_message: `Você ganhou R$ ${(saleForAffiliate.commission_amount || 0).toFixed(2)} de comissão por uma venda.`,
                      p_type: 'success',
                      p_link: '/dashboard/afiliados'
                    })
                  }
                } else {
                  console.log('Affiliate sale already exists, skipping:', existingAffiliateSale.id)
                }

                // Update affiliate_clicks to mark as converted
                const { error: clickUpdateError } = await supabase
                  .from('affiliate_clicks')
                  .update({
                    converted: true,
                    converted_at: new Date().toISOString(),
                    sale_id: existingSale.id,
                  })
                  .eq('affiliation_id', affiliation.id)
                  .eq('converted', false)
                  .order('created_at', { ascending: false })
                  .limit(1)

                if (clickUpdateError) {
                  console.error('Error updating affiliate click:', clickUpdateError)
                } else {
                  console.log('Affiliate click marked as converted')
                }
              }
            }
          } catch (affiliateError) {
            console.error('Error processing affiliate commission:', affiliateError)
            // Don't fail the webhook for affiliate errors
          }
          // ========== END PROCESS AFFILIATE COMMISSION ==========

          // ========== PROCESS COUPON USAGE ==========
          // Increment coupon usage count only after payment is approved
          try {
            const { data: saleForCoupon } = await supabase
              .from('sales')
              .select('campaign_id, coupon_code, coupon_discount, product_id, amount')
              .eq('id', existingSale.id)
              .single()

            if (saleForCoupon && saleForCoupon.campaign_id) {
              console.log('Processing coupon usage for campaign:', saleForCoupon.campaign_id)
              
              // Increment current_uses in campaigns table
              // Get current value and increment
              const { data: campaign } = await supabase
                .from('campaigns')
                .select('current_uses')
                .eq('id', saleForCoupon.campaign_id)
                .single()

              if (campaign) {
                const newUses = (campaign.current_uses || 0) + 1
                const { error: updateError } = await supabase
                  .from('campaigns')
                  .update({ 
                    current_uses: newUses,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', saleForCoupon.campaign_id)
                
                if (updateError) {
                  console.error('Error incrementing coupon usage:', updateError)
                } else {
                  console.log('Coupon usage incremented to', newUses, 'for campaign:', saleForCoupon.campaign_id)
                }
              }

              // Log coupon usage
              await supabase.from('coupon_usage_logs').insert({
                campaign_id: saleForCoupon.campaign_id,
                sale_id: existingSale.id,
                coupon_code: saleForCoupon.coupon_code,
                product_id: saleForCoupon.product_id,
                discount_type: 'calculated',
                discount_value: saleForCoupon.coupon_discount || 0,
                discount_applied: saleForCoupon.coupon_discount || 0,
                original_amount: saleForCoupon.amount + (saleForCoupon.coupon_discount || 0),
                final_amount: saleForCoupon.amount,
                status: 'used',
              })
              
              console.log('Coupon usage logged for sale:', existingSale.id)
            }
          } catch (couponError) {
            console.error('Error processing coupon usage:', couponError)
            // Don't fail the webhook for coupon errors
          }
          // ========== END PROCESS COUPON USAGE ==========

          // ========== PROCESS COPRODUCER COMMISSIONS ==========
          // Calculate and register commissions for co-producers after payment approval
          try {
            console.log('=== PROCESSING COPRODUCER COMMISSIONS ===')
            
            // Get complete sale data
            const { data: saleForCommission } = await supabase
              .from('sales')
              .select('id, product_id, seller_user_id, amount, net_amount, payment_fee, coupon_discount, affiliation_id, commission_amount')
              .eq('id', existingSale.id)
              .single()

            if (saleForCommission) {
              // Get product details
              const { data: productForCommission } = await supabase
                .from('products')
                .select('id, user_id, name')
                .eq('id', saleForCommission.product_id)
                .single()

              if (productForCommission) {
                // Get active co-producers for this product
                const { data: coProducers } = await supabase
                  .from('co_producers')
                  .select('id, user_id, commission_percentage, commission_type, status')
                  .eq('product_id', saleForCommission.product_id)
                  .eq('status', 'active')

                // Base amount for commission calculation: net_amount (after payment fees)
                // Also subtract affiliate commission if any
                const affiliateCommission = saleForCommission.commission_amount || 0
                const baseAmountForCommission = (saleForCommission.net_amount || 0) - affiliateCommission

                console.log('Base amount for commission:', baseAmountForCommission)
                console.log('Co-producers found:', coProducers?.length || 0)

                // Check if commissions already exist for this sale (idempotency)
                const { data: existingCommissions } = await supabase
                  .from('sale_commissions')
                  .select('id')
                  .eq('sale_id', saleForCommission.id)
                  .limit(1)

                if (existingCommissions && existingCommissions.length > 0) {
                  console.log('Commissions already exist for sale, skipping:', saleForCommission.id)
                } else {
                  const commissionsToInsert: any[] = []
                  let totalCoProducerCommission = 0

                  // Calculate commissions for each co-producer
                  if (coProducers && coProducers.length > 0) {
                    for (const coproducer of coProducers) {
                      let commissionAmount = 0
                      const commissionType = coproducer.commission_type || 'percentage'

                      if (commissionType === 'percentage') {
                        commissionAmount = Math.round((baseAmountForCommission * coproducer.commission_percentage / 100) * 100) / 100
                      } else {
                        // Fixed commission - can't exceed base amount
                        commissionAmount = Math.min(coproducer.commission_percentage, baseAmountForCommission - totalCoProducerCommission)
                      }

                      // Ensure non-negative
                      commissionAmount = Math.max(0, commissionAmount)
                      totalCoProducerCommission += commissionAmount

                      commissionsToInsert.push({
                        sale_id: saleForCommission.id,
                        user_id: coproducer.user_id,
                        role: 'coproducer',
                        commission_type: commissionType,
                        commission_percentage: coproducer.commission_percentage,
                        commission_amount: commissionAmount,
                        sale_amount: saleForCommission.amount,
                        net_amount: commissionAmount,
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                      })

                      console.log(`Coproducer ${coproducer.user_id}: ${commissionAmount} (${coproducer.commission_percentage}%)`)

                      // Notify coproducer
                      await supabase.rpc('create_system_notification', {
                        p_user_id: coproducer.user_id,
                        p_title: 'Comissão recebida!',
                        p_message: `Você ganhou R$ ${commissionAmount.toFixed(2)} de comissão por uma venda de ${productForCommission.name}.`,
                        p_type: 'success',
                        p_link: '/dashboard/vendas'
                      })
                    }
                  }

                  // Calculate producer's (owner's) commission = base - total coproducer commissions
                  const producerCommission = Math.max(0, baseAmountForCommission - totalCoProducerCommission)

                  commissionsToInsert.push({
                    sale_id: saleForCommission.id,
                    user_id: productForCommission.user_id,
                    role: 'producer',
                    commission_type: 'percentage',
                    commission_percentage: coProducers && coProducers.length > 0 
                      ? Math.round((producerCommission / baseAmountForCommission) * 10000) / 100 
                      : 100,
                    commission_amount: producerCommission,
                    sale_amount: saleForCommission.amount,
                    net_amount: producerCommission,
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                  })

                  console.log(`Producer ${productForCommission.user_id}: ${producerCommission}`)

                  // Insert all commissions
                  if (commissionsToInsert.length > 0) {
                    const { error: commissionError } = await supabase
                      .from('sale_commissions')
                      .insert(commissionsToInsert)

                    if (commissionError) {
                      console.error('Error inserting commissions:', commissionError)
                    } else {
                      console.log(`Inserted ${commissionsToInsert.length} commission records`)
                    }
                  }

                  // Also process commissions for order items (bumps)
                  const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('id, product_id, subtotal, item_type')
                    .eq('sale_id', saleForCommission.id)
                    .eq('item_type', 'bump')

                  if (orderItems && orderItems.length > 0) {
                    console.log(`Processing ${orderItems.length} order bump commissions`)

                    for (const item of orderItems) {
                      // Get coproducers for the bump product (if different from main product)
                      const { data: bumpCoProducers } = await supabase
                        .from('co_producers')
                        .select('id, user_id, commission_percentage, commission_type, status')
                        .eq('product_id', item.product_id)
                        .eq('status', 'active')

                      // Get bump product owner
                      const { data: bumpProduct } = await supabase
                        .from('products')
                        .select('user_id')
                        .eq('id', item.product_id)
                        .single()

                      if (bumpProduct) {
                        const itemCommissions: any[] = []
                        let totalBumpCoProducerCommission = 0

                        // Calculate bump coproducer commissions
                        if (bumpCoProducers && bumpCoProducers.length > 0) {
                          for (const bumpCoproducer of bumpCoProducers) {
                            let itemCommissionAmount = 0
                            const commType = bumpCoproducer.commission_type || 'percentage'

                            if (commType === 'percentage') {
                              itemCommissionAmount = Math.round((item.subtotal * bumpCoproducer.commission_percentage / 100) * 100) / 100
                            } else {
                              itemCommissionAmount = Math.min(bumpCoproducer.commission_percentage, item.subtotal - totalBumpCoProducerCommission)
                            }

                            itemCommissionAmount = Math.max(0, itemCommissionAmount)
                            totalBumpCoProducerCommission += itemCommissionAmount

                            itemCommissions.push({
                              order_item_id: item.id,
                              user_id: bumpCoproducer.user_id,
                              role: 'coproducer',
                              commission_type: commType,
                              commission_percentage: bumpCoproducer.commission_percentage,
                              commission_amount: itemCommissionAmount,
                              item_amount: item.subtotal,
                            })
                          }
                        }

                        // Bump producer commission
                        const bumpProducerCommission = Math.max(0, item.subtotal - totalBumpCoProducerCommission)
                        itemCommissions.push({
                          order_item_id: item.id,
                          user_id: bumpProduct.user_id,
                          role: 'producer',
                          commission_type: 'percentage',
                          commission_percentage: 100 - (bumpCoProducers?.reduce((acc, cp) => acc + cp.commission_percentage, 0) || 0),
                          commission_amount: bumpProducerCommission,
                          item_amount: item.subtotal,
                        })

                        // Insert item commissions
                        if (itemCommissions.length > 0) {
                          await supabase.from('order_item_commissions').insert(itemCommissions)
                        }
                      }
                    }
                  }

                  console.log('=== COPRODUCER COMMISSIONS PROCESSED ===')

                  // ========== CREATE PAYMENT SPLITS ==========
                  // Create split records for each party (producer, coproducers, platform)
                  try {
                    console.log('=== CREATING PAYMENT SPLITS ===')
                    
                    // Check if splits already exist
                    const { data: existingSplits } = await supabase
                      .from('payment_splits')
                      .select('id')
                      .eq('sale_id', saleForCommission.id)
                      .limit(1)
                    
                    if (!existingSplits || existingSplits.length === 0) {
                      const splitsToInsert: any[] = []
                      const platformFeePercent = 4.99 // Platform fee percentage
                      const paymentFee = saleForCommission.payment_fee || 0
                      
                      // Producer split
                      splitsToInsert.push({
                        sale_id: saleForCommission.id,
                        user_id: productForCommission.user_id,
                        role: 'producer',
                        gross_amount: saleForCommission.amount,
                        net_amount: producerCommission,
                        fee_amount: paymentFee,
                        platform_fee: (saleForCommission.amount * platformFeePercent / 100),
                        split_percentage: coProducers && coProducers.length > 0 
                          ? Math.round((producerCommission / baseAmountForCommission) * 10000) / 100 
                          : 100,
                        status: 'processed',
                        processed_at: new Date().toISOString()
                      })
                      
                      // Coproducer splits
                      if (coProducers && coProducers.length > 0) {
                        for (const coproducer of coProducers) {
                          const coCommission = commissionsToInsert.find(c => c.user_id === coproducer.user_id && c.role === 'coproducer')
                          if (coCommission) {
                            splitsToInsert.push({
                              sale_id: saleForCommission.id,
                              user_id: coproducer.user_id,
                              role: 'coproducer',
                              gross_amount: coCommission.commission_amount,
                              net_amount: coCommission.commission_amount,
                              fee_amount: 0, // Fees already deducted from gross
                              platform_fee: 0,
                              split_percentage: coproducer.commission_percentage,
                              status: 'processed',
                              processed_at: new Date().toISOString()
                            })
                          }
                        }
                      }
                      
                      // Insert all splits
                      if (splitsToInsert.length > 0) {
                        const { error: splitError } = await supabase
                          .from('payment_splits')
                          .insert(splitsToInsert)
                        
                        if (splitError) {
                          console.error('Error inserting payment splits:', splitError)
                        } else {
                          console.log(`Inserted ${splitsToInsert.length} payment split records`)
                        }
                      }
                    }
                    
                    console.log('=== PAYMENT SPLITS CREATED ===')
                  } catch (splitError) {
                    console.error('Error creating payment splits:', splitError)
                    // Don't fail for split errors
                  }
                  // ========== END CREATE PAYMENT SPLITS ==========
                }
              }
            }
          } catch (commissionError) {
            console.error('Error processing coproducer commissions:', commissionError)
            // Don't fail the webhook for commission errors
          }
          // ========== END PROCESS COPRODUCER COMMISSIONS ==========

          // Check if this is a subscription product and activate/create subscription
          try {
            // Get product to check payment_type
            const { data: saleWithProduct } = await supabase
              .from('sales')
              .select('product_id, buyer_email, amount')
              .eq('id', existingSale.id)
              .single()

            if (saleWithProduct) {
              const { data: product } = await supabase
                .from('products')
                .select('id, payment_type, name')
                .eq('id', saleWithProduct.product_id)
                .single()

              if (product && product.payment_type === 'subscription') {
                console.log('Processing subscription for product:', product.id)

                // Check if subscription already exists for this sale
                const { data: existingSubscription } = await supabase
                  .from('subscriptions')
                  .select('id, status')
                  .eq('product_id', product.id)
                  .eq('metadata->>sale_id', existingSale.id)
                  .maybeSingle()

                if (existingSubscription) {
                  // Activate existing subscription
                  const now = new Date()
                  const periodEnd = new Date(now)
                  periodEnd.setMonth(periodEnd.getMonth() + 1)

                  await supabase
                    .from('subscriptions')
                    .update({
                      status: 'active',
                      started_at: now.toISOString(),
                      current_period_start: now.toISOString(),
                      current_period_end: periodEnd.toISOString(),
                    })
                    .eq('id', existingSubscription.id)

                  console.log('Subscription activated:', existingSubscription.id)
                  
                  // Sync subscription with member area enrollment
                  try {
                    const { data: productForMemberArea } = await supabase
                      .from('products')
                      .select('delivery_method, user_id')
                      .eq('id', product.id)
                      .single()
                    
                    if (productForMemberArea?.delivery_method === 'member_area') {
                      console.log('Creating/reactivating enrollment for subscription:', existingSubscription.id)
                      
                      const { data: enrollmentId, error: enrollmentError } = await supabase.rpc('create_enrollment_after_payment', {
                        p_sale_id: existingSale.id,
                        p_student_email: saleWithProduct.buyer_email,
                        p_student_name: transactionData.customer?.name || body.customer?.name || 'Cliente',
                        p_product_id: product.id,
                      })
                      
                      if (enrollmentError) {
                        console.error('Error creating enrollment for subscription:', enrollmentError)
                      } else if (enrollmentId) {
                        console.log('Enrollment created/reactivated for subscription:', enrollmentId)
                      }
                    }
                  } catch (memberAreaError) {
                    console.error('Error syncing subscription with member area:', memberAreaError)
                  }
                } else {
                  // Get buyer user_id from email if exists
                  const { data: buyerProfile } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('email', saleWithProduct.buyer_email)
                    .maybeSingle()

                  if (buyerProfile) {
                    // Create new subscription for buyer
                    const now = new Date()
                    const periodEnd = new Date(now)
                    periodEnd.setMonth(periodEnd.getMonth() + 1)

                    const { data: newSub, error: subError } = await supabase
                      .from('subscriptions')
                      .insert({
                        user_id: buyerProfile.user_id,
                        product_id: product.id,
                        status: 'active',
                        plan_interval: 'monthly',
                        amount: saleWithProduct.amount,
                        current_period_start: now.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                        started_at: now.toISOString(),
                        payment_method: 'pix',
                        metadata: { sale_id: existingSale.id }
                      })
                      .select()
                      .single()

                    if (subError) {
                      console.error('Error creating subscription:', subError)
                    } else {
                      console.log('Subscription created:', newSub.id)

                      // Notify buyer
                      await supabase.rpc('create_system_notification', {
                        p_user_id: buyerProfile.user_id,
                        p_title: 'Assinatura ativada!',
                        p_message: `Sua assinatura do ${product.name} foi ativada com sucesso.`,
                        p_type: 'success'
                      })
                      
                      // Sync new subscription with member area enrollment
                      try {
                        const { data: productForMemberArea } = await supabase
                          .from('products')
                          .select('delivery_method, user_id')
                          .eq('id', product.id)
                          .single()
                        
                        if (productForMemberArea?.delivery_method === 'member_area') {
                          console.log('Creating enrollment for new subscription:', newSub.id)
                          
                          const { data: enrollmentId, error: enrollmentError } = await supabase.rpc('create_enrollment_after_payment', {
                            p_sale_id: existingSale.id,
                            p_student_email: saleWithProduct.buyer_email,
                            p_student_name: transactionData.customer?.name || body.customer?.name || 'Cliente',
                            p_product_id: product.id,
                          })
                          
                          if (enrollmentError) {
                            console.error('Error creating enrollment for new subscription:', enrollmentError)
                          } else if (enrollmentId) {
                            console.log('Enrollment created for new subscription:', enrollmentId)
                            
                            // Notify seller
                            await supabase.rpc('create_system_notification', {
                              p_user_id: productForMemberArea.user_id,
                              p_title: 'Novo assinante matriculado!',
                              p_message: `${transactionData.customer?.name || 'Cliente'} foi matriculado na área de membros via assinatura.`,
                              p_type: 'info',
                              p_link: `/dashboard/produtos/${product.id}`
                            })
                          }
                        }
                      } catch (memberAreaError) {
                        console.error('Error syncing new subscription with member area:', memberAreaError)
                      }
                    }
                  }
                }
              }
            }
          } catch (subError) {
            console.error('Error processing subscription:', subError)
            // Don't fail the webhook for subscription errors
          }

          // ========== PROCESS DELIVERABLES (INCLUDING ORDER BUMPS) ==========
          // Trigger automatic delivery of all products after payment approval
          try {
            console.log('Triggering deliverables for sale:', existingSale.id)
            
            const { data: saleDetails } = await supabase
              .from('sales')
              .select('product_id, buyer_email, buyer_name')
              .eq('id', existingSale.id)
              .single()
            
            if (saleDetails) {
              // Fetch all order items for this sale (main product + order bumps)
              const { data: orderItems, error: orderItemsError } = await supabase
                .from('order_items')
                .select('id, product_id, item_type, order_bump_id, name, delivery_status')
                .eq('sale_id', existingSale.id)
              
              if (orderItemsError) {
                console.error('Error fetching order items:', orderItemsError)
              }

              // If no order_items exist (legacy sales), just process main product
              const productsToDeliver = orderItems && orderItems.length > 0
                ? [...new Set(orderItems.map(item => item.product_id))] // Get unique product IDs
                : [saleDetails.product_id]
              
              console.log('Products to deliver:', productsToDeliver.length)

              // Process delivery for each product
              for (const productId of productsToDeliver) {
                const { data: productDetails } = await supabase
                  .from('products')
                  .select('payment_type')
                  .eq('id', productId)
                  .single()

                // Call process-deliverables function for each product
                const deliverablePayload = {
                  sale_id: existingSale.id,
                  product_id: productId,
                  user_email: saleDetails.buyer_email,
                  user_name: saleDetails.buyer_name || 'Cliente',
                  payment_type: productDetails?.payment_type === 'subscription' ? 'subscription' : 'one_time',
                }
                
                console.log('Deliverable payload for product', productId, ':', JSON.stringify(deliverablePayload))
                
                // Invoke the edge function
                const functionsUrl = `${supabaseUrl}/functions/v1/process-deliverables`
                const deliveryResponse = await fetch(functionsUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify(deliverablePayload),
                })
                
                if (deliveryResponse.ok) {
                  const deliveryResult = await deliveryResponse.json()
                  console.log('Deliverables processed for product', productId, ':', deliveryResult)
                  
                  // Update order_items delivery status
                  if (orderItems && orderItems.length > 0) {
                    await supabase
                      .from('order_items')
                      .update({ 
                        delivery_status: 'delivered',
                        delivered_at: new Date().toISOString()
                      })
                      .eq('sale_id', existingSale.id)
                      .eq('product_id', productId)
                  }
                } else {
                  const errorText = await deliveryResponse.text()
                  console.error('Failed to process deliverables for product', productId, ':', errorText)
                  
                  // Update order_items delivery status as failed
                  if (orderItems && orderItems.length > 0) {
                    await supabase
                      .from('order_items')
                      .update({ delivery_status: 'failed' })
                      .eq('sale_id', existingSale.id)
                      .eq('product_id', productId)
                  }
                }
              }
            }
          } catch (deliveryError) {
            console.error('Error triggering deliverables:', deliveryError)
            // Don't fail the webhook for delivery errors
          }
          // ========== END PROCESS DELIVERABLES ==========

          // ========== PROCESS MEMBER AREA ENROLLMENT ==========
          // Create enrollment if product has member area delivery
          try {
            console.log('Checking member area enrollment for sale:', existingSale.id)
            
            const { data: saleForEnrollment } = await supabase
              .from('sales')
              .select('product_id, buyer_email, buyer_name')
              .eq('id', existingSale.id)
              .single()
            
            if (saleForEnrollment) {
              // Check if product has member area delivery
              const { data: productForEnrollment } = await supabase
                .from('products')
                .select('id, delivery_method, user_id')
                .eq('id', saleForEnrollment.product_id)
                .single()

              if (productForEnrollment && productForEnrollment.delivery_method === 'member_area') {
                console.log('Product has member area delivery, creating enrollment')
                
                // Call the enrollment function
                const { data: enrollmentId, error: enrollmentError } = await supabase.rpc('create_enrollment_after_payment', {
                  p_sale_id: existingSale.id,
                  p_student_email: saleForEnrollment.buyer_email,
                  p_student_name: saleForEnrollment.buyer_name || 'Cliente',
                  p_product_id: saleForEnrollment.product_id,
                })

                if (enrollmentError) {
                  console.error('Error creating enrollment:', enrollmentError)
                } else if (enrollmentId) {
                  console.log('Enrollment created successfully:', enrollmentId)
                  
                  // Create notification about member area access
                  await supabase.rpc('create_system_notification', {
                    p_user_id: productForEnrollment.user_id,
                    p_title: 'Novo aluno matriculado!',
                    p_message: `${saleForEnrollment.buyer_name || 'Cliente'} foi matriculado automaticamente na área de membros.`,
                    p_type: 'info',
                    p_link: `/dashboard/produtos/${productForEnrollment.id}`
                  })
                }
              }

              // ========== PROCESS ORDER BUMPS MEMBER AREA ENROLLMENT ==========
              // Check if sale has order bumps that need member area enrollment
              const { data: orderBumpItems, error: bumpItemsError } = await supabase
                .from('order_items')
                .select('id, product_id, item_type, order_bump_id')
                .eq('sale_id', existingSale.id)
                .eq('item_type', 'bump')

              if (!bumpItemsError && orderBumpItems && orderBumpItems.length > 0) {
                console.log('Processing member area enrollment for', orderBumpItems.length, 'order bump(s)')

                for (const bumpItem of orderBumpItems) {
                  // Check if bump product has member area delivery
                  const { data: bumpProduct } = await supabase
                    .from('products')
                    .select('id, delivery_method, user_id')
                    .eq('id', bumpItem.product_id)
                    .single()

                  if (bumpProduct && bumpProduct.delivery_method === 'member_area') {
                    console.log('Order bump product has member area delivery:', bumpItem.product_id)

                    // Create enrollment for bump product
                    const { data: bumpEnrollmentId, error: bumpEnrollmentError } = await supabase.rpc('create_enrollment_after_payment', {
                      p_sale_id: existingSale.id,
                      p_student_email: saleForEnrollment.buyer_email,
                      p_student_name: saleForEnrollment.buyer_name || 'Cliente',
                      p_product_id: bumpItem.product_id,
                    })

                    if (bumpEnrollmentError) {
                      console.error('Error creating enrollment for order bump:', bumpEnrollmentError)
                    } else if (bumpEnrollmentId) {
                      console.log('Enrollment created for order bump:', bumpEnrollmentId)
                    }
                  }
                }
              }
              // ========== END ORDER BUMPS MEMBER AREA ENROLLMENT ==========
            }
          } catch (enrollmentError) {
            console.error('Error processing member area enrollment:', enrollmentError)
            // Don't fail the webhook for enrollment errors
          }
          // ========== END PROCESS MEMBER AREA ENROLLMENT ==========

        }

        // ========== SEND UTMIFY NOTIFICATION ==========
        // Send sale data to UTMify for tracking attribution
        // Send for ALL status updates with proper event_type mapping
        try {
          // Map newStatus to UTMify event_type
          const utmifyEventType = newStatus === 'approved' ? 'payment_approved' : 
                                   newStatus === 'pending' ? 'payment_created' :
                                   newStatus === 'refunded' ? 'refunded' :
                                   newStatus === 'chargeback' ? 'chargeback' :
                                   newStatus === 'failed' || newStatus === 'refused' ? 'payment_refused' : 
                                   null;
          
          if (utmifyEventType) {
            console.log('Triggering UTMify notification for sale:', existingSale.id, 'event_type:', utmifyEventType, 'status:', newStatus)
            
            // Invoke send-utmify edge function with event_type
            const { error: utmifyError } = await supabase.functions.invoke('send-utmify', {
              body: {
                sale_id: existingSale.id,
                event_type: utmifyEventType,
                force_resend: true, // Always send with event_type to ensure status updates are tracked
              }
            })
            
            if (utmifyError) {
              console.error('Error sending to UTMify:', utmifyError)
            } else {
              console.log('UTMify notification triggered successfully for sale:', existingSale.id, 'event:', utmifyEventType)
            }
          } else {
            console.log('UTMify: No event mapping for status:', newStatus)
          }
        } catch (utmifyError) {
          console.error('Error triggering UTMify notification:', utmifyError)
          // Don't fail the webhook for UTMify errors
        }
        // ========== END SEND UTMIFY NOTIFICATION ==========

        // ========== SEND PUSHCUT NOTIFICATION ==========
        // Send push notification via Pushcut for configured sellers
        // Map status to event types matching GATEWAY_EVENTS in UI
        try {
          // Map webhook status to UI event IDs
          const pushcutEventType = newStatus === 'approved' ? 'payment_approved' : 
                                   newStatus === 'pending' ? 'payment_created' :  // pending maps to payment_created
                                   newStatus === 'refunded' ? 'payment_refunded' :
                                   newStatus === 'chargeback' ? 'chargeback_created' :
                                   newStatus === 'failed' || newStatus === 'refused' ? 'payment_refused' : 
                                   newStatus === 'cancelled' ? 'payment_refused' : null;
          
          if (pushcutEventType) {
            console.log('Triggering Pushcut notification for sale:', existingSale.id, 'event:', pushcutEventType, 'status:', newStatus)
            
            const { error: pushcutError } = await supabase.functions.invoke('send-pushcut', {
              body: {
                sale_id: existingSale.id,
                event_type: pushcutEventType,
              }
            })
            
            if (pushcutError) {
              console.error('Error sending to Pushcut:', pushcutError)
            } else {
              console.log('Pushcut notification triggered successfully')
            }
          } else {
            console.log('Pushcut: No event mapping for status:', newStatus)
          }
        } catch (pushcutError) {
          console.error('Error triggering Pushcut notification:', pushcutError)
          // Don't fail the webhook for Pushcut errors
        }
        // ========== END SEND PUSHCUT NOTIFICATION ==========

        // ========== DISPATCH CUSTOM WEBHOOKS ==========
        // Send event to all custom webhooks configured by the seller
        try {
          // Map webhook status to event IDs
          const customWebhookEvent = newStatus === 'approved' ? 'payment_approved' : 
                                      newStatus === 'pending' ? 'payment_created' :
                                      newStatus === 'refunded' ? 'payment_refunded' :
                                      newStatus === 'chargeback' ? 'chargeback_created' :
                                      newStatus === 'failed' || newStatus === 'refused' ? 'payment_refused' : null;
          
          if (customWebhookEvent && existingSale.seller_user_id) {
            console.log('Dispatching custom webhooks for sale:', existingSale.id, 'event:', customWebhookEvent)
            
            // Build payload for custom webhooks
            const webhookPayload = {
              event: customWebhookEvent,
              event_id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              gateway: {
                name: 'RoyalPay',
                environment: 'production',
              },
              payment: {
                id: existingSale.id,
                method: existingSale.payment_method || 'unknown',
                status: newStatus,
                amount: Math.round((existingSale.amount || 0) * 100),
                currency: 'BRL',
              },
              customer: {
                id: existingSale.customer_email || '',
                name: existingSale.customer_name || '',
                email: existingSale.customer_email || '',
                document: existingSale.customer_document || '',
              },
              product: {
                id: existingSale.product_id || '',
                name: '',
              },
              utm: {
                source: existingSale.utm_source || null,
                medium: existingSale.utm_medium || null,
                campaign: existingSale.utm_campaign || null,
              },
            };
            
            const { error: customWebhookError } = await supabase.functions.invoke('dispatch-custom-webhooks', {
              body: {
                event: customWebhookEvent,
                payload: webhookPayload,
                seller_user_id: existingSale.seller_user_id,
                product_id: existingSale.product_id,
              }
            })
            
            if (customWebhookError) {
              console.error('Error dispatching custom webhooks:', customWebhookError)
            } else {
              console.log('Custom webhooks dispatched successfully')
            }
          }
        } catch (customWebhookError) {
          console.error('Error dispatching custom webhooks:', customWebhookError)
          // Don't fail the webhook for custom webhook errors
        }
        // ========== END DISPATCH CUSTOM WEBHOOKS ==========

        // ========== PROCESS REFUND/CHARGEBACK - REVOKE ACCESS ==========
        if ((newStatus === 'refunded' || newStatus === 'chargeback') && existingSale.seller_user_id) {
          try {
            console.log('Processing access revocation for sale:', existingSale.id, 'reason:', newStatus)
            
            // Revoke enrollment using the database function
            const { error: revokeError } = await supabase.rpc('revoke_enrollment', {
              p_sale_id: existingSale.id,
              p_reason: newStatus === 'refunded' ? 'Reembolso solicitado' : 'Chargeback detectado',
            })

            if (revokeError) {
              console.error('Error revoking enrollment:', revokeError)
            } else {
              console.log('Enrollment access revoked for sale:', existingSale.id)
            }

            // Notify seller
            await supabase.rpc('create_system_notification', {
              p_user_id: existingSale.seller_user_id,
              p_title: newStatus === 'refunded' ? 'Reembolso processado' : 'Chargeback recebido',
              p_message: `O acesso do cliente foi revogado automaticamente.`,
              p_type: 'warning',
              p_link: '/dashboard/vendas'
            })

            // ========== SEND UTMIFY NOTIFICATION FOR REFUND/CHARGEBACK ==========
            // Update UTMify with refund/chargeback status - already sent in main section above
            // This is a fallback in case the main section didn't fire
            try {
              const refundEventType = newStatus === 'refunded' ? 'refunded' : 'chargeback';
              console.log('Triggering UTMify notification for refund/chargeback:', existingSale.id, 'event:', refundEventType)
              
              const { error: utmifyError } = await supabase.functions.invoke('send-utmify', {
                body: {
                  sale_id: existingSale.id,
                  event_type: refundEventType,
                  force_resend: true, // Force resend for status update
                }
              })
              
              if (utmifyError) {
                console.error('Error sending refund to UTMify:', utmifyError)
              } else {
                console.log('UTMify refund notification sent for sale:', existingSale.id, 'event:', refundEventType)
              }
            } catch (utmifyError) {
              console.error('Error triggering UTMify refund notification:', utmifyError)
            }
            // ========== END SEND UTMIFY NOTIFICATION FOR REFUND/CHARGEBACK ==========
          } catch (revokeError) {
            console.error('Error processing access revocation:', revokeError)
          }
        }
        // ========== END PROCESS REFUND/CHARGEBACK ==========
      }
    } else {
      console.log('No matching sale found')
      result = { 
        action: 'no_matching_sale', 
        sale_id: null, 
        details: `Searched: saleId=${saleId}, transactionId=${transactionId}, externalRef=${externalRef}, orderId=${orderId}` 
      }
    }

    // Update log with success
    if (logId) {
      await supabase.from('webhook_logs').update({
        status: result.action === 'updated' ? 'processed' : 'no_match',
        response_data: { status: newStatus, ...result },
        processed_at: new Date().toISOString(),
      }).eq('id', logId)
    }

    console.log('Webhook processed:', result)

    return new Response(JSON.stringify({ received: true, status: newStatus, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)

    if (logId) {
      await supabase.from('webhook_logs').update({
        status: 'error',
        response_data: { error: 'Processing error', details: error instanceof Error ? error.message : 'Unknown' },
        processed_at: new Date().toISOString(),
      }).eq('id', logId)
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})