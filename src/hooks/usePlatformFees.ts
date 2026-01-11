/**
 * Hook para gerenciamento de taxas da plataforma
 * Sincronização em tempo real com Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  PlatformFee, 
  FeeType,
  FeeValueType,
  getAllFees, 
  updateFee, 
  createTenantFee,
  deleteTenantFee,
  getFeeChangeLogs,
  calculateFee,
  simulateAllFees,
  invalidateFeeCache,
  FEE_TYPE_LABELS,
  FEE_VALUE_TYPE_LABELS,
  FEE_CATEGORIES,
} from '@/lib/feeService';

interface UsePlatformFeesOptions {
  tenantId?: string | null;
  isAdmin?: boolean;
}

interface FeeChangeLog {
  id: string;
  fee_id: string | null;
  tenant_id: string | null;
  fee_type: FeeType;
  previous_value: number | null;
  new_value: number;
  previous_value_type: FeeValueType | null;
  new_value_type: FeeValueType;
  action: string;
  changed_by: string | null;
  created_at: string;
}

export function usePlatformFees(options: UsePlatformFeesOptions = {}) {
  const { tenantId, isAdmin = false } = options;
  
  const [globalFees, setGlobalFees] = useState<PlatformFee[]>([]);
  const [tenantFees, setTenantFees] = useState<PlatformFee[]>([]);
  const [changeLogs, setChangeLogs] = useState<FeeChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Buscar taxas
  const fetchFees = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { global, tenant } = await getAllFees(tenantId);
      setGlobalFees(global);
      setTenantFees(tenant);
    } catch (err) {
      console.error('Erro ao buscar taxas:', err);
      setError('Erro ao carregar taxas');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);
  
  // Buscar logs de alterações
  const fetchLogs = useCallback(async () => {
    const logs = await getFeeChangeLogs({ 
      tenantId: isAdmin ? undefined : tenantId || undefined,
      limit: 100 
    });
    setChangeLogs(logs as FeeChangeLog[]);
  }, [tenantId, isAdmin]);
  
  // Atualizar taxa
  const handleUpdateFee = useCallback(async (
    feeId: string,
    updates: Partial<Pick<PlatformFee, 'value' | 'value_type' | 'min_value' | 'max_value' | 'is_active' | 'description'>>
  ) => {
    const result = await updateFee(feeId, updates);
    if (result.success) {
      await fetchFees();
      await fetchLogs();
    }
    return result;
  }, [fetchFees, fetchLogs]);
  
  // Criar taxa do tenant
  const handleCreateTenantFee = useCallback(async (
    feeType: FeeType,
    value: number,
    valueType: FeeValueType,
    feeOptions?: { minValue?: number; maxValue?: number; description?: string }
  ) => {
    if (!tenantId) {
      return { success: false, error: 'Tenant ID não definido' };
    }
    
    const result = await createTenantFee(tenantId, feeType, value, valueType, feeOptions);
    if (result.success) {
      await fetchFees();
      await fetchLogs();
    }
    return result;
  }, [tenantId, fetchFees, fetchLogs]);
  
  // Remover taxa personalizada
  const handleDeleteTenantFee = useCallback(async (feeId: string) => {
    if (!tenantId) {
      return { success: false, error: 'Tenant ID não definido' };
    }
    
    const result = await deleteTenantFee(feeId, tenantId);
    if (result.success) {
      await fetchFees();
      await fetchLogs();
    }
    return result;
  }, [tenantId, fetchFees, fetchLogs]);
  
  // Simular taxas
  const handleSimulateFees = useCallback(async (amount: number) => {
    return simulateAllFees(amount, tenantId);
  }, [tenantId]);
  
  // Calcular taxa específica
  const handleCalculateFee = useCallback(async (amount: number, feeType: FeeType) => {
    return calculateFee({ amount, feeType, tenantId });
  }, [tenantId]);
  
  // Obter taxa efetiva (tenant ou global)
  const getEffectiveFee = useCallback((feeType: FeeType): PlatformFee | null => {
    const tenantFee = tenantFees.find(f => f.fee_type === feeType && f.is_active);
    if (tenantFee) return tenantFee;
    
    const globalFee = globalFees.find(f => f.fee_type === feeType && f.is_active);
    return globalFee || null;
  }, [globalFees, tenantFees]);
  
  // Setup inicial e realtime
  useEffect(() => {
    fetchFees();
    fetchLogs();
    
    // Subscrever para mudanças em tempo real
    const channel = supabase
      .channel('platform_fees_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_fees' },
        () => {
          invalidateFeeCache(tenantId);
          fetchFees();
          fetchLogs();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchFees, fetchLogs]);
  
  return {
    // Estado
    globalFees,
    tenantFees,
    changeLogs,
    loading,
    error,
    
    // Ações
    updateFee: handleUpdateFee,
    createTenantFee: handleCreateTenantFee,
    deleteTenantFee: handleDeleteTenantFee,
    simulateFees: handleSimulateFees,
    calculateFee: handleCalculateFee,
    getEffectiveFee,
    refetch: fetchFees,
    
    // Helpers
    FEE_TYPE_LABELS,
    FEE_VALUE_TYPE_LABELS,
    FEE_CATEGORIES,
  };
}

export default usePlatformFees;
