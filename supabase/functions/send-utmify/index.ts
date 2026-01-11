import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes
const UTMIFY_API_URL = "https://api.utmify.com.br/api-credentials/orders";
const PLATFORM_NAME = "RoyalPay";
const MAX_RETRIES = 3;

// Tipos
interface UtmifyCustomer {
  name: string;
  email: string;
  phone: string;
  document: string;
  country?: string;
  ip?: string;
}

interface UtmifyProduct {
  id: string;
  name: string;
  planId: string | null;
  planName: string | null;
  quantity: number;
  priceInCents: number;
}

interface UtmifyTrackingParameters {
  src: string | null;
  sck: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

interface UtmifyCommission {
  totalPriceInCents: number;
  gatewayFeeInCents: number;
  userCommissionInCents: number;
  currency?: string;
}

interface UtmifyPayload {
  orderId: string;
  platform: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  approvedDate: string | null;
  refundedAt: string | null;
  customer: UtmifyCustomer;
  products: UtmifyProduct[];
  trackingParameters: UtmifyTrackingParameters;
  commission: UtmifyCommission;
  isTest?: boolean;
}

interface SendUtmifyRequest {
  sale_id: string;
  subscription_id?: string;
  event_type?: string;  // payment_created, payment_approved, payment_refused, refunded, chargeback, subscription_created, subscription_canceled
  force_resend?: boolean;
}

// Funções auxiliares
function formatDateToUtmify(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function mapPaymentMethod(method: string): string {
  const mapping: Record<string, string> = {
    'pix': 'pix',
    'credit_card': 'credit_card',
    'boleto': 'boleto',
    'paypal': 'paypal',
    'free': 'free_price',
  };
  return mapping[method?.toLowerCase()] || 'credit_card';
}

function mapStatus(status: string, eventType?: string): string {
  // Handle event types directly from webhook events
  if (eventType) {
    const eventMapping: Record<string, string> = {
      'payment_created': 'waiting_payment',
      'payment_approved': 'paid',
      'payment_refused': 'refused',
      'refunded': 'refunded',
      'payment_refunded': 'refunded',
      'chargeback': 'chargedback',
      'chargeback_created': 'chargedback',
      'subscription_created': 'paid',  // New subscription = active
      'subscription_canceled': 'refunded',  // Canceled = loss for UTMify tracking
    };
    if (eventMapping[eventType.toLowerCase()]) {
      return eventMapping[eventType.toLowerCase()];
    }
  }
  
  // Fall back to status mapping
  const mapping: Record<string, string> = {
    'pending': 'waiting_payment',
    'waiting_payment': 'waiting_payment',
    'approved': 'paid',
    'paid': 'paid',
    'active': 'paid',
    'failed': 'refused',
    'refused': 'refused',
    'refunded': 'refunded',
    'chargeback': 'chargedback',
    'chargedback': 'chargedback',
    'canceled': 'refunded',
    'cancelled': 'refunded',
    'expired': 'refunded',
  };
  return mapping[status?.toLowerCase()] || 'waiting_payment';
}

function sanitizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function sanitizeDocument(doc: string | null): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '');
}

