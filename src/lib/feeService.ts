/**
 * Serviço de Cálculo de Taxas - SaaS Financeiro
 * 
 * Este serviço é responsável por:
 * - Buscar taxas do banco de dados
 * - Aplicar a taxa correta (tenant → global)
 * - Calcular valores com precisão financeira
 */

import { supabase } from "@/integrations/supabase/client";

// Tipos - Todos os tipos de taxas descontadas dos usuários
export type FeeType = 
  | 'transaction'      // Taxa geral de transação
  | 'withdrawal'       // Taxa de saque
  | 'anticipation'     // Taxa de antecipação
  | 'pix'              // Taxa PIX
  | 'credit_card_2d'   // Cartão crédito 2 dias
  | 'credit_card_7d'   // Cartão crédito 7 dias
  | 'credit_card_15d'  // Cartão crédito 15 dias
  | 'credit_card_30d'  // Cartão crédito 30 dias
  | 'boleto'           // Taxa boleto
  | 'acquirer'         // Taxa adquirente
  | 'subscription'     // Taxa assinatura
  | 'chargeback'       // Taxa chargeback
  | 'refund';          // Taxa reembolso

export type FeeValueType = 'fixed' | 'percentage';

export interface PlatformFee {
  id: string;
  tenant_id: string | null;
  fee_type: FeeType;
  value: number;
  value_type: FeeValueType;
  min_value: number | null;
  max_value: number | null;
  is_active: boolean;
  description: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface FeeCalculationResult {
  grossAmount: number;       // Valor bruto
  feeAmount: number;         // Valor da taxa
  netAmount: number;         // Valor líquido final
  feePercentage: number;     // Percentual efetivo da taxa
  appliedFee: PlatformFee;   // Taxa aplicada
  isGlobalFee: boolean;      // Se usou taxa global ou do tenant
}

export interface FeeSimulationInput {
  amount: number;
  feeType: FeeType;
  tenantId?: string | null;
}

// Cache local para taxas (invalida a cada 30 segundos)
let feeCache: Map<string, { fees: PlatformFee[]; timestamp: number }> = new Map();
const CACHE_TTL = 30000; // 30 segundos

/**
 * Busca taxas do banco de dados com cache
 */
export async function fetchFees(tenantId?: string | null): Promise<PlatformFee[]> {
  const cacheKey = tenantId || 'global';
  const cached = feeCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.fees;
  }
  
  try {
    // Buscar taxas globais E do tenant se especificado
    let query = supabase
      .from('platform_fees')
      .select('*')
      .eq('is_active', true);
    
    if (tenantId) {
      query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
    } else {
      query = query.is('tenant_id', null);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar taxas:', error);
      throw error;
    }
    
    const fees = (data || []) as PlatformFee[];
    feeCache.set(cacheKey, { fees, timestamp: Date.now() });
    
    return fees;
  } catch (error) {
    console.error('Erro no feeService.fetchFees:', error);
    return [];
  }
}

/**
 * Invalida o cache de taxas
 */
export function invalidateFeeCache(tenantId?: string | null): void {
  if (tenantId) {
    feeCache.delete(tenantId);
  } else {
    feeCache.clear();
  }
}

/**
 * Obtém a taxa aplicável para um tipo específico
 * Prioridade: Taxa do Tenant → Taxa Global
 */
export async function getApplicableFee(
  feeType: FeeType,
  tenantId?: string | null
): Promise<PlatformFee | null> {
  const fees = await fetchFees(tenantId);
  
  // Primeiro busca taxa específica do tenant
  const tenantFee = fees.find(f => f.fee_type === feeType && f.tenant_id === tenantId);
  if (tenantFee) {
    return tenantFee;
  }
  
  // Fallback para taxa global
  const globalFee = fees.find(f => f.fee_type === feeType && f.tenant_id === null);
  return globalFee || null;
}

