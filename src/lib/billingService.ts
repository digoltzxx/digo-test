import { supabase } from "@/integrations/supabase/client";
import Decimal from "decimal.js";

// Configure Decimal.js for financial precision (15,2)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================
// INTERFACES DE DADOS
// ============================================

export interface BillingSummary {
  id: string;
  billingPeriodId: string;
  tenantId: string | null;
  
  // Adquirência
  grossRevenue: number;           // Faturamento = SOMA(transacoes.valor)
  preChargeback: number;          // Pré-Chargeback = SOMA(chargebacks.amount)
  acquirerFees: number;           // Taxas Adquirentes = SOMA(sales.payment_fee)
  acquirerSubtotal: number;       // Subtotal = Faturamento - Pré-Chargeback - Taxas Adquirentes
  
  // Taxa da Plataforma (4.99% + R$ 1.49 por transação)
  platformFees: number;           // Taxas da Plataforma = SOMA(sales.platform_fee)
  platformFeePercentage: number;  // Percentual da taxa (4.99%)
  platformFeeFixed: number;       // Valor fixo por transação (R$ 1.49)
  platformSubtotal: number;       // Subtotal = -Taxas da Plataforma
  
  // Banking
  withdrawalFees: number;         // Taxas de Saque Flat = SOMA(withdrawals.fee)
  anticipationFees: number;       // Taxas de Antecipações = SOMA(antecipacoes.valor_taxa)
  baasFees: number;               // Taxas de BaaS (do platform_fees)
  bankingSubtotal: number;        // Subtotal = -(Saque + Antecipação + BaaS)
  
  // Extensões
  antifraudFees: number;          // Taxas de Antifraude (do platform_fees ou antifraud_analysis)
  preChargebackFees: number;      // Taxas de Pré-Chargeback (do platform_fees)
  kycFees: number;                // Taxas de KYC (do platform_fees)
  extensionsSubtotal: number;     // Subtotal = -(Antifraude + Pré-Chargeback + KYC)
  
  // Gateway Provider (dynamic name from gateway_acquirers)
  gatewayProviderName: string;    // Nome da adquirente principal
  gatewayProviderFees: number;    // Taxas do gateway principal
  gatewayProviderSubtotal: number;// Subtotal = -Taxas
  
  // Total
  totalProfit: number;            // Lucro Total = Soma de todos os subtotais
  profitStatus: 'positive' | 'negative';
  
  calculatedAt: string;
}

