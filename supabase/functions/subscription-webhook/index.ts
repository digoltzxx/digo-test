import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Handle subscription lifecycle events from payment gateway
 * Events: subscription_created, payment_succeeded, payment_failed, subscription_canceled, subscription_expired
 */
Deno.serve(async (req) => {
  console.log('========================================')
  console.log('Subscription webhook received')
  console.log('========================================')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await req.json()
    console.log('Webhook body:', JSON.stringify(body, null, 2))

    const event = body.event || body.type || ''
    const subscriptionData = body.data?.subscription || body.subscription || body.data || {}
    const paymentData = body.data?.payment || body.payment || {}
    
    const subscriptionId = subscriptionData.id || subscriptionData.external_subscription_id
    const externalId = subscriptionData.external_id || subscriptionData.externalId
    const productId = subscriptionData.product_id || subscriptionData.metadata?.product_id
    const customerId = subscriptionData.customer_id || subscriptionData.metadata?.customer_id
    const customerEmail = subscriptionData.customer?.email || body.customer?.email
    const customerName = subscriptionData.customer?.name || body.customer?.name || 'Cliente'
    
    console.log(`Processing event: ${event}`)
    console.log(`Subscription ID: ${subscriptionId}, External ID: ${externalId}`)

    // Find subscription in our database
    let subscription = null
    
    if (subscriptionId) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .or(`id.eq.${subscriptionId},external_subscription_id.eq.${subscriptionId}`)
        .maybeSingle()
      subscription = data
    }
    
    if (!subscription && externalId) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('external_subscription_id', externalId)
        .maybeSingle()
      subscription = data
    }

    let result = { action: 'unknown', subscription_id: null as string | null }

    switch (event.toLowerCase()) {
      case 'subscription_created':
      case 'subscription.created':
        console.log('Processing subscription_created')
        // Subscription should already be created at checkout, just update if needed
        if (subscription) {
          // Send to UTMify for subscription created
          try {
            console.log('Triggering UTMify notification for subscription_created:', subscription.id)
            const { error: utmifyError } = await supabase.functions.invoke('send-utmify', {
              body: {
                subscription_id: subscription.id,
                sale_id: subscription.sale_id,
                event_type: 'subscription_created',
              }
            })
            if (utmifyError) {
              console.error('Error sending subscription_created to UTMify:', utmifyError)
            } else {
              console.log('UTMify notification triggered successfully for subscription_created')
            }
          } catch (utmifyError) {
            console.error('Error triggering UTMify notification:', utmifyError)
          }
          
          // Dispatch custom webhooks for subscription_created
          try {
            console.log('Dispatching custom webhooks for subscription_created:', subscription.id)
            
            // Get product details
            const { data: product } = await supabase
              .from('products')
              .select('id, name, user_id')
              .eq('id', subscription.product_id)
              .single()
            
            if (product) {
              const webhookPayload = {
                event: 'subscription_created',
                event_id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                gateway: { name: 'RoyalPay', environment: 'production' },
                payment: {
                  id: subscription.id,
                  method: 'subscription',
                  status: 'active',
                  amount: Math.round((subscription.price || 0) * 100),
                  currency: 'BRL',
                },
                customer: {
                  id: subscription.user_id || '',
                  name: customerName || '',
                  email: customerEmail || '',
                  document: '',
                },
                product: { id: product.id, name: product.name },
                utm: { source: null, medium: null, campaign: null },
                subscription: { id: subscription.id, cycle: subscription.interval || 'monthly' },
              };
              
              await supabase.functions.invoke('dispatch-custom-webhooks', {
                body: {
                  event: 'subscription_created',
                  payload: webhookPayload,
                  seller_user_id: product.user_id,
                  product_id: product.id,
                }
              })
              console.log('Custom webhooks dispatched for subscription_created')
            }
          } catch (customWebhookError) {
            console.error('Error dispatching custom webhooks:', customWebhookError)
          }
          
          result = { action: 'subscription_exists', subscription_id: subscription.id }
        } else {
          result = { action: 'subscription_not_found', subscription_id: null }
        }
        break

      case 'payment_succeeded':
      case 'payment.succeeded':
      case 'subscription.payment_succeeded':
      case 'invoice.paid':
        console.log('Processing payment_succeeded')
        
        if (subscription) {
          const now = new Date()
          const periodEnd = new Date(now)
          periodEnd.setMonth(periodEnd.getMonth() + 1)
          
          // Update subscription to active
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', subscription.id)
          
          // Log event
          await supabase.rpc('log_subscription_access_event', {
            p_subscription_id: subscription.id,
            p_event_type: 'payment_succeeded',
            p_previous_status: subscription.status,
            p_new_status: 'active',
            p_reason: 'Pagamento recorrente aprovado - acesso mantido',
            p_metadata: { payment_id: paymentData.id || null }
          })
          
          // Sync enrollment (activate/reactivate)
          await supabase.rpc('sync_subscription_enrollment_access', {
            p_subscription_id: subscription.id,
            p_action: 'activate'
          })
          
          // Notify user
          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Pagamento aprovado',
            p_message: 'Seu pagamento foi processado com sucesso. Seu acesso continua ativo.',
            p_type: 'success'
          })
          
          result = { action: 'payment_processed', subscription_id: subscription.id }
        }
        break

      case 'payment_failed':
      case 'payment.failed':
      case 'subscription.payment_failed':
      case 'invoice.payment_failed':
        console.log('Processing payment_failed')
        
        if (subscription) {
          // Update subscription to past_due
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)
          
          // Log event
          await supabase.rpc('log_subscription_access_event', {
            p_subscription_id: subscription.id,
            p_event_type: 'payment_failed',
            p_previous_status: subscription.status,
            p_new_status: 'past_due',
            p_reason: 'Assinatura suspensa por pagamento falhado',
            p_metadata: { payment_id: paymentData.id || null, failure_reason: paymentData.failure_reason || null }
          })
          
          // Suspend enrollment access
          await supabase.rpc('sync_subscription_enrollment_access', {
            p_subscription_id: subscription.id,
            p_action: 'suspend'
          })
          
          // Notify user
          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Falha no pagamento',
            p_message: 'Não foi possível processar seu pagamento. Seu acesso foi suspenso temporariamente.',
            p_type: 'warning',
            p_link: '/dashboard/assinaturas'
          })
          
          result = { action: 'payment_failed_processed', subscription_id: subscription.id }
        }
        break

      case 'subscription_canceled':
      case 'subscription.canceled':
      case 'subscription.cancelled':
        console.log('Processing subscription_canceled')
        
        if (subscription) {
          const cancelAtPeriodEnd = subscriptionData.cancel_at_period_end ?? true
          
          // Update subscription
          await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              cancel_at_period_end: cancelAtPeriodEnd,
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)
          
          // Log event
          await supabase.rpc('log_subscription_access_event', {
            p_subscription_id: subscription.id,
            p_event_type: 'subscription_canceled',
            p_previous_status: subscription.status,
            p_new_status: 'canceled',
            p_reason: cancelAtPeriodEnd 
              ? 'Assinatura cancelada - acesso continua até o vencimento'
              : 'Assinatura cancelada - acesso revogado imediatamente',
            p_metadata: { cancel_at_period_end: cancelAtPeriodEnd }
          })
          
          // If immediate cancellation (not at period end), revoke access now
          if (!cancelAtPeriodEnd) {
            await supabase.rpc('sync_subscription_enrollment_access', {
              p_subscription_id: subscription.id,
              p_action: 'revoke'
            })
          }
          
          // Send to UTMify for subscription canceled
          try {
            console.log('Triggering UTMify notification for subscription_canceled:', subscription.id)
            const { error: utmifyError } = await supabase.functions.invoke('send-utmify', {
              body: {
                subscription_id: subscription.id,
                sale_id: subscription.sale_id,
                event_type: 'subscription_canceled',
              }
            })
            if (utmifyError) {
              console.error('Error sending subscription_canceled to UTMify:', utmifyError)
            } else {
              console.log('UTMify notification triggered successfully for subscription_canceled')
            }
          } catch (utmifyError) {
            console.error('Error triggering UTMify notification:', utmifyError)
          }
          
          // Notify user
          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Assinatura cancelada',
            p_message: cancelAtPeriodEnd 
              ? `Sua assinatura foi cancelada. Você terá acesso até ${new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}.`
              : 'Sua assinatura foi cancelada e seu acesso foi revogado.',
            p_type: 'info'
          })
          
          // Get product details and notify seller
          const { data: product } = await supabase
            .from('products')
            .select('id, user_id, name')
            .eq('id', subscription.product_id)
            .single()
          
          if (product) {
            await supabase.rpc('create_system_notification', {
              p_user_id: product.user_id,
              p_title: 'Assinatura cancelada',
              p_message: `Um cliente cancelou a assinatura do ${product.name}.`,
              p_type: 'warning',
              p_link: '/dashboard/assinaturas'
            })
            
            // Dispatch custom webhooks for subscription_canceled
            try {
              console.log('Dispatching custom webhooks for subscription_canceled:', subscription.id)
              
              const webhookPayload = {
                event: 'subscription_canceled',
                event_id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                gateway: { name: 'RoyalPay', environment: 'production' },
                payment: {
                  id: subscription.id,
                  method: 'subscription',
                  status: 'canceled',
                  amount: Math.round((subscription.price || 0) * 100),
                  currency: 'BRL',
                },
                customer: {
                  id: subscription.user_id || '',
                  name: '',
                  email: '',
                  document: '',
                },
                product: { id: product.id, name: product.name },
                utm: { source: null, medium: null, campaign: null },
                subscription: { id: subscription.id, cycle: subscription.interval || 'monthly' },
              };
              
              await supabase.functions.invoke('dispatch-custom-webhooks', {
                body: {
                  event: 'subscription_canceled',
                  payload: webhookPayload,
                  seller_user_id: product.user_id,
                  product_id: product.id,
                }
              })
              console.log('Custom webhooks dispatched for subscription_canceled')
            } catch (customWebhookError) {
              console.error('Error dispatching custom webhooks:', customWebhookError)
            }
          }
          
          result = { action: 'subscription_canceled_processed', subscription_id: subscription.id }
        }
        break

      case 'subscription_expired':
      case 'subscription.expired':
        console.log('Processing subscription_expired')
        
        if (subscription) {
          // Update subscription to expired
          await supabase
            .from('subscriptions')
            .update({
              status: 'expired',
              updated_at: new Date().toISOString()
            })
            .eq('id', subscription.id)
          
          // Log event
          await supabase.rpc('log_subscription_access_event', {
            p_subscription_id: subscription.id,
            p_event_type: 'subscription_expired',
            p_previous_status: subscription.status,
            p_new_status: 'expired',
            p_reason: 'Assinatura expirada - acesso revogado'
          })
          
          // Revoke access
          await supabase.rpc('sync_subscription_enrollment_access', {
            p_subscription_id: subscription.id,
            p_action: 'expire'
          })
          
          // Notify user
          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Assinatura expirada',
            p_message: 'Sua assinatura expirou. Renove para continuar acessando.',
            p_type: 'warning',
            p_link: '/dashboard/assinaturas'
          })
          
          result = { action: 'subscription_expired_processed', subscription_id: subscription.id }
        }
        break

      default:
        console.log(`Unknown event type: ${event}`)
        result = { action: 'unknown_event', subscription_id: subscription?.id || null }
    }

    console.log('Webhook processed:', result)

    return new Response(JSON.stringify({
      received: true,
      event,
      ...result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Subscription webhook error:', error)
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
