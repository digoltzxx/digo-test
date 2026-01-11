import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GA4Event {
  user_id: string;
  measurement_id: string;
  api_secret: string;
  client_id: string;
  event_name: string; // purchase, add_payment_info, refund
  transaction_id?: string;
  value?: number;
  currency?: string;
  items?: Array<{
    item_id?: string;
    item_name?: string;
    price?: number;
    quantity?: number;
  }>;
  sale_id?: string;
  user_properties?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event: GA4Event = await req.json();
    
    console.log('Sending GA4 event:', event.event_name);

    // Create deduplication key
    const deduplicationKey = `${event.sale_id || event.transaction_id}_${event.event_name}`;

    // Check if already sent (deduplication)
    const { data: existing } = await supabase
      .from('analytics_events')
      .select('id')
      .eq('deduplication_key', deduplicationKey)
      .maybeSingle();

    if (existing) {
      console.log('Event already sent, skipping (deduplication)');
      return new Response(JSON.stringify({ 
        success: true, 
        deduplicated: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare event params
    const eventParams: Record<string, unknown> = {
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
    };

    if (event.items && event.items.length > 0) {
      eventParams.items = event.items;
    }

    // Send to GA4 Measurement Protocol
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${event.measurement_id}&api_secret=${event.api_secret}`;
    
    const payload = {
      client_id: event.client_id,
      user_properties: event.user_properties,
      events: [{
        name: event.event_name,
        params: eventParams,
      }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const success = response.status === 204;

    // Log to database
    await supabase.from('analytics_events').insert({
      user_id: event.user_id,
      measurement_id: event.measurement_id,
      client_id: event.client_id,
      event_name: event.event_name,
      event_params: eventParams,
      user_properties: event.user_properties,
      sale_id: event.sale_id,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      sent_at: success ? new Date().toISOString() : null,
      error_message: success ? null : `Status: ${response.status}`,
      deduplication_key: deduplicationKey,
    });

    console.log('GA4 event sent:', success ? 'success' : 'failed');

    return new Response(JSON.stringify({ 
      success,
      event_name: event.event_name,
    }), {
      status: success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending GA4 event:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