/**
 * Calcula o valor da taxa com precisão financeira
 * min_value = valor fixo adicional (para taxas como 4.99% + R$ 1.49)
 * max_value = valor máximo (cap) da taxa
 */
export function calculateFeeAmount(
  grossAmount: number,
  fee: PlatformFee
): number {
  let feeAmount: number;
  
  if (fee.value_type === 'fixed') {
    feeAmount = fee.value;
  } else {
    // Percentual + valor fixo adicional (min_value)
    feeAmount = (grossAmount * fee.value) / 100;
    
    // Adicionar valor fixo (min_value representa taxa fixa adicional, não valor mínimo)
    if (fee.min_value !== null && fee.min_value > 0) {
      feeAmount += fee.min_value;
    }
  }
  
  // Aplicar valor máximo (cap)
  if (fee.max_value !== null && feeAmount > fee.max_value) {
    feeAmount = fee.max_value;
  }
  
  // Arredondar para 2 casas decimais (precisão financeira)
  return Math.round(feeAmount * 100) / 100;
}

/**
 * Calcula taxa completa com todos os detalhes
 */
export async function calculateFee(
  input: FeeSimulationInput
): Promise<FeeCalculationResult | null> {
  const { amount, feeType, tenantId } = input;
  
  const fee = await getApplicableFee(feeType, tenantId);
  
  if (!fee) {
    console.warn(`Nenhuma taxa encontrada para tipo: ${feeType}`);
    return null;
  }
  
  const feeAmount = calculateFeeAmount(amount, fee);
  const netAmount = Math.round((amount - feeAmount) * 100) / 100;
  const feePercentage = amount > 0 ? (feeAmount / amount) * 100 : 0;
  
  return {
    grossAmount: amount,
    feeAmount,
    netAmount,
    feePercentage: Math.round(feePercentage * 100) / 100,
    appliedFee: fee,
    isGlobalFee: fee.tenant_id === null,
  };
}

/**
 * Simula múltiplas taxas de uma vez
 */
export async function simulateAllFees(
  amount: number,
  tenantId?: string | null
): Promise<Partial<Record<FeeType, FeeCalculationResult | null>>> {
  const feeTypes: FeeType[] = [
    'transaction', 'withdrawal', 'anticipation', 
    'pix', 'credit_card_2d', 'credit_card_7d', 'credit_card_15d', 'credit_card_30d',
    'boleto', 'acquirer', 'subscription', 'chargeback', 'refund'
  ];
  
  const results = await Promise.all(
    feeTypes.map(feeType => calculateFee({ amount, feeType, tenantId }))
  );
  
  const output: Partial<Record<FeeType, FeeCalculationResult | null>> = {};
  feeTypes.forEach((type, idx) => {
    if (results[idx]) {
      output[type] = results[idx];
    }
  });
  
  return output;
}

/**
 * Obtém todas as taxas de um tenant (ou globais)
 */
export async function getAllFees(tenantId?: string | null): Promise<{
  global: PlatformFee[];
  tenant: PlatformFee[];
}> {
  const { data, error } = await supabase
    .from('platform_fees')
    .select('*')
    .order('fee_type');
  
  if (error) {
    console.error('Erro ao buscar todas as taxas:', error);
    return { global: [], tenant: [] };
  }
  
  const fees = (data || []) as PlatformFee[];
  
  return {
    global: fees.filter(f => f.tenant_id === null),
    tenant: fees.filter(f => f.tenant_id === tenantId),
  };
}

/**
 * Atualiza uma taxa
 */
export async function updateFee(
  feeId: string,
  updates: Partial<Pick<PlatformFee, 'value' | 'value_type' | 'min_value' | 'max_value' | 'is_active' | 'description'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('platform_fees')
      .update(updates)
      .eq('id', feeId);
    
    if (error) {
      console.error('Erro ao atualizar taxa:', error);
      return { success: false, error: error.message };
    }
    
    // Invalidar cache
    invalidateFeeCache();
    
    return { success: true };
  } catch (error) {
    console.error('Erro no updateFee:', error);
    return { success: false, error: 'Erro ao atualizar taxa' };
  }
}

