import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

// Status que representam pagamento aprovado/concluído
const APPROVED_STATUSES = ["approved", "completed", "paid", "settled"];

// Metas progressivas em ordem crescente
const PROGRESSIVE_GOALS = [10000, 100000, 500000, 1000000];

interface GlobalSalesStats {
  totalAmount: number;
  loading: boolean;
}

const getGoalLabel = (goal: number): string => {
  if (goal >= 1000000) return `${(goal / 1000000).toFixed(0)}M`;
  return `${(goal / 1000).toFixed(0)}K`;
};

const getCurrentGoal = (amount: number): number => {
  for (const goal of PROGRESSIVE_GOALS) {
    if (amount < goal) return goal;
  }
  // Se ultrapassou todas as metas, continua na última
  return PROGRESSIVE_GOALS[PROGRESSIVE_GOALS.length - 1];
};

export const useGlobalSalesIndicator = () => {
  const [stats, setStats] = useState<GlobalSalesStats>({
    totalAmount: 0,
    loading: true,
  });

  const fetchGlobalSales = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setStats({ totalAmount: 0, loading: false });
        return;
      }

      // Buscar apenas vendas APROVADAS do gateway (sem filtro de data)
      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, transaction_id, net_amount, amount, status")
        .eq("seller_user_id", user.id)
        .in("status", APPROVED_STATUSES);

      if (error) {
        console.error("Error fetching global sales:", error);
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      // Deduplicar por transaction_id
      const seenTransactions = new Set<string>();
      const uniqueSales = (sales || []).filter(s => {
        if (seenTransactions.has(s.transaction_id)) return false;
        seenTransactions.add(s.transaction_id);
      return true;
    });

    // Somar VALOR BRUTO (amount) - meta sempre usa valor bruto
    const totalAmount = uniqueSales.reduce((sum, s) => {
      return sum + Number(s.amount || 0);
    }, 0);

      setStats({
        totalAmount,
        loading: false,
      });
    } catch (error) {
      console.error("Error in useGlobalSalesIndicator:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchGlobalSales();

    // Subscribe para atualização em tempo real
    const channel = supabase
      .channel("global-sales-indicator")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => {
          fetchGlobalSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGlobalSales]);

  // Calcular meta atual baseada no valor acumulado
  const currentGoal = useMemo(() => getCurrentGoal(stats.totalAmount), [stats.totalAmount]);
  const goalLabel = useMemo(() => getGoalLabel(currentGoal), [currentGoal]);
  const progressPercent = useMemo(() => 
    Math.min((stats.totalAmount / currentGoal) * 100, 100), 
    [stats.totalAmount, currentGoal]
  );
  const goalReached = stats.totalAmount >= currentGoal;

  return {
    ...stats,
    currentGoal,
    goalLabel,
    progressPercent,
    goalReached,
    refetch: fetchGlobalSales,
  };
};
