import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MailerLiteRequest {
  user_id: string;
  email: string;
  name?: string;
  phone?: string;
  fields?: Record<string, string>;
  groups?: string[];
  event_type?: string;
  sale_id?: string;
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

    const payload: MailerLiteRequest = await req.json();
    console.log('[MailerLite] Request received:', { 
      user_id: payload.user_id, 
      email: payload.email,
      event_type: payload.event_type 
    });

    // Get user's MailerLite configuration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'mailerlite')
      .single();

    if (integrationError || !integration) {
      console.error('[MailerLite] Integration not found:', integrationError);
      throw new Error('MailerLite integration not configured');
    }

    const config = integration.config as { api_key?: string; group_id?: string };
    const apiKey = config.api_key;

    if (!apiKey) {
      throw new Error('MailerLite API key not configured');
    }

    // Create or update subscriber
    const subscriberData: Record<string, unknown> = {
      email: payload.email,
      fields: {
        name: payload.name || '',
        phone: payload.phone || '',
        ...payload.fields,
      },
      groups: payload.groups || (config.group_id ? [config.group_id] : []),
    };

    console.log('[MailerLite] Creating/updating subscriber:', subscriberData);

    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(subscriberData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[MailerLite] API error:', responseData);
      
      // Log error to database
      await supabase.from('email_marketing_contacts').insert({
        user_id: payload.user_id,
        email: payload.email,
        name: payload.name,
        phone: payload.phone,
        provider: 'mailerlite',
        status: 'error',
        sync_error: JSON.stringify(responseData),
      });

      throw new Error(`MailerLite API error: ${responseData.message || 'Unknown error'}`);
    }

    console.log('[MailerLite] Subscriber created/updated successfully:', responseData.data?.id);

    // Log success to database
    await supabase.from('email_marketing_contacts').upsert({
      user_id: payload.user_id,
      email: payload.email,
      name: payload.name,
      phone: payload.phone,
      provider: 'mailerlite',
      provider_contact_id: responseData.data?.id,
      status: 'active',
      synced_at: new Date().toISOString(),
      list_id: config.group_id,
    }, {
      onConflict: 'user_id,email,provider',
    });

    // Update last sync timestamp
    await supabase
      .from('user_integrations')
      .update({ 
        last_sync_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
      })
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'mailerlite');

    return new Response(JSON.stringify({
      success: true,
      subscriber_id: responseData.data?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MailerLite] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
