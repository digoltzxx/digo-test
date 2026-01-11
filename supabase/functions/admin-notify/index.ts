import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'pending_withdrawal' | 'pending_bank_account' | 'auto_approve_error' | 'maintenance_mode';
  entity_id?: string;
  details?: Record<string, any>;
}

const getEmailTemplate = (type: string, details: Record<string, any>) => {
  const templates: Record<string, { subject: string; html: string }> = {
    pending_withdrawal: {
      subject: '🔔 Novo saque pendente de aprovação',
      html: `
        <h2>Novo Saque Pendente</h2>
        <p>Um novo saque está aguardando aprovação manual.</p>
        <ul>
          <li><strong>Usuário:</strong> ${details.user_email || 'N/A'}</li>
          <li><strong>Valor:</strong> R$ ${(details.amount || 0).toFixed(2)}</li>
          <li><strong>Valor Líquido:</strong> R$ ${(details.net_amount || 0).toFixed(2)}</li>
          <li><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</li>
        </ul>
        <p>Acesse o painel administrativo para aprovar ou rejeitar.</p>
      `
    },
    pending_bank_account: {
      subject: '🏦 Nova conta bancária pendente de aprovação',
      html: `
        <h2>Nova Conta Bancária Pendente</h2>
        <p>Uma nova conta bancária foi cadastrada e está aguardando aprovação.</p>
        <ul>
          <li><strong>Usuário:</strong> ${details.user_email || 'N/A'}</li>
          <li><strong>Banco:</strong> ${details.bank_name || 'N/A'}</li>
          <li><strong>Agência:</strong> ${details.agency || 'N/A'}</li>
          <li><strong>Conta:</strong> ${details.account_number || 'N/A'}</li>
          <li><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</li>
        </ul>
        <p>Acesse o painel administrativo para aprovar ou rejeitar.</p>
      `
    },
    auto_approve_error: {
      subject: '⚠️ Erro na aprovação automática',
      html: `
        <h2>Erro na Aprovação Automática</h2>
        <p>Houve um erro ao tentar aprovar automaticamente uma operação.</p>
        <ul>
          <li><strong>Tipo:</strong> ${details.entity_type || 'N/A'}</li>
          <li><strong>Erro:</strong> ${details.error || 'N/A'}</li>
          <li><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</li>
        </ul>
        <p>Verifique o sistema e tome as medidas necessárias.</p>
      `
    },
    maintenance_mode: {
      subject: details.enabled ? '🔧 Modo de manutenção ATIVADO' : '✅ Modo de manutenção DESATIVADO',
      html: `
        <h2>Modo de Manutenção ${details.enabled ? 'Ativado' : 'Desativado'}</h2>
        <p>O modo de manutenção foi ${details.enabled ? 'ativado' : 'desativado'}.</p>
        <ul>
          <li><strong>Responsável:</strong> ${details.admin_email || 'Sistema'}</li>
          <li><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</li>
        </ul>
        ${details.enabled ? '<p>Os usuários não terão acesso à plataforma até que o modo seja desativado.</p>' : '<p>Os usuários podem acessar a plataforma normalmente.</p>'}
      `
    }
  };

  return templates[type] || { subject: 'Notificação do Sistema', html: '<p>Notificação do sistema.</p>' };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if email notifications are enabled
    const { data: emailSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'enable_email_notifications')
      .maybeSingle();

    if (emailSetting?.value !== 'true') {
      console.log('ADMIN_NOTIFY: Email notifications disabled');
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, entity_id, details = {} }: NotificationRequest = await req.json();

    console.log(`ADMIN_NOTIFY: Sending ${type} notification`);

    // Get admin emails
    const { data: admins } = await supabase.rpc('get_admin_emails');
    
    if (!admins || admins.length === 0) {
      console.log('ADMIN_NOTIFY: No admin emails found');
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminEmails = admins.map((a: { email: string }) => a.email);
    const template = getEmailTemplate(type, details);

    // Send email using fetch to Resend API
    if (!resendApiKey) {
      console.error('ADMIN_NOTIFY: RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "RoyalPay <onboarding@resend.dev>",
        to: adminEmails,
        subject: template.subject,
        html: template.html,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log(`ADMIN_NOTIFY: Email sent to ${adminEmails.length} admins`, emailResult);

    // Log the notification
    await supabase.rpc('log_admin_action', {
      p_user_id: null,
      p_action_type: 'admin_notification',
      p_entity_type: type,
      p_entity_id: entity_id || null,
      p_details: { ...details, sent_to: adminEmails }
    });

    return new Response(
      JSON.stringify({ success: true, sent_to: adminEmails.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("ADMIN_NOTIFY ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
