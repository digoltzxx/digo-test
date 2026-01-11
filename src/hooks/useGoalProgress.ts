/**
 * Hook useGoalProgress - INDEPENDENTE do calendário/filtros de data
 * 
 * REGRA DE OURO: A meta NÃO responde ao calendário de relatórios.
 * A meta é alimentada exclusivamente por:
 * - Configuração da meta (valor alvo + período)
 * - Vendas aprovadas do período ATUAL da meta (não do filtro de data)
 * 
 * Período da meta:
 * - Diária → dia atual (hoje)
 * - Semanal → semana atual
 * - Mensal → mês atual
 * 
 * Sempre baseado no período corrente da meta, NUNCA no calendário do relatório.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

// Tipos de período suportados
export type GoalPeriodType = "daily" | "weekly" | "monthly";

// Placas de premiação fixas (baseadas em valor bruto acumulado)
const AWARD_PLATES = [
  { id: 1, threshold: 10000, label: "10 MIL", image: "10k" },
  { id: 2, threshold: 100000, label: "100 MIL", image: "100k" },
  { id: 3, threshold: 500000, label: "500 MIL", image: "500k" },
] as const;

// Constantes de milestones para alertas
const MILESTONES = [
  { type: "50_percent", threshold: 50 },
  { type: "80_percent", threshold: 80 },
  { type: "100_percent", threshold: 100 },
] as const;

interface GoalProgressData {
  // Dados principais (VALOR BRUTO)
  grossApprovedAmount: number;
  approvedSalesCount: number;
  
  // Total lifetime (todas as vendas aprovadas - não filtrado por data)
  totalLifetimeAmount: number;
  
  // Configuração da meta
  goalAmount: number;
  periodType: GoalPeriodType;
  periodLabel: string;
  
  // Progresso calculado
  progressPercentage: number;
  remainingAmount: number;
  isGoalReached: boolean;
  
  // Placas de premiação
  currentPlate: typeof AWARD_PLATES[number];
  currentPlateIndex: number;
  platesEarned: number;
  allPlatesEarned: boolean;
  plateProgressPercentage: number;
  plateRemainingAmount: number;
  nextPlateThreshold: number;
  
  // Milestones atingidos
  milestones: Array<{ percent: number; reached: boolean }>;
  
  // Estados
  isLoading: boolean;
}

interface UseGoalProgressReturn extends GoalProgressData {
  refetch: () => void;
  setGoal: (amount: number, periodType: GoalPeriodType) => Promise<void>;
  plates: typeof AWARD_PLATES;
}

function getPeriodDates(periodType: GoalPeriodType) {
  const now = new Date();
  
  switch (periodType) {
    case "daily":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "weekly":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "monthly":
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPeriodLabel(periodType: GoalPeriodType): string {
  switch (periodType) {
    case "daily": return "Meta diária";
    case "weekly": return "Meta semanal";
    case "monthly": return "Meta mensal";
    default: return "Meta";
  }
}

export function useGoalProgress(): UseGoalProgressReturn {
  const [data, setData] = useState<GoalProgressData>({
    grossApprovedAmount: 0,
    approvedSalesCount: 0,
    totalLifetimeAmount: 0,
    goalAmount: 10000,
    periodType: "monthly",
    periodLabel: "Meta mensal",
    progressPercentage: 0,
    remainingAmount: 10000,
    isGoalReached: false,
    currentPlate: AWARD_PLATES[0],
    currentPlateIndex: 0,
    platesEarned: 0,
    allPlatesEarned: false,
    plateProgressPercentage: 0,
    plateRemainingAmount: AWARD_PLATES[0].threshold,
    nextPlateThreshold: AWARD_PLATES[0].threshold,
    milestones: MILESTONES.map(m => ({ percent: m.threshold, reached: false })),
    isLoading: true,
  });
  
  const [userId, setUserId] = useState<string | null>(null);
  const [goalConfig, setGoalConfig] = useState<{ amount: number; periodType: GoalPeriodType } | null>(null);
  
  // Rastrear alertas já disparados para evitar duplicatas
  const alertsTriggeredRef = useRef<Set<string>>(new Set());

  // Função para disparar alertas de milestones
  const checkAndTriggerAlerts = useCallback(async (
    currentAmount: number,
    goalAmount: number,
    periodType: GoalPeriodType
  ) => {
    if (!userId || goalAmount <= 0) return;
    
    const percentage = (currentAmount / goalAmount) * 100;
    const cycleStartDate = new Date().toISOString().split("T")[0];

    for (const milestone of MILESTONES) {
      const alertKey = `${milestone.type}-${periodType}-${cycleStartDate}`;
      
      if (percentage >= milestone.threshold && !alertsTriggeredRef.current.has(alertKey)) {
        alertsTriggeredRef.current.add(alertKey);

        // Verificar se já existe no banco
        const { data: existing } = await supabase
          .from("goal_alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("alert_type", milestone.type)
          .eq("goal_type", "sales_goal")
          .eq("cycle_start_date", cycleStartDate)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from("goal_alerts").insert({
            user_id: userId,
            alert_type: milestone.type,
            goal_type: "sales_goal",
            threshold_amount: goalAmount,
            current_amount: currentAmount,
            percentage_reached: percentage,
            cycle_start_date: cycleStartDate,
          });

          if (!error) {
            // Disparar evento customizado para toast
            window.dispatchEvent(new CustomEvent("goal-alert-triggered", {
              detail: { 
                alertType: milestone.type, 
                percentage,
                currentAmount,
                goalAmount 
              }
            }));
          }
        }
      }
    }
  }, [userId]);

  // Calcular progresso das placas (baseado em valor bruto total acumulado - sem período)
  // Progressão: 10k → 100k → 500k (sincronizado com imagem e barra)
  const calculatePlateProgress = useCallback((totalGrossAmount: number) => {
    // Determinar qual placa está em progresso
    // 0 placas ganhas = trabalhando para 10k
    // 1 placa ganha = trabalhando para 100k
    // 2 placas ganhas = trabalhando para 500k
    // 3 placas ganhas = todas completas
    
    let platesEarned = 0;
    
    for (let i = 0; i < AWARD_PLATES.length; i++) {
      if (totalGrossAmount >= AWARD_PLATES[i].threshold) {
        platesEarned = i + 1;
      }
    }

    const allPlatesEarned = platesEarned === AWARD_PLATES.length;
    
    // A placa atual é a PRÓXIMA a ser conquistada (ou a última se todas foram ganhas)
    const targetPlateIndex = allPlatesEarned 
      ? AWARD_PLATES.length - 1 
      : platesEarned;
    
    const currentPlate = AWARD_PLATES[targetPlateIndex];
    
    // Calcular thresholds
    let nextThreshold: number;
    let previousThreshold: number;
    
    if (allPlatesEarned) {
      // Todas as placas conquistadas - mostrar última
      nextThreshold = AWARD_PLATES[AWARD_PLATES.length - 1].threshold;
      previousThreshold = AWARD_PLATES.length > 1 ? AWARD_PLATES[AWARD_PLATES.length - 2].threshold : 0;
    } else {
      // Progredindo para a próxima placa
      nextThreshold = AWARD_PLATES[targetPlateIndex].threshold;
      previousThreshold = targetPlateIndex > 0 ? AWARD_PLATES[targetPlateIndex - 1].threshold : 0;
    }

    // Calcular porcentagem de progresso para a placa atual
    let plateProgressPercentage: number;
    if (allPlatesEarned) {
      plateProgressPercentage = 100;
    } else {
      const progressRange = nextThreshold - previousThreshold;
      const currentProgress = totalGrossAmount - previousThreshold;
      plateProgressPercentage = Math.min(Math.max((currentProgress / progressRange) * 100, 0), 100);
    }

    const plateRemainingAmount = Math.max(nextThreshold - totalGrossAmount, 0);

    return {
      currentPlate,
      currentPlateIndex: targetPlateIndex,
      platesEarned,
      allPlatesEarned,
      plateProgressPercentage,
      plateRemainingAmount,
      nextPlateThreshold: nextThreshold,
    };
  }, []);

  // Buscar meta do usuário
  const fetchGoalConfig = useCallback(async (uid: string) => {
    const { data: goals } = await supabase
      .from("sales_goals")
      .select("*")
      .eq("user_id", uid)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (goals && goals.length > 0) {
      return {
        amount: Number(goals[0].goal_amount),
        periodType: goals[0].period_type as GoalPeriodType,
      };
    }
    
    // Meta padrão: R$ 10.000,00 mensal
    return { amount: 10000, periodType: "monthly" as GoalPeriodType };
  }, []);

  // Buscar dados de vendas
  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setUserId(userData.user.id);

      // Buscar configuração da meta
      const config = await fetchGoalConfig(userData.user.id);
      setGoalConfig(config);

      // Calcular período da meta (INDEPENDENTE do calendário)
      const { start, end } = getPeriodDates(config.periodType);

      // Buscar vendas aprovadas no período da meta (VALOR BRUTO = amount)
      const { data: periodSales, error: periodError } = await supabase
        .from("sales")
        .select("amount, id")
        .eq("seller_user_id", userData.user.id)
        .eq("status", "approved")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (periodError) {
        console.error("Error fetching period sales:", periodError);
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Buscar TODAS as vendas aprovadas para placas (acumulado total)
      const { data: allSales, error: allError } = await supabase
        .from("sales")
        .select("amount, id")
        .eq("seller_user_id", userData.user.id)
        .eq("status", "approved");

      if (allError) {
        console.error("Error fetching all sales:", allError);
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Calcular valor bruto do período
      const grossApprovedAmount = periodSales?.reduce((sum, sale) => sum + Number(sale.amount || 0), 0) || 0;
      const approvedSalesCount = periodSales?.length || 0;

      // Calcular valor bruto total (para placas)
      const totalGrossAmount = allSales?.reduce((sum, sale) => sum + Number(sale.amount || 0), 0) || 0;

      // Calcular progresso da meta do período
      const progressPercentage = Math.min((grossApprovedAmount / config.amount) * 100, 100);
      const remainingAmount = Math.max(config.amount - grossApprovedAmount, 0);
      const isGoalReached = grossApprovedAmount >= config.amount;

      // Calcular milestones
      const milestones = MILESTONES.map(m => ({
        percent: m.threshold,
        reached: progressPercentage >= m.threshold,
      }));

      // Calcular progresso das placas
      const plateProgress = calculatePlateProgress(totalGrossAmount);

      // Disparar alertas se necessário
      await checkAndTriggerAlerts(grossApprovedAmount, config.amount, config.periodType);

      setData({
        grossApprovedAmount,
        approvedSalesCount,
        totalLifetimeAmount: totalGrossAmount,
        goalAmount: config.amount,
        periodType: config.periodType,
        periodLabel: getPeriodLabel(config.periodType),
        progressPercentage,
        remainingAmount,
        isGoalReached,
        ...plateProgress,
        milestones,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error in useGoalProgress:", error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [fetchGoalConfig, calculatePlateProgress, checkAndTriggerAlerts]);

  // Definir nova meta
  const setGoal = useCallback(async (amount: number, periodType: GoalPeriodType) => {
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
      await supabase.from("sales_goals").insert({
        user_id: userData.user.id,
        goal_amount: amount,
        period_type: periodType,
        is_active: true,
      });

      // Recarregar dados
      await fetchData();
    } catch (error) {
      console.error("Error setting goal:", error);
    }
  }, [fetchData]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("goal-progress-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `seller_user_id=eq.${userId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  return {
    ...data,
    refetch: fetchData,
    setGoal,
    plates: AWARD_PLATES,
  };
}
