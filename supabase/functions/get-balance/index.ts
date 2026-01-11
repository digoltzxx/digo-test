import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * GET /financeiro/saldo
 * 
 * Retorna o saldo consolidado do usuário
 * 
 * REGRAS DE NEGÓCIO:
 * - saldo_disponivel = transações APROVADAS com data_liberação <= agora (não sacadas)
 * - saldo_em_retencao = transações APROVADAS com data_liberação > agora
 * - saldo_total = saldo_disponivel + saldo_em_retencao
 * - total_sacado = soma dos saques CONCLUÍDOS
 * - pode_sacar = saldo_disponivel > valor_minimo_saque
 * 
 * STATUS PERMITIDOS: 'paid', 'approved', 'confirmed'
 */

const ALLOWED_WALLET_STATUSES = ['paid', 'approved', 'confirmed'];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept both GET and POST (supabase.functions.invoke uses POST by default)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('BALANCE ERROR: No authorization header');
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.log('BALANCE ERROR: Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`BALANCE: Calculating for user ${userId}`);

    // Service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get system settings
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .in('key', ['minimum_withdrawal', 'withdrawal_fee']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => settingsMap[s.key] = s.value);

    const minWithdrawal = parseFloat(settingsMap['minimum_withdrawal']) || 50;
    const withdrawalFee = parseFloat(settingsMap['withdrawal_fee']) || 4.90;

    // Monetary rounding function
    const arredondarMoeda = (valor: number): number => Math.round(valor * 100) / 100;

    // =====================================
    // BUSCAR VENDAS (TRANSAÇÕES)
    // =====================================
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('amount, net_amount, payment_fee, platform_fee, commission_amount, status, payment_method, created_at')
      .eq('seller_user_id', userId);

    if (salesError) {
      console.error('BALANCE ERROR: Failed to fetch sales:', salesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar transações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================
    // BUSCAR SAQUES
    // =====================================
    const { data: withdrawals, error: withdrawalsError } = await supabaseAdmin
      .from('withdrawals')
      .select('amount, status, created_at')
      .eq('user_id', userId);

    if (withdrawalsError) {
      console.error('BALANCE ERROR: Failed to fetch withdrawals:', withdrawalsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar saques' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================
    // CÁLCULOS DE SALDO
    // =====================================

    // Vendas APROVADAS (status permitidos)
    const approvedSales = sales?.filter(s => ALLOWED_WALLET_STATUSES.includes(s.status)) || [];
    
    // Vendas em RETENÇÃO
    const retentionSales = sales?.filter(s => s.status === 'retention') || [];
    
    // Vendas PENDENTES (informativo apenas)
    const pendingSales = sales?.filter(s => 
      ['pending', 'waiting_payment', 'processing', 'under_analysis'].includes(s.status)
    ) || [];

    // Vendas aprovadas por cartão (para "saldo à liberar")
    const cardApprovedSales = approvedSales.filter(s => 
      s.payment_method === 'credit_card' || s.payment_method === 'card'
    );

    // Total líquido vendas aprovadas (net_amount já tem taxas descontadas)
    const totalLiquidoVendas = arredondarMoeda(
      approvedSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
    );

    // Saldo em retenção
    const saldoEmRetencao = arredondarMoeda(
      retentionSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
    );

    // Vendas pendentes (não entram no saldo)
    const vendasPendentes = arredondarMoeda(
      pendingSales.reduce((sum, s) => sum + Number(s.amount || 0), 0)
    );
    const quantidadeVendasPendentes = pendingSales.length;

    // Vendas aprovadas por cartão
    const saldoCartaoALiberar = arredondarMoeda(
      cardApprovedSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
    );
    const quantidadeCartaoALiberar = cardApprovedSales.length;

    // Total de taxas
    const totalTaxas = arredondarMoeda(
      approvedSales.reduce((sum, s) => 
        sum + Number(s.payment_fee || 0) + Number(s.platform_fee || 0) + Number(s.commission_amount || 0)
      , 0)
    );

    // Saques concluídos
    const saquesCompletos = arredondarMoeda(
      withdrawals
        ?.filter(w => w.status === 'completed' || w.status === 'approved')
        .reduce((sum, w) => sum + Number(w.amount), 0) || 0
    );

    // Saques pendentes
    const saquesPendentes = arredondarMoeda(
      withdrawals
        ?.filter(w => w.status === 'pending')
        .reduce((sum, w) => sum + Number(w.amount), 0) || 0
    );

    // =====================================
    // CÁLCULO FINAL DO SALDO
    // saldo_disponivel = total_liquido_vendas - saques_completos - saques_pendentes
    // saldo_total = saldo_disponivel + saldo_em_retencao
    // =====================================
    const saldoDisponivel = arredondarMoeda(
      Math.max(0, totalLiquidoVendas - saquesCompletos - saquesPendentes)
    );

    const saldoTotal = arredondarMoeda(saldoDisponivel + saldoEmRetencao);

    // Pode sacar se saldo disponível >= valor mínimo
    const podeSacar = saldoDisponivel >= minWithdrawal;

    // Log para auditoria
    console.log('=== CÁLCULO DE SALDO (BACKEND) ===');
    console.log(`User ID: ${userId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Total líquido vendas aprovadas: R$ ${totalLiquidoVendas.toFixed(2)}`);
    console.log(`Saldo em retenção: R$ ${saldoEmRetencao.toFixed(2)}`);
    console.log(`Saques completos: R$ ${saquesCompletos.toFixed(2)}`);
    console.log(`Saques pendentes: R$ ${saquesPendentes.toFixed(2)}`);
    console.log(`Saldo disponível: R$ ${saldoDisponivel.toFixed(2)}`);
    console.log(`Saldo total: R$ ${saldoTotal.toFixed(2)}`);
    console.log(`Pode sacar: ${podeSacar}`);
    console.log('===================================');

    // Resposta conforme especificação
    const response = {
      saldo_total: saldoTotal,
      saldo_disponivel: saldoDisponivel,
      saldo_em_retencao: saldoEmRetencao,
      total_sacado: saquesCompletos,
      saques_pendentes: saquesPendentes,
      pode_sacar: podeSacar,
      // Dados adicionais para UI
      cartao_a_liberar: saldoCartaoALiberar,
      cartao_a_liberar_qtd: quantidadeCartaoALiberar,
      vendas_pendentes: vendasPendentes,
      vendas_pendentes_qtd: quantidadeVendasPendentes,
      total_taxas: totalTaxas,
      // Configurações
      valor_minimo_saque: minWithdrawal,
      taxa_saque: withdrawalFee,
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('BALANCE ERROR: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
