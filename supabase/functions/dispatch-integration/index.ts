import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationPayload {
  event: string;
  event_id: string;
  timestamp: string;
  gateway: {
    name: string;
    environment: string;
  };
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    currency: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    document: string;
  };
  product: {
    id: string;
    name: string;
  };
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  };
  subscription: {
    id: string | null;
    cycle: string | null;
  };
}

interface DispatchRequest {
  integration_id: string;
  event: string;
  payload: IntegrationPayload;
  config: Record<string, string>;
}

// Helper para fazer requests com retry e backoff exponencial
const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok || response.status < 500) {
        return response;
      }
      
      // Retry on 5xx errors
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
    
    // Exponential backoff
    if (attempt < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Dispatchers para cada integração
const dispatchers: Record<string, (payload: IntegrationPayload, config: Record<string, string>) => Promise<{ success: boolean; message: string }>> = {
  
  // ═══ WEBHOOKS ═══
  webhooks: async (payload, config) => {
    const webhookUrl = config.webhook_url;
    if (!webhookUrl) throw new Error('URL do webhook não configurada');
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // HMAC signature se configurado
    if (config.secret_key) {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(config.secret_key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, data);
      headers['X-Webhook-Signature'] = btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
    
    const response = await fetchWithRetry(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    return { success: response.ok, message: `Status: ${response.status}` };
  },

  // ═══ TELEGRAM ═══
  telegram: async (payload, config) => {
    const { bot_token, chat_id } = config;
    if (!bot_token || !chat_id) throw new Error('Token ou Chat ID não configurados');
    
    const statusEmoji = {
      payment_approved: '✅',
      payment_refused: '❌',
      payment_refunded: '🔄',
      chargeback_created: '⚠️',
      subscription_created: '🎉',
      subscription_canceled: '📭',
    }[payload.event] || '📢';
    
    const message = `${statusEmoji} *${payload.event.replace('_', ' ').toUpperCase()}*

💰 Valor: R$ ${(payload.payment.amount / 100).toFixed(2)}
📦 Produto: ${payload.product.name}
👤 Cliente: ${payload.customer.name}
📧 Email: ${payload.customer.email}
💳 Método: ${payload.payment.method.toUpperCase()}

🕐 ${new Date(payload.timestamp).toLocaleString('pt-BR')}`;

    const response = await fetchWithRetry(
      `https://api.telegram.org/bot${bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id,
          text: message,
          parse_mode: 'Markdown'
        })
      }
    );
    
    const data = await response.json();
    return { success: data.ok, message: data.ok ? 'Mensagem enviada' : data.description };
  },

  // ═══ UTMIFY ═══
  utmify: async (payload, config) => {
    const { api_token } = config;
    if (!api_token) throw new Error('API Token não configurado');
    
    const utmifyPayload = {
      orderId: payload.payment.id,
      platform: payload.gateway.name,
      paymentMethod: payload.payment.method,
      status: payload.payment.status,
      value: payload.payment.amount / 100,
      customerEmail: payload.customer.email,
      customerName: payload.customer.name,
      productName: payload.product.name,
      createdAt: payload.timestamp,
      src: payload.utm.source,
      utm_source: payload.utm.source,
      utm_medium: payload.utm.medium,
      utm_campaign: payload.utm.campaign,
    };

    const response = await fetchWithRetry(
      'https://api.utmify.com.br/api/v1/sales',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-token': api_token
        },
        body: JSON.stringify(utmifyPayload)
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Conversão registrada' : `Erro: ${response.status}` };
  },

  // ═══ UTMIIZE ═══
  utmiize: async (payload, config) => {
    const { api_key, workspace_id } = config;
    if (!api_key) throw new Error('API Key não configurada');
    
    const response = await fetchWithRetry(
      'https://api.utmiize.com/v1/conversions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          workspace_id,
          event_type: payload.event,
          order_id: payload.payment.id,
          value: payload.payment.amount / 100,
          customer_email: payload.customer.email,
          utm_source: payload.utm.source,
          utm_medium: payload.utm.medium,
          utm_campaign: payload.utm.campaign,
          timestamp: payload.timestamp
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Conversão rastreada' : `Erro: ${response.status}` };
  },

  // ═══ TRACKY ═══
  tracky: async (payload, config) => {
    const { api_key, pixel_id } = config;
    if (!api_key) throw new Error('API Key não configurada');
    
    const response = await fetchWithRetry(
      'https://api.tracky.io/v1/events',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key
        },
        body: JSON.stringify({
          pixel_id,
          event_name: payload.event,
          transaction_id: payload.payment.id,
          value: payload.payment.amount / 100,
          currency: payload.payment.currency,
          customer: {
            email: payload.customer.email,
            name: payload.customer.name
          },
          product: payload.product,
          utm: payload.utm,
          timestamp: payload.timestamp
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Evento rastreado' : `Erro: ${response.status}` };
  },

  // ═══ XTRACKY ═══
  xtracky: async (payload, config) => {
    const { api_key, account_id } = config;
    if (!api_key || !account_id) throw new Error('API Key ou Account ID não configurados');
    
    const response = await fetchWithRetry(
      `https://api.xtracky.com/v1/accounts/${account_id}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          event_type: payload.event,
          order_id: payload.payment.id,
          amount: payload.payment.amount,
          currency: payload.payment.currency,
          customer_email: payload.customer.email,
          product_id: payload.product.id,
          product_name: payload.product.name,
          utm_params: payload.utm,
          created_at: payload.timestamp
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Conversão registrada' : `Erro: ${response.status}` };
  },

  // ═══ ENOTAS ═══
  enotas: async (payload, config) => {
    const { api_key, empresa_id, ambiente } = config;
    if (!api_key || !empresa_id) throw new Error('API Key ou ID da Empresa não configurados');
    
    // Só emite nota em payment_approved
    if (payload.event !== 'payment_approved') {
      return { success: true, message: 'Evento ignorado (apenas payment_approved emite nota)' };
    }
    
    const baseUrl = ambiente === 'homologacao' 
      ? 'https://api.enotas.com.br/v2' 
      : 'https://api.enotas.com.br/v2';
    
    const response = await fetchWithRetry(
      `${baseUrl}/empresas/${empresa_id}/nfes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(api_key + ':')}`
        },
        body: JSON.stringify({
          tipo: 'NFS-e',
          idExterno: payload.payment.id,
          cliente: {
            nome: payload.customer.name,
            email: payload.customer.email,
            cpfCnpj: payload.customer.document
          },
          servico: {
            descricao: payload.product.name,
            valorTotal: payload.payment.amount / 100
          }
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Nota fiscal emitida' : `Erro: ${response.status}` };
  },

  // ═══ NOTAZZ ═══
  notazz: async (payload, config) => {
    const { api_key, cnpj } = config;
    if (!api_key || !cnpj) throw new Error('API Key ou CNPJ não configurados');
    
    if (payload.event !== 'payment_approved') {
      return { success: true, message: 'Evento ignorado (apenas payment_approved emite nota)' };
    }
    
    const response = await fetchWithRetry(
      'https://api.notazz.com/v1/nfse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          cnpj_prestador: cnpj,
          id_externo: payload.payment.id,
          cliente: {
            nome: payload.customer.name,
            email: payload.customer.email,
            documento: payload.customer.document
          },
          servicos: [{
            descricao: payload.product.name,
            valor: payload.payment.amount / 100
          }]
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'NFS-e emitida' : `Erro: ${response.status}` };
  },

  // ═══ CHECKOUTFY ═══
  checkoutfy: async (payload, config) => {
    const { api_key, store_id, webhook_url } = config;
    if (!api_key || !store_id) throw new Error('API Key ou Store ID não configurados');
    
    const response = await fetchWithRetry(
      `https://api.checkoutfy.com/v1/stores/${store_id}/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key
        },
        body: JSON.stringify({
          event: payload.event,
          order_id: payload.payment.id,
          amount: payload.payment.amount,
          customer: payload.customer,
          product: payload.product,
          callback_url: webhook_url
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Evento sincronizado' : `Erro: ${response.status}` };
  },

  // ═══ MEMBERKIT ═══
  memberkit: async (payload, config) => {
    const { api_key, subdomain } = config;
    if (!api_key || !subdomain) throw new Error('API Key ou Subdomínio não configurados');
    
    // Libera acesso em payment_approved, revoga em payment_refunded/chargeback
    const action = payload.event === 'payment_approved' ? 'enroll' 
      : ['payment_refunded', 'chargeback_created'].includes(payload.event) ? 'revoke' 
      : null;
    
    if (!action) {
      return { success: true, message: 'Evento ignorado' };
    }
    
    const endpoint = action === 'enroll' 
      ? `https://${subdomain}.memberkit.com.br/api/v1/enrollments`
      : `https://${subdomain}.memberkit.com.br/api/v1/enrollments/revoke`;
    
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          email: payload.customer.email,
          name: payload.customer.name,
          external_id: payload.payment.id,
          product_external_id: payload.product.id
        })
      }
    );
    
    return { 
      success: response.ok, 
      message: response.ok 
        ? (action === 'enroll' ? 'Acesso liberado' : 'Acesso revogado')
        : `Erro: ${response.status}` 
    };
  },

  // ═══ ASTRON MEMBERS ═══
  astron: async (payload, config) => {
    const { api_key, api_secret, product_id } = config;
    if (!api_key || !api_secret) throw new Error('API Key ou Secret não configurados');
    
    const action = payload.event === 'payment_approved' ? 'create' 
      : ['payment_refunded', 'chargeback_created'].includes(payload.event) ? 'revoke' 
      : null;
    
    if (!action) {
      return { success: true, message: 'Evento ignorado' };
    }
    
    const response = await fetchWithRetry(
      `https://api.astronmembers.com/v1/members/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': api_key,
          'X-API-Secret': api_secret
        },
        body: JSON.stringify({
          email: payload.customer.email,
          name: payload.customer.name,
          product_id: product_id || payload.product.id,
          transaction_id: payload.payment.id
        })
      }
    );
    
    return { 
      success: response.ok, 
      message: response.ok 
        ? (action === 'create' ? 'Membro criado' : 'Acesso revogado')
        : `Erro: ${response.status}` 
    };
  },

  // ═══ BOTCONVERSA ═══
  botconversa: async (payload, config) => {
    const { api_key, bot_id, flow_id } = config;
    if (!api_key || !bot_id) throw new Error('API Key ou Bot ID não configurados');
    
    // Extrai telefone do documento (simplificado)
    const phone = payload.customer.document || '';
    
    const messageTemplates: Record<string, string> = {
      payment_approved: `🎉 Parabéns ${payload.customer.name}! Seu pagamento de R$ ${(payload.payment.amount / 100).toFixed(2)} foi aprovado para ${payload.product.name}.`,
      payment_refused: `❌ ${payload.customer.name}, infelizmente seu pagamento não foi aprovado. Tente novamente ou entre em contato conosco.`,
      payment_refunded: `🔄 ${payload.customer.name}, seu reembolso de R$ ${(payload.payment.amount / 100).toFixed(2)} foi processado.`,
    };
    
    const message = messageTemplates[payload.event];
    if (!message) {
      return { success: true, message: 'Evento sem mensagem configurada' };
    }
    
    const response = await fetchWithRetry(
      `https://api.botconversa.com.br/v1/bots/${bot_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          to: phone,
          message,
          flow_id: flow_id || undefined
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Mensagem enviada' : `Erro: ${response.status}` };
  },

  // ═══ VOXUY ═══
  voxuy: async (payload, config) => {
    const { api_key, account_id } = config;
    if (!api_key) throw new Error('API Key não configurada');
    
    const response = await fetchWithRetry(
      'https://api.voxuy.com/v1/automations/trigger',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          account_id,
          event: payload.event,
          order_id: payload.payment.id,
          customer: {
            name: payload.customer.name,
            email: payload.customer.email,
            phone: payload.customer.document
          },
          payment: {
            amount: payload.payment.amount,
            method: payload.payment.method,
            status: payload.payment.status
          },
          product: payload.product,
          utm: payload.utm,
          timestamp: payload.timestamp
        })
      }
    );
    
    return { success: response.ok, message: response.ok ? 'Automação disparada' : `Erro: ${response.status}` };
  },

  // ═══ CADEMI ═══
  cademi: async (payload, config) => {
    const { api_key, workspace_id } = config;
    if (!api_key) throw new Error('API Key não configurada');
    
    // Libera acesso em payment_approved, revoga em refund/chargeback
    const action = payload.event === 'payment_approved' ? 'enroll' 
      : ['payment_refunded', 'chargeback_created'].includes(payload.event) ? 'revoke' 
      : null;
    
    if (!action) {
      return { success: true, message: 'Evento ignorado' };
    }
    
    const endpoint = action === 'enroll' 
      ? 'https://api.cademi.com.br/v1/students'
      : 'https://api.cademi.com.br/v1/students/revoke';
    
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({
          workspace_id,
          email: payload.customer.email,
          name: payload.customer.name,
          external_id: payload.payment.id,
          product_id: payload.product.id
        })
      }
    );
    
    return { 
      success: response.ok, 
      message: response.ok 
        ? (action === 'enroll' ? 'Aluno matriculado' : 'Acesso revogado')
        : `Erro: ${response.status}` 
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration_id, event, payload, config }: DispatchRequest = await req.json();
    
    console.log(`[DISPATCH] ${integration_id} <- ${event}`);
    
    const dispatcher = dispatchers[integration_id];
    if (!dispatcher) {
      console.log(`[DISPATCH] [ERROR] Unknown integration: ${integration_id}`);
      return new Response(
        JSON.stringify({ success: false, message: `Integração desconhecida: ${integration_id}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await dispatcher(payload, config);
    
    console.log(`[DISPATCH] [${result.success ? 'SUCCESS' : 'FAILED'}] ${integration_id}: ${result.message}`);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[DISPATCH] [ERROR]', errMsg);
    return new Response(
      JSON.stringify({ success: false, message: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
