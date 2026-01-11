import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TelegramMessage {
  user_id: string;
  chat_id: string;
  bot_token: string;
  message: string;
  event_type?: string;
  sale_id?: string;
  amount?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, chat_id, bot_token, message, event_type, sale_id, amount }: TelegramMessage = await req.json();

    console.log('Sending Telegram notification to chat:', chat_id);

    const url = `https://api.telegram.org/bot${bot_token}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    
    // Log to database
    await supabase.from('telegram_notifications').insert({
      user_id,
      chat_id,
      event_type: event_type || 'manual',
      message,
      message_id: data.result?.message_id?.toString(),
      sent_at: data.ok ? new Date().toISOString() : null,
      error_message: data.ok ? null : data.description,
      sale_id,
      amount,
    });

    if (data.ok) {
      console.log('Telegram message sent successfully:', data.result.message_id);
      return new Response(JSON.stringify({ 
        success: true, 
        message_id: data.result.message_id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('Telegram API error:', data.description);
      return new Response(JSON.stringify({ 
        success: false, 
        error: data.description 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
