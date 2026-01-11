import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MakeRequest {
  user_id: string;
  event_type: string;
  sale_data?: {
    id: string;
    amount: number;
    status: string;
    payment_method?: string;
    product_name?: string;
    product_id?: string;
  };
  customer_data?: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
  };
  metadata?: Record<string, unknown>;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Make] Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: MakeRequest = await req.json();
    console.log('[Make] Request received:', {
      user_id: payload.user_id,
      event_type: payload.event_type,
    });

    // Get user's Make configuration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'make')
      .single();

    if (integrationError || !integration) {
      console.error('[Make] Integration not found:', integrationError);
      throw new Error('Make integration not configured');
    }

    const config = integration.config as { 
      webhook_url?: string;
      events_enabled?: string[];
    };
    const eventsEnabled = integration.events_enabled as string[] || [];

    // Check if this event type is enabled
    if (!eventsEnabled.includes(payload.event_type) && eventsEnabled.length > 0) {
      console.log(`[Make] Event ${payload.event_type} not enabled, skipping`);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: 'Event type not enabled',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.webhook_url) {
      throw new Error('Make webhook URL not configured');
    }

    // Standardized payload for Make
    const makePayload = {
      event_type: payload.event_type,
      timestamp: new Date().toISOString(),
      source: 'gateway',
      version: '1.0',
      data: {
        sale: payload.sale_data,
        customer: payload.customer_data,
        metadata: payload.metadata,
      },
    };

    console.log('[Make] Sending to Make webhook:', config.webhook_url);

    const response = await retryWithBackoff(async () => {
      const res = await fetch(config.webhook_url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(makePayload),
      });

      if (!res.ok && res.status !== 200) {
        throw new Error(`Make webhook error: ${res.status}`);
      }

      return res;
    });

    const responseText = await response.text();
    console.log('[Make] Webhook response:', responseText);

    // Log success
    await supabase.from('integration_events').insert({
      user_id: payload.user_id,
      integration_id: 'make',
      event_type: payload.event_type,
      payload: makePayload,
      status: 'sent',
      sent_at: new Date().toISOString(),
      response_data: { status: response.status, body: responseText },
    });

    // Update last sync
    await supabase
      .from('user_integrations')
      .update({ 
        last_sync_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
      })
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'make');

    return new Response(JSON.stringify({
      success: true,
      status: response.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Make] Error:', error);

    // Log error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const payload = await req.clone().json();
      
      await supabase.from('integration_events').insert({
        user_id: payload.user_id,
        integration_id: 'make',
        event_type: payload.event_type,
        payload: payload,
        status: 'failed',
        error_message: errorMessage,
      });

      await supabase
        .from('user_integrations')
        .update({ 
          last_error: errorMessage,
          error_count: 1, // Will be incremented by trigger if exists
        })
        .eq('user_id', payload.user_id)
        .eq('integration_id', 'make');
    } catch (logError) {
      console.error('[Make] Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
