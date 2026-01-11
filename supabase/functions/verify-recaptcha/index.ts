import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecaptchaRequest {
  token: string;
  user_id?: string;
  action?: string;
  ip_address?: string;
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

    const payload: RecaptchaRequest = await req.json();
    console.log('[reCAPTCHA] Verification request received:', {
      action: payload.action,
      has_token: !!payload.token,
    });

    if (!payload.token) {
      throw new Error('reCAPTCHA token is required');
    }

    // Get reCAPTCHA secret from user's integration or environment
    let secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');

    if (payload.user_id) {
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('config')
        .eq('user_id', payload.user_id)
        .eq('integration_id', 'recaptcha')
        .single();

      if (integration?.config) {
        const config = integration.config as { secret_key?: string };
        if (config.secret_key) {
          secretKey = config.secret_key;
        }
      }
    }

    if (!secretKey) {
      throw new Error('reCAPTCHA secret key not configured');
    }

    // Verify token with Google
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const params = new URLSearchParams();
    params.append('secret', secretKey);
    params.append('response', payload.token);
    if (payload.ip_address) {
      params.append('remoteip', payload.ip_address);
    }

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const result = await response.json();
    console.log('[reCAPTCHA] Verification result:', result);

    // For reCAPTCHA v3, check score
    const isValid = result.success && (result.score === undefined || result.score >= 0.5);
    const actionMatch = !payload.action || result.action === payload.action;

    if (!isValid || !actionMatch) {
      console.warn('[reCAPTCHA] Verification failed:', {
        success: result.success,
        score: result.score,
        action: result.action,
        expected_action: payload.action,
        error_codes: result['error-codes'],
      });
    }

    return new Response(JSON.stringify({
      success: isValid && actionMatch,
      score: result.score,
      action: result.action,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
      error_codes: result['error-codes'],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[reCAPTCHA] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
