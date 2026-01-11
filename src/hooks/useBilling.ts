import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  BillingSummary, 
  GatewayAcquirer,
  Adquirente,
  Gateway,
  calculateBillingSummary,
  getPrimaryAcquirer,
  getPrimaryAdquirente,
  getAdquirentesByGateway,
  getAllGateways,
  changePrimaryAdquirente as changePrimaryAdquirenteService
} from '@/lib/billingService';
import { startOfMonth, endOfMonth } from 'date-fns';

// Gateway padrão (Royal Gateway)
const DEFAULT_GATEWAY_ID = '11111111-1111-1111-1111-111111111111';

export interface UseBillingReturn {
  summary: BillingSummary | null;
  primaryAcquirer: GatewayAcquirer | null;
  primaryAdquirente: Adquirente | null;
  acquirers: GatewayAcquirer[];
  adquirentes: Adquirente[];
  gateways: Gateway[];
  isLoading: boolean;
  error: Error | null;
  periodStart: Date;
  periodEnd: Date;
  setPeriod: (start: Date, end: Date) => void;
  refreshBilling: () => Promise<void>;
  changePrimaryAcquirer: (acquirerId: string, displayName: string) => Promise<void>;
  changePrimaryAdquirente: (novaAdquirenteId: string, userId: string, motivo?: string) => Promise<boolean>;
}

export function useBilling(tenantId?: string): UseBillingReturn {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [primaryAcquirer, setPrimaryAcquirer] = useState<GatewayAcquirer | null>(null);
  const [primaryAdquirente, setPrimaryAdquirente] = useState<Adquirente | null>(null);
  const [acquirers, setAcquirers] = useState<GatewayAcquirer[]>([]);
  const [adquirentes, setAdquirentes] = useState<Adquirente[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [periodStart, setPeriodStart] = useState<Date>(startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState<Date>(endOfMonth(new Date()));

  const loadBilling = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load from new tables (gateways + adquirentes) and legacy (gateway_acquirers)
      const [
        allGateways,
        allAdquirentes,
        primary,
        primaryAdq
      ] = await Promise.all([
        getAllGateways(),
        getAdquirentesByGateway(DEFAULT_GATEWAY_ID),
        getPrimaryAcquirer(tenantId),
        getPrimaryAdquirente(DEFAULT_GATEWAY_ID)
      ]);
      
      setGateways(allGateways);
      setAdquirentes(allAdquirentes);
      setPrimaryAcquirer(primary);
      setPrimaryAdquirente(primaryAdq);
      
      // Convert adquirentes to legacy format for acquirers state
      const legacyAcquirers: GatewayAcquirer[] = allAdquirentes.map(a => ({
        id: a.id,
        tenantId: tenantId || null,
        name: a.nomeExibicao.toLowerCase().replace(/\s/g, '_'),
        displayName: a.nomeExibicao,
        isActive: a.ativo,
        isPrimary: a.principal,
        metadata: {},
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }));
      setAcquirers(legacyAcquirers);
      
      // Calculate billing summary
      const billingSummary = await calculateBillingSummary(
        tenantId || null,
        periodStart,
        periodEnd
      );
      
      setSummary(billingSummary);
    } catch (err) {
      console.error('Error loading billing:', err);
      setError(err instanceof Error ? err : new Error('Failed to load billing'));
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, periodStart, periodEnd]);

  // Initial load
  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Real-time subscription para sincronização completa (incluindo novas tabelas)
  useEffect(() => {
    const channel = supabase
      .channel('billing-changes')
      // New tables
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gateways' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adquirentes' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'adquirente_logs' },
        () => loadBilling()
      )
      // Legacy/existing tables
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_summary' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_acquirers' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transacoes' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chargebacks' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'withdrawals' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'antecipacoes' },
        () => loadBilling()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_fees' },
        () => loadBilling()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBilling]);

  const setPeriod = useCallback((start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  // Legacy function (deprecated - use changePrimaryAdquirente)
  const changePrimaryAcquirer = useCallback(async (acquirerId: string, displayName: string) => {
    // Try to use new function if possible
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await changePrimaryAdquirenteService(
        DEFAULT_GATEWAY_ID, 
        acquirerId, 
        user.id, 
        `Alterado para ${displayName}`
      );
    }
    await loadBilling();
  }, [loadBilling]);

  // New function with audit log
  const changePrimaryAdquirente = useCallback(async (
    novaAdquirenteId: string, 
    userId: string, 
    motivo: string = 'Troca de adquirente principal'
  ): Promise<boolean> => {
    const success = await changePrimaryAdquirenteService(
      DEFAULT_GATEWAY_ID,
      novaAdquirenteId,
      userId,
      motivo
    );
    if (success) {
      await loadBilling();
    }
    return success;
  }, [loadBilling]);

  return {
    summary,
    primaryAcquirer,
    primaryAdquirente,
    acquirers,
    adquirentes,
    gateways,
    isLoading,
    error,
    periodStart,
    periodEnd,
    setPeriod,
    refreshBilling: loadBilling,
    changePrimaryAcquirer,
    changePrimaryAdquirente
  };
}
