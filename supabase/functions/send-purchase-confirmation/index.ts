import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brevo API configuration
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface PurchaseEmailRequest {
  buyerName: string;
  buyerEmail: string;
  productName: string;
  amount: number;
  paymentMethod: string;
  purchaseDate: string;
  transactionId: string;
  deliveryMethod: string; // 'member_area' | 'email' | 'none'
  isSubscription: boolean;
  memberAreaUrl?: string;
  tone?: 'informal' | 'corporate';
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getPaymentMethodLabel = (method: string): string => {
  switch (method?.toLowerCase()) {
    case "pix":
      return "PIX";
    case "boleto":
      return "Boleto Bancário";
    case "credit_card":
    case "cartao":
      return "Cartão de Crédito";
    default:
      return "Cartão de Crédito";
  }
};

const getToneContent = (tone: 'informal' | 'corporate') => {
  if (tone === 'informal') {
    return {
      greeting: 'Olá',
      confirmationMessage: 'Seu pagamento foi confirmado com sucesso! 🎉',
      accessMessage: 'Para acessar o produto, é só clicar no botão abaixo.',
      emailDeliveryMessage: 'O conteúdo foi enviado para este endereço de email.',
      subscriptionMessage: 'Sua assinatura está ativa e você pode acessar o conteúdo sempre que quiser.',
      supportMessage: 'Caso tenha qualquer dúvida, é só entrar em contato com nosso suporte.',
      buttonText: 'Acessar agora',
    };
  }
  
  return {
    greeting: 'Prezado(a)',
    confirmationMessage: 'Seu pagamento foi confirmado com sucesso.',
    accessMessage: 'Para acessar o produto, clique no botão abaixo.',
    emailDeliveryMessage: 'O conteúdo foi enviado para este endereço de email.',
    subscriptionMessage: 'Sua assinatura está ativa e permanecerá disponível enquanto os pagamentos estiverem em dia.',
    supportMessage: 'Caso tenha qualquer dúvida, entre em contato com nosso suporte.',
    buttonText: 'Acessar área de membros',
  };
};

const generateEmailHtml = (data: PurchaseEmailRequest): string => {
  const tone = data.tone || 'corporate';
  const content = getToneContent(tone);
  
  const deliverySection = data.deliveryMethod === 'member_area' && data.memberAreaUrl
    ? `
      <div style="margin: 24px 0; text-align: center;">
        <p style="color: #374151; font-size: 15px; margin-bottom: 16px;">${content.accessMessage}</p>
        <a href="${data.memberAreaUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${content.buttonText}
        </a>
      </div>
    `
    : data.deliveryMethod === 'email'
    ? `
      <div style="margin: 24px 0; padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="color: #1e40af; font-size: 14px; margin: 0;">${content.emailDeliveryMessage}</p>
      </div>
    `
    : '';

  const subscriptionNote = data.isSubscription
    ? `
      <div style="margin: 16px 0; padding: 12px 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #22c55e;">
        <p style="color: #166534; font-size: 14px; margin: 0;">${content.subscriptionMessage}</p>
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compra confirmada</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background: white; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-radius: 50%; margin-bottom: 16px;">
                <span style="font-size: 32px;">✓</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #111827;">Compra confirmada</h1>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 32px 0;">
              <p style="margin: 0 0 8px; font-size: 16px; color: #374151;">
                ${content.greeting}, <strong>${data.buyerName}</strong>
              </p>
              <p style="margin: 0; font-size: 15px; color: #6b7280;">
                ${content.confirmationMessage}
              </p>
            </td>
          </tr>
          
          <!-- Purchase Summary -->
          <tr>
            <td style="padding: 24px 32px;">
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; border: 1px solid #e5e7eb;">
                <h2 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Resumo da compra</h2>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 13px; color: #6b7280;">Produto</span>
                    </td>
                    <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 14px; font-weight: 600; color: #111827;">${data.productName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 13px; color: #6b7280;">Forma de pagamento</span>
                    </td>
                    <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 14px; color: #111827;">${getPaymentMethodLabel(data.paymentMethod)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 13px; color: #6b7280;">Valor pago</span>
                    </td>
                    <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="font-size: 14px; font-weight: 600; color: #111827;">${formatCurrency(data.amount)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="font-size: 13px; color: #6b7280;">Data da compra</span>
                    </td>
                    <td align="right" style="padding: 8px 0;">
                      <span style="font-size: 14px; color: #111827;">${formatDate(data.purchaseDate)}</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Delivery / Access Section -->
          <tr>
            <td style="padding: 0 32px;">
              ${deliverySection}
              ${subscriptionNote}
            </td>
          </tr>
          
          <!-- Support Footer -->
          <tr>
            <td style="padding: 24px 32px 32px;">
              <div style="padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                  ${content.supportMessage}
                </p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                  ID da transação: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${data.transactionId}</code>
                </p>
              </div>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Este email foi enviado automaticamente. Por favor, não responda.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PurchaseEmailRequest = await req.json();

    if (!data.buyerEmail || !data.buyerName || !data.productName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "noreply@royalpay.com.br";
    const senderName = Deno.env.get("BREVO_SENDER_NAME") || "RoyalPay";

    const html = generateEmailHtml(data);

    const emailPayload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: data.buyerEmail,
          name: data.buyerName,
        },
      ],
      subject: "Compra confirmada – acesso ao seu produto",
      htmlContent: html,
    };

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Brevo API error:", response.status, errorText);
      throw new Error(`Brevo API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("Purchase confirmation email sent:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending purchase confirmation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