/**
 * Cria uma nova taxa para um tenant
 */
export async function createTenantFee(
  tenantId: string,
  feeType: FeeType,
  value: number,
  valueType: FeeValueType,
  options?: {
    minValue?: number;
    maxValue?: number;
    description?: string;
  }
): Promise<{ success: boolean; fee?: PlatformFee; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('platform_fees')
      .insert({
        tenant_id: tenantId,
        fee_type: feeType,
        value,
        value_type: valueType,
        min_value: options?.minValue,
        max_value: options?.maxValue,
        description: options?.description,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar taxa:', error);
      return { success: false, error: error.message };
    }
    
    invalidateFeeCache(tenantId);
    
    return { success: true, fee: data as PlatformFee };
  } catch (error) {
    console.error('Erro no createTenantFee:', error);
    return { success: false, error: 'Erro ao criar taxa' };
  }
}

/**
 * Remove uma taxa personalizada do tenant (volta a usar global)
 */
export async function deleteTenantFee(
  feeId: string,
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('platform_fees')
      .delete()
      .eq('id', feeId)
      .eq('tenant_id', tenantId);
    
    if (error) {
      console.error('Erro ao deletar taxa:', error);
      return { success: false, error: error.message };
    }
    
    invalidateFeeCache(tenantId);
    
    return { success: true };
  } catch (error) {
    console.error('Erro no deleteTenantFee:', error);
    return { success: false, error: 'Erro ao remover taxa' };
  }
}

/**
 * Busca histórico de alterações de taxas
 */
export async function getFeeChangeLogs(
  options?: {
    tenantId?: string;
    feeId?: string;
    limit?: number;
  }
): Promise<any[]> {
  try {
    let query = supabase
      .from('fee_change_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);
    
    if (options?.tenantId) {
      query = query.eq('tenant_id', options.tenantId);
    }
    
    if (options?.feeId) {
      query = query.eq('fee_id', options.feeId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar logs:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Erro no getFeeChangeLogs:', error);
    return [];
  }
}

// Labels para UI - Todos os tipos de taxas
export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  transaction: 'Taxa de Transação',
  withdrawal: 'Taxa de Saque',
  anticipation: 'Taxa de Antecipação',
  pix: 'Taxa PIX',
  credit_card_2d: 'Cartão 2 dias',
  credit_card_7d: 'Cartão 7 dias',
  credit_card_15d: 'Cartão 15 dias',
  credit_card_30d: 'Cartão 30 dias',
  boleto: 'Taxa Boleto',
  acquirer: 'Taxa Adquirente',
  subscription: 'Taxa Assinatura',
  chargeback: 'Taxa Chargeback',
  refund: 'Taxa Reembolso',
};

export const FEE_VALUE_TYPE_LABELS: Record<FeeValueType, string> = {
  fixed: 'Valor Fixo',
  percentage: 'Percentual',
};

// Categorias de taxas para organização na UI
export const FEE_CATEGORIES = {
  payment: {
    label: 'Taxas de Pagamento',
    description: 'Taxas cobradas por método de pagamento',
    types: ['pix', 'credit_card_2d', 'credit_card_7d', 'credit_card_15d', 'credit_card_30d', 'boleto'] as FeeType[],
  },
  platform: {
    label: 'Taxas da Plataforma',
    description: 'Taxas operacionais da plataforma',
    types: ['transaction', 'acquirer', 'subscription'] as FeeType[],
  },
  financial: {
    label: 'Taxas Financeiras',
    description: 'Taxas de operações financeiras',
    types: ['withdrawal', 'anticipation'] as FeeType[],
  },
  disputes: {
    label: 'Taxas de Disputa',
    description: 'Taxas relacionadas a contestações',
    types: ['chargeback', 'refund'] as FeeType[],
  },
};
