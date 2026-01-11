import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FingerprintRequest {
  visitor_id: string;
  request_id?: string;
  user_id?: string;
  checkout_session_id?: string;
  ip_address?: string;
  user_agent?: string;
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

    const payload: FingerprintRequest = await req.json();
    console.log('[FingerprintJS] Verification request received:', {
      visitor_id: payload.visitor_id,
      has_request_id: !!payload.request_id,
    });

    if (!payload.visitor_id) {
      throw new Error('Visitor ID is required');
    }

    // Get FingerprintJS API key from user's integration or environment
    let apiKey = Deno.env.get('FINGERPRINTJS_API_KEY');

    if (payload.user_id) {
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('config')
        .eq('user_id', payload.user_id)
        .eq('integration_id', 'fingerprintjs')
        .single();

      if (integration?.config) {
        const config = integration.config as { api_key?: string };
        if (config.api_key) {
          apiKey = config.api_key;
        }
      }
    }

    if (!apiKey) {
      // If no API key, just log the fingerprint without server verification
      console.log('[FingerprintJS] No API key, storing fingerprint without verification');
      
      await supabase.from('antifraud_analysis').insert({
        user_id: payload.user_id || 'anonymous',
        provider: 'fingerprintjs',
        device_fingerprint: payload.visitor_id,
        ip_address: payload.ip_address,
        checkout_session_id: payload.checkout_session_id,
        analysis_data: {
          visitor_id: payload.visitor_id,
          verified: false,
        },
        analyzed_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({
        success: true,
        verified: false,
        visitor_id: payload.visitor_id,
        message: 'Fingerprint stored without server verification',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify with FingerprintJS Pro API
    const verifyUrl = `https://api.fpjs.io/events/${payload.request_id}`;
    
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'Auth-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FingerprintJS] API error:', errorText);
      throw new Error(`FingerprintJS API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[FingerprintJS] Verification result:', result);

    // Extract risk signals
    const identification = result.products?.identification?.data;
    const botDetection = result.products?.botd?.data;
    const ipInfo = result.products?.ipInfo?.data;
    const vpnDetection = result.products?.vpn?.data;

    const riskScore = calculateRiskScore(identification, botDetection, vpnDetection);
    const riskLevel = riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low';

    // Store analysis in database
    await supabase.from('antifraud_analysis').insert({
      user_id: payload.user_id || 'anonymous',
      provider: 'fingerprintjs',
      device_fingerprint: identification?.visitorId,
      ip_address: ipInfo?.ip || payload.ip_address,
      checkout_session_id: payload.checkout_session_id,
      risk_score: riskScore,
      risk_level: riskLevel,
      decision: riskScore > 70 ? 'block' : 'allow',
      analysis_data: {
        visitor_id: identification?.visitorId,
        confidence: identification?.confidence,
        is_incognito: identification?.incognito,
        bot_detected: botDetection?.bot?.result === 'detected',
        bot_type: botDetection?.bot?.type,
        is_vpn: vpnDetection?.result,
        ip_info: ipInfo,
        browser: identification?.browserDetails,
      },
      analyzed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      verified: true,
      visitor_id: identification?.visitorId,
      confidence: identification?.confidence,
      risk_score: riskScore,
      risk_level: riskLevel,
      is_bot: botDetection?.bot?.result === 'detected',
      is_vpn: vpnDetection?.result,
      is_incognito: identification?.incognito,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FingerprintJS] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateRiskScore(
  identification: Record<string, unknown> | undefined,
  botDetection: Record<string, unknown> | undefined,
  vpnDetection: Record<string, unknown> | undefined
): number {
  let score = 0;

  // Low confidence increases risk
  const confidence = (identification?.confidence as { score?: number })?.score || 0;
  if (confidence < 0.5) score += 30;
  else if (confidence < 0.8) score += 15;

  // Incognito mode is suspicious
  if (identification?.incognito) score += 20;

  // Bot detection
  if ((botDetection?.bot as { result?: string })?.result === 'detected') score += 50;

  // VPN/Proxy detection
  if (vpnDetection?.result) score += 25;

  return Math.min(score, 100);
}
