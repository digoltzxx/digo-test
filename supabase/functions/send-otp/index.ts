import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brevo API configuration
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendOtpRequest {
  email: string;
  name?: string;
  purpose?: string;
  userId?: string;
  channel?: "email" | "sms" | "whatsapp"; // Support multiple channels
}

// Rate limiting: max 3 OTP requests per email per 5 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number; attempts: number }>();

// Suspicious activity tracking
const suspiciousIpMap = new Map<string, { count: number; blockedUntil: number }>();

function checkRateLimit(email: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now();
  const key = email.toLowerCase();
  const limit = rateLimitMap.get(key);
  
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 5 * 60 * 1000, attempts: 0 });
    return { allowed: true, remainingAttempts: 2 };
  }
  
  if (limit.count >= 3) {
    return { allowed: false, remainingAttempts: 0 };
  }
  
  limit.count++;
  return { allowed: true, remainingAttempts: 3 - limit.count };
}

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

function trackSuspiciousActivity(ipAddress: string | null, email: string): void {
  if (!ipAddress) return;
  
  const record = suspiciousIpMap.get(ipAddress) || { count: 0, blockedUntil: 0 };
  record.count++;
  
  // Block IP after 10 failed attempts for 15 minutes
  if (record.count >= 10) {
    record.blockedUntil = Date.now() + 15 * 60 * 1000;
    console.warn(`[SECURITY] IP ${ipAddress} blocked due to suspicious activity on email: ${email.substring(0, 3)}***`);
  }
  
  suspiciousIpMap.set(ipAddress, record);
}

function generateOtpCode(): string {
  // Generate secure 6-digit numeric code
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Brevo email sending service
async function sendEmailWithBrevo(
  apiKey: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
  senderEmail: string,
  senderName: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    console.log("Sending email via Brevo from:", senderEmail, "to:", to.email);
    
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email: to.email, name: to.name || to.email }],
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", data);
      return {
        success: false,
        error: data.message || "Erro ao enviar e-mail via Brevo",
      };
    }

    console.log("Brevo email sent successfully:", data);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("Brevo request error:", error);
    return { success: false, error: "Erro de conexão com o serviço de e-mail" };
  }
}

function generateEmailHtml(otpCode: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Código de Verificação - RoyalPay</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a;">
  <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" width="100%" style="max-width: 500px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid #334155;">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                <span style="color: white; font-size: 28px; font-weight: bold;">R</span>
              </div>
              <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin: 0;">RoyalPay</h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 8px 0 0;">Gateway de Pagamentos</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 600; margin: 0 0 16px; text-align: center;">
                Código de Verificação
              </h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                Use o código abaixo para completar sua verificação de identidade:
              </p>
              
              <!-- OTP Code Box -->
              <div style="background: linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3b82f6;">
                  ${otpCode}
                </span>
              </div>
              
              <!-- Expiry Warning -->
              <div style="background-color: #1e293b; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="color: #f59e0b; font-size: 13px; margin: 0; font-weight: 600;">
                  ⏱️ Este código expira em 5 minutos
                </p>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 16px; border-radius: 8px;">
                <p style="color: #f87171; font-size: 12px; margin: 0; line-height: 1.5;">
                  🔒 <strong>Aviso de Segurança:</strong> Se você não solicitou este código, ignore este e-mail. Nunca compartilhe seu código com terceiros.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <div style="border-top: 1px solid #334155; padding-top: 20px; text-align: center;">
                <p style="color: #64748b; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} RoyalPay. Todos os direitos reservados.
                </p>
                <p style="color: #475569; font-size: 11px; margin: 8px 0 0;">
                  Este é um e-mail automático. Por favor, não responda.
                </p>
              </div>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] send-otp function called`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  try {
    const { email, name, purpose = "authentication", userId, channel = "email" }: SendOtpRequest = await req.json();
    
    // Log request (mask email for security)
    const maskedEmail = email ? `${email.substring(0, 3)}***@${email.split("@")[1] || ""}` : "none";
    console.log(`[${requestId}] Request: email=${maskedEmail}, purpose=${purpose}, channel=${channel}`);
    
    // Check if IP is blocked
    if (checkIpBlocked(ipAddress)) {
      console.warn(`[${requestId}] Blocked IP attempted request: ${ipAddress}`);
      return new Response(
        JSON.stringify({ error: "Acesso temporariamente bloqueado. Tente novamente mais tarde." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!email || !email.includes("@")) {
      console.error(`[${requestId}] Invalid email provided`);
      trackSuspiciousActivity(ipAddress, email || "unknown");
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(email);
    if (!rateLimit.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for: ${maskedEmail}`);
      trackSuspiciousActivity(ipAddress, email);
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 5 minutos antes de solicitar outro código." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Brevo configuration from environment variables
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const brevoSenderName = Deno.env.get("BREVO_SENDER_NAME") || "RoyalPay";
    
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Serviço de e-mail não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!brevoSenderEmail) {
      console.error("BREVO_SENDER_EMAIL not configured");
      return new Response(
        JSON.stringify({ error: "Email remetente não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Brevo config - Sender:", brevoSenderEmail, "Name:", brevoSenderName);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate OTP code
    const otpCode = generateOtpCode();
    const codeHash = await hashCode(otpCode);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    console.log("Generated OTP for:", email, "expires at:", expiresAt.toISOString());

    // Invalidate any existing unused OTP codes for this email and purpose
    await supabase
      .from("otp_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("email", email.toLowerCase())
      .eq("purpose", purpose)
      .is("used_at", null);

    // Insert new OTP code
    const { error: insertError } = await supabase.from("otp_codes").insert({
      user_id: userId || "00000000-0000-0000-0000-000000000000",
      email: email.toLowerCase(),
      code_hash: codeHash,
      purpose,
      expires_at: expiresAt.toISOString(),
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
    });

    if (insertError) {
      console.error("Error inserting OTP:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código de verificação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate email HTML
    const emailHtml = generateEmailHtml(otpCode);

    // Send email via Brevo
    const emailResult = await sendEmailWithBrevo(
      brevoApiKey,
      { email, name },
      `${otpCode} é seu código de verificação - RoyalPay`,
      emailHtml,
      brevoSenderEmail,
      brevoSenderName
    );

    if (!emailResult.success) {
      console.error("Error sending email via Brevo:", emailResult.error);
      return new Response(
        JSON.stringify({ error: emailResult.error || "Erro ao enviar e-mail" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OTP sent successfully to:", email, "messageId:", emailResult.messageId);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código enviado com sucesso",
        expiresAt: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error in send-otp:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
