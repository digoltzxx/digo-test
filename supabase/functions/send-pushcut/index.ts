import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendPushcutRequest {
  sale_id: string;
  event_type: string;
}

// Format currency BRL
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Get event emoji and title based on event type
function getEventDetails(eventType: string): { emoji: string; title: string } {
  switch (eventType) {
    case 'payment_approved':
      return { emoji: '💰', title: 'Venda Aprovada!' };
    case 'payment_created':
      return { emoji: '⏳', title: 'PIX Gerado' };
    case 'payment_refused':
      return { emoji: '❌', title: 'Pagamento Recusado' };
    case 'payment_refunded':
      return { emoji: '↩️', title: 'Reembolso Processado' };
    case 'chargeback_created':
      return { emoji: '⚠️', title: 'Chargeback!' };
    case 'subscription_created':
      return { emoji: '🔄', title: 'Nova Assinatura' };
    case 'subscription_canceled':
      return { emoji: '📴', title: 'Assinatura Cancelada' };
    default:
      return { emoji: '🔔', title: 'Atualização' };
  }
}

// Build notification text - with product name
function buildNotificationText(sale: any, eventType: string): string {
  const { emoji } = getEventDetails(eventType);
  const amount = formatCurrency(sale.amount || 0);
  const productName = sale.products?.name || 'Produto';
  const paymentMethod = sale.payment_method === 'pix' ? 'PIX' : 
                        sale.payment_method === 'credit_card' ? 'Cartão' : 
                        sale.payment_method || '';

  switch (eventType) {
    case 'payment_approved':
      return `${emoji} ${amount} - ${productName}`;
    case 'payment_created':
      return `${emoji} ${paymentMethod} ${amount} - ${productName}`;
    case 'payment_refused':
      return `${emoji} Recusado ${amount} - ${productName}`;
    case 'payment_refunded':
      return `${emoji} Reembolso ${amount} - ${productName}`;
    case 'chargeback_created':
      return `${emoji} CHARGEBACK ${amount} - ${productName}`;
    case 'subscription_created':
      return `${emoji} Assinatura ${amount}/mês - ${productName}`;
    case 'subscription_canceled':
      return `${emoji} Cancelada - ${productName}`;
    default:
      return `${emoji} ${productName} - ${amount}`;
  }
}

// Get Pushcut config from user integrations
async function getPushcutConfig(supabase: any, sellerUserId: string): Promise<{
  webhookUrl: string | null;
  eventsEnabled: string[];
}> {
  console.log(`[Pushcut] Buscando configuração para vendedor: ${sellerUserId}`);
  
  let integration = null;
  
  const { data: integrationById } = await supabase
    .from('user_integrations')
    .select('config, credentials_encrypted, is_active, events_enabled')
    .eq('user_id', sellerUserId)
    .eq('integration_id', 'pushcut')
    .eq('is_active', true)
    .maybeSingle();
  
  if (integrationById) {
    integration = integrationById;
    console.log('[Pushcut] Integração encontrada por integration_id');
  }
  
  // Fallback to integration_type
  if (!integration) {
    const { data: integrationByType } = await supabase
      .from('user_integrations')
      .select('config, credentials_encrypted, is_active, events_enabled')
      .eq('user_id', sellerUserId)
      .eq('integration_type', 'pushcut')
      .eq('is_active', true)
      .maybeSingle();
    
    if (integrationByType) {
      integration = integrationByType;
      console.log('[Pushcut] Integração encontrada por integration_type');
    }
  }
  
  if (!integration) {
    console.log('[Pushcut] Vendedor não tem integração Pushcut configurada');
    return { webhookUrl: null, eventsEnabled: [] };
  }
  
  // Extract webhook URL
  let webhookUrl: string | null = null;
  if (integration.config?.webhook_url) {
    webhookUrl = integration.config.webhook_url;
  } else if (integration.credentials_encrypted?.webhook_url) {
    webhookUrl = integration.credentials_encrypted.webhook_url;
  }
  
  // Extract enabled events
  const eventsEnabled = integration.events_enabled || [
    'payment_created', 
    'payment_approved', 
    'payment_refused', 
    'payment_refunded',
    'chargeback_created',
    'subscription_created',
    'subscription_canceled'
  ];
  
  return { 
    webhookUrl: webhookUrl?.trim() || null, 
    eventsEnabled 
  };
}

// Generate idempotency key for deduplication
function generateIdempotencyKey(saleId: string, eventType: string): string {
  // Create a key based on sale + event + 5-minute window
  const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 minute windows
  return `pushcut_${saleId}_${eventType}_${timeWindow}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { sale_id, event_type }: SendPushcutRequest = await req.json();

    if (!sale_id) {
      return new Response(
        JSON.stringify({ success: false, error: "sale_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Pushcut] Processando evento "${event_type}" para venda: ${sale_id}`);

    // IDEMPOTENCY CHECK - Prevent duplicate notifications
    const idempotencyKey = generateIdempotencyKey(sale_id, event_type);
    
    // Check if we already sent this notification recently
    const { data: existingLog } = await supabase
      .from('admin_audit_logs')
      .select('id')
      .eq('action_type', 'pushcut_notification_sent')
      .eq('entity_id', sale_id)
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .limit(1)
      .maybeSingle();

    if (existingLog) {
      console.log(`[Pushcut] ⚠️ Notificação duplicada detectada - ignorando (idempotency: ${idempotencyKey})`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Notificação já enviada (deduplicada)",
          skipped: true,
          idempotency_key: idempotencyKey
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch sale data
    const { data: sale, error: saleError } = await supabase
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

    if (saleError || !sale) {
      console.error(`[Pushcut] Venda não encontrada: ${sale_id}`, saleError);
      return new Response(
        JSON.stringify({ success: false, error: "Venda não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Pushcut configuration
    const { webhookUrl, eventsEnabled } = await getPushcutConfig(supabase, sale.seller_user_id);
    
    if (!webhookUrl) {
      console.log(`[Pushcut] ❌ Vendedor não tem integração Pushcut configurada`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Vendedor não tem integração Pushcut configurada",
          skipped: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if event is enabled
    if (!eventsEnabled.includes(event_type)) {
      console.log(`[Pushcut] ⚠️ Evento "${event_type}" não está habilitado`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Evento ${event_type} não habilitado`,
          skipped: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Pushcut] ✅ Enviando notificação...`);

    // Build SIMPLIFIED payload - only title and text
    const { title } = getEventDetails(event_type);
    const notificationText = buildNotificationText(sale, event_type);
    
    // Simplified payload for Pushcut - minimal data
    const payload = {
      title: title,
      text: notificationText,
    };

    console.log(`[Pushcut] Payload:`, JSON.stringify(payload));

    // Send to Pushcut Webhook URL
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData: any;
    
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`[Pushcut] Resposta (${response.status}):`, responseData);

    if (response.ok) {
      console.log(`[Pushcut] ✅ Notificação enviada com sucesso!`);
      
      // Log success (also serves as idempotency record)
      await supabase
        .from('admin_audit_logs')
        .insert({
          action_type: 'pushcut_notification_sent',
          entity_type: 'sale',
          entity_id: sale_id,
          details: {
            success: true,
            event_type,
            idempotency_key: idempotencyKey,
          },
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Notificação enviada para Pushcut",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log failure
    console.error(`[Pushcut] ❌ Falha ao enviar:`, responseData);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Falha ao enviar para Pushcut: ${response.status}`,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Pushcut] ❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});