import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AlertType = "50_percent" | "80_percent" | "100_percent";

interface GoalAlert {
  id: string;
  alertType: AlertType;
  goalType: string;
  plateLevel: number | null;
  thresholdAmount: number;
  currentAmount: number;
  percentageReached: number;
  triggeredAt: Date;
  cycleStartDate: string;
}

interface UseGoalAlertsReturn {
  alerts: GoalAlert[];
  recentAlerts: GoalAlert[];
  isLoading: boolean;
  checkAndTriggerAlerts: (
    currentAmount: number,
    thresholdAmount: number,
    plateLevel: number,
    goalType?: string
  ) => Promise<void>;
  getTriggeredAlertsForCycle: (plateLevel: number, cycleStartDate: string) => Promise<string[]>;
}

const ALERT_MESSAGES: Record<AlertType, { title: string; description: string; emoji: string }> = {
  "50_percent": {
    title: "50% da meta atingida! 🎯",
    description: "Você atingiu metade do caminho. Continue assim!",
    emoji: "🎯",
  },
  "80_percent": {
    title: "80% da meta alcançada! 🔥",
    description: "Falta pouco! Você está quase lá.",
    emoji: "🔥",
  },
  "100_percent": {
    title: "Meta atingida com sucesso! 🚀",
    description: "Parabéns! Você conquistou sua meta!",
    emoji: "🚀",
  },
};

export function useGoalAlerts(): UseGoalAlertsReturn {
  const [alerts, setAlerts] = useState<GoalAlert[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<GoalAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Track alerts we've already shown toasts for in this session
  const shownToastsRef = useRef<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setIsLoading(false);
        return;
      }

      setUserId(userData.user.id);

      const { data, error } = await supabase
        .from("goal_alerts")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("triggered_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedAlerts: GoalAlert[] = (data || []).map((alert) => ({
        id: alert.id,
        alertType: alert.alert_type as AlertType,
        goalType: alert.goal_type,
        plateLevel: alert.plate_level,
        thresholdAmount: Number(alert.threshold_amount),
        currentAmount: Number(alert.current_amount),
        percentageReached: Number(alert.percentage_reached),
        triggeredAt: new Date(alert.triggered_at),
        cycleStartDate: alert.cycle_start_date,
      }));

      setAlerts(formattedAlerts);

      // Get alerts from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setRecentAlerts(formattedAlerts.filter((a) => a.triggeredAt > oneDayAgo));
    } catch (error) {
      console.error("Error fetching goal alerts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTriggeredAlertsForCycle = useCallback(
    async (plateLevel: number, cycleStartDate: string): Promise<string[]> => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return [];

        const { data, error } = await supabase
          .from("goal_alerts")
          .select("alert_type")
          .eq("user_id", userData.user.id)
          .eq("goal_type", "award_plate")
          .eq("plate_level", plateLevel)
          .eq("cycle_start_date", cycleStartDate);

        if (error) throw error;

        return (data || []).map((a) => a.alert_type);
      } catch (error) {
        console.error("Error checking triggered alerts:", error);
        return [];
      }
    },
    []
  );

  const triggerAlert = useCallback(
    async (
      alertType: AlertType,
      currentAmount: number,
      thresholdAmount: number,
      percentageReached: number,
      plateLevel: number,
      goalType: string = "award_plate"
    ) => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const cycleStartDate = new Date().toISOString().split("T")[0];

        // Check if alert already exists for this cycle
        const { data: existing } = await supabase
          .from("goal_alerts")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("alert_type", alertType)
          .eq("goal_type", goalType)
          .eq("plate_level", plateLevel)
          .eq("cycle_start_date", cycleStartDate)
          .maybeSingle();

        if (existing) {
          return;
        }

        // Insert new alert
        const { error } = await supabase.from("goal_alerts").insert({
          user_id: userData.user.id,
          alert_type: alertType,
          goal_type: goalType,
          plate_level: plateLevel,
          threshold_amount: thresholdAmount,
          current_amount: currentAmount,
          percentage_reached: percentageReached,
          cycle_start_date: cycleStartDate,
        });

        if (error) {
          // Ignore duplicate key errors (race condition protection)
          if (!error.message.includes("duplicate key")) {
            console.error("Error triggering alert:", error);
          }
          return;
        }

        // Show toast notification
        const alertKey = `${alertType}-${plateLevel}-${cycleStartDate}`;
        if (!shownToastsRef.current.has(alertKey)) {
          shownToastsRef.current.add(alertKey);
          
          const message = ALERT_MESSAGES[alertType];
          toast.success(message.title, {
            description: message.description,
            duration: 6000,
            icon: message.emoji,
          });
        }

        // Refresh alerts list
        fetchAlerts();
      } catch (error) {
        console.error("Error in triggerAlert:", error);
      }
    },
    [fetchAlerts]
  );

  const checkAndTriggerAlerts = useCallback(
    async (
      currentAmount: number,
      thresholdAmount: number,
      plateLevel: number,
      goalType: string = "award_plate"
    ) => {
      if (thresholdAmount <= 0) return;

      const percentage = (currentAmount / thresholdAmount) * 100;
      const cycleStartDate = new Date().toISOString().split("T")[0];

      // Get already triggered alerts for this cycle
      const triggeredAlerts = await getTriggeredAlertsForCycle(plateLevel, cycleStartDate);

      // Check and trigger alerts in order
      if (percentage >= 50 && !triggeredAlerts.includes("50_percent")) {
        await triggerAlert("50_percent", currentAmount, thresholdAmount, percentage, plateLevel, goalType);
      }
      
      if (percentage >= 80 && !triggeredAlerts.includes("80_percent")) {
        await triggerAlert("80_percent", currentAmount, thresholdAmount, percentage, plateLevel, goalType);
      }
      
      if (percentage >= 100 && !triggeredAlerts.includes("100_percent")) {
        await triggerAlert("100_percent", currentAmount, thresholdAmount, percentage, plateLevel, goalType);
      }
    },
    [getTriggeredAlertsForCycle, triggerAlert]
  );

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Listen for real-time alert updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("goal-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_alerts",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchAlerts]);

  return {
    alerts,
    recentAlerts,
    isLoading,
    checkAndTriggerAlerts,
    getTriggeredAlertsForCycle,
  };
}