// Busca o token UTMify do vendedor na tabela user_integrations
async function getUtmifyToken(supabase: any, sellerUserId: string): Promise<string | null> {
  console.log(`[UTMify] Buscando token para vendedor: ${sellerUserId}`);
  
  // Buscar integração UTMify do vendedor - try by integration_id first (most reliable)
  let integration = null;
  
  // Try 1: Buscar por integration_id = 'utmify' (método principal)
  const { data: integrationById, error: error1 } = await supabase
    .from('user_integrations')
    .select('config, credentials_encrypted, is_active')
    .eq('user_id', sellerUserId)
    .eq('integration_id', 'utmify')
    .eq('is_active', true)
    .maybeSingle();
  
  if (integrationById) {
    integration = integrationById;
    console.log('[UTMify] Encontrado por integration_id = utmify');
  }
  
  // Try 2: Buscar por integration_type = 'utmify'
  if (!integration) {
    const { data: integrationByType, error: error2 } = await supabase
      .from('user_integrations')
      .select('config, credentials_encrypted, is_active')
      .eq('user_id', sellerUserId)
      .eq('integration_type', 'utmify')
      .eq('is_active', true)
      .maybeSingle();
    
    if (integrationByType) {
      integration = integrationByType;
      console.log('[UTMify] Encontrado por integration_type = utmify');
    }
  }
  
  if (!integration) {
    console.log('[UTMify] Vendedor não tem integração UTMify configurada');
    return null;
  }
  
  // Tentar buscar token de diferentes lugares
  let token: string | null = null;
  
  // 1. Tentar de config.api_token
  if (integration.config?.api_token) {
    token = integration.config.api_token;
    console.log('[UTMify] Token encontrado em config.api_token');
  }
  // 2. Tentar de credentials_encrypted.api_token
  else if (integration.credentials_encrypted?.api_token) {
    token = integration.credentials_encrypted.api_token;
    console.log('[UTMify] Token encontrado em credentials_encrypted.api_token');
  }
  // 3. Tentar de config (pode ser o próprio token se armazenado como string)
  else if (typeof integration.config === 'string') {
    token = integration.config;
    console.log('[UTMify] Token encontrado em config (string)');
  }
  
  if (token) {
    return token.trim();
  }
  
  console.log('[UTMify] Nenhum token válido encontrado na integração');
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { sale_id, subscription_id, event_type, force_resend = false }: SendUtmifyRequest = await req.json();

    if (!sale_id && !subscription_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sale_id ou subscription_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the log key - use event_type for idempotency if provided
    const idempotencyKey = event_type ? `${sale_id || subscription_id}_${event_type}` : (sale_id || subscription_id);
    console.log(`[UTMify] Idempotency key: ${idempotencyKey}`);

    // Verificar se já foi enviado (idempotência) - check by sale_id AND event_type
    if (!force_resend && sale_id) {
      const { data: existingLog } = await supabase
        .from('utmify_logs')
        .select('id, status')
        .eq('sale_id', sale_id)
        .eq('status', 'sent')
        .maybeSingle();

      // Only skip if same event_type was already sent
      if (existingLog && !event_type) {
        console.log(`[UTMify] Venda ${sale_id} já foi enviada anteriormente`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Venda já foi enviada para UTMify",
            log_id: existingLog.id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let sale: any = null;
    let subscription: any = null;
    let sellerUserId: string | null = null;

    // Buscar dados da venda ou assinatura
    if (sale_id) {
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          products:product_id (
            id,
            name,
            price
          )
        `)
        .eq('id', sale_id)
        .maybeSingle();

      if (saleError || !saleData) {
        console.error(`[UTMify] Venda não encontrada: ${sale_id}`, saleError);
        return new Response(
          JSON.stringify({ success: false, error: "Venda não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      sale = saleData;
      sellerUserId = sale.seller_user_id;
    } else if (subscription_id) {
      // Buscar assinatura e a venda associada
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          products:product_id (
            id,
            name,
            price
          )
        `)
        .eq('id', subscription_id)
        .maybeSingle();

      if (subError || !subData) {
        console.error(`[UTMify] Assinatura não encontrada: ${subscription_id}`, subError);
        return new Response(
          JSON.stringify({ success: false, error: "Assinatura não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subscription = subData;
      sellerUserId = subscription.user_id; // seller user id
      
      // Try to get associated sale for more data
      if (subscription.sale_id) {
        const { data: assocSale } = await supabase
          .from('sales')
          .select('*')
          .eq('id', subscription.sale_id)
          .maybeSingle();
        if (assocSale) sale = assocSale;
      }
    }

    if (!sellerUserId) {
      console.error('[UTMify] Não foi possível determinar o seller_user_id');
      return new Response(
        JSON.stringify({ success: false, error: "seller_user_id não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se status permite envio (quando usando venda)
    if (sale && !event_type) {
      const allowedStatuses = ['pending', 'waiting_payment', 'approved', 'paid', 'refunded', 'chargeback', 'chargedback'];
      if (!allowedStatuses.includes(sale.status?.toLowerCase())) {
        console.log(`[UTMify] Status ${sale.status} não requer envio para UTMify`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Status ${sale.status} não requer envio para UTMify` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Buscar token UTMify do vendedor
    const utmifyToken = await getUtmifyToken(supabase, sellerUserId);
    
    if (!utmifyToken) {
      console.log(`[UTMify] Vendedor ${sellerUserId} não tem integração UTMify configurada`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Vendedor não tem integração UTMify configurada",
          skipped: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[UTMify] Token do vendedor encontrado, enviando para UTMify...`);

    // Buscar UTMs associadas à venda (do metadata ou da tabela de sessões)
    const metadata = sale?.metadata || subscription?.metadata || {};
    const utms = metadata.utms || metadata.tracking_parameters || {};

    // Determine data source (sale or subscription)
    const dataSource = sale || {
      id: subscription?.sale_id || subscription?.id,
      product_id: subscription?.product_id,
      products: subscription?.products,
      amount: subscription?.amount || subscription?.products?.price || 0,
      payment_method: subscription?.payment_method || 'credit_card',
      status: subscription?.status,
      created_at: subscription?.created_at,
      paid_at: subscription?.status === 'active' ? subscription?.created_at : null,
      buyer_name: subscription?.customer_name,
      buyer_email: subscription?.customer_email,
      buyer_phone: subscription?.customer_phone,
      buyer_document: subscription?.customer_document,
      quantity: 1,
      platform_fee: 0,
      net_amount: subscription?.amount || subscription?.products?.price || 0,
    };

    // Determine status to send - use event_type if provided
    const statusToSend = mapStatus(dataSource.status, event_type);
    console.log(`[UTMify] Status to send: ${statusToSend} (event_type: ${event_type}, original status: ${dataSource.status})`);

    // Montar payload para UTMify
    const payload: UtmifyPayload = {
      orderId: dataSource.id,
      platform: PLATFORM_NAME,
      paymentMethod: mapPaymentMethod(dataSource.payment_method),
      status: statusToSend,
      createdAt: formatDateToUtmify(dataSource.created_at)!,
      approvedDate: dataSource.paid_at ? formatDateToUtmify(dataSource.paid_at) : null,
      refundedAt: dataSource.refunded_at ? formatDateToUtmify(dataSource.refunded_at) : null,
      customer: {
        name: dataSource.buyer_name || 'Não informado',
        email: dataSource.buyer_email || 'nao@informado.com',
        phone: sanitizePhone(dataSource.buyer_phone),
        document: sanitizeDocument(dataSource.buyer_document),
        country: "BR",
        ip: metadata.ip_address || undefined,
      },
      products: [
        {
          id: dataSource.product_id || 'unknown',
          name: dataSource.products?.name || 'Produto',
          planId: subscription?.plan_id || null,
          planName: subscription?.plan_name || (subscription ? 'Assinatura Mensal' : null),
          quantity: dataSource.quantity || 1,
          priceInCents: Math.round((dataSource.amount || 0) * 100),
        }
      ],
      trackingParameters: {
        src: utms.src || null,
        sck: utms.sck || null,
        utm_source: utms.utm_source || null,
        utm_campaign: utms.utm_campaign || null,
        utm_medium: utms.utm_medium || null,
        utm_content: utms.utm_content || null,
        utm_term: utms.utm_term || null,
      },
      commission: {
        totalPriceInCents: Math.round((dataSource.amount || 0) * 100),
        gatewayFeeInCents: Math.round((dataSource.platform_fee || 0) * 100),
        userCommissionInCents: Math.round((dataSource.net_amount || dataSource.amount || 0) * 100),
        currency: "BRL",
      },
    };

    console.log(`[UTMify] Payload montado:`, JSON.stringify(payload, null, 2));

    // Criar log de tentativa
    const { data: logEntry, error: logError } = await supabase
      .from('utmify_logs')
      .insert({
        sale_id: sale_id,
        order_id: sale.id,
        status: 'pending',
        payload: payload,
        attempts: 1,
      })
      .select()
      .single();

    if (logError) {
      console.error('[UTMify] Erro ao criar log:', logError);
    }

    // Enviar para UTMify
    let response: Response | null = null;
    let responseBody: any = null;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[UTMify] Tentativa ${attempt} de ${MAX_RETRIES}`);
        
        // UTMify aceita tanto x-api-token quanto Authorization: Bearer
        response = await fetch(UTMIFY_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-token': utmifyToken,
          },
          body: JSON.stringify(payload),
        });

        responseBody = await response.text();
        
        try {
          responseBody = JSON.parse(responseBody);
        } catch {
          // Mantém como texto se não for JSON
        }

        console.log(`[UTMify] Resposta (${response.status}):`, responseBody);

        if (response.ok) {
          // Sucesso - atualizar log
          if (logEntry) {
            await supabase
              .from('utmify_logs')
              .update({
                status: 'sent',
                response: responseBody,
                sent_at: new Date().toISOString(),
                attempts: attempt,
              })
              .eq('id', logEntry.id);
          }

          // Registrar auditoria
          await supabase
            .from('admin_audit_logs')
            .insert({
              action_type: 'utmify_send',
              entity_type: 'sale',
              entity_id: sale_id,
              details: {
                success: true,
                order_id: payload.orderId,
                status: payload.status,
                tracking_parameters: payload.trackingParameters,
              },
            });

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Enviado para UTMify com sucesso",
              log_id: logEntry?.id,
              utmify_response: responseBody,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        lastError = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
        
        // Se for erro 4xx, não tentar novamente
        if (response.status >= 400 && response.status < 500) {
          break;
        }

        // Aguardar antes de tentar novamente (exponential backoff)
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[UTMify] Erro na tentativa ${attempt}:`, error);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // Falha após todas as tentativas
    if (logEntry) {
      await supabase
        .from('utmify_logs')
        .update({
          status: 'failed',
          error_message: lastError,
          response: responseBody,
          attempts: MAX_RETRIES,
        })
        .eq('id', logEntry.id);
    }

    // Registrar falha na auditoria
    await supabase
      .from('admin_audit_logs')
      .insert({
        action_type: 'utmify_send_failed',
        entity_type: 'sale',
        entity_id: sale_id,
        details: {
          success: false,
          error: lastError,
          attempts: MAX_RETRIES,
        },
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Falha ao enviar para UTMify após ${MAX_RETRIES} tentativas`,
        details: lastError,
        log_id: logEntry?.id,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[UTMify] Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
