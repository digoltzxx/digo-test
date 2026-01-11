import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SentryLogRequest {
  user_id?: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
  message: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  transaction?: string;
  exception?: {
    type: string;
    value: string;
    stacktrace?: string;
  };
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

    const payload: SentryLogRequest = await req.json();
    console.log('[Sentry] Log request received:', {
      level: payload.level,
      message: payload.message,
    });

    // Get Sentry DSN from user's integration or environment
    let sentryDsn = Deno.env.get('SENTRY_DSN');

    if (payload.user_id) {
      const { data: integration } = await supabase
        .from('user_integrations')
        .select('config')
        .eq('user_id', payload.user_id)
        .eq('integration_id', 'sentry')
        .single();

      if (integration?.config) {
        const config = integration.config as { dsn?: string };
        if (config.dsn) {
          sentryDsn = config.dsn;
        }
      }
    }

    if (!sentryDsn) {
      // Store locally if no Sentry configured
      console.log('[Sentry] No DSN configured, storing log locally');
      
      await supabase.from('monitoring_alerts').insert({
        user_id: payload.user_id || 'system',
        alert_type: payload.level,
        title: payload.message,
        message: JSON.stringify(payload.extra || {}),
        metadata: {
          tags: payload.tags,
          transaction: payload.transaction,
          exception: payload.exception,
        },
        status: 'pending',
      });

      return new Response(JSON.stringify({
        success: true,
        stored_locally: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse DSN to get project info
    const dsnMatch = sentryDsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) {
      throw new Error('Invalid Sentry DSN format');
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const sentryUrl = `https://${host}/api/${projectId}/store/`;

    // Build Sentry event
    const event: Record<string, unknown> = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: payload.level,
      logger: 'gateway',
      message: {
        formatted: payload.message,
      },
      extra: payload.extra || {},
      tags: {
        ...payload.tags,
        environment: Deno.env.get('ENVIRONMENT') || 'production',
      },
    };

    if (payload.transaction) {
      event.transaction = payload.transaction;
    }

    if (payload.exception) {
      event.exception = {
        values: [{
          type: payload.exception.type,
          value: payload.exception.value,
          stacktrace: payload.exception.stacktrace ? {
            frames: parseStacktrace(payload.exception.stacktrace),
          } : undefined,
        }],
      };
    }

    console.log('[Sentry] Sending event to Sentry...');

    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=gateway/1.0`,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Sentry] API error:', errorText);
      throw new Error(`Sentry API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Sentry] Event sent successfully:', result.id);

    // Also store in local monitoring
    await supabase.from('monitoring_alerts').insert({
      user_id: payload.user_id || 'system',
      alert_type: payload.level,
      title: payload.message,
      message: JSON.stringify(payload.extra || {}),
      metadata: {
        sentry_event_id: result.id,
        tags: payload.tags,
        transaction: payload.transaction,
      },
      status: 'sent',
    });

    return new Response(JSON.stringify({
      success: true,
      event_id: result.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sentry] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseStacktrace(stacktrace: string): Array<Record<string, unknown>> {
  const lines = stacktrace.split('\n');
  return lines.map(line => {
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    if (match) {
      return {
        function: match[1],
        filename: match[2],
        lineno: parseInt(match[3]),
        colno: parseInt(match[4]),
      };
    }
    return { function: line.trim() };
  }).filter(frame => frame.function);
}
