import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Interface de dados de saldo retornados pela API
 * 
 * REGRA: O frontend NUNCA calcula saldos.
 * Todos os valores vêm do endpoint GET /financeiro/saldo (edge function get-balance)
 */
export interface BalanceData {
  // Valores principais (da API)
  saldoTotal: number;
  saldoDisponivel: number;
  saldoEmRetencao: number;
  totalSacado: number;
  saquesPendentes: number;
  podeSacar: boolean;
  
  // Dados adicionais para UI
  cartaoALiberar: number;
  cartaoALiberarQtd: number;
  vendasPendentes: number;
  vendasPendentesQtd: number;
  totalTaxas: number;
  
  // Configurações
  valorMinimoSaque: number;
  taxaSaque: number;
  
  // Estado
  loading: boolean;
  error: string | null;
  
  // Legacy compatibility (mapeamento para código existente)
  availableBalance: number;
  totalLiquidoVendas: number;
  pendingAmount: number;
  pendingSalesCount: number;
  cardApprovedAmount: number;
  cardApprovedCount: number;
  retentionAmount: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
}

const initialState: BalanceData = {
  // Novos campos
  saldoTotal: 0,
  saldoDisponivel: 0,
  saldoEmRetencao: 0,
  totalSacado: 0,
  saquesPendentes: 0,
  podeSacar: false,
  cartaoALiberar: 0,
  cartaoALiberarQtd: 0,
  vendasPendentes: 0,
  vendasPendentesQtd: 0,
  totalTaxas: 0,
  valorMinimoSaque: 50,
  taxaSaque: 4.90,
  loading: true,
  error: null,
  // Legacy compatibility
  availableBalance: 0,
  totalLiquidoVendas: 0,
  pendingAmount: 0,
  pendingSalesCount: 0,
  cardApprovedAmount: 0,
  cardApprovedCount: 0,
  retentionAmount: 0,
  totalWithdrawn: 0,
  pendingWithdrawals: 0,
};

/**
 * Hook centralizado para saldo disponível
 * 
 * FONTE DA VERDADE: Backend (edge function get-balance)
 * 
 * Este hook consome exclusivamente o endpoint /financeiro/saldo
 * e não realiza nenhum cálculo financeiro no frontend.
 */
export const useAvailableBalance = () => {
  const [data, setData] = useState<BalanceData>(initialState);

  const fetchBalance = useCallback(async () => {
    try {
      // Check for valid session before making API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not authenticated - set default state without error (expected on login page)
        setData(prev => ({ ...prev, loading: false, error: null }));
        return;
      }

      setData(prev => ({ ...prev, loading: true, error: null }));

      // Chamar edge function para obter saldo
      const { data: response, error } = await supabase.functions.invoke('get-balance');

      if (error) {
        console.error('Error fetching balance:', error);
        setData(prev => ({ 
          ...prev, 
          loading: false, 
          error: error.message || 'Erro ao buscar saldo' 
        }));
        return;
      }

      if (response?.error) {
        console.error('Balance API error:', response.error);
        setData(prev => ({ 
          ...prev, 
          loading: false, 
          error: response.error 
        }));
        return;
      }

      // Mapear resposta da API para estado
      const newData: BalanceData = {
        // Novos campos
        saldoTotal: response.saldo_total || 0,
        saldoDisponivel: response.saldo_disponivel || 0,
        saldoEmRetencao: response.saldo_em_retencao || 0,
        totalSacado: response.total_sacado || 0,
        saquesPendentes: response.saques_pendentes || 0,
        podeSacar: response.pode_sacar || false,
        cartaoALiberar: response.cartao_a_liberar || 0,
        cartaoALiberarQtd: response.cartao_a_liberar_qtd || 0,
        vendasPendentes: response.vendas_pendentes || 0,
        vendasPendentesQtd: response.vendas_pendentes_qtd || 0,
        totalTaxas: response.total_taxas || 0,
        valorMinimoSaque: response.valor_minimo_saque || 50,
        taxaSaque: response.taxa_saque || 4.90,
        loading: false,
        error: null,
        
        // Legacy compatibility (mapeamento)
        availableBalance: response.saldo_disponivel || 0,
        totalLiquidoVendas: response.saldo_disponivel || 0,
        pendingAmount: response.vendas_pendentes || 0,
        pendingSalesCount: response.vendas_pendentes_qtd || 0,
        cardApprovedAmount: response.cartao_a_liberar || 0,
        cardApprovedCount: response.cartao_a_liberar_qtd || 0,
        retentionAmount: response.saldo_em_retencao || 0,
        totalWithdrawn: response.total_sacado || 0,
        pendingWithdrawals: response.saques_pendentes || 0,
      };

      // Log para debug
      console.log('=== SALDO RECEBIDO DO BACKEND ===');
      console.log('Saldo Total:', newData.saldoTotal);
      console.log('Saldo Disponível:', newData.saldoDisponivel);
      console.log('Em Retenção:', newData.saldoEmRetencao);
      console.log('Total Sacado:', newData.totalSacado);
      console.log('Pode Sacar:', newData.podeSacar);
      console.log('=================================');

      setData(newData);
    } catch (error) {
      console.error('Error in fetchBalance:', error);
      setData(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Erro ao buscar saldo' 
      }));
    }
  }, []);

  useEffect(() => {
    fetchBalance();

    // Subscrever para mudanças em vendas
    const salesChannel = supabase
      .channel("balance-sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => fetchBalance()
      )
      .subscribe();

    // Subscrever para mudanças em saques
    const withdrawalsChannel = supabase
      .channel("balance-withdrawals-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        () => fetchBalance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, [fetchBalance]);

  return { ...data, refetch: fetchBalance };
};
