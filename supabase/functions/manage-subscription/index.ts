import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize string input
const sanitizeString = (input: string | null | undefined, maxLength: number = 100): string | null => {
  if (!input || typeof input !== 'string') return null;
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '');
};

// Calculate next period end based on interval
function calculatePeriodEnd(startDate: Date, interval: 'weekly' | 'monthly' | 'yearly'): Date {
  const endDate = new Date(startDate);
  switch (interval) {
    case 'weekly':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case 'monthly':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'yearly':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }
  return endDate;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, ...params } = body;

    console.log('=== MANAGE SUBSCRIPTION ===');
    console.log('Action:', action);
    console.log('Params:', JSON.stringify(params));

    switch (action) {
      // =====================================
      // CREATE SUBSCRIPTION
      // =====================================
      case 'create': {
        const {
          user_id,
          product_id,
          amount,
          plan_interval = 'monthly',
          payment_method = 'credit_card',
          external_subscription_id,
          external_customer_id,
        } = params;

        if (!user_id || !product_id || !amount) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: user_id, product_id, amount' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if product exists and is subscription type
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, payment_type, user_id')
          .eq('id', product_id)
          .maybeSingle();

        if (productError || !product) {
          return new Response(
            JSON.stringify({ error: 'Product not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (product.payment_type !== 'subscription') {
          return new Response(
            JSON.stringify({ error: 'Product is not a subscription type' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for existing active subscription
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('user_id', user_id)
          .eq('product_id', product_id)
          .in('status', ['active', 'pending', 'past_due'])
          .maybeSingle();

        if (existingSubscription) {
          return new Response(
            JSON.stringify({ 
              error: 'User already has an active subscription for this product',
              subscription_id: existingSubscription.id
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate period dates
        const now = new Date();
        const periodEnd = calculatePeriodEnd(now, plan_interval);

        // Create subscription
        const { data: subscription, error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id,
            product_id,
            status: 'pending', // Will be activated on payment confirmation
            plan_interval,
            amount,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            payment_method,
            external_subscription_id: sanitizeString(external_subscription_id, 100),
            external_customer_id: sanitizeString(external_customer_id, 100),
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating subscription:', createError);
          return new Response(
            JSON.stringify({ error: 'Failed to create subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Subscription created:', subscription.id);

        return new Response(
          JSON.stringify({ success: true, subscription }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // ACTIVATE SUBSCRIPTION (on payment success)
      // =====================================
      case 'activate': {
        const { subscription_id, external_subscription_id } = params;

        if (!subscription_id && !external_subscription_id) {
          return new Response(
            JSON.stringify({ error: 'Missing subscription_id or external_subscription_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find subscription
        let query = supabase.from('subscriptions').select('*');
        if (subscription_id) {
          query = query.eq('id', subscription_id);
        } else {
          query = query.eq('external_subscription_id', external_subscription_id);
        }

        const { data: subscription, error: findError } = await query.maybeSingle();

        if (findError || !subscription) {
          return new Response(
            JSON.stringify({ error: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Activate subscription
        const now = new Date();
        const periodEnd = calculatePeriodEnd(now, subscription.plan_interval);

        const { data: updatedSubscription, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            started_at: now.toISOString(),
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .eq('id', subscription.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error activating subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to activate subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create notification for user
        try {
          const { data: product } = await supabase
            .from('products')
            .select('name, delivery_method, user_id')
            .eq('id', subscription.product_id)
            .single();

          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Assinatura ativada',
            p_message: `Sua assinatura do ${product?.name || 'produto'} foi ativada com sucesso!`,
            p_type: 'success'
          });
          
          // Sync subscription activation with member area enrollment
          if (product?.delivery_method === 'member_area') {
            console.log('Creating enrollment for activated subscription:', subscription.id);
            
            // Get user email
            const { data: profile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('user_id', subscription.user_id)
              .single();
              
            if (profile?.email) {
              // Get or create a sale reference for the enrollment
              const metadata = subscription.metadata as { sale_id?: string } | null;
              const saleId = metadata?.sale_id;
              
              if (saleId) {
                const { data: enrollmentId, error: enrollmentError } = await supabase.rpc('create_enrollment_after_payment', {
                  p_sale_id: saleId,
                  p_student_email: profile.email,
                  p_student_name: profile.full_name || 'Assinante',
                  p_product_id: subscription.product_id,
                });
                
                if (enrollmentError) {
                  console.error('Error creating enrollment on subscription activate:', enrollmentError);
                } else if (enrollmentId) {
                  console.log('Enrollment created for subscription activation:', enrollmentId);
                  
                  // Notify seller
                  if (product.user_id) {
                    await supabase.rpc('create_system_notification', {
                      p_user_id: product.user_id,
                      p_title: 'Novo assinante matriculado!',
                      p_message: `${profile.full_name || 'Assinante'} foi matriculado na área de membros.`,
                      p_type: 'info',
                      p_link: `/dashboard/produtos/${subscription.product_id}`
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Error creating notification:', e);
        }

        console.log('Subscription activated:', subscription.id);

        return new Response(
          JSON.stringify({ success: true, subscription: updatedSubscription }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // RENEW SUBSCRIPTION (on recurring payment)
      // =====================================
      case 'renew': {
        const { subscription_id, external_subscription_id } = params;

        if (!subscription_id && !external_subscription_id) {
          return new Response(
            JSON.stringify({ error: 'Missing subscription_id or external_subscription_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Find subscription
        let query = supabase.from('subscriptions').select('*');
        if (subscription_id) {
          query = query.eq('id', subscription_id);
        } else {
          query = query.eq('external_subscription_id', external_subscription_id);
        }

        const { data: subscription, error: findError } = await query.maybeSingle();

        if (findError || !subscription) {
          return new Response(
            JSON.stringify({ error: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate new period
        const now = new Date();
        const currentEnd = new Date(subscription.current_period_end);
        const newStart = currentEnd > now ? currentEnd : now;
        const newEnd = calculatePeriodEnd(newStart, subscription.plan_interval);

        const { data: updatedSubscription, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: newStart.toISOString(),
            current_period_end: newEnd.toISOString(),
          })
          .eq('id', subscription.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error renewing subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to renew subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Subscription renewed:', subscription.id);

        return new Response(
          JSON.stringify({ success: true, subscription: updatedSubscription }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // CANCEL SUBSCRIPTION
      // =====================================
      case 'cancel': {
        const { subscription_id, cancel_at_period_end = true } = params;

        if (!subscription_id) {
          return new Response(
            JSON.stringify({ error: 'Missing subscription_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const now = new Date();

        const updateData = cancel_at_period_end
          ? { cancel_at_period_end: true, canceled_at: now.toISOString() }
          : { status: 'canceled', canceled_at: now.toISOString() };

        const { data: subscription, error: updateError } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('id', subscription_id)
          .select()
          .single();

        if (updateError) {
          console.error('Error canceling subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to cancel subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create notification
        try {
          const { data: product } = await supabase
            .from('products')
            .select('name, delivery_method')
            .eq('id', subscription.product_id)
            .single();

          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Assinatura cancelada',
            p_message: cancel_at_period_end 
              ? `Sua assinatura do ${product?.name || 'produto'} será cancelada ao final do período atual.`
              : `Sua assinatura do ${product?.name || 'produto'} foi cancelada.`,
            p_type: 'warning'
          });
          
          // If immediate cancellation (not at period end) and product has member area, revoke enrollment
          if (!cancel_at_period_end && product?.delivery_method === 'member_area') {
            console.log('Revoking member area access for subscription:', subscription_id);
            
            // Get sale_id from subscription metadata if available
            const metadata = subscription.metadata as { sale_id?: string } | null;
            const saleId = metadata?.sale_id;
            
            if (saleId) {
              const { error: revokeError } = await supabase.rpc('revoke_enrollment', {
                p_sale_id: saleId,
                p_reason: 'Assinatura cancelada pelo usuário',
              });
              
              if (revokeError) {
                console.error('Error revoking enrollment on subscription cancel:', revokeError);
              } else {
                console.log('Enrollment revoked for cancelled subscription');
              }
            } else {
              // Find enrollments by student email and revoke
              const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .eq('user_id', subscription.user_id)
                .single();
                
              if (profile?.email) {
                // Find student and revoke enrollment
                const { data: student } = await supabase
                  .from('students')
                  .select('id')
                  .eq('email', profile.email)
                  .eq('product_id', subscription.product_id)
                  .maybeSingle();
                  
                if (student) {
                  await supabase
                    .from('enrollments')
                    .update({
                      status: 'cancelled',
                      access_revoked_at: new Date().toISOString(),
                      revoke_reason: 'Assinatura cancelada pelo usuário',
                    })
                    .eq('student_id', student.id)
                    .eq('product_id', subscription.product_id);
                  
                  console.log('Enrollment revoked by student lookup');
                }
              }
            }
          }
        } catch (e) {
          console.error('Error creating notification:', e);
        }

        console.log('Subscription canceled:', subscription_id);

        return new Response(
          JSON.stringify({ success: true, subscription }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // CHECK ACCESS
      // =====================================
      case 'check_access': {
        const { user_id, product_id } = params;

        if (!user_id || !product_id) {
          return new Response(
            JSON.stringify({ error: 'Missing user_id or product_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: hasAccess } = await supabase.rpc('check_subscription_access', {
          p_user_id: user_id,
          p_product_id: product_id
        });

        const { data: subscription } = await supabase.rpc('get_active_subscription', {
          p_user_id: user_id,
          p_product_id: product_id
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            has_access: hasAccess || false,
            subscription: subscription?.[0] || null 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // GET USER SUBSCRIPTIONS
      // =====================================
      case 'list': {
        const { user_id } = params;

        if (!user_id) {
          return new Response(
            JSON.stringify({ error: 'Missing user_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: subscriptions, error } = await supabase
          .from('subscriptions')
          .select(`
            *,
            products:product_id (
              id,
              name,
              image_url,
              price
            )
          `)
          .eq('user_id', user_id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching subscriptions:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch subscriptions' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, subscriptions }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // =====================================
      // UPDATE PAYMENT FAILURE (past_due)
      // =====================================
      case 'payment_failed': {
        const { subscription_id, external_subscription_id } = params;

        if (!subscription_id && !external_subscription_id) {
          return new Response(
            JSON.stringify({ error: 'Missing subscription_id or external_subscription_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let query = supabase.from('subscriptions').select('*');
        if (subscription_id) {
          query = query.eq('id', subscription_id);
        } else {
          query = query.eq('external_subscription_id', external_subscription_id);
        }

        const { data: subscription, error: findError } = await query.maybeSingle();

        if (findError || !subscription) {
          return new Response(
            JSON.stringify({ error: 'Subscription not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: updatedSubscription, error: updateError } = await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', subscription.id)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update subscription' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create notification
        try {
          const { data: product } = await supabase
            .from('products')
            .select('name')
            .eq('id', subscription.product_id)
            .single();

          await supabase.rpc('create_system_notification', {
            p_user_id: subscription.user_id,
            p_title: 'Problema com pagamento',
            p_message: `Houve um problema com o pagamento da sua assinatura do ${product?.name || 'produto'}. Por favor, atualize seus dados de pagamento.`,
            p_type: 'error'
          });
        } catch (e) {
          console.error('Error creating notification:', e);
        }

        console.log('Subscription payment failed:', subscription.id);

        return new Response(
          JSON.stringify({ success: true, subscription: updatedSubscription }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Manage subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
