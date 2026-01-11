import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SESRequest {
  user_id: string;
  to_email: string;
  to_name?: string;
  subject: string;
  html_body: string;
  text_body?: string;
  from_email?: string;
  from_name?: string;
  event_type?: string;
  sale_id?: string;
}

// AWS Signature V4 signing
async function signAWSRequest(
  method: string,
  url: string,
  body: string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  
  const host = new URL(url).host;
  const canonicalUri = new URL(url).pathname;
  const canonicalQuerystring = '';
  
  const payloadHash = await sha256(body);
  
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n');
  
  const kDate = await hmacSHA256(`AWS4${secretKey}`, dateStamp);
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, service);
  const kSigning = await hmacSHA256(kService, 'aws4_request');
  
  const signature = await hmacSHA256Hex(kSigning, stringToSign);
  
  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Amz-Date': amzDate,
    'Authorization': authorizationHeader,
  };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSHA256(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const keyBuffer = typeof key === 'string' 
    ? new TextEncoder().encode(key) 
    : key;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function hmacSHA256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const hashBuffer = await hmacSHA256(key, message);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

    const payload: SESRequest = await req.json();
    console.log('[Amazon SES] Request received:', { 
      user_id: payload.user_id, 
      to_email: payload.to_email,
      subject: payload.subject 
    });

    // Get user's SES configuration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'amazon_ses')
      .single();

    if (integrationError || !integration) {
      console.error('[Amazon SES] Integration not found:', integrationError);
      throw new Error('Amazon SES integration not configured');
    }

    const config = integration.config as { 
      access_key?: string; 
      secret_key?: string; 
      region?: string;
      from_email?: string;
      from_name?: string;
    };

    if (!config.access_key || !config.secret_key) {
      throw new Error('Amazon SES credentials not configured');
    }

    const region = config.region || 'us-east-1';
    const fromEmail = payload.from_email || config.from_email || 'noreply@example.com';
    const fromName = payload.from_name || config.from_name || 'Gateway';
    
    // Build SES request body
    const params = new URLSearchParams();
    params.append('Action', 'SendEmail');
    params.append('Source', `${fromName} <${fromEmail}>`);
    params.append('Destination.ToAddresses.member.1', payload.to_email);
    params.append('Message.Subject.Data', payload.subject);
    params.append('Message.Body.Html.Data', payload.html_body);
    if (payload.text_body) {
      params.append('Message.Body.Text.Data', payload.text_body);
    }
    params.append('Version', '2010-12-01');

    const url = `https://email.${region}.amazonaws.com/`;
    const body = params.toString();

    const headers = await signAWSRequest(
      'POST',
      url,
      body,
      config.access_key,
      config.secret_key,
      region,
      'ses'
    );

    console.log('[Amazon SES] Sending email...');

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[Amazon SES] API error:', responseText);
      throw new Error(`Amazon SES error: ${responseText}`);
    }

    // Extract MessageId from XML response
    const messageIdMatch = responseText.match(/<MessageId>(.+?)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : null;

    console.log('[Amazon SES] Email sent successfully:', messageId);

    // Update last sync timestamp
    await supabase
      .from('user_integrations')
      .update({ 
        last_sync_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
      })
      .eq('user_id', payload.user_id)
      .eq('integration_id', 'amazon_ses');

    return new Response(JSON.stringify({
      success: true,
      message_id: messageId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Amazon SES] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
