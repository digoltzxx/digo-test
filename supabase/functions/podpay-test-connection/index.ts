import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for pending credentials in system_settings first
    const { data: pendingSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['podpay_secret_key_pending', 'podpay_public_key_pending', 'podpay_withdrawal_key_pending'])

    const pendingMap: Record<string, string> = {}
    pendingSettings?.forEach(s => {
      pendingMap[s.key] = s.value
    })

    // Use pending credentials if available, otherwise use secrets
    let secretKey = pendingMap['podpay_secret_key_pending'] || Deno.env.get('PODPAY_API_KEY')
    let publicKey = pendingMap['podpay_public_key_pending'] || Deno.env.get('PODPAY_PUBLIC_KEY')
    let withdrawalKey = pendingMap['podpay_withdrawal_key_pending'] || Deno.env.get('PODPAY_WITHDRAWAL_KEY')

    const usingPending = !!pendingMap['podpay_secret_key_pending']

    console.log('Checking PodPay credentials...')
    console.log('Secret Key configured:', !!secretKey)
    console.log('Public Key configured:', !!publicKey)
    console.log('Withdrawal Key configured:', !!withdrawalKey)
    console.log('Using pending credentials:', usingPending)

    if (!secretKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Chave Privada (PODPAY_API_KEY) não configurada',
        details: {
          secretKey: false,
          publicKey: !!publicKey,
          withdrawalKey: !!withdrawalKey,
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PodPay API base URL
    const baseUrl = 'https://api.podpay.co/v1';

    console.log('Testing connection to PodPay API:', baseUrl)
    console.log('Using secret key:', secretKey.substring(0, 10) + '...')

    // Basic Auth: SECRET_KEY:x encoded in Base64 (PodPay standard)
    const credentials = `${secretKey}:x`;
    const encodedCredentials = btoa(credentials);
    const authHeader = `Basic ${encodedCredentials}`;

    // Test connection by fetching company data
    const authResponse = await fetch(`${baseUrl}/company`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    const responseText = await authResponse.text()
    console.log('PodPay response status:', authResponse.status)
    console.log('PodPay response body:', responseText)

    if (!authResponse.ok) {
      console.error('PodPay auth error:', authResponse.status, responseText)
      
      let errorMessage = `Erro na autenticação: ${authResponse.status}`
      if (authResponse.status === 401) {
        errorMessage = 'Credenciais inválidas. Verifique sua Chave Privada.'
      } else if (authResponse.status === 403) {
        errorMessage = 'Acesso negado. Verifique as permissões da sua chave API.'
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage,
        details: {
          status: authResponse.status,
          response: responseText,
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let authData = {}
    try {
      authData = JSON.parse(responseText)
    } catch {
      authData = { raw: responseText }
    }
    
    console.log('PodPay connection successful:', authData)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Conexão com PodPay estabelecida com sucesso!',
      company: (authData as Record<string, string>).name || (authData as Record<string, string>).company_name || (authData as Record<string, string>).legal_name || 'Conectado',
      environment: 'production',
      credentials: {
        secretKey: true,
        publicKey: !!publicKey,
        withdrawalKey: !!withdrawalKey,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Test connection error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
