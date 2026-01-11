import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationEvent {
  event_type: string;
  sale_id?: string;
  product_id?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  transaction_id?: string;
  metadata?: Record<string, unknown>;
  user_id: string;
}

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error | null = null;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt + 1} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}

// Send webhook with HMAC signature
async function sendWebhook(
  url: string, 
  payload: unknown, 
  secret?: string
): Promise<{ status: number; body: string; latency: number }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    headers['X-Webhook-Signature'] = `sha256=${signatureHex}`;
  }

  const startTime = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  const latency = Date.now() - startTime;
  const responseBody = await response.text();

  return { status: response.status, body: responseBody, latency };
}

// Send to Telegram
async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  const data = await response.json();
  
  if (data.ok) {
    return { success: true, messageId: data.result?.message_id?.toString() };
  }
  
  return { success: false, error: data.description || 'Unknown error' };
}

// Send to WhatsApp Cloud API
async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  recipientPhone: string,
  templateName: string,
  templateParams: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components: [{
          type: 'body',
          parameters: templateParams.map(text => ({ type: 'text', text })),
        }],
      },
    }),
  });

  const data = await response.json();
  
  if (data.messages?.[0]?.id) {
    return { success: true, messageId: data.messages[0].id };
  }
  
  return { success: false, error: data.error?.message || 'Unknown error' };
}

// Send GA4 event
async function sendGA4Event(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  eventName: string,
  eventParams: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      events: [{
        name: eventName,
        params: eventParams,
      }],
    }),
  });

  return { success: response.status === 204 };
}

// Send to Brevo (email marketing)
async function sendToBrevo(
  apiKey: string,
  email: string,
  name: string,
  listId: number,
  attributes?: Record<string, unknown>
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  const url = 'https://api.brevo.com/v3/contacts';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: name, ...attributes },
      listIds: [listId],
      updateEnabled: true,
    }),
  });

  const data = await response.json();
  
  if (response.ok || response.status === 201) {
    return { success: true, contactId: data.id?.toString() };
  }
  
  return { success: false, error: data.message || 'Unknown error' };
}

