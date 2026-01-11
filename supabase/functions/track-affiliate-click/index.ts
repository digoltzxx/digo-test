import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// SECURITY UTILITIES
// ===========================================

/**
 * Generates a hashed version of IP for anonymization
 * We don't store raw IPs for privacy
 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.slice(0, 16));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Validates affiliate reference format
 */
function validateAffiliateRef(ref: string | null): boolean {
  if (!ref) return false;
  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]{5,64}$/.test(ref)) return false;
  // Prevent SQL injection patterns
  if (/['";]|--|\*\/|union|select|insert|update|delete|drop/i.test(ref)) return false;
  return true;
}

/**
 * Validates UUID format
 */
function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Sanitizes URL for storage
 */
function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    // Remove sensitive query params
    const sensitiveParams = ['email', 'password', 'token', 'key', 'secret', 'auth'];
    sensitiveParams.forEach(param => parsed.searchParams.delete(param));
    return parsed.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * Rate limiting check
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Clean up old rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

// ===========================================
// MAIN HANDLER
// ===========================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for rate limiting (anonymized)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    // Rate limit by IP (10 requests per minute)
    if (!checkRateLimit(`click_${clientIp}`, 10, 60000)) {
      console.log('Rate limited:', clientIp);
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      affiliation_id, 
      product_id, 
      session_id,
      referrer_url,
      landing_url,
      tracking_id // Anonymous tracking ID from client
    } = body;

    console.log('=== SECURE AFFILIATE CLICK TRACKING ===');
    console.log('Tracking ID:', tracking_id);
    console.log('Session ID:', session_id ? session_id.slice(0, 8) + '...' : 'none');

    // Validate required fields
    if (!affiliation_id || !product_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUIDs
    if (!isValidUUID(affiliation_id) || !isValidUUID(product_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameter format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize session ID
    const sanitizedSessionId = session_id 
      ? session_id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) 
      : null;

    // Anonymize IP address (hash it, don't store raw)
    const anonymizedIp = await hashIP(clientIp);

    // Sanitize user agent (minimal info only)
    const userAgent = req.headers.get('user-agent') || null;
    const sanitizedUserAgent = userAgent 
      ? userAgent.replace(/[<>'"]/g, '').slice(0, 200) 
      : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate affiliation exists and is active
    const { data: affiliation, error: affError } = await supabase
      .from('affiliations')
      .select('id, product_id, user_id, status')
      .eq('id', affiliation_id)
      .eq('status', 'active')
      .maybeSingle();

    if (affError || !affiliation) {
      console.log('Affiliation validation failed');
      return new Response(
        JSON.stringify({ error: 'Invalid affiliation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify product matches
    if (affiliation.product_id !== product_id) {
      console.log('Product mismatch detected');
      return new Response(
        JSON.stringify({ error: 'Affiliation mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate click in last 5 minutes (debounce by anonymized IP)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: existingClick } = await supabase
      .from('affiliate_clicks')
      .select('id')
      .eq('affiliation_id', affiliation_id)
      .or(`session_id.eq.${sanitizedSessionId},ip_address.eq.${anonymizedIp}`)
      .gte('created_at', fiveMinutesAgo)
      .maybeSingle();

    if (existingClick) {
      console.log('Duplicate click detected');
      return new Response(
        JSON.stringify({ success: true, message: 'Click registered', click_id: existingClick.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert click record with anonymized data
    const { data: click, error: insertError } = await supabase
      .from('affiliate_clicks')
      .insert({
        affiliation_id: affiliation.id,
        product_id: affiliation.product_id,
        affiliate_user_id: affiliation.user_id,
        session_id: sanitizedSessionId,
        ip_address: anonymizedIp, // Hashed, not raw IP
        user_agent: sanitizedUserAgent,
        referrer_url: sanitizeUrl(referrer_url),
        landing_url: sanitizeUrl(landing_url),
        converted: false,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to track' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Click tracked:', click.id.slice(0, 8) + '...');

    return new Response(
      JSON.stringify({ 
        success: true, 
        click_id: click.id,
        message: 'Click tracked'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Tracking error:', error instanceof Error ? error.message : 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