// Interface para novo modelo de adquirentes
export interface Adquirente {
  id: string;
  gatewayId: string;
  nomeExibicao: string;
  ativo: boolean;
  principal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Gateway {
  id: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
}

// Legacy interface (manter compatibilidade)
export interface GatewayAcquirer {
  id: string;
  tenantId: string | null;
  name: string;
  displayName: string;
  isActive: boolean;
  isPrimary: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPeriod {
  id: string;
  tenantId: string | null;
  periodStart: string;
  periodEnd: string;
  status: 'open' | 'closed' | 'paid';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// FUNÇÕES DE PRECISÃO FINANCEIRA
// ============================================

/**
 * Converte valor para Decimal com segurança
 */
function toDecimal(value: number | string | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/**
 * Converte Decimal para número com 2 casas decimais
 */
function toNumber(decimal: Decimal): number {
  return decimal.toDecimalPlaces(2).toNumber();
}

/**
 * Soma valores de um array com precisão
 */
function sumValues(values: (number | null | undefined)[]): Decimal {
  return values.reduce((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));
}

// ============================================
// BUSCA DE ADQUIRENTE PRINCIPAL (COM FALLBACK)
// ============================================

// Gateway padrão (Royal Gateway)
const DEFAULT_GATEWAY_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Busca a adquirente principal usando a função RPC com fallback automático
 * Query: principal -> fallback (primeira ativa) -> erro controlado
 */
export async function getPrimaryAdquirente(gatewayId: string = DEFAULT_GATEWAY_ID): Promise<Adquirente | null> {
  // Usar função RPC que implementa fallback automático
  const { data, error } = await supabase.rpc('resolve_primary_acquirer', {
    p_gateway_id: gatewayId
  });
  
  if (error || !data || data.length === 0) {
    console.warn('[Billing] Nenhuma adquirente encontrada para gateway:', gatewayId);
    return null;
  }
  
  const result = data[0];
  return {
    id: result.id,
    gatewayId,
    nomeExibicao: result.nome_exibicao,
    ativo: true,
    principal: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Busca todas as adquirentes de um gateway
 */
export async function getAdquirentesByGateway(gatewayId: string = DEFAULT_GATEWAY_ID): Promise<Adquirente[]> {
  const { data, error } = await supabase
    .from('adquirentes')
    .select('*')
    .eq('gateway_id', gatewayId)
    .eq('ativo', true)
    .order('principal', { ascending: false });
  
  if (error || !data) return [];
  
  return data.map(a => ({
    id: a.id,
    gatewayId: a.gateway_id,
    nomeExibicao: a.nome_exibicao,
    ativo: a.ativo,
    principal: a.principal,
    createdAt: a.created_at,
    updatedAt: a.updated_at
  }));
}

/**
 * Troca a adquirente principal com log de auditoria
 */
export async function changePrimaryAdquirente(
  gatewayId: string,
  novaAdquirenteId: string,
  userId: string,
  motivo: string = 'Troca de adquirente principal'
): Promise<boolean> {
  const { data, error } = await supabase.rpc('change_primary_acquirer', {
    p_gateway_id: gatewayId,
    p_nova_adquirente_id: novaAdquirenteId,
    p_user_id: userId,
    p_motivo: motivo
  });
  
  if (error) {
    console.error('[Billing] Erro ao trocar adquirente:', error);
    return false;
  }
  
  return data === true;
}

/**
 * Busca todos os gateways ativos
 */
export async function getAllGateways(): Promise<Gateway[]> {
  const { data, error } = await supabase
    .from('gateways')
    .select('*')
    .eq('ativo', true)
    .order('nome');
  
  if (error || !data) return [];
  
  return data.map(g => ({
    id: g.id,
    nome: g.nome,
    ativo: g.ativo,
    createdAt: g.created_at
  }));
}

/**
 * Busca adquirente principal de todos os gateways
 */
export async function getAllPrimaryAcquirers(): Promise<Array<{ gateway: Gateway; adquirente: Adquirente | null }>> {
  const gateways = await getAllGateways();
  
  const results = await Promise.all(
    gateways.map(async (gateway) => ({
      gateway,
      adquirente: await getPrimaryAdquirente(gateway.id)
    }))
  );
  
  return results;
}

// Legacy function (manter compatibilidade com código existente)
export async function getPrimaryAcquirer(tenantId?: string): Promise<GatewayAcquirer | null> {
  const adquirente = await getPrimaryAdquirente();
  
  if (!adquirente) return null;
  
  return {
    id: adquirente.id,
    tenantId: tenantId || null,
    name: adquirente.nomeExibicao.toLowerCase().replace(/\s/g, '_'),
    displayName: adquirente.nomeExibicao,
    isActive: adquirente.ativo,
    isPrimary: adquirente.principal,
    metadata: {},
    createdAt: adquirente.createdAt,
    updatedAt: adquirente.updatedAt
  };
}

function mapAcquirer(data: any): GatewayAcquirer {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    displayName: data.display_name,
    isActive: data.is_active,
    isPrimary: data.is_primary,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// ============================================
// CÁLCULO DO FATURAMENTO (100% DO BANCO)
// ============================================

/**
 * Calcula o faturamento completo com dados 100% do banco de dados
 * Seguindo as regras de cálculo especificadas
 */
export async function calculateBillingSummary(
  tenantId: string | null,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingSummary> {
  const startDate = periodStart.toISOString();
  const endDate = periodEnd.toISOString();
  
  // ============================================
  // BUSCA PARALELA DE TODOS OS DADOS
  // ============================================
  
  const [
    salesResult,
    transacoesResult,
    chargebacksResult,
    withdrawalsResult,
    anticipationsResult,
    antifraudResult,
    platformFeesResult,
    acquirerResult
  ] = await Promise.all([
    // Vendas aprovadas (para taxas de adquirente)
    supabase
      .from('sales')
      .select('amount, payment_fee, platform_fee, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('status', ['approved', 'completed', 'paid']),
    
    // Transações (faturamento bruto)
    supabase
      .from('transacoes')
      .select('valor, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .eq('status', 'aprovada'),
    
    // Chargebacks
    supabase
      .from('chargebacks')
      .select('amount, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate),
    
    // Saques (taxas de saque)
    supabase
      .from('withdrawals')
      .select('amount, fee, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('status', ['completed', 'processing', 'approved']),
    
    // Antecipações
    supabase
      .from('antecipacoes')
      .select('valor_bruto, valor_taxa, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('status', ['completed', 'approved']),
    
    // Análises de antifraude
    supabase
      .from('antifraud_analysis')
      .select('id')
      .gte('created_at', startDate)
      .lte('created_at', endDate),
    
    // Taxas da plataforma (para extensões e BaaS)
    supabase
      .from('platform_fees')
      .select('fee_type, value, value_type, min_value, is_active')
      .eq('is_active', true),
    
    // Adquirente principal
    getPrimaryAcquirer(tenantId || undefined)
  ]);

  const sales = salesResult.data || [];
  const transacoes = transacoesResult.data || [];
  const chargebacks = chargebacksResult.data || [];
  const withdrawals = withdrawalsResult.data || [];
  const anticipations = anticipationsResult.data || [];
  const antifraudAnalyses = antifraudResult.data || [];
  const platformFees = platformFeesResult.data || [];
  const primaryAcquirer = acquirerResult;

  // ============================================
  // PASSO 1: FATURAMENTO BRUTO
  // ============================================
  
  // Faturamento = SOMA(transacoes.valor) ou SOMA(sales.amount)
  let grossRevenue: Decimal;
  if (transacoes.length > 0) {
    grossRevenue = sumValues(transacoes.map(t => t.valor));
  } else {
    grossRevenue = sumValues(sales.map(s => s.amount));
  }
  
  // Pré-Chargeback = SOMA(chargebacks.amount)
  const preChargeback = sumValues(chargebacks.map(c => c.amount));
  
  // Faturamento após pré-chargeback
  const revenueAfterChargeback = grossRevenue.minus(preChargeback);

  // ============================================
  // REGRA OBRIGATÓRIA DE CÁLCULO FINANCEIRO:
  // 1. Começa com valor base inicial
  // 2. Calcula taxa percentual: valor_base × (percentual / 100)
  // 3. Subtrai taxa percentual do valor base = valor intermediário
  // 4. Subtrai taxas fixas uma a uma, na ordem
  // 5. Nunca agrupa taxas - cada uma é aplicada individualmente
  // ============================================

  // ============================================
  // PASSO 2: TAXA DA PLATAFORMA (descontada PRIMEIRO)
  // ============================================
  
  const platformFeeConfig = platformFees.find(f => f.fee_type === 'transaction' || f.fee_type === 'pix');
  const platformFeePercentage = platformFeeConfig?.value || 4.99;
  const platformFeeFixed = platformFeeConfig?.min_value || 1.49;
  const numTransactions = sales.length > 0 ? sales.length : (transacoes.length > 0 ? transacoes.length : 1);
  
  // Usar valores reais do banco se disponíveis (platform_fee de cada venda)
  let platformFeesTotal: Decimal;
  const salesPlatformFees = sumValues(sales.map(s => s.platform_fee));
  
  if (salesPlatformFees.gt(0)) {
    // Usa os valores já calculados e salvos no banco
    platformFeesTotal = salesPlatformFees;
  } else {
    // Cálculo manual seguindo a REGRA OBRIGATÓRIA:
    // 1. Calcular taxa percentual: valor_base × (percentual / 100)
    const taxaPercentual = revenueAfterChargeback.times(toDecimal(platformFeePercentage).div(100));
    
    // 2. Calcular taxa fixa total: fixo × número de transações
    const taxaFixaTotal = toDecimal(platformFeeFixed).times(numTransactions);
    
    // 3. Total de taxas da plataforma = taxa percentual + taxa fixa
    platformFeesTotal = taxaPercentual.plus(taxaFixaTotal);
  }
  
  // Subtotal Plataforma = -Taxas (valor negativo pois é dedução)
  const platformSubtotal = platformFeesTotal.neg();
  
  // APLICAR DEDUÇÃO SEQUENCIAL:
  // Valor após taxa da plataforma = revenueAfterChargeback - platformFeesTotal
  const revenueAfterPlatformFee = revenueAfterChargeback.minus(platformFeesTotal);

  // ============================================
  // PASSO 3: TAXA DAS ADQUIRENTES (descontada DEPOIS da plataforma)
  // ============================================
  
  // Taxas Adquirentes = SOMA(sales.payment_fee) do banco
  const acquirerFees = sumValues(sales.map(s => s.payment_fee));
  
  // APLICAR DEDUÇÃO SEQUENCIAL:
  // Subtotal Adquirência = Valor após plataforma - Taxas Adquirentes
  const acquirerSubtotal = revenueAfterPlatformFee.minus(acquirerFees);

  // ============================================
  // ABA: BANKING
  // ============================================
  
  // Taxas de Saque Flat = SOMA(withdrawals.fee)
  const withdrawalFees = sumValues(withdrawals.map(w => w.fee));
  
  // Taxas de Antecipações = SOMA(antecipacoes.valor_taxa)
  const anticipationFees = sumValues(anticipations.map(a => a.valor_taxa));
  
  // Taxas de BaaS (buscar do platform_fees ou calcular)
  const baasFeeConfig = platformFees.find(f => f.fee_type === 'subscription');
  let baasFees: Decimal;
  if (baasFeeConfig) {
    if (baasFeeConfig.value_type === 'percentage') {
      baasFees = grossRevenue.times(toDecimal(baasFeeConfig.value).div(100));
    } else {
      baasFees = toDecimal(baasFeeConfig.value);
    }
  } else {
    baasFees = new Decimal(0);
  }
  
  // Subtotal Banking = -(Taxas de Saque + Taxas de Antecipações + Taxas de BaaS)
  const bankingSubtotal = withdrawalFees.plus(anticipationFees).plus(baasFees).neg();

  // ============================================
  // ABA: EXTENSÕES
  // ============================================
  
  // Taxas de Antifraude (baseado em análises realizadas ou config)
  const antifraudFeeConfig = platformFees.find(f => f.fee_type === 'chargeback');
  let antifraudFees: Decimal;
  if (antifraudFeeConfig && antifraudAnalyses.length > 0) {
    if (antifraudFeeConfig.value_type === 'percentage') {
      antifraudFees = grossRevenue.times(toDecimal(antifraudFeeConfig.value).div(100));
    } else {
      antifraudFees = toDecimal(antifraudFeeConfig.value).times(antifraudAnalyses.length);
    }
  } else {
    antifraudFees = new Decimal(0);
  }
  
  // Taxas de Pré-Chargeback (baseado em chargebacks processados)
  const preChargebackFeeConfig = platformFees.find(f => f.fee_type === 'refund');
  let preChargebackFees: Decimal;
  if (preChargebackFeeConfig && chargebacks.length > 0) {
    if (preChargebackFeeConfig.value_type === 'percentage') {
      preChargebackFees = preChargeback.times(toDecimal(preChargebackFeeConfig.value).div(100));
    } else {
      preChargebackFees = toDecimal(preChargebackFeeConfig.value).times(chargebacks.length);
    }
  } else {
    preChargebackFees = new Decimal(0);
  }
  
  // Taxas de KYC (baseado em transações ou configuração)
  const kycFeeConfig = platformFees.find(f => f.fee_type === 'transaction');
  let kycFees: Decimal;
  if (kycFeeConfig) {
    // KYC geralmente é por transação única (não todas)
    kycFees = new Decimal(0); // Sem dados de KYC específicos, retornar 0
  } else {
    kycFees = new Decimal(0);
  }
  
  // Subtotal Extensões = -(Antifraude + Pré-Chargeback + KYC)
  const extensionsSubtotal = antifraudFees.plus(preChargebackFees).plus(kycFees).neg();
  // ============================================
  // ABA: COBRANÇAS DA ADQUIRENTE PRINCIPAL
  // ============================================
  
  const gatewayProviderName = primaryAcquirer?.displayName || 'ShieldTech';
  
  // Taxas do Gateway Principal (acquirer fee)
  const acquirerFeeConfig = platformFees.find(f => f.fee_type === 'acquirer');
  let gatewayProviderFees: Decimal;
  if (acquirerFeeConfig) {
    if (acquirerFeeConfig.value_type === 'percentage') {
      gatewayProviderFees = grossRevenue.times(toDecimal(acquirerFeeConfig.value).div(100));
    } else {
      gatewayProviderFees = toDecimal(acquirerFeeConfig.value).times(sales.length);
    }
  } else {
    gatewayProviderFees = new Decimal(0);
  }
  
  // Subtotal Gateway = -Taxas
  const gatewayProviderSubtotal = gatewayProviderFees.neg();

  // ============================================
  // LUCRO TOTAL (REGRA FINAL SEQUENCIAL)
  // ============================================
  
  // REGRA OBRIGATÓRIA DE CÁLCULO:
  // O acquirerSubtotal já contém: Faturamento - Chargeback - Platform Fee - Acquirer Fee
  // Aplicar deduções sequenciais: Banking, Extensões, Gateway Provider
  const totalProfit = acquirerSubtotal
    .plus(bankingSubtotal)         // Subtrai taxas de Banking (valor já negativo)
    .plus(extensionsSubtotal);     // Subtrai taxas de Extensões (valor já negativo)
  // Nota: gatewayProviderFees já está incluído em acquirerFees, não duplicar
  
  const profitStatus = totalProfit.gte(0) ? 'positive' : 'negative';

  // ============================================
  // RETORNO DO OBJETO ESTRUTURADO
  // ============================================
  
  return {
    id: crypto.randomUUID(),
    billingPeriodId: '',
    tenantId,
    
    // Adquirência
    grossRevenue: toNumber(grossRevenue),
    preChargeback: toNumber(preChargeback),
    acquirerFees: toNumber(acquirerFees),
    acquirerSubtotal: toNumber(acquirerSubtotal),
    
    // Taxa da Plataforma
    platformFees: toNumber(platformFeesTotal),
    platformFeePercentage,
    platformFeeFixed,
    platformSubtotal: toNumber(platformSubtotal),
    
    // Banking
    withdrawalFees: toNumber(withdrawalFees),
    anticipationFees: toNumber(anticipationFees),
    baasFees: toNumber(baasFees),
    bankingSubtotal: toNumber(bankingSubtotal),
    
    // Extensões
    antifraudFees: toNumber(antifraudFees),
    preChargebackFees: toNumber(preChargebackFees),
    kycFees: toNumber(kycFees),
    extensionsSubtotal: toNumber(extensionsSubtotal),
    
    // Gateway Provider
    gatewayProviderName,
    gatewayProviderFees: toNumber(gatewayProviderFees),
    gatewayProviderSubtotal: toNumber(gatewayProviderSubtotal),
    
    // Total
    totalProfit: toNumber(totalProfit),
    profitStatus,
    
    calculatedAt: new Date().toISOString()
  };
}

// ============================================
// PERSISTÊNCIA NO BANCO DE DADOS
// ============================================

/**
 * Salva o resumo de faturamento no banco de dados
 */
export async function saveBillingSummary(
  summary: BillingSummary,
  billingPeriodId: string
): Promise<void> {
  await supabase.from('billing_summary').upsert({
    id: summary.id,
    billing_period_id: billingPeriodId,
    tenant_id: summary.tenantId,
    gross_revenue: summary.grossRevenue,
    pre_chargeback: summary.preChargeback,
    acquirer_fees: summary.acquirerFees,
    acquirer_subtotal: summary.acquirerSubtotal,
    withdrawal_fees: summary.withdrawalFees,
    anticipation_fees: summary.anticipationFees,
    baas_fees: summary.baasFees,
    banking_subtotal: summary.bankingSubtotal,
    antifraud_fees: summary.antifraudFees,
    pre_chargeback_fees: summary.preChargebackFees,
    kyc_fees: summary.kycFees,
    extensions_subtotal: summary.extensionsSubtotal,
    gateway_provider_name: summary.gatewayProviderName,
    gateway_provider_fees: summary.gatewayProviderFees,
    gateway_provider_subtotal: summary.gatewayProviderSubtotal,
    total_profit: summary.totalProfit,
    calculated_at: summary.calculatedAt
  });
}

/**
 * Busca ou cria um período de faturamento
 */
export async function getOrCreateBillingPeriod(
  tenantId: string | null,
  periodStart: Date,
  periodEnd: Date
): Promise<BillingPeriod> {
  const startStr = periodStart.toISOString().split('T')[0];
  const endStr = periodEnd.toISOString().split('T')[0];
  
  const query = tenantId 
    ? supabase.from('billing_periods').select('*').eq('tenant_id', tenantId).eq('period_start', startStr).eq('period_end', endStr)
    : supabase.from('billing_periods').select('*').is('tenant_id', null).eq('period_start', startStr).eq('period_end', endStr);
  
  const { data: existing } = await query.single();
  
  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenant_id,
      periodStart: existing.period_start,
      periodEnd: existing.period_end,
      status: existing.status as 'open' | 'closed' | 'paid',
      createdAt: existing.created_at,
      updatedAt: existing.updated_at
    };
  }
  
  const { data: created, error } = await supabase
    .from('billing_periods')
    .insert({
      tenant_id: tenantId,
      period_start: startStr,
      period_end: endStr,
      status: 'open'
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: created.id,
    tenantId: created.tenant_id,
    periodStart: created.period_start,
    periodEnd: created.period_end,
    status: created.status as 'open' | 'closed' | 'paid',
    createdAt: created.created_at,
    updatedAt: created.updated_at
  };
}

// ============================================
// GESTÃO DE ADQUIRENTES
// ============================================

/**
 * Atualiza a adquirente principal
 */
export async function updatePrimaryAcquirer(
  acquirerId: string,
  displayName: string,
  tenantId?: string
): Promise<void> {
  // Remove flag de principal de todas as adquirentes do tenant
  if (tenantId) {
    await supabase
      .from('gateway_acquirers')
      .update({ is_primary: false })
      .eq('tenant_id', tenantId);
  } else {
    await supabase
      .from('gateway_acquirers')
      .update({ is_primary: false })
      .is('tenant_id', null);
  }
  
  // Define a nova adquirente como principal
  await supabase
    .from('gateway_acquirers')
    .update({ 
      is_primary: true,
      display_name: displayName 
    })
    .eq('id', acquirerId);
}

/**
 * Busca todas as adquirentes disponíveis
 */
export async function getAllAcquirers(tenantId?: string): Promise<GatewayAcquirer[]> {
  let query = supabase
    .from('gateway_acquirers')
    .select('*')
    .order('is_primary', { ascending: false });
    
  if (tenantId) {
    const { data } = await query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    return (data || []).map(mapAcquirer);
  }
  
  const { data } = await query;
  return (data || []).map(mapAcquirer);
}

// ============================================
// FORMATAÇÃO
// ============================================

/**
 * Formata valor como moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}
