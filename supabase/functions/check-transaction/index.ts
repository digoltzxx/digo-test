import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map PodPay status to internal status
const STATUS_MAP: Record<string, string> = {
  'approved': 'approved',
  'paid': 'approved',
  'confirmed': 'approved',
  'authorized': 'approved',
  'refused': 'refused',
  'refunded': 'refunded',
  'chargeback': 'chargeback',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'expired': 'expired',
  'pending': 'pending',
  'waiting_payment': 'pending',
  'processing': 'pending',
};

// Status priority to prevent regression
const STATUS_PRIORITY: Record<string, number> = {
  'pending': 1,
  'refused': 2,
  'cancelled': 2,
  'expired': 2,
  'approved': 3,
  'refunded': 4,
  'chargeback': 5,
};

// Query transaction status from PodPay API
async function queryPodPayTransaction(
  secretKey: string, 
  transactionId: string
): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    console.log('[CheckTransaction] Querying PodPay for transaction:', transactionId);
    
    const credentials = `${secretKey}:x`;
    const encodedCredentials = btoa(credentials);
    const authHeader = `Basic ${encodedCredentials}`;
    
    const response = await fetch(`https://api.podpay.co/v1/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CheckTransaction] PodPay API error:', response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    console.log('[CheckTransaction] PodPay response:', { id: data.id, status: data.status });
    return { success: true, transaction: data };
  } catch (error) {
    console.error('[CheckTransaction] Error querying PodPay:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Update sale status with audit logging
async function updateSaleStatus(
  supabase: any, 
  saleId: string, 
  newStatus: string, 
  oldStatus: string,
  podpayStatus: string,
  transactionId: string | null,
  source: string
): Promise<boolean> {
  try {
    const oldPriority = STATUS_PRIORITY[oldStatus] || 0;
    const newPriority = STATUS_PRIORITY[newStatus] || 0;
    
    // Prevent status regression (except for refunds and chargebacks which are special)
    if (newPriority < oldPriority && newPriority < 4) {
      console.log(`[CheckTransaction] Status regression blocked: ${oldStatus} (${oldPriority}) -> ${newStatus} (${newPriority})`);
      return false;
    }
    
    // Don't update if status is the same
    if (newStatus === oldStatus) {
      console.log(`[CheckTransaction] Status unchanged: ${newStatus}`);
      return false;
    }
    
    // Update sale
    const { error: updateError } = await supabase
      .from('sales')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId);
    
    if (updateError) {
      console.error('[CheckTransaction] Sale update error:', updateError);
      return false;
    }
    
    console.log(`[CheckTransaction] Sale ${saleId} updated: ${oldStatus} -> ${newStatus}`);
    
    // Log the status change
    await supabase.from('webhook_logs').insert({
      event_type: 'check_transaction_update',
      payload: {
        sale_id: saleId,
        transaction_id: transactionId,
        old_status: oldStatus,
        new_status: newStatus,
        podpay_status: podpayStatus,
        source: source,
        timestamp: new Date().toISOString(),
      },
      status: 'processed',
      processed_at: new Date().toISOString(),
    });
    
    // Create notification if payment approved
    if (newStatus === 'approved') {
      const { data: sale } = await supabase
        .from('sales')
        .select('seller_user_id, amount, buyer_name')
        .eq('id', saleId)
        .single();
      
      if (sale?.seller_user_id) {
        await supabase.rpc('create_system_notification', {
          p_user_id: sale.seller_user_id,
          p_title: 'Pagamento confirmado!',
          p_message: `${sale.buyer_name || 'Cliente'} realizou um pagamento de R$ ${(sale.amount || 0).toFixed(2)}`,
          p_type: 'success',
          p_link: '/dashboard/vendas'
        });
        console.log('[CheckTransaction] Notification sent to seller:', sale.seller_user_id);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[CheckTransaction] Error in updateSaleStatus:', error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const podpaySecretKey = Deno.env.get('PODPAY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const transactionId = url.searchParams.get('transaction_id');
    const saleId = url.searchParams.get('sale_id');
    const orderId = url.searchParams.get('order_id');
    const forceCheck = url.searchParams.get('force') === 'true';

    console.log('[CheckTransaction] Request:', { transactionId, saleId, orderId, forceCheck });

    if (!transactionId && !saleId && !orderId) {
      return new Response(
        JSON.stringify({ error: 'Missing transaction_id, sale_id, or order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find sale in database using various identifiers
    let sale = null;
    
    if (saleId) {
      const { data } = await supabase
        .from('sales')
        .select('id, status, transaction_id, amount, product_id, buyer_name, buyer_email, seller_user_id, created_at, payment_method')
        .eq('id', saleId)
        .maybeSingle();
      sale = data;
    }
    
    if (!sale && transactionId) {
      const { data } = await supabase
        .from('sales')
        .select('id, status, transaction_id, amount, product_id, buyer_name, buyer_email, seller_user_id, created_at, payment_method')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      sale = data;
    }
    
    if (!sale && orderId) {
      const { data } = await supabase
        .from('sales')
        .select('id, status, transaction_id, amount, product_id, buyer_name, buyer_email, seller_user_id, created_at, payment_method')
        .eq('transaction_id', orderId)
        .maybeSingle();
      sale = data;
    }

    if (!sale) {
      console.log('[CheckTransaction] Sale not found');
      return new Response(
        JSON.stringify({ success: false, error: 'Sale not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CheckTransaction] Found sale:', { id: sale.id, status: sale.status, transaction_id: sale.transaction_id });

    let podpayStatus = null;
    let statusUpdated = false;
    let syncSource = 'database';

    // Query PodPay API if:
    // 1. Sale is pending (needs confirmation), OR
    // 2. Force check requested
    // AND we have PodPay API key AND transaction_id
    const shouldQueryPodPay = (sale.status === 'pending' || forceCheck) && 
                              podpaySecretKey && 
                              sale.transaction_id;
    
    if (shouldQueryPodPay) {
      console.log('[CheckTransaction] Querying PodPay for latest status...');
      
      const podpayResult = await queryPodPayTransaction(podpaySecretKey, sale.transaction_id);
      
      if (podpayResult.success && podpayResult.transaction) {
        podpayStatus = podpayResult.transaction.status;
        const rawStatus = String(podpayStatus).toLowerCase();
        const mappedStatus = STATUS_MAP[rawStatus] || 'pending';
        
        console.log('[CheckTransaction] PodPay status:', podpayStatus, '-> mapped:', mappedStatus);
        
        // Update if status changed
        if (mappedStatus !== sale.status) {
          statusUpdated = await updateSaleStatus(
            supabase,
            sale.id,
            mappedStatus,
            sale.status,
            podpayStatus,
            sale.transaction_id,
            'active_check'
          );
          
          if (statusUpdated) {
            sale.status = mappedStatus;
            syncSource = 'podpay_api';
          }
        }
      } else {
        console.log('[CheckTransaction] PodPay query failed:', podpayResult.error);
      }
    }

    // Get product info
    const { data: product } = await supabase
      .from('products')
      .select('name, image_url, payment_type')
      .eq('id', sale.product_id)
      .maybeSingle();

    // Get delivery method from product_deliverables
    const { data: deliverable } = await supabase
      .from('product_deliverables')
      .select('delivery_type')
      .eq('product_id', sale.product_id)
      .eq('is_active', true)
      .order('position')
      .limit(1)
      .maybeSingle();

    const responseTime = Date.now() - requestStart;
    console.log(`[CheckTransaction] Complete in ${responseTime}ms - Status: ${sale.status}`);

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: sale.id,
        transaction_id: sale.transaction_id,
        status: sale.status,
        amount: sale.amount,
        buyer_name: sale.buyer_name,
        buyer_email: sale.buyer_email,
        product_name: product?.name,
        product_image: product?.image_url,
        created_at: sale.created_at,
        payment_method: sale.payment_method,
        delivery_method: deliverable?.delivery_type || 'member_area',
        is_subscription: product?.payment_type === 'subscription',
        podpay_status: podpayStatus,
        status_updated: statusUpdated,
        sync_source: syncSource,
        response_time_ms: responseTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CheckTransaction] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
