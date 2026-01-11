import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImpersonateRequest {
  action: "start" | "end" | "verify";
  targetUserId?: string;
  token?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com service role para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com anon key para validar o token do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Obter usuário atual
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ImpersonateRequest = await req.json();
    const { action, targetUserId, token, reason } = body;

    // Obter IP e User Agent
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (action === "start") {
      // Verificar se o usuário tem permissão para impersonar
      const { data: canImpersonate } = await supabaseAdmin.rpc("can_impersonate", {
        _user_id: user.id,
      });

      if (!canImpersonate) {
        // Log tentativa não autorizada
        console.error(`Tentativa não autorizada de impersonação: ${user.id} -> ${targetUserId}`);
        return new Response(
          JSON.stringify({ error: "Você não tem permissão para assumir contas de usuários" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "ID do usuário alvo é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se não está tentando impersonar a si mesmo
      if (targetUserId === user.id) {
        return new Response(
          JSON.stringify({ error: "Não é possível impersonar sua própria conta" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se usuário alvo existe
      const { data: targetUser, error: targetError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      if (targetError || !targetUser?.user) {
        return new Response(
          JSON.stringify({ error: "Usuário alvo não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se não está tentando impersonar outro admin/owner
      const { data: targetRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      const targetIsAdmin = targetRoles?.some(r => 
        ["owner", "admin_super", "admin"].includes(r.role)
      );

      if (targetIsAdmin) {
        return new Response(
          JSON.stringify({ error: "Não é possível impersonar outros administradores" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encerrar sessões ativas anteriores deste admin
      await supabaseAdmin
        .from("impersonation_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("admin_user_id", user.id)
        .eq("status", "active");

      // Gerar token seguro
      const impersonationToken = crypto.randomUUID() + "-" + crypto.randomUUID();

      // Criar sessão de impersonação
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("impersonation_sessions")
        .insert({
          admin_user_id: user.id,
          impersonated_user_id: targetUserId,
          token: impersonationToken,
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: reason || "Suporte administrativo",
          status: "active",
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Erro ao criar sessão:", sessionError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar sessão de impersonação" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registrar log de ação
      await supabaseAdmin.from("impersonation_action_logs").insert({
        session_id: session.id,
        admin_user_id: user.id,
        impersonated_user_id: targetUserId,
        action_type: "session_start",
        action_details: {
          reason: reason || "Suporte administrativo",
          target_email: targetUser.user.email,
        },
        ip_address: ipAddress,
      });

      // Obter perfil do usuário impersonado
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("user_id", targetUserId)
        .single();

      console.log(`Impersonação iniciada: Admin ${user.id} -> Usuário ${targetUserId}`);

      return new Response(
        JSON.stringify({
          success: true,
          session: {
            id: session.id,
            token: impersonationToken,
            expires_at: session.expires_at,
          },
          impersonatedUser: {
            id: targetUserId,
            email: targetUser.user.email,
            name: targetProfile?.full_name || targetUser.user.email,
            avatar_url: targetProfile?.avatar_url,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "end") {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar e encerrar sessão
      const { data: session, error: findError } = await supabaseAdmin
        .from("impersonation_sessions")
        .select("*")
        .eq("token", token)
        .eq("status", "active")
        .single();

      if (findError || !session) {
        return new Response(
          JSON.stringify({ error: "Sessão não encontrada ou já encerrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encerrar sessão
      await supabaseAdmin
        .from("impersonation_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", session.id);

      // Registrar log
      await supabaseAdmin.from("impersonation_action_logs").insert({
        session_id: session.id,
        admin_user_id: session.admin_user_id,
        impersonated_user_id: session.impersonated_user_id,
        action_type: "session_end",
        action_details: { ended_by: user.id },
        ip_address: ipAddress,
      });

      console.log(`Impersonação encerrada: Session ${session.id}`);

      return new Response(
        JSON.stringify({ success: true, message: "Sessão encerrada com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!token) {
        return new Response(
          JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se a sessão é válida
      const { data: session } = await supabaseAdmin
        .from("impersonation_sessions")
        .select("*, profiles:impersonated_user_id(full_name, email, avatar_url)")
        .eq("token", token)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!session) {
        return new Response(
          JSON.stringify({ valid: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          valid: true,
          session: {
            id: session.id,
            admin_user_id: session.admin_user_id,
            impersonated_user_id: session.impersonated_user_id,
            expires_at: session.expires_at,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na impersonação:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
