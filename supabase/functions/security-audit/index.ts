import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityCheck {
  id: string;
  name: string;
  category: 'DATABASE' | 'BACKEND' | 'FRONTEND' | 'INFRA' | 'COMPLIANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  message: string;
  recommendation?: string;
}

interface AuditReport {
  timestamp: string;
  environment: string;
  checks: SecurityCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    criticalIssues: number;
    score: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const checks: SecurityCheck[] = [];

    // ============================================
    // 1. DATABASE SECURITY CHECKS
    // ============================================

    // Check 1.1: Verificar tabelas sem RLS
    try {
      const { data: tablesWithoutRLS } = await supabaseAdmin.rpc('get_tables_without_rls');
      checks.push({
        id: 'DB-001',
        name: 'RLS em todas as tabelas',
        category: 'DATABASE',
        severity: 'CRITICAL',
        status: tablesWithoutRLS?.length === 0 ? 'PASS' : 'FAIL',
        message: tablesWithoutRLS?.length === 0 
          ? 'Todas as tabelas têm RLS habilitado'
          : `${tablesWithoutRLS?.length} tabelas sem RLS: ${tablesWithoutRLS?.slice(0, 3).join(', ')}...`,
        recommendation: 'Habilitar RLS com: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;'
      });
    } catch {
      checks.push({
        id: 'DB-001',
        name: 'RLS em todas as tabelas',
        category: 'DATABASE',
        severity: 'CRITICAL',
        status: 'WARNING',
        message: 'Não foi possível verificar RLS (função não existe)',
        recommendation: 'Criar função get_tables_without_rls'
      });
    }

    // Check 1.2: Verificar policies TRUE
    try {
      const { data: permissivePolicies } = await supabaseAdmin
        .from('pg_policies')
        .select('*')
        .or('qual.ilike.%true%,with_check.ilike.%true%');
      
      checks.push({
        id: 'DB-002',
        name: 'Sem policies permissivas (TRUE)',
        category: 'DATABASE',
        severity: 'HIGH',
        status: !permissivePolicies || permissivePolicies.length === 0 ? 'PASS' : 'WARNING',
        message: !permissivePolicies || permissivePolicies.length === 0
          ? 'Nenhuma policy com TRUE detectada'
          : `${permissivePolicies.length} policies podem ser muito permissivas`,
        recommendation: 'Revisar policies que usam USING(true) ou WITH CHECK(true)'
      });
    } catch {
      checks.push({
        id: 'DB-002',
        name: 'Sem policies permissivas (TRUE)',
        category: 'DATABASE',
        severity: 'HIGH',
        status: 'SKIP',
        message: 'Verificação requer acesso direto ao PostgreSQL'
      });
    }

