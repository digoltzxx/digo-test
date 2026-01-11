import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-platform-signature, x-voxuy-signature, x-cademi-signature',
};

interface WebhookPayload {
  event: string;
  event_id?: string;
  timestamp?: string;
  data: Record<string, unknown>;
}

// ═══════════════════════════════════════
// VALIDAÇÃO DE ASSINATURA HMAC
// ═══════════════════════════════════════

const verifySignature = async (
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> => {
  if (!signature || !secret) return true;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(payload));
  } catch (error) {
    console.error('[WEBHOOK] Erro ao verificar assinatura:', error);
    return false;
  }
};

// ═══════════════════════════════════════
// PROCESSADORES DE EVENTOS
// ═══════════════════════════════════════

// deno-lint-ignore no-explicit-any
const processStudentEvent = async (supabase: any, userId: string, platform: string, event: string, data: Record<string, unknown>) => {
  const studentData = {
    external_id: String(data.id || data.student_id || ''),
    external_platform: platform,
    name: String(data.name || data.nome || ''),
    email: String(data.email || ''),
    phone: String(data.phone || data.telefone || ''),
    document: String(data.document || data.cpf || ''),
    status: event === 'student.deleted' ? 'inativo' : 'ativo',
    external_synced_at: new Date().toISOString(),
    external_metadata: data
  };

  if (event === 'student.created') {
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('email', studentData.email)
      .eq('seller_user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('students')
        .update({
          external_id: studentData.external_id,
          external_platform: studentData.external_platform,
          external_synced_at: studentData.external_synced_at,
          external_metadata: studentData.external_metadata
        })
        .eq('id', existing.id);
      return { action: 'updated', id: existing.id };
    } else {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const { data: newStudent } = await supabase
        .from('students')
        .insert({
          seller_user_id: userId,
          product_id: product?.id,
          name: studentData.name,
          email: studentData.email,
          phone: studentData.phone,
          document: studentData.document,
          status: studentData.status,
          external_id: studentData.external_id,
          external_platform: studentData.external_platform,
          external_synced_at: studentData.external_synced_at,
          external_metadata: studentData.external_metadata,
          enrolled_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();
      return { action: 'created', id: newStudent?.id };
    }
  } else if (event === 'student.updated') {
    await supabase
      .from('students')
      .update({
        name: studentData.name,
        phone: studentData.phone,
        document: studentData.document,
        external_synced_at: studentData.external_synced_at,
        external_metadata: studentData.external_metadata
      })
      .eq('external_id', studentData.external_id)
      .eq('external_platform', platform);
    return { action: 'updated' };
  } else if (event === 'student.deleted') {
    await supabase
      .from('students')
      .update({ status: 'inativo', is_blocked: true, blocked_reason: 'Removido via webhook' })
      .eq('external_id', studentData.external_id)
      .eq('external_platform', platform);
    return { action: 'deactivated' };
  }
  return { action: 'ignored' };
};

// deno-lint-ignore no-explicit-any
const processEnrollmentEvent = async (supabase: any, userId: string, platform: string, event: string, data: Record<string, unknown>) => {
  const studentEmail = String(data.student_email || data.email || '');
  const courseExternalId = String(data.course_id || data.curso_id || '');
  const externalId = String(data.id || data.enrollment_id || '');

  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('email', studentEmail)
    .eq('seller_user_id', userId)
    .maybeSingle();

  if (!student) {
    console.log('[WEBHOOK] Aluno não encontrado:', studentEmail);
    return { action: 'skipped', reason: 'student_not_found' };
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, product_id')
    .eq('external_id', courseExternalId)
    .eq('external_platform', platform)
    .maybeSingle();

  if (!course) {
    console.log('[WEBHOOK] Curso não encontrado:', courseExternalId);
    return { action: 'skipped', reason: 'course_not_found' };
  }

  if (event === 'enrollment.created' || event === 'enrollment.approved') {
    const status = event === 'enrollment.approved' ? 'active' : 'enrolled';

    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', student.id)
      .eq('course_id', course.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('enrollments')
        .update({
          status,
          external_id: externalId,
          external_platform: platform,
          external_synced_at: new Date().toISOString(),
          access_revoked_at: null,
          revoke_reason: null
        })
        .eq('id', existing.id);
      return { action: 'updated', status };
    } else {
      await supabase
        .from('enrollments')
        .insert({
          student_id: student.id,
          course_id: course.id,
          product_id: course.product_id,
          status,
          external_id: externalId,
          external_platform: platform,
          external_synced_at: new Date().toISOString(),
          enrolled_at: new Date().toISOString()
        });
      return { action: 'created', status };
    }
  } else if (event === 'enrollment.canceled') {
    await supabase
      .from('enrollments')
      .update({
        status: 'revoked',
        access_revoked_at: new Date().toISOString(),
        revoke_reason: 'Cancelado via webhook',
        external_synced_at: new Date().toISOString()
      })
      .eq('student_id', student.id)
      .eq('course_id', course.id);
    return { action: 'revoked' };
  } else if (event === 'enrollment.completed') {
    await supabase
      .from('enrollments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        external_synced_at: new Date().toISOString()
      })
      .eq('student_id', student.id)
      .eq('course_id', course.id);
    return { action: 'completed' };
  }
  return { action: 'ignored' };
};

// deno-lint-ignore no-explicit-any
const processCourseEvent = async (supabase: any, userId: string, platform: string, event: string, data: Record<string, unknown>) => {
  const courseData = {
    external_id: String(data.id || data.course_id || ''),
    external_platform: platform,
    name: String(data.name || data.titulo || data.title || ''),
    description: String(data.description || data.descricao || ''),
    image_url: String(data.image_url || data.imagem || ''),
    status: event === 'course.deleted' ? 'inactive' : 'active',
    external_synced_at: new Date().toISOString(),
    external_metadata: data
  };

  if (event === 'course.created' || event === 'course.updated') {
    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('external_id', courseData.external_id)
      .eq('external_platform', platform)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('courses')
        .update({
          name: courseData.name,
          description: courseData.description,
          image_url: courseData.image_url,
          status: courseData.status,
          external_synced_at: courseData.external_synced_at,
          external_metadata: courseData.external_metadata
        })
        .eq('id', existing.id);
      return { action: 'updated', id: existing.id };
    } else {
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      const { data: newCourse } = await supabase
        .from('courses')
        .insert({
          seller_user_id: userId,
          product_id: product?.id,
          name: courseData.name,
          description: courseData.description,
          image_url: courseData.image_url,
          status: courseData.status,
          external_id: courseData.external_id,
          external_platform: courseData.external_platform,
          external_synced_at: courseData.external_synced_at,
          external_metadata: courseData.external_metadata
        })
        .select('id')
        .maybeSingle();
      return { action: 'created', id: newCourse?.id };
    }
  } else if (event === 'course.deleted') {
    await supabase
      .from('courses')
      .update({ status: 'inactive' })
      .eq('external_id', courseData.external_id)
      .eq('external_platform', platform);
    return { action: 'deactivated' };
  }
  return { action: 'ignored' };
};

// ═══════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const url = new URL(req.url);
    
    // Esperamos: ?platform=voxuy&user_id=xxx
    const platform = (url.searchParams.get('platform') || '').toLowerCase();
    const userId = url.searchParams.get('user_id') || '';

    if (!platform || !userId) {
      return new Response(
        JSON.stringify({ error: 'Platform e user_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['voxuy', 'cademi', 'memberkit', 'astron'].includes(platform)) {
      return new Response(
        JSON.stringify({ error: 'Plataforma não suportada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await req.text();
    const payload: WebhookPayload = JSON.parse(rawBody);

    // Verificar assinatura
    const signature = req.headers.get(`x-${platform}-signature`) || 
                      req.headers.get('x-webhook-signature') ||
                      req.headers.get('x-platform-signature');

    const { data: integration } = await supabase
      .from('user_integrations')
      .select('config')
      .eq('user_id', userId)
      .eq('integration_id', platform)
      .maybeSingle();

    const secret = integration?.config?.webhook_secret || integration?.config?.secret_key;

    if (secret && signature) {
      const isValid = await verifySignature(rawBody, signature, secret as string);
      if (!isValid) {
        console.log(`[WEBHOOK] Assinatura inválida para ${platform}/${userId}`);
        return new Response(
          JSON.stringify({ error: 'Assinatura inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Idempotência
    const idempotencyKey = payload.event_id || `${platform}-${payload.event}-${Date.now()}`;
    
    const { data: existingLog } = await supabase
      .from('edtech_webhook_logs')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingLog?.status === 'success') {
      return new Response(
        JSON.stringify({ success: true, message: 'Evento já processado', duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar log
    const { data: logEntry } = await supabase
      .from('edtech_webhook_logs')
      .insert({
        user_id: userId,
        platform,
        event_type: payload.event,
        event_id: payload.event_id,
        payload,
        status: 'processing',
        idempotency_key: idempotencyKey
      })
      .select('id')
      .maybeSingle();

    // Processar evento
    let result: Record<string, unknown> = { action: 'unknown' };
    const event = payload.event.toLowerCase();

    try {
      if (event.startsWith('student.')) {
        result = await processStudentEvent(supabase, userId, platform, event, payload.data);
      } else if (event.startsWith('enrollment.')) {
        result = await processEnrollmentEvent(supabase, userId, platform, event, payload.data);
      } else if (event.startsWith('course.')) {
        result = await processCourseEvent(supabase, userId, platform, event, payload.data);
      } else if (event.startsWith('payment.')) {
        result = { action: 'forwarded', message: 'Processado pelo gateway de pagamentos' };
      } else {
        result = { action: 'ignored', reason: 'Evento não mapeado' };
      }

      if (logEntry) {
        await supabase
          .from('edtech_webhook_logs')
          .update({ status: 'success', processed_at: new Date().toISOString() })
          .eq('id', logEntry.id);
      }

      console.log(`[WEBHOOK] ${platform}/${event}: ${JSON.stringify(result)}`);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processError) {
      const errorMessage = processError instanceof Error ? processError.message : 'Erro desconhecido';
      
      if (logEntry) {
        await supabase
          .from('edtech_webhook_logs')
          .update({ status: 'error', error_message: errorMessage, retry_count: 1, processed_at: new Date().toISOString() })
          .eq('id', logEntry.id);
      }

      console.error(`[WEBHOOK] Erro processando ${platform}/${event}:`, errorMessage);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    console.error('[WEBHOOK] Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});