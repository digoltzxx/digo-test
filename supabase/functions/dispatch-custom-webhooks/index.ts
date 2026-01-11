import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  event: string;
  event_id: string;
  timestamp: string;
  gateway: {
    name: string;
    environment: string;
  };
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    currency: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    document: string;
  };
  product: {
    id: string;
    name: string;
  };
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  };
  subscription?: {
    id: string | null;
    cycle: string | null;
  };
}

interface DispatchRequest {
  event: string;
  payload: WebhookPayload;
  seller_user_id: string;
  product_id?: string;
}

// Helper to make requests with retry and exponential backoff
const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok || response.status < 500) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
    
    if (attempt < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { event, payload, seller_user_id, product_id }: DispatchRequest = await req.json();
    
    console.log(`[CUSTOM_WEBHOOKS] Dispatching event: ${event} for seller: ${seller_user_id}`);

    // Fetch all active custom webhooks for this seller that have this event enabled
    const { data: webhooks, error: webhooksError } = await supabase
      .from('custom_webhooks')
      .select('*')
      .eq('user_id', seller_user_id)
      .eq('is_active', true)
      .contains('events_enabled', [event]);

    if (webhooksError) {
      console.error('[CUSTOM_WEBHOOKS] Error fetching webhooks:', webhooksError);
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      console.log('[CUSTOM_WEBHOOKS] No active webhooks found for this event');
      return new Response(
        JSON.stringify({ success: true, message: 'No webhooks to dispatch', dispatched: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CUSTOM_WEBHOOKS] Found ${webhooks.length} webhook(s) to dispatch`);

    const results: { webhook_id: string; success: boolean; message: string }[] = [];

    for (const webhook of webhooks) {
      try {
        // Check product filter
        if (webhook.product_filter === 'specific' && webhook.product_ids && product_id) {
          if (!webhook.product_ids.includes(product_id)) {
            console.log(`[CUSTOM_WEBHOOKS] Webhook ${webhook.id} skipped - product not in filter`);
            continue;
          }
        }

        // Build headers
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json',
          'User-Agent': 'RoyalPay-Webhooks/1.0'
        };
        
        if (webhook.token) {
          headers['Authorization'] = `Bearer ${webhook.token}`;
        }

        // Build webhook payload
        const webhookPayload = {
          event,
          event_id: payload.event_id,
          timestamp: payload.timestamp,
          gateway: payload.gateway,
          payment: payload.payment,
          customer: payload.customer,
          product: payload.product,
          utm: payload.utm,
          subscription: payload.subscription || null,
        };

        console.log(`[CUSTOM_WEBHOOKS] Sending to ${webhook.url}`);

        const response = await fetchWithRetry(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(webhookPayload)
        });

        const success = response.ok;
        const message = success ? `Status: ${response.status}` : `Error: ${response.status}`;

        // Update webhook stats
        if (success) {
          await supabase
            .from('custom_webhooks')
            .update({ 
              success_count: (webhook.success_count || 0) + 1,
              last_triggered_at: new Date().toISOString(),
              last_error: null
            })
            .eq('id', webhook.id);
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          await supabase
            .from('custom_webhooks')
            .update({ 
              error_count: (webhook.error_count || 0) + 1,
              last_triggered_at: new Date().toISOString(),
              last_error: `HTTP ${response.status}: ${errorText.substring(0, 500)}`
            })
            .eq('id', webhook.id);
        }

        results.push({ 
          webhook_id: webhook.id, 
          success, 
          message 
        });

        console.log(`[CUSTOM_WEBHOOKS] ${success ? 'SUCCESS' : 'FAILED'} ${webhook.name}: ${message}`);

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[CUSTOM_WEBHOOKS] Error dispatching to ${webhook.name}:`, errMsg);
        
        // Update error count
        await supabase
          .from('custom_webhooks')
          .update({ 
            error_count: (webhook.error_count || 0) + 1,
            last_triggered_at: new Date().toISOString(),
            last_error: errMsg.substring(0, 500)
          })
          .eq('id', webhook.id);

        results.push({ 
          webhook_id: webhook.id, 
          success: false, 
          message: errMsg 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[CUSTOM_WEBHOOKS] Completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Dispatched to ${results.length} webhook(s)`,
        dispatched: results.length,
        successful: successCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CUSTOM_WEBHOOKS] [ERROR]', errMsg);
    return new Response(
      JSON.stringify({ success: false, message: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
