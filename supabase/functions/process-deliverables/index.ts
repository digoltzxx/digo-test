import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ========================================
// ERROR CODES AND MESSAGES
// ========================================
const DELIVERY_ERRORS = {
  // Payment only errors
  PAYMENT_ONLY_NO_DELIVERY: {
    code: 'PAYMENT_ONLY_NO_DELIVERY',
    message: 'Este produto está configurado apenas para recebimento de pagamento. Nenhuma entrega automática foi definida.',
    severity: 'info',
  },
  PAYMENT_ONLY_INVALID_ACTION: {
    code: 'PAYMENT_ONLY_INVALID_ACTION',
    message: 'Não há ação de entrega vinculada a este produto.',
    severity: 'warning',
  },
  // Email errors
  EMAIL_NOT_CONFIGURED: {
    code: 'EMAIL_NOT_CONFIGURED',
    message: 'Entrega via email não configurada para este produto.',
    severity: 'error',
  },
  EMAIL_TEMPLATE_MISSING: {
    code: 'EMAIL_TEMPLATE_MISSING',
    message: 'O template de email não está configurado para este produto.',
    severity: 'warning',
  },
  EMAIL_SEND_FAILED: {
    code: 'EMAIL_SEND_FAILED',
    message: 'O pagamento foi confirmado, mas o email não pôde ser enviado.',
    severity: 'error',
  },
  EMAIL_PAYMENT_PENDING: {
    code: 'EMAIL_PAYMENT_PENDING',
    message: 'A entrega por email só ocorre após a confirmação do pagamento.',
    severity: 'warning',
  },
  // Member area errors
  MEMBER_AREA_NOT_LINKED: {
    code: 'MEMBER_AREA_NOT_LINKED',
    message: 'Este produto não possui uma área de membros configurada.',
    severity: 'error',
  },
  MEMBER_SUBSCRIPTION_INACTIVE: {
    code: 'MEMBER_SUBSCRIPTION_INACTIVE',
    message: 'A assinatura vinculada a este produto não está ativa.',
    severity: 'error',
  },
  MEMBER_SUBSCRIPTION_EXPIRED: {
    code: 'MEMBER_SUBSCRIPTION_EXPIRED',
    message: 'Sua assinatura expirou. Renove para recuperar o acesso.',
    severity: 'error',
  },
  MEMBER_ACCESS_FAILED: {
    code: 'MEMBER_ACCESS_FAILED',
    message: 'Pagamento confirmado, mas o acesso à área de membros não foi liberado.',
    severity: 'error',
  },
  // General errors
  PRODUCT_NOT_FOUND: {
    code: 'PRODUCT_NOT_FOUND',
    message: 'Produto não encontrado.',
    severity: 'error',
  },
  PAYMENT_NOT_CONFIRMED: {
    code: 'PAYMENT_NOT_CONFIRMED',
    message: 'Aguardando confirmação do pagamento.',
    severity: 'warning',
  },
  DELIVERY_METHOD_UNKNOWN: {
    code: 'DELIVERY_METHOD_UNKNOWN',
    message: 'Método de entrega não configurado para este produto.',
    severity: 'error',
  },
} as const

