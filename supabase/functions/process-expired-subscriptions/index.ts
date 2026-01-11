import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge function to process expired subscriptions
 * Should be called periodically (e.g., every hour via cron)
 */
Deno.serve(async (req) => {
  console.log('========================================')
  console.log('Process expired subscriptions started')
  console.log('========================================')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. Process subscriptions that have expired (period ended)
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        user_id,
        product_id,
        status,
        current_period_end,
        cancel_at_period_end,
        amount
      `)
      .lt('current_period_end', new Date().toISOString())
      .in('status', ['active', 'past_due', 'canceled'])

    if (fetchError) {
      console.error('Error fetching expired subscriptions:', fetchError)
      throw fetchError
    }

    console.log(`Found ${expiredSubscriptions?.length || 0} expired subscriptions`)

    const results = {
      processed: 0,
      expired: 0,
      accessRevoked: 0,
      errors: 0,
      details: [] as any[]
    }

    for (const subscription of expiredSubscriptions || []) {
      try {
        console.log(`Processing subscription ${subscription.id} - current status: ${subscription.status}`)
        
        // Update subscription status to expired
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id)

        if (updateError) {
          console.error(`Error updating subscription ${subscription.id}:`, updateError)
          results.errors++
          results.details.push({ 
            subscription_id: subscription.id, 
            action: 'error', 
            error: updateError.message 
          })
          continue
        }

        results.expired++

        // Sync enrollment access (revoke)
        const { error: syncError } = await supabase.rpc('sync_subscription_enrollment_access', {
          p_subscription_id: subscription.id,
          p_action: 'expire'
        })

        if (syncError) {
          console.error(`Error syncing enrollment for subscription ${subscription.id}:`, syncError)
        } else {
          results.accessRevoked++
        }

        // Get product details for notifications
        const { data: product } = await supabase
          .from('products')
          .select('name, user_id')
          .eq('id', subscription.product_id)
          .single()

        const productName = product?.name || 'sem nome'

        // Notify user about expiration
        const { error: notifyError } = await supabase.rpc('create_system_notification', {
          p_user_id: subscription.user_id,
          p_title: 'Assinatura expirada',
          p_message: `Sua assinatura do produto ${productName} expirou. Renove para continuar acessando.`,
          p_type: 'warning',
          p_link: '/dashboard/assinaturas'
        })

        if (notifyError) {
          console.error('Error creating notification:', notifyError)
        }

        // Notify seller
        if (product?.user_id) {
          await supabase.rpc('create_system_notification', {
            p_user_id: product.user_id,
            p_title: 'Assinatura de cliente expirada',
            p_message: `Uma assinatura do ${productName} expirou e o acesso foi revogado.`,
            p_type: 'info',
            p_link: '/dashboard/assinaturas'
          })
        }

        results.processed++
        results.details.push({
          subscription_id: subscription.id,
          action: 'expired',
          product_id: subscription.product_id,
          previous_status: subscription.status
        })

        console.log(`Successfully processed subscription ${subscription.id}`)
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error)
        results.errors++
        results.details.push({
          subscription_id: subscription.id,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // 2. Process past_due subscriptions that need suspension
    const { data: pastDueSubscriptions, error: pastDueError } = await supabase
      .from('subscriptions')
      .select('id, user_id, product_id')
      .eq('status', 'past_due')
      .gt('current_period_end', new Date().toISOString())

    if (!pastDueError && pastDueSubscriptions) {
      console.log(`Found ${pastDueSubscriptions.length} past_due subscriptions to suspend`)
      
      for (const sub of pastDueSubscriptions) {
        const { error: suspendError } = await supabase.rpc('sync_subscription_enrollment_access', {
          p_subscription_id: sub.id,
          p_action: 'suspend'
        })

        if (suspendError) {
          console.error(`Error suspending enrollment for ${sub.id}:`, suspendError)
        } else {
          results.details.push({
            subscription_id: sub.id,
            action: 'suspended'
          })
        }
      }
    }

    // 3. Process canceled subscriptions that reached period end
    const { data: canceledSubscriptions, error: canceledError } = await supabase
      .from('subscriptions')
      .select('id, user_id, product_id, current_period_end')
      .eq('status', 'canceled')
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', new Date().toISOString())

    if (!canceledError && canceledSubscriptions) {
      console.log(`Found ${canceledSubscriptions.length} canceled subscriptions at period end`)
      
      for (const sub of canceledSubscriptions) {
        // Revoke access for canceled subscription at period end
        const { error: revokeError } = await supabase.rpc('sync_subscription_enrollment_access', {
          p_subscription_id: sub.id,
          p_action: 'revoke'
        })

        if (revokeError) {
          console.error(`Error revoking access for canceled sub ${sub.id}:`, revokeError)
        } else {
          // Update to expired
          await supabase
            .from('subscriptions')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', sub.id)

          results.details.push({
            subscription_id: sub.id,
            action: 'canceled_revoked'
          })
        }
      }
    }

    console.log('========================================')
    console.log('Process completed:', results)
    console.log('========================================')

    return new Response(JSON.stringify({
      success: true,
      message: 'Expired subscriptions processed',
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing expired subscriptions:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
