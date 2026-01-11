import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  email: string;
  code: string;
  purpose?: string;
  createSession?: boolean; // If true, generate a magic link for session creation
}

// Suspicious activity tracking
const suspiciousIpMap = new Map<string, { count: number; blockedUntil: number }>();

function checkIpBlocked(ipAddress: string | null): boolean {
  if (!ipAddress) return false;
  const now = Date.now();
  const record = suspiciousIpMap.get(ipAddress);
  
  if (record && now < record.blockedUntil) {
    return true;
  }
  
  if (record && now >= record.blockedUntil) {
    suspiciousIpMap.delete(ipAddress);
  }
  
  return false;
}

function trackFailedAttempt(ipAddress: string | null): void {
  if (!ipAddress) return;
  
  const record = suspiciousIpMap.get(ipAddress) || { count: 0, blockedUntil: 0 };
  record.count++;
  
  // Block IP after 5 failed verification attempts for 15 minutes
  if (record.count >= 5) {
    record.blockedUntil = Date.now() + 15 * 60 * 1000;
    console.warn(`[SECURITY] IP ${ipAddress} blocked due to multiple failed OTP verifications`);
  }
  
  suspiciousIpMap.set(ipAddress, record);
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] verify-otp function called`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  try {
    // Check if IP is blocked
    if (checkIpBlocked(ipAddress)) {
      console.warn(`[${requestId}] Blocked IP attempted verification: ${ipAddress}`);
      return new Response(
        JSON.stringify({ valid: false, error: "Acesso temporariamente bloqueado. Tente novamente mais tarde." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, code, purpose = "authentication", createSession = false }: VerifyOtpRequest = await req.json();
    
    // Log request (mask email and code for security)
    const maskedEmail = email ? `${email.substring(0, 3)}***@${email.split("@")[1] || ""}` : "none";
    console.log(`[${requestId}] Verification request: email=${maskedEmail}, purpose=${purpose}`);
    
    if (!email || !code) {
      trackFailedAttempt(ipAddress);
      return new Response(
        JSON.stringify({ valid: false, error: "Email e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      trackFailedAttempt(ipAddress);
      return new Response(
        JSON.stringify({ valid: false, error: "Código deve ter 6 dígitos numéricos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const codeHash = await hashCode(code);

    // Find valid OTP code
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      console.warn(`[${requestId}] Invalid OTP attempt for: ${maskedEmail}`);
      trackFailedAttempt(ipAddress);
      
      // Increment attempts for any unused OTP for this email
      const { data: unusedOtps } = await supabase
        .from("otp_codes")
        .select("id, attempts, max_attempts")
        .eq("email", email.toLowerCase())
        .eq("purpose", purpose)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString());
      
      if (unusedOtps && unusedOtps.length > 0) {
        for (const otp of unusedOtps) {
          const newAttempts = otp.attempts + 1;
          if (newAttempts >= otp.max_attempts) {
            // Invalidate OTP after max attempts
            await supabase
              .from("otp_codes")
              .update({ used_at: new Date().toISOString() })
              .eq("id", otp.id);
            console.warn(`[${requestId}] OTP invalidated after max attempts for: ${maskedEmail}`);
          } else {
            await supabase
              .from("otp_codes")
              .update({ attempts: newAttempts })
              .eq("id", otp.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Código inválido ou expirado" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.warn(`[${requestId}] Max attempts exceeded for: ${maskedEmail}`);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Número máximo de tentativas excedido. Solicite um novo código." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    const { error: updateError } = await supabase
      .from("otp_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error(`[${requestId}] Error marking OTP as used:`, updateError);
      return new Response(
        JSON.stringify({ valid: false, error: "Erro ao processar verificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up expired OTPs periodically (1% chance per request)
    if (Math.random() < 0.01) {
      supabase
        .from("otp_codes")
        .delete()
        .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .then(() => console.log(`[${requestId}] Cleaned up expired OTPs`));
    }

    console.log(`[${requestId}] OTP verified successfully for: ${maskedEmail}, createSession: ${createSession}`);
    
    // If createSession is requested, generate a magic link for the user
    let magicLink = null;
    if (createSession && otpRecord.user_id) {
      try {
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email: email.toLowerCase(),
          options: {
            redirectTo: `${req.headers.get("origin") || "https://royalpaybr.com"}/dashboard`,
          },
        });
        
        if (linkError) {
          console.error(`[${requestId}] Error generating magic link:`, linkError);
        } else if (linkData?.properties?.hashed_token) {
          magicLink = linkData.properties.action_link;
          console.log(`[${requestId}] Magic link generated for: ${maskedEmail}`);
        }
      } catch (linkErr) {
        console.error(`[${requestId}] Error in magic link generation:`, linkErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        valid: true, 
        message: "Código verificado com sucesso",
        userId: otpRecord.user_id,
        magicLink: magicLink
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${requestId}] Unexpected error in verify-otp:`, error);
    trackFailedAttempt(ipAddress);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
