import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize amount
const sanitizeAmount = (amount: unknown): number => {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || num < 0 || num > 999999999) return 0;
  return Math.round(num * 100) / 100;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    console.log('Processing one-click purchase:', JSON.stringify(body, null, 2));

    const {
      parent_sale_id,
      offer_type, // 'upsell' or 'downsell'
      upsell_id,
      downsell_id,
      product_id,
      amount,
      buyer_name,
      buyer_email,
      buyer_document,
      buyer_phone,
      original_transaction_id,
      is_subscription,
      subscription_interval,
    } = body;

    // Validate required fields
    if (!parent_sale_id || !product_id || !amount || !buyer_email) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const podpaySecretKey = Deno.env.get('PODPAY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify parent sale exists and is approved
    const { data: parentSale, error: parentError } = await supabase
      .from('sales')
      .select('id, status, seller_user_id, transaction_id, payment_method')
      .eq('id', parent_sale_id)
      .eq('status', 'approved')
      .single();

    if (parentError || !parentSale) {
      console.error('Parent sale not found or not approved:', parentError);
      return new Response(
        JSON.stringify({ error: 'Parent sale not found or not approved' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, user_id, delivery_method')
      .eq('id', product_id)
      .eq('status', 'active')
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return new Response(
        JSON.stringify({ error: 'Product not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedAmount = sanitizeAmount(amount);
    console.log('Processing one-click for amount:', sanitizedAmount);

    // Calculate fees (simplified for one-click)
    const paymentFeePercent = 4.99;
    const paymentFee = Math.round((sanitizedAmount * paymentFeePercent / 100 + 1.49) * 100) / 100;
    const netAmount = Math.round((sanitizedAmount - paymentFee) * 100) / 100;

    // Generate unique order ID
    const orderId = `OC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // For one-click purchases, we need to create a new charge using the saved payment method
    // This depends on the gateway's capability to charge saved cards/tokens
    // For now, we'll create the funnel_order and mark it as pending for manual/webhook processing
    
    let transactionId = null;
    let orderStatus = 'pending';

    // If using PodPay and it supports one-click charges
    if (podpaySecretKey && parentSale.payment_method === 'credit_card') {
      try {
        // PodPay One-Click Charge (if supported)
        const credentials = `${podpaySecretKey}:x`;
        const encodedCredentials = btoa(credentials);
        
        const response = await fetch('https://api.podpay.co/v1/transactions', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: Math.round(sanitizedAmount * 100),
            paymentMethod: 'credit_card',
            customer: {
              name: buyer_name,
              email: buyer_email,
              document: buyer_document ? {
                type: buyer_document.length === 14 ? 'cnpj' : 'cpf',
                number: buyer_document,
              } : undefined,
              phone: buyer_phone ? `55${buyer_phone.replace(/\D/g, '')}` : undefined,
            },
            items: [{
              title: product.name,
              unitPrice: Math.round(sanitizedAmount * 100),
              quantity: 1,
              tangible: false,
            }],
            externalRef: orderId,
            metadata: JSON.stringify({
              parent_sale_id,
              offer_type,
              one_click: true,
            }),
            // Reference to original transaction for one-click
            card: {
              // If PodPay supports tokenized card re-use, we'd reference it here
              // This is gateway-specific
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          transactionId = data.id;
          orderStatus = data.status === 'paid' || data.status === 'authorized' ? 'approved' : 'pending';
          console.log('PodPay one-click transaction created:', transactionId, orderStatus);
        } else {
          const errorText = await response.text();
          console.error('PodPay one-click error:', errorText);
          // Fall through to create pending order
        }
      } catch (gatewayError) {
        console.error('Gateway error:', gatewayError);
        // Fall through to create pending order
      }
    }

    // For PIX payments, one-click isn't typically supported
    // Create order as approved since PIX was already paid for parent
    if (parentSale.payment_method === 'pix') {
      // For PIX, we could create a new PIX charge or mark as manual review
      // For simplicity, we'll mark as approved and trust the post-purchase flow
      orderStatus = 'approved';
      console.log('PIX one-click: Marking as approved (trust flow)');
    }

    // Create funnel_order record
    const { data: funnelOrder, error: funnelError } = await supabase
      .from('funnel_orders')
      .insert({
        parent_sale_id,
        upsell_id: offer_type === 'upsell' ? upsell_id : null,
        downsell_id: offer_type === 'downsell' ? downsell_id : null,
        product_id,
        order_type: offer_type,
        amount: sanitizedAmount,
        net_amount: netAmount,
        payment_fee: paymentFee,
        status: orderStatus,
        transaction_id: transactionId || orderId,
        buyer_name,
        buyer_email,
        seller_user_id: product.user_id,
        payment_token_used: true,
        access_granted_at: orderStatus === 'approved' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (funnelError) {
      console.error('Error creating funnel order:', funnelError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Funnel order created:', funnelOrder.id);

    // If order is approved, grant access
    if (orderStatus === 'approved') {
      // Create member access if delivery method is member_area
      if (product.delivery_method === 'member_area') {
        const { error: accessError } = await supabase
          .from('member_access')
          .insert({
            product_id,
            user_email: buyer_email,
            user_name: buyer_name,
            access_status: 'active',
          });

        if (accessError) {
          console.error('Error creating member access:', accessError);
        } else {
          console.log('Member access granted for:', buyer_email);
        }

        // Create enrollment if course exists
        const { data: course } = await supabase
          .from('courses')
          .select('id')
          .eq('product_id', product_id)
          .single();

        if (course) {
          // Find or create student
          let studentId;
          const { data: existingStudent } = await supabase
            .from('students')
            .select('id')
            .eq('email', buyer_email)
            .eq('product_id', product_id)
            .single();

          if (existingStudent) {
            studentId = existingStudent.id;
          } else {
            const { data: newStudent, error: studentError } = await supabase
              .from('students')
              .insert({
                email: buyer_email,
                name: buyer_name,
                product_id,
                seller_user_id: product.user_id,
                status: 'active',
              })
              .select()
              .single();

            if (studentError) {
              console.error('Error creating student:', studentError);
            } else {
              studentId = newStudent.id;
            }
          }

          if (studentId) {
            const { error: enrollError } = await supabase
              .from('enrollments')
              .upsert({
                student_id: studentId,
                course_id: course.id,
                product_id,
                status: 'active',
              }, {
                onConflict: 'student_id,course_id',
              });

            if (enrollError) {
              console.error('Error creating enrollment:', enrollError);
            } else {
              console.log('Enrollment created for student:', studentId);
            }
          }
        }
      }

      // If subscription, create subscription record
      if (is_subscription) {
        const intervalDays = subscription_interval === 'monthly' ? 30 
          : subscription_interval === 'quarterly' ? 90 
          : 365;

        const { error: subError } = await supabase
          .from('subscriptions')
          .insert({
            product_id,
            amount: sanitizedAmount,
            status: 'active',
            plan_interval: subscription_interval,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (subError) {
          console.error('Error creating subscription:', subError);
        }
      }

      // Update funnel order with access granted time
      await supabase
        .from('funnel_orders')
        .update({ access_granted_at: new Date().toISOString() })
        .eq('id', funnelOrder.id);
    }

    // Log success event
    await supabase.from('sales_funnel_events').insert({
      sale_id: parent_sale_id,
      session_id: `oneclick_${Date.now()}`,
      user_email: buyer_email,
      product_id,
      step: offer_type,
      action: orderStatus === 'approved' ? 'accepted' : 'pending',
      offer_id: offer_type === 'upsell' ? upsell_id : downsell_id,
      offer_type,
      amount: sanitizedAmount,
      metadata: { funnel_order_id: funnelOrder.id, order_status: orderStatus },
    });

    return new Response(
      JSON.stringify({
        success: true,
        funnel_order_id: funnelOrder.id,
        status: orderStatus,
        access_granted: orderStatus === 'approved',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing one-click purchase:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