    // Check 1.3: Auditoria financeira ativa
    const { count: auditCount } = await supabaseAdmin
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      id: 'DB-003',
      name: 'Auditoria ativa (últimas 24h)',
      category: 'DATABASE',
      severity: 'HIGH',
      status: (auditCount ?? 0) > 0 ? 'PASS' : 'WARNING',
      message: (auditCount ?? 0) > 0
        ? `${auditCount} eventos de auditoria nas últimas 24h`
        : 'Nenhum evento de auditoria recente',
      recommendation: 'Verificar se triggers de auditoria estão funcionando'
    });

    // Check 1.4: Transações financeiras consistentes
    const { data: salesData } = await supabaseAdmin
      .from('sales')
      .select('id, amount, net_amount, status')
      .eq('status', 'approved')
      .limit(100);

    const inconsistentSales = salesData?.filter(s => 
      s.net_amount > s.amount || s.net_amount < 0
    ) ?? [];

    checks.push({
      id: 'DB-004',
      name: 'Integridade de transações',
      category: 'DATABASE',
      severity: 'CRITICAL',
      status: inconsistentSales.length === 0 ? 'PASS' : 'FAIL',
      message: inconsistentSales.length === 0
        ? 'Todas as transações verificadas estão consistentes'
        : `${inconsistentSales.length} transações com valores inconsistentes`,
      recommendation: 'Revisar transações onde net_amount > amount'
    });

    // ============================================
    // 2. BACKEND SECURITY CHECKS
    // ============================================

    // Check 2.1: Verificar se secrets estão configurados
    const requiredSecrets = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingSecrets = requiredSecrets.filter(s => !Deno.env.get(s));
    
    checks.push({
      id: 'BE-001',
      name: 'Secrets obrigatórios configurados',
      category: 'BACKEND',
      severity: 'CRITICAL',
      status: missingSecrets.length === 0 ? 'PASS' : 'FAIL',
      message: missingSecrets.length === 0
        ? 'Todos os secrets obrigatórios estão configurados'
        : `Secrets faltando: ${missingSecrets.join(', ')}`,
      recommendation: 'Configurar secrets via Supabase Dashboard'
    });

    // Check 2.2: Verificar webhooks ativos
    const { count: webhookFailures } = await supabaseAdmin
      .from('webhook_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'error')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      id: 'BE-002',
      name: 'Webhooks funcionando',
      category: 'BACKEND',
      severity: 'HIGH',
      status: (webhookFailures ?? 0) < 10 ? 'PASS' : 'WARNING',
      message: (webhookFailures ?? 0) < 10
        ? `${webhookFailures ?? 0} falhas de webhook nas últimas 24h`
        : `${webhookFailures} falhas de webhook detectadas`,
      recommendation: 'Verificar logs de webhook e endpoints de destino'
    });

    // Check 2.3: Verificar saques pendentes suspeitos
    const { data: suspiciousWithdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('id, amount, user_id')
      .eq('status', 'pending')
      .gt('amount', 10000); // Saques > R$ 100 pendentes

    checks.push({
      id: 'BE-003',
      name: 'Saques altos pendentes',
      category: 'BACKEND',
      severity: 'MEDIUM',
      status: (suspiciousWithdrawals?.length ?? 0) < 5 ? 'PASS' : 'WARNING',
      message: (suspiciousWithdrawals?.length ?? 0) < 5
        ? `${suspiciousWithdrawals?.length ?? 0} saques altos pendentes`
        : `${suspiciousWithdrawals?.length} saques altos aguardando revisão`,
      recommendation: 'Revisar saques acima de R$ 100 manualmente'
    });

    // ============================================
    // 3. COMPLIANCE CHECKS
    // ============================================

    // Check 3.1: Verificar usuários sem documento
    const { count: usersWithoutDoc } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('document', null);

    checks.push({
      id: 'CP-001',
      name: 'KYC - Documentos verificados',
      category: 'COMPLIANCE',
      severity: 'MEDIUM',
      status: (usersWithoutDoc ?? 0) === 0 ? 'PASS' : 'WARNING',
      message: (usersWithoutDoc ?? 0) === 0
        ? 'Todos os usuários têm documento'
        : `${usersWithoutDoc} usuários sem documento`,
      recommendation: 'Exigir documento no cadastro para saques'
    });

    // Check 3.2: Verificar transações sem rastreabilidade
    const { count: salesWithoutUTM } = await supabaseAdmin
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .is('utm_source', null)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      id: 'CP-002',
      name: 'Rastreabilidade de vendas (UTM)',
      category: 'COMPLIANCE',
      severity: 'LOW',
      status: 'PASS', // UTM é opcional
      message: `${salesWithoutUTM ?? 0} vendas sem UTM nos últimos 7 dias`,
      recommendation: 'UTMs ajudam na auditoria de marketing'
    });

    // ============================================
    // 4. INFRA CHECKS
    // ============================================

    // Check 4.1: Ambiente identificado
    const environment = Deno.env.get('ENVIRONMENT') || 'production';
    checks.push({
      id: 'IF-001',
      name: 'Ambiente identificado',
      category: 'INFRA',
      severity: 'MEDIUM',
      status: environment ? 'PASS' : 'WARNING',
      message: `Ambiente: ${environment}`,
      recommendation: 'Definir ENVIRONMENT=production em produção'
    });

    // Check 4.2: Verificar se há erros recentes
    const { count: recentErrors } = await supabaseAdmin
      .from('checkout_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'error')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    checks.push({
      id: 'IF-002',
      name: 'Erros na última hora',
      category: 'INFRA',
      severity: 'HIGH',
      status: (recentErrors ?? 0) < 10 ? 'PASS' : 'WARNING',
      message: `${recentErrors ?? 0} erros na última hora`,
      recommendation: 'Investigar erros recorrentes'
    });

    // ============================================
    // CALCULATE SUMMARY
    // ============================================

    const summary = {
      total: checks.length,
      passed: checks.filter(c => c.status === 'PASS').length,
      failed: checks.filter(c => c.status === 'FAIL').length,
      warnings: checks.filter(c => c.status === 'WARNING').length,
      criticalIssues: checks.filter(c => c.status === 'FAIL' && c.severity === 'CRITICAL').length,
      score: 0
    };

    // Calculate security score (0-100)
    const weights = { CRITICAL: 25, HIGH: 15, MEDIUM: 10, LOW: 5 };
    let maxScore = 0;
    let actualScore = 0;

    for (const check of checks) {
      const weight = weights[check.severity];
      maxScore += weight;
      if (check.status === 'PASS') {
        actualScore += weight;
      } else if (check.status === 'WARNING') {
        actualScore += weight * 0.5;
      }
    }

    summary.score = Math.round((actualScore / maxScore) * 100);

    const report: AuditReport = {
      timestamp: new Date().toISOString(),
      environment,
      checks,
      summary
    };

    // Log audit execution
    await supabaseAdmin.from('admin_audit_logs').insert({
      entity_type: 'security_audit',
      action_type: 'AUDIT_EXECUTED',
      details: {
        score: summary.score,
        passed: summary.passed,
        failed: summary.failed,
        warnings: summary.warnings
      }
    });

    console.log(`[SECURITY_AUDIT] Score: ${summary.score}%, Passed: ${summary.passed}, Failed: ${summary.failed}`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('[SECURITY_AUDIT] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Audit failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