// Format Telegram message
function formatTelegramMessage(event: IntegrationEvent): string {
  const amount = event.amount 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.amount)
    : 'N/A';

  const eventEmojis: Record<string, string> = {
    'payment.approved': '✅',
    'payment.created': '🆕',
    'payment.refused': '❌',
    'payment.refunded': '💸',
    'chargeback.created': '⚠️',
    'subscription.created': '🔄',
    'subscription.canceled': '🚫',
  };

  const emoji = eventEmojis[event.event_type] || '📋';
  
  return `${emoji} *${event.event_type.replace('.', ' ').toUpperCase()}*

💰 *Valor:* ${amount}
📧 *Cliente:* ${event.customer_email || 'N/A'}
👤 *Nome:* ${event.customer_name || 'N/A'}
💳 *Método:* ${event.payment_method || 'N/A'}
🔢 *Transação:* \`${event.transaction_id || 'N/A'}\`
📅 *Data:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const event: IntegrationEvent = await req.json();
    console.log('Processing integration event:', event.event_type);

    // Fetch user integrations
    const { data: integrations, error: intError } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', event.user_id)
      .eq('connected', true)
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching integrations:', intError);
      throw intError;
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    for (const integration of integrations || []) {
      const config = integration.config as Record<string, string>;
      
      try {
        switch (integration.integration_id) {
          case 'webhooks': {
            if (config?.webhook_url) {
              const result = await retryWithBackoff(
                () => sendWebhook(config.webhook_url, event, config.webhook_secret),
                integration.retry_policy?.max_retries || 3
              );
              
              // Log webhook
              await supabase.from('webhook_logs').insert({
                user_id: event.user_id,
                event_type: event.event_type,
                endpoint_url: config.webhook_url,
                request_payload: event,
                response_status: result.status,
                response_body: result.body.substring(0, 1000),
                latency_ms: result.latency,
                delivered_at: result.status >= 200 && result.status < 300 ? new Date().toISOString() : null,
                failed_at: result.status >= 400 ? new Date().toISOString() : null,
                idempotency_key: `${event.sale_id || event.transaction_id}_${event.event_type}`,
              });
              
              results['webhooks'] = { success: result.status >= 200 && result.status < 300 };
            }
            break;
          }

          case 'telegram': {
            if (config?.bot_token && config?.chat_id) {
              const message = formatTelegramMessage(event);
              const result = await retryWithBackoff(
                () => sendTelegramNotification(config.bot_token, config.chat_id, message)
              );
              
              await supabase.from('telegram_notifications').insert({
                user_id: event.user_id,
                chat_id: config.chat_id,
                event_type: event.event_type,
                message,
                message_id: result.messageId,
                sent_at: result.success ? new Date().toISOString() : null,
                error_message: result.error,
                sale_id: event.sale_id,
                amount: event.amount,
              });
              
              results['telegram'] = result;
            }
            break;
          }

          case 'whatsapp': {
            if (config?.access_token && config?.phone_number_id && event.customer_phone) {
              const templateParams = [
                event.customer_name || 'Cliente',
                event.amount?.toString() || '0',
                event.transaction_id || 'N/A',
              ];
              
              const result = await retryWithBackoff(
                () => sendWhatsAppMessage(
                  config.access_token,
                  config.phone_number_id,
                  event.customer_phone!,
                  config.template_name || 'payment_confirmation',
                  templateParams
                )
              );
              
              await supabase.from('whatsapp_messages').insert({
                user_id: event.user_id,
                phone_number: event.customer_phone,
                template_name: config.template_name || 'payment_confirmation',
                template_params: templateParams,
                provider_message_id: result.messageId,
                status: result.success ? 'sent' : 'failed',
                sent_at: result.success ? new Date().toISOString() : null,
                error_message: result.error,
                sale_id: event.sale_id,
              });
              
              results['whatsapp'] = result;
            }
            break;
          }

          case 'analytics': {
            if (config?.measurement_id && config?.api_secret) {
              const ga4EventName = event.event_type === 'payment.approved' ? 'purchase' 
                : event.event_type === 'payment.refunded' ? 'refund' 
                : 'custom_event';
              
              const clientId = event.metadata?.client_id as string || crypto.randomUUID();
              const deduplicationKey = `${event.sale_id || event.transaction_id}_${event.event_type}`;
              
              // Check for deduplication
              const { data: existing } = await supabase
                .from('analytics_events')
                .select('id')
                .eq('deduplication_key', deduplicationKey)
                .maybeSingle();
              
              if (!existing) {
                const eventParams = {
                  transaction_id: event.transaction_id,
                  value: event.amount,
                  currency: event.currency || 'BRL',
                  items: event.product_id ? [{ item_id: event.product_id }] : [],
                };
                
                const result = await retryWithBackoff(
                  () => sendGA4Event(config.measurement_id, config.api_secret, clientId, ga4EventName, eventParams)
                );
                
                await supabase.from('analytics_events').insert({
                  user_id: event.user_id,
                  measurement_id: config.measurement_id,
                  client_id: clientId,
                  event_name: ga4EventName,
                  event_params: eventParams,
                  sale_id: event.sale_id,
                  transaction_id: event.transaction_id,
                  value: event.amount,
                  sent_at: result.success ? new Date().toISOString() : null,
                  deduplication_key: deduplicationKey,
                });
                
                results['analytics'] = result;
              } else {
                results['analytics'] = { success: true, error: 'Deduplicated' };
              }
            }
            break;
          }

          case 'email': {
            if (config?.api_key && event.customer_email) {
              const provider = config.provider || 'brevo';
              
              if (provider === 'brevo') {
                const result = await retryWithBackoff(
                  () => sendToBrevo(
                    config.api_key,
                    event.customer_email!,
                    event.customer_name || '',
                    parseInt(config.list_id || '0'),
                    { 
                      LAST_PURCHASE: new Date().toISOString(),
                      LAST_AMOUNT: event.amount,
                    }
                  )
                );
                
                await supabase.from('email_marketing_contacts').upsert({
                  user_id: event.user_id,
                  provider,
                  email: event.customer_email,
                  name: event.customer_name,
                  phone: event.customer_phone,
                  list_id: config.list_id,
                  provider_contact_id: result.contactId,
                  synced_at: result.success ? new Date().toISOString() : null,
                  sync_error: result.error,
                }, {
                  onConflict: 'user_id,provider,email',
                });
                
                results['email'] = result;
              }
            }
            break;
          }

          case 'zapier': {
            // Check zapier triggers
            const { data: triggers } = await supabase
              .from('zapier_triggers')
              .select('*')
              .eq('user_id', event.user_id)
              .eq('is_active', true)
              .contains('event_types', [event.event_type]);
            
            for (const trigger of triggers || []) {
              try {
                const result = await retryWithBackoff(
                  () => sendWebhook(trigger.webhook_url, {
                    event_type: event.event_type,
                    data: event,
                    timestamp: new Date().toISOString(),
                  })
                );
                
                await supabase
                  .from('zapier_triggers')
                  .update({
                    last_triggered_at: new Date().toISOString(),
                    trigger_count: (trigger.trigger_count || 0) + 1,
                  })
                  .eq('id', trigger.id);
                
                results[`zapier_${trigger.id}`] = { success: result.status >= 200 && result.status < 300 };
              } catch (error) {
                await supabase
                  .from('zapier_triggers')
                  .update({
                    error_count: (trigger.error_count || 0) + 1,
                    last_error: error instanceof Error ? error.message : String(error),
                  })
                  .eq('id', trigger.id);
              }
            }
            break;
          }
        }

        // Log integration event
        await supabase.from('integration_events').insert({
          user_id: event.user_id,
          integration_id: integration.integration_id,
          event_type: event.event_type,
          event_data: event,
          sale_id: event.sale_id,
          product_id: event.product_id,
          customer_email: event.customer_email,
          amount: event.amount,
          currency: event.currency || 'BRL',
          status: results[integration.integration_id]?.success ? 'delivered' : 'failed',
          error_message: results[integration.integration_id]?.error,
          processed_at: new Date().toISOString(),
        });

      } catch (error) {
        console.error(`Error processing ${integration.integration_id}:`, error);
        results[integration.integration_id] = { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in integration-dispatch:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
