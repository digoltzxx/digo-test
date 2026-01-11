import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppMessage {
  user_id: string;
  access_token: string;
  phone_number_id: string;
  recipient_phone: string;
  template_name: string;
  template_params: string[];
  language_code?: string;
  sale_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const message: WhatsAppMessage = await req.json();
    
    console.log('Sending WhatsApp message to:', message.recipient_phone);

    // Format phone number (remove non-digits and ensure country code)
    let phone = message.recipient_phone.replace(/\D/g, '');
    if (!phone.startsWith('55')) {
      phone = '55' + phone;
    }

    const url = `https://graph.facebook.com/v18.0/${message.phone_number_id}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: message.template_name,
        language: { code: message.language_code || 'pt_BR' },
        components: message.template_params.length > 0 ? [{
          type: 'body',
          parameters: message.template_params.map(text => ({ type: 'text', text })),
        }] : [],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${message.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    const success = !!data.messages?.[0]?.id;
    
    // Log to database
    await supabase.from('whatsapp_messages').insert({
      user_id: message.user_id,
      phone_number: phone,
      template_name: message.template_name,
      template_params: message.template_params,
      message_type: 'template',
      provider_message_id: data.messages?.[0]?.id,
      status: success ? 'sent' : 'failed',
      sent_at: success ? new Date().toISOString() : null,
      error_code: data.error?.code?.toString(),
      error_message: data.error?.message,
      sale_id: message.sale_id,
    });

    if (success) {
      console.log('WhatsApp message sent:', data.messages[0].id);
      return new Response(JSON.stringify({ 
        success: true, 
        message_id: data.messages[0].id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('WhatsApp API error:', data.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.error?.message || 'Unknown error',
        error_code: data.error?.code
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
