import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Types matching backend response
export interface EligibleCommission {
  id: string;
  sale_id: string;
  commission_amount: number;
  commission_percentage: number;
  role: string;
  status: string;
  created_at: string;
  sale_buyer_name: string | null;
  sale_amount: number | null;
  sale_date: string | null;
  product_name: string | null;
  // Calculated by backend
  fee_amount: number;
  net_amount: number;
}

export interface Anticipation {
  id: string;
  total_original_amount: number;
  total_anticipated_amount: number;
  fee_percentage: number;
  fee_amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  anticipation_items?: AnticipationItem[];
}

export interface AnticipationItem {
  id: string;
  commission_id: string;
  original_amount: number;
  anticipated_amount: number;
  fee_amount: number;
}

export interface AnticipationSettings {
  feePercentage: number;
  minAmount: number;
}

export interface AnticipationData {
  disponivel_antecipacao: number;
  taxa_antecipacao: number;
  minimo: number;
  quantidade_antecipacoes: number;
  total_antecipado: number;
  debitos_pendentes: number;
  tem_debitos: boolean;
  comissoes: EligibleCommission[];
  historico: Anticipation[];
}

export function useCommissionAnticipation() {
  const [data, setData] = useState<AnticipationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const { data: response, error } = await supabase.functions.invoke("anticipation-api", {
        body: { action: "get_data" }
      });

      if (error) throw error;

      if (response.error) {
        console.error("API error:", response.error);
        throw new Error(response.error);
      }

      setData(response);
    } catch (error: any) {
      console.error("Error fetching anticipation data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message || "Não foi possível carregar os dados de antecipação.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const requestAnticipation = useCallback(async (commissionIds: string[]) => {
    if (commissionIds.length === 0) {
      toast({
        title: "Selecione comissões",
        description: "Selecione pelo menos uma comissão para antecipar.",
        variant: "destructive"
      });
      return null;
    }

    setProcessing(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("anticipation-api", {
        body: { 
          action: "process_anticipation",
          commission_ids: commissionIds 
        }
      });

      if (error) throw error;

      if (response.error) {
        toast({
          title: "Erro na antecipação",
          description: response.error,
          variant: "destructive"
        });
        return null;
      }

      toast({
        title: "Antecipação realizada!",
        description: `R$ ${response.total_anticipated.toFixed(2)} foi adicionado ao seu saldo disponível.`
      });

      // Refresh data
      await fetchData();

      return response;
    } catch (error: any) {
      console.error("Error requesting anticipation:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível processar a antecipação.",
        variant: "destructive"
      });
      return null;
    } finally {
      setProcessing(false);
    }
  }, [toast, fetchData]);

  // Derived values from backend data
  const availableCommissions = data?.comissoes || [];
  const anticipations = data?.historico || [];
  const totalAvailable = data?.disponivel_antecipacao || 0;
  const totalDebts = data?.debitos_pendentes || 0;
  const hasDebts = data?.tem_debitos || false;
  const settings: AnticipationSettings = {
    feePercentage: data?.taxa_antecipacao || 15.5,
    minAmount: data?.minimo || 50
  };
  const totalAnticipated = data?.total_antecipado || 0;
  const quantityAnticipations = data?.quantidade_antecipacoes || 0;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };

    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("anticipation-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commission_anticipations" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sale_commissions" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return {
    // Raw data
    data,
    
    // Convenience accessors
    availableCommissions,
    anticipations,
    settings,
    totalAvailable,
    totalDebts,
    hasDebts,
    totalAnticipated,
    quantityAnticipations,
    
    // State
    loading,
    processing,
    
    // Actions
    requestAnticipation,
    refetch: fetchData
  };
}
