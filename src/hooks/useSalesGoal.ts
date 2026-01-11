import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type PeriodType = "daily" | "weekly" | "monthly" | "custom";

interface SalesGoal {
  id: string;
  goalAmount: number;
  periodType: PeriodType;
  customStartDate: string | null;
  customEndDate: string | null;
  isActive: boolean;
}

interface GoalProgress {
  goal: SalesGoal | null;
  currentAmount: number;
  remaining: number;
  percentage: number;
  salesCount: number;
  isLoading: boolean;
  isGoalReached: boolean;
  periodLabel: string;
}

interface UseSalesGoalReturn extends GoalProgress {
  setGoal: (amount: number, periodType: PeriodType) => Promise<void>;
  refetch: () => void;
}

function getPeriodDates(periodType: PeriodType, customStart?: string | null, customEnd?: string | null) {
  const now = new Date();
  
  switch (periodType) {
    case "daily":
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };
    case "weekly":
      return {
        start: startOfWeek(now, { weekStartsOn: 0 }),
        end: endOfWeek(now, { weekStartsOn: 0 }),
      };
    case "monthly":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
    case "custom":
      return {
        start: customStart ? new Date(customStart) : startOfMonth(now),
        end: customEnd ? new Date(customEnd) : endOfMonth(now),
      };
    default:
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };
  }
}

function getPeriodLabel(periodType: PeriodType): string {
  switch (periodType) {
    case "daily":
      return "Meta diária";
    case "weekly":
      return "Meta semanal";
    case "monthly":
      return "Meta mensal";
    case "custom":
      return "Meta personalizada";
    default:
      return "Meta";
  }
}

export function useSalesGoal(): UseSalesGoalReturn {
  const [goal, setGoalState] = useState<SalesGoal | null>(null);
  const [currentAmount, setCurrentAmount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchGoal = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      
      setUserId(userData.user.id);

      // Buscar meta ativa do usuário (prioridade: monthly)
      const { data: goals, error } = await supabase
        .from("sales_goals")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (goals && goals.length > 0) {
        const g = goals[0];
        return {
          id: g.id,
          goalAmount: Number(g.goal_amount),
          periodType: g.period_type as PeriodType,
          customStartDate: g.custom_start_date,
          customEndDate: g.custom_end_date,
          isActive: g.is_active,
        };
      }
      
      // Se não tiver meta, criar uma padrão
      return null;
    } catch (error) {
      console.error("Error fetching goal:", error);
      return null;
    }
  }, []);

  const fetchSalesProgress = useCallback(async (goalData: SalesGoal | null) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Usar período da meta ou mensal por padrão
      const periodType = goalData?.periodType || "monthly";
      const { start, end } = getPeriodDates(
        periodType, 
        goalData?.customStartDate, 
        goalData?.customEndDate
      );

      // Buscar vendas aprovadas no período - USAR VALOR BRUTO (amount)
      const { data: sales, error } = await supabase
        .from("sales")
        .select("amount, id")
        .eq("seller_user_id", userData.user.id)
        .eq("status", "approved")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (error) throw error;

      // Usar valor bruto (amount) ao invés de líquido (net_amount)
      const total = sales?.reduce((acc, sale) => acc + Number(sale.amount), 0) || 0;
      setCurrentAmount(total);
      setSalesCount(sales?.length || 0);
    } catch (error) {
      console.error("Error fetching sales progress:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const goalData = await fetchGoal();
    setGoalState(goalData);
    await fetchSalesProgress(goalData);
    setIsLoading(false);
  }, [fetchGoal, fetchSalesProgress]);

  // Criar ou atualizar meta
  const setGoal = useCallback(async (amount: number, periodType: PeriodType) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Desativar metas existentes
      await supabase
        .from("sales_goals")
        .update({ is_active: false })
        .eq("user_id", userData.user.id)
        .eq("is_active", true);

      // Criar nova meta
      const { error } = await supabase
        .from("sales_goals")
        .insert({
          user_id: userData.user.id,
          goal_amount: amount,
          period_type: periodType,
          is_active: true,
        });

      if (error) throw error;

      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error("Error setting goal:", error);
    }
  }, [loadData]);

  // Carregar dados iniciais
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Configurar listener de tempo real para vendas
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("sales-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `seller_user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Real-time sale update:", payload);
          // Recarregar progresso quando houver mudanças
          fetchSalesProgress(goal);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, goal, fetchSalesProgress]);

  const goalAmount = goal?.goalAmount || 10000;
  const remaining = Math.max(goalAmount - currentAmount, 0);
  const percentage = Math.min((currentAmount / goalAmount) * 100, 100);
  const isGoalReached = currentAmount >= goalAmount;
  const periodLabel = getPeriodLabel(goal?.periodType || "monthly");

  return {
    goal,
    currentAmount,
    remaining,
    percentage,
    salesCount,
    isLoading,
    isGoalReached,
    periodLabel,
    setGoal,
    refetch: loadData,
  };
}