// ========================================
// EMAIL TEMPLATES
// ========================================
const createEmailTemplate = (
  headerColor: string,
  headerIcon: string,
  headerTitle: string,
  userName: string,
  productName: string,
  productPrice: number,
  sellerName: string,
  customContent: string
) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">${headerIcon}</div>
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${headerTitle}</h1>
    </div>
    
    <!-- Content -->
    <div style="background: #ffffff; border-radius: 0 0 16px 16px; padding: 40px 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <p style="font-size: 18px; color: #18181b; margin-bottom: 20px;">
        Olá <strong>${userName}</strong>,
      </p>
      
      <p style="font-size: 16px; color: #3f3f46; line-height: 1.6; margin-bottom: 25px;">
        Sua compra do produto <strong style="color: #8b5cf6;">${productName}</strong> foi confirmada!
      </p>
      
      <!-- Product Details -->
      <div style="background: #f4f4f5; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
        <h3 style="color: #18181b; margin: 0 0 15px 0; font-size: 16px;">📦 Detalhes da Compra:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Produto:</td>
            <td style="padding: 8px 0; color: #18181b; font-size: 14px; text-align: right; font-weight: 600;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Valor:</td>
            <td style="padding: 8px 0; color: #22c55e; font-size: 14px; text-align: right; font-weight: 600;">R$ ${productPrice.toFixed(2).replace('.', ',')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a; font-size: 14px;">Status:</td>
            <td style="padding: 8px 0; color: #22c55e; font-size: 14px; text-align: right; font-weight: 600;">✅ Aprovado</td>
          </tr>
        </table>
      </div>
      
      ${customContent}
      
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
      
      <p style="font-size: 14px; color: #71717a; line-height: 1.6; margin: 0;">
        Se tiver qualquer dúvida, entre em contato conosco.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 30px 20px;">
      <p style="font-size: 12px; color: #a1a1aa; margin: 0 0 5px 0;">
        Este email foi enviado automaticamente por ${sellerName}
      </p>
      <p style="font-size: 11px; color: #d4d4d8; margin: 0;">
        Powered by Royal Pay
      </p>
    </div>
  </div>
</body>
</html>
`

const createPaymentOnlyEmail = (
  userName: string,
  productName: string,
  productPrice: number,
  sellerName: string,
  sellerEmail?: string,
  sellerPhone?: string
) => {
  const contactInfo = (sellerEmail || sellerPhone) ? `
    <p style="color: #1e40af; font-size: 13px; font-weight: 600; margin: 15px 0 8px 0;">📞 Contato do Vendedor:</p>
    ${sellerEmail ? `<p style="color: #1e3a8a; font-size: 13px; margin: 4px 0;">Email: ${sellerEmail}</p>` : ''}
    ${sellerPhone ? `<p style="color: #1e3a8a; font-size: 13px; margin: 4px 0;">WhatsApp: ${sellerPhone}</p>` : ''}
  ` : ''

  const customContent = `
    <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
      <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 10px 0;">ℹ️ Próximos Passos</p>
      <p style="color: #1e3a8a; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
        Seu pagamento foi processado com sucesso. O vendedor entrará em contato para dar continuidade ao seu pedido.
      </p>
      ${contactInfo}
    </div>
  `

  return createEmailTemplate(
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    '💳',
    'Pagamento Confirmado!',
    userName,
    productName,
    productPrice,
    sellerName,
    customContent
  )
}

const createEmailDeliveryEmail = (
  userName: string,
  productName: string,
  productPrice: number,
  sellerName: string,
  contentUrl?: string,
  customEmailContent?: string
) => {
  let customContent = ''
  
  if (customEmailContent) {
    customContent += `
      <div style="background: #fefce8; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #fef08a;">
        ${customEmailContent}
      </div>
    `
  }
  
  if (contentUrl) {
    customContent += `
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${contentUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
          Acessar Meu Conteúdo →
        </a>
        <p style="font-size: 12px; color: #71717a; margin-top: 15px;">
          Ou copie este link: <a href="${contentUrl}" style="color: #f97316;">${contentUrl}</a>
        </p>
      </div>
    `
  }

  customContent += `
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #bbf7d0;">
      <div style="font-size: 32px; margin: 0;">✅</div>
      <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 10px 0 5px 0;">Entrega Realizada</p>
      <p style="color: #15803d; font-size: 13px; margin: 0;">
        Seu produto foi entregue com sucesso. Guarde este email para referência futura.
      </p>
    </div>
  `

  return createEmailTemplate(
    'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    '📧',
    'Seu Produto Chegou!',
    userName,
    productName,
    productPrice,
    sellerName,
    customContent
  )
}

const createMemberAccessEmail = (
  userName: string,
  productName: string,
  productPrice: number,
  sellerName: string,
  memberAreaUrl: string,
  isSubscription: boolean
) => {
  const subscriptionWarning = isSubscription ? `
    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #fde68a;">
      <p style="font-size: 20px; margin: 0 0 8px 0;">⚠️</p>
      <p style="color: #92400e; font-size: 13px; line-height: 1.6; margin: 0;">
        <strong>Importante:</strong> Mantenha sua assinatura ativa para continuar acessando todo o conteúdo. 
        Se sua assinatura expirar, o acesso será bloqueado até a renovação.
      </p>
    </div>
  ` : ''

  const customContent = `
    <!-- Access Type -->
    <div style="background: #f0fdf4; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px; border: 1px solid #bbf7d0;">
      <div style="font-size: 40px; margin: 0 0 10px 0;">${isSubscription ? '🔄' : '♾️'}</div>
      <p style="color: #166534; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">
        ${isSubscription ? 'Acesso por Assinatura' : 'Acesso Vitalício'}
      </p>
      <p style="color: #15803d; font-size: 14px; margin: 0;">
        ${isSubscription 
          ? 'Seu acesso está vinculado à sua assinatura ativa.'
          : 'Você tem acesso permanente a este conteúdo.'
        }
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="${memberAreaUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);">
        Acessar Área de Membros →
      </a>
    </div>

    <!-- What's included -->
    <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <p style="color: #18181b; font-size: 14px; font-weight: 600; margin: 0 0 15px 0;">✨ O que você terá acesso:</p>
      <table style="width: 100%;">
        <tr>
          <td style="color: #22c55e; font-size: 14px; width: 25px; vertical-align: top; padding-top: 3px;">✅</td>
          <td style="color: #3f3f46; font-size: 14px; padding: 5px 0;">Conteúdo exclusivo do produto</td>
        </tr>
        <tr>
          <td style="color: #22c55e; font-size: 14px; width: 25px; vertical-align: top; padding-top: 3px;">✅</td>
          <td style="color: #3f3f46; font-size: 14px; padding: 5px 0;">Atualizações futuras</td>
        </tr>
        <tr>
          <td style="color: #22c55e; font-size: 14px; width: 25px; vertical-align: top; padding-top: 3px;">✅</td>
          <td style="color: #3f3f46; font-size: 14px; padding: 5px 0;">Materiais complementares</td>
        </tr>
        <tr>
          <td style="color: #22c55e; font-size: 14px; width: 25px; vertical-align: top; padding-top: 3px;">✅</td>
          <td style="color: #3f3f46; font-size: 14px; padding: 5px 0;">Suporte ao aluno</td>
        </tr>
      </table>
    </div>

    ${subscriptionWarning}

    <!-- Tip -->
    <div style="background: #eff6ff; border-radius: 12px; padding: 15px 20px; border: 1px solid #bfdbfe;">
      <p style="color: #1e40af; font-size: 13px; font-weight: 600; margin: 0 0 5px 0;">💡 Dica</p>
      <p style="color: #1e3a8a; font-size: 13px; margin: 0;">
        Salve o link da área de membros nos seus favoritos para acessar rapidamente quando quiser.
      </p>
    </div>
  `

  return createEmailTemplate(
    'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    '🎉',
    'Acesso Liberado!',
    userName,
    productName,
    productPrice,
    sellerName,
    customContent
  )
}

// Dynamic Resend import
let ResendModule: any = null
async function getResendClient(apiKey: string) {
  if (!ResendModule) {
    ResendModule = await import('https://esm.sh/resend@2.0.0')
  }
  return new ResendModule.Resend(apiKey)
}

interface DeliverableRequest {
  sale_id?: string
  subscription_id?: string
  product_id: string
  user_email: string
  user_name: string
  payment_type: 'one_time' | 'subscription'
  payment_status?: string
  subscription_status?: string
}

type DeliveryMethod = 'payment_only' | 'email' | 'member_area' | 'receive_only' | 'members_area' | null
type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'expired'

// Valid subscription statuses for delivery
const VALID_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active']

function isSubscriptionValid(status: SubscriptionStatus | string): boolean {
  return VALID_SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
}

function getSubscriptionErrorCode(status: string): keyof typeof DELIVERY_ERRORS | null {
  if (status === 'pending') return 'PAYMENT_NOT_CONFIRMED'
  if (status === 'canceled') return 'MEMBER_SUBSCRIPTION_INACTIVE'
  if (status === 'expired') return 'MEMBER_SUBSCRIPTION_EXPIRED'
  return null
}

interface DeliveryResult {
  type: string
  status: 'completed' | 'failed' | 'skipped'
  error?: string
  errorCode?: string
  errorSeverity?: string
}

Deno.serve(async (req) => {
  console.log('========================================')
  console.log('Process Deliverables - Request received')
  console.log('Method:', req.method)
  console.log('Timestamp:', new Date().toISOString())
  console.log('========================================')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: DeliverableRequest = await req.json()
    console.log('Request body:', JSON.stringify(body))

    const { 
      sale_id, 
      subscription_id, 
      product_id, 
      user_email, 
      user_name, 
      payment_type,
      payment_status,
      subscription_status 
    } = body

    if (!product_id || !user_email) {
      console.error('Missing required fields')
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: product_id and user_email',
        errorCode: 'VALIDATION_ERROR'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, description, price, user_id, payment_type, delivery_method, sac_email, sac_phone')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      console.error('Product not found:', productError)
      const error = DELIVERY_ERRORS.PRODUCT_NOT_FOUND
      await logDeliveryError(supabase, {
        sale_id,
        subscription_id,
        product_id,
        user_email,
        user_name,
        errorCode: error.code,
        errorMessage: error.message,
      })
      return new Response(JSON.stringify({ 
        error: error.message,
        errorCode: error.code,
        severity: error.severity
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Product found:', product.name)
    console.log('Delivery method:', product.delivery_method)
    console.log('Payment type:', payment_type)

    // Normalize delivery method
    let deliveryMethod: DeliveryMethod = product.delivery_method as DeliveryMethod
    if (deliveryMethod === 'receive_only') deliveryMethod = 'payment_only'
    if (deliveryMethod === 'members_area') deliveryMethod = 'member_area'
    
    console.log('Normalized delivery method:', deliveryMethod)

    // ========================================
    // SUBSCRIPTION VALIDATION
    // ========================================
    if (payment_type === 'subscription') {
      console.log('Validating subscription status:', subscription_status)
      
      // If subscription_status not provided, fetch it
      let currentStatus = subscription_status
      if (!currentStatus && subscription_id) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('id', subscription_id)
          .single()
        currentStatus = sub?.status
      }

      if (currentStatus && !isSubscriptionValid(currentStatus)) {
        const errorCode = getSubscriptionErrorCode(currentStatus)
        if (errorCode) {
          const error = DELIVERY_ERRORS[errorCode]
          console.log(`Subscription blocked: ${currentStatus} -> ${errorCode}`)
          
          await logDeliveryError(supabase, {
            sale_id,
            subscription_id,
            product_id,
            user_email,
            user_name,
            errorCode: error.code,
            errorMessage: error.message,
          })

          return new Response(JSON.stringify({
            success: false,
            error: error.message,
            errorCode: error.code,
            severity: error.severity,
            subscription_status: currentStatus,
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Fetch seller profile
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', product.user_id)
      .single()

    const sellerName = sellerProfile?.full_name || 'Royal Pay'
    const results: DeliveryResult[] = []

    // ========================================
    // OPTION 1: PAYMENT ONLY
    // ========================================
    if (deliveryMethod === 'payment_only' || !deliveryMethod) {
      console.log('Delivery method: PAYMENT ONLY')
      
      const info = DELIVERY_ERRORS.PAYMENT_ONLY_NO_DELIVERY
      
      await supabase.from('delivery_logs').insert({
        sale_id,
        subscription_id,
        product_id,
        user_email: user_email.toLowerCase(),
        user_name,
        delivery_type: 'payment_only',
        delivery_status: 'completed',
        delivered_at: new Date().toISOString(),
      })
      
      results.push({ 
        type: 'payment_only', 
        status: 'completed',
        errorCode: info.code,
        errorSeverity: info.severity
      })

      // Send confirmation email
      if (resendApiKey) {
        try {
          const resend = await getResendClient(resendApiKey)
          const emailHtml = createPaymentOnlyEmail(
            user_name,
            product.name,
            product.price,
            sellerName,
            product.sac_email || undefined,
            product.sac_phone || undefined
          )

          const { error: emailError } = await resend.emails.send({
            from: 'Royal Pay <noreply@resend.dev>',
            to: [user_email],
            subject: `💳 Pagamento Confirmado - ${product.name}`,
            html: emailHtml,
          })

          if (emailError) {
            console.error('Email error:', emailError)
            results.push({ 
              type: 'confirmation_email', 
              status: 'failed', 
              error: emailError.message,
              errorCode: 'EMAIL_SEND_FAILED',
              errorSeverity: 'error'
            })
          } else {
            results.push({ type: 'confirmation_email', status: 'completed' })
          }
        } catch (err) {
          console.error('Email error:', err)
          results.push({ 
            type: 'confirmation_email', 
            status: 'failed', 
            error: String(err),
            errorCode: 'EMAIL_SEND_FAILED',
            errorSeverity: 'error'
          })
        }
      }
      
      await supabase.from('notifications').insert({
        user_id: product.user_id,
        type: 'sale',
        title: 'Pagamento recebido',
        message: `Pagamento de ${user_name} para ${product.name} confirmado`,
        link: `/dashboard/vendas`,
      })

      return new Response(JSON.stringify({
        success: true,
        product_id,
        user_email,
        delivery_method: 'payment_only',
        message: info.message,
        results,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // OPTION 2: EMAIL DELIVERY
    // ========================================
    if (deliveryMethod === 'email') {
      console.log('Delivery method: EMAIL')
      
      // Check if email service is configured
      if (!resendApiKey) {
        const error = DELIVERY_ERRORS.EMAIL_NOT_CONFIGURED
        console.error('RESEND_API_KEY not configured')
        
        await logDeliveryError(supabase, {
          sale_id,
          subscription_id,
          product_id,
          user_email,
          user_name,
          errorCode: error.code,
          errorMessage: error.message,
        })

        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          errorCode: error.code,
          severity: error.severity,
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      // Fetch email config
      const { data: emailDeliverable } = await supabase
        .from('product_deliverables')
        .select('*')
        .eq('product_id', product_id)
        .eq('delivery_type', 'email')
        .eq('is_active', true)
        .limit(1)
        .single()

      // Log warning if no template configured (but continue with default)
      if (!emailDeliverable) {
        console.log('No email template configured, using default')
        results.push({
          type: 'template_check',
          status: 'skipped',
          error: DELIVERY_ERRORS.EMAIL_TEMPLATE_MISSING.message,
          errorCode: DELIVERY_ERRORS.EMAIL_TEMPLATE_MISSING.code,
          errorSeverity: 'warning'
        })
      }

      try {
        const resend = await getResendClient(resendApiKey)
        
        let emailSubject = `📧 Seu produto chegou - ${product.name}`
        let emailHtml = ''
        
        if (emailDeliverable?.email_subject && emailDeliverable?.email_body) {
          emailSubject = emailDeliverable.email_subject
            .replace(/{{product_name}}/g, product.name)
          
          const customBody = emailDeliverable.email_body
            .replace(/{{user_name}}/g, user_name)
            .replace(/{{product_name}}/g, product.name)
            .replace(/{{content_url}}/g, emailDeliverable.content_url || '')

          emailHtml = createEmailDeliveryEmail(
            user_name,
            product.name,
            product.price,
            sellerName,
            emailDeliverable.content_url || undefined,
            customBody
          )
        } else {
          emailHtml = createEmailDeliveryEmail(
            user_name,
            product.name,
            product.price,
            sellerName,
            emailDeliverable?.content_url || undefined
          )
        }

        const { error: emailError } = await resend.emails.send({
          from: 'Royal Pay <noreply@resend.dev>',
          to: [user_email],
          subject: emailSubject,
          html: emailHtml,
        })

        if (emailError) {
          console.error('Email error:', emailError)
          const error = DELIVERY_ERRORS.EMAIL_SEND_FAILED
          
          await supabase.from('delivery_logs').insert({
            sale_id,
            subscription_id,
            product_id,
            deliverable_id: emailDeliverable?.id || null,
            user_email: user_email.toLowerCase(),
            user_name,
            delivery_type: 'email',
            delivery_status: 'failed',
            error_message: `${error.code}: ${emailError.message}`,
          })
          
          results.push({ 
            type: 'email', 
            status: 'failed', 
            error: error.message,
            errorCode: error.code,
            errorSeverity: error.severity
          })
        } else {
          console.log('Email sent successfully')
          
          await supabase.from('delivery_logs').insert({
            sale_id,
            subscription_id,
            product_id,
            deliverable_id: emailDeliverable?.id || null,
            user_email: user_email.toLowerCase(),
            user_name,
            delivery_type: 'email',
            delivery_status: 'completed',
            delivered_at: new Date().toISOString(),
          })
          
          results.push({ type: 'email', status: 'completed' })
        }
      } catch (err) {
        console.error('Email error:', err)
        const error = DELIVERY_ERRORS.EMAIL_SEND_FAILED
        results.push({ 
          type: 'email', 
          status: 'failed', 
          error: error.message,
          errorCode: error.code,
          errorSeverity: error.severity
        })
      }
      
      await supabase.from('notifications').insert({
        user_id: product.user_id,
        type: 'sale',
        title: 'Produto enviado por email',
        message: `${product.name} enviado para ${user_email}`,
        link: `/dashboard/vendas`,
      })

      const hasFailure = results.some(r => r.status === 'failed')
      return new Response(JSON.stringify({
        success: !hasFailure,
        product_id,
        user_email,
        delivery_method: 'email',
        results,
      }), {
        status: hasFailure ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ========================================
    // OPTION 3: MEMBER AREA ACCESS
    // ========================================
    if (deliveryMethod === 'member_area') {
      console.log('Delivery method: MEMBER AREA')
      
      const isSubscription = payment_type === 'subscription'

      // Calculate expiration for subscription-based access
      let expiresAt: string | null = null
      if (isSubscription && subscription_id) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('current_period_end')
          .eq('id', subscription_id)
          .single()
        if (sub?.current_period_end) {
          expiresAt = sub.current_period_end
        }
      }

      try {
        const { error: accessError } = await supabase
          .from('member_access')
          .upsert({
            user_email: user_email.toLowerCase(),
            user_name: user_name,
            product_id: product_id,
            sale_id: sale_id || null,
            subscription_id: subscription_id || null,
            access_status: 'active',
            granted_at: new Date().toISOString(),
            expires_at: expiresAt,
          }, {
            onConflict: 'user_email,product_id',
            ignoreDuplicates: false,
          })

        if (accessError) {
          console.error('Member access error:', accessError)
          const error = DELIVERY_ERRORS.MEMBER_ACCESS_FAILED
          
          await supabase.from('delivery_logs').insert({
            sale_id,
            subscription_id,
            product_id,
            user_email: user_email.toLowerCase(),
            user_name,
            delivery_type: 'member_access',
            delivery_status: 'failed',
            error_message: `${error.code}: ${accessError.message}`,
          })
          
          results.push({ 
            type: 'member_access', 
            status: 'failed', 
            error: error.message,
            errorCode: error.code,
            errorSeverity: error.severity
          })
        } else {
          console.log('Member access granted')
          
          await supabase.from('delivery_logs').insert({
            sale_id,
            subscription_id,
            product_id,
            user_email: user_email.toLowerCase(),
            user_name,
            delivery_type: 'member_access',
            delivery_status: 'completed',
            delivered_at: new Date().toISOString(),
          })
          
          results.push({ type: 'member_access', status: 'completed' })
        }
      } catch (err) {
        console.error('Member access error:', err)
        const error = DELIVERY_ERRORS.MEMBER_ACCESS_FAILED
        results.push({ 
          type: 'member_access', 
          status: 'failed', 
          error: error.message,
          errorCode: error.code,
          errorSeverity: error.severity
        })
      }

      // Send confirmation email
      if (resendApiKey) {
        try {
          const resend = await getResendClient(resendApiKey)
          const memberAreaUrl = `${supabaseUrl.replace('.supabase.co', '')}/area-membros/${product_id}`
          
          const emailHtml = createMemberAccessEmail(
            user_name,
            product.name,
            product.price,
            sellerName,
            memberAreaUrl,
            isSubscription
          )

          const { error: emailError } = await resend.emails.send({
            from: 'Royal Pay <noreply@resend.dev>',
            to: [user_email],
            subject: `🎉 Acesso Liberado - ${product.name}`,
            html: emailHtml,
          })

          if (emailError) {
            console.error('Email error:', emailError)
            results.push({ 
              type: 'confirmation_email', 
              status: 'failed', 
              error: emailError.message,
              errorCode: 'EMAIL_SEND_FAILED',
              errorSeverity: 'error'
            })
          } else {
            results.push({ type: 'confirmation_email', status: 'completed' })
          }
        } catch (err) {
          console.error('Email error:', err)
          results.push({ 
            type: 'confirmation_email', 
            status: 'failed', 
            error: String(err),
            errorCode: 'EMAIL_SEND_FAILED',
            errorSeverity: 'error'
          })
        }
      }
      
      await supabase.from('notifications').insert({
        user_id: product.user_id,
        type: 'sale',
        title: 'Acesso liberado',
        message: `Acesso a ${product.name} liberado para ${user_email}`,
        link: `/dashboard/produtos/${product_id}`,
      })

      const hasFailure = results.some(r => r.status === 'failed' && r.type === 'member_access')
      return new Response(JSON.stringify({
        success: !hasFailure,
        product_id,
        user_email,
        delivery_method: 'member_area',
        is_subscription: isSubscription,
        expires_at: expiresAt,
        results,
      }), {
        status: hasFailure ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Unknown delivery method
    const error = DELIVERY_ERRORS.DELIVERY_METHOD_UNKNOWN
    console.error('Unknown delivery method:', deliveryMethod)
    
    await logDeliveryError(supabase, {
      sale_id,
      subscription_id,
      product_id,
      user_email,
      user_name,
      errorCode: error.code,
      errorMessage: `${error.message} (${deliveryMethod})`,
    })

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      errorCode: error.code,
      severity: error.severity,
      delivery_method: deliveryMethod,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error processing deliverables:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'INTERNAL_ERROR',
      severity: 'error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Helper function to log delivery events (success or error)
async function logDeliveryEvent(
  supabase: any,
  params: {
    sale_id?: string
    subscription_id?: string
    product_id: string
    user_email: string
    user_name?: string
    delivery_type: string
    delivery_status: 'pending' | 'processing' | 'delivered' | 'failed'
    error_code?: string
    error_message?: string
    delivered_at?: string
    deliverable_id?: string
  }
) {
  try {
    const logEntry = {
      sale_id: params.sale_id,
      subscription_id: params.subscription_id,
      product_id: params.product_id,
      deliverable_id: params.deliverable_id,
      user_email: params.user_email.toLowerCase(),
      user_name: params.user_name || 'Unknown',
      delivery_type: params.delivery_type,
      delivery_status: params.delivery_status,
      error_message: params.error_code 
        ? `${params.error_code}: ${params.error_message || 'No details'}` 
        : params.error_message || null,
      delivered_at: params.delivered_at || (params.delivery_status === 'delivered' ? new Date().toISOString() : null),
    }
    
    console.log('Creating delivery log:', JSON.stringify(logEntry))
    
    const { error } = await supabase.from('delivery_logs').insert(logEntry)
    
    if (error) {
      console.error('Failed to create delivery log:', error)
    }
  } catch (err) {
    console.error('Exception in logDeliveryEvent:', err)
  }
}

// Legacy helper (backwards compatibility)
async function logDeliveryError(
  supabase: any,
  params: {
    sale_id?: string
    subscription_id?: string
    product_id: string
    user_email: string
    user_name?: string
    errorCode: string
    errorMessage: string
  }
) {
  return logDeliveryEvent(supabase, {
    sale_id: params.sale_id,
    subscription_id: params.subscription_id,
    product_id: params.product_id,
    user_email: params.user_email,
    user_name: params.user_name,
    delivery_type: 'error',
    delivery_status: 'failed',
    error_code: params.errorCode,
    error_message: params.errorMessage,
  })
}
