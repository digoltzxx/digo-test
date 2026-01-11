import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Placas de premiação fixas
const AWARD_PLATES = [
  { id: 1, threshold: 10000, label: "10 MIL", nextLabel: "100 MIL" },
  { id: 2, threshold: 100000, label: "100 MIL", nextLabel: "500 MIL" },
  { id: 3, threshold: 500000, label: "500 MIL", nextLabel: null },
];

interface AwardPlateProgress {
  currentPlate: typeof AWARD_PLATES[0];
  currentPlateIndex: number;
  nextThreshold: number;
  totalApprovedAmount: number;
  progressPercentage: number;
  remainingAmount: number;
  platesEarned: number;
  allPlatesEarned: boolean;
  isLoading: boolean;
  approvedSalesCount: number;
}

interface UseAwardPlatesReturn extends AwardPlateProgress {
  refetch: () => void;
  plates: typeof AWARD_PLATES;
}

export function useAwardPlates(): UseAwardPlatesReturn {
  const [data, setData] = useState<AwardPlateProgress>({
    currentPlate: AWARD_PLATES[0],
    currentPlateIndex: 0,
    nextThreshold: AWARD_PLATES[0].threshold,
    totalApprovedAmount: 0,
    progressPercentage: 0,
    remainingAmount: AWARD_PLATES[0].threshold,
    platesEarned: 0,
    allPlatesEarned: false,
    isLoading: true,
    approvedSalesCount: 0,
  });
  const [userId, setUserId] = useState<string | null>(null);
  
  // Track which alerts we've already checked to avoid duplicate triggers
  const lastCheckedAmountRef = useRef<number>(0);
  const alertsCheckedRef = useRef<Set<string>>(new Set());

  const checkAndTriggerAlerts = useCallback(async (
    currentAmount: number,
    plateLevel: number,
    thresholdAmount: number
  ) => {
    // Only check if amount changed significantly
    if (Math.abs(currentAmount - lastCheckedAmountRef.current) < 0.01) return;
    lastCheckedAmountRef.current = currentAmount;

    if (thresholdAmount <= 0) return;

    const percentage = (currentAmount / thresholdAmount) * 100;
    const cycleStartDate = new Date().toISOString().split("T")[0];

    // Get user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Check each milestone
    const milestones: Array<{ type: string; threshold: number }> = [
      { type: "50_percent", threshold: 50 },
      { type: "80_percent", threshold: 80 },
      { type: "100_percent", threshold: 100 },
    ];

    for (const milestone of milestones) {
      const alertKey = `${milestone.type}-${plateLevel}-${cycleStartDate}`;
      
      if (percentage >= milestone.threshold && !alertsCheckedRef.current.has(alertKey)) {
        alertsCheckedRef.current.add(alertKey);

        // Check if already triggered in DB
        const { data: existing } = await supabase
          .from("goal_alerts")
          .select("id")
          .eq("user_id", userData.user.id)
          .eq("alert_type", milestone.type)
          .eq("goal_type", "award_plate")
          .eq("plate_level", plateLevel)
          .eq("cycle_start_date", cycleStartDate)
          .maybeSingle();

        if (!existing) {
          // Insert new alert
          const { error } = await supabase.from("goal_alerts").insert({
            user_id: userData.user.id,
            alert_type: milestone.type,
            goal_type: "award_plate",
            plate_level: plateLevel,
            threshold_amount: thresholdAmount,
            current_amount: currentAmount,
            percentage_reached: percentage,
            cycle_start_date: cycleStartDate,
          });

          if (!error) {
            // Dispatch custom event for toast notification
            window.dispatchEvent(new CustomEvent("goal-alert-triggered", {
              detail: { 
                alertType: milestone.type, 
                plateLevel, 
                percentage,
                currentAmount,
                thresholdAmount 
              }
            }));
          }
        }
      }
    }
  }, []);

  const calculateProgress = useCallback((totalAmount: number, salesCount: number) => {
    let platesEarned = 0;
    let currentPlateIndex = 0;
    
    for (let i = 0; i < AWARD_PLATES.length; i++) {
      if (totalAmount >= AWARD_PLATES[i].threshold) {
        platesEarned = i + 1;
        currentPlateIndex = i;
      }
    }

    const currentPlate = AWARD_PLATES[currentPlateIndex];
    const allPlatesEarned = platesEarned === AWARD_PLATES.length;
    
    let nextThreshold: number;
    let previousThreshold: number;
    
    if (allPlatesEarned) {
      nextThreshold = AWARD_PLATES[AWARD_PLATES.length - 1].threshold;
      previousThreshold = AWARD_PLATES.length > 1 
        ? AWARD_PLATES[AWARD_PLATES.length - 2].threshold 
        : 0;
    } else if (platesEarned === 0) {
      nextThreshold = AWARD_PLATES[0].threshold;
      previousThreshold = 0;
    } else {
      nextThreshold = AWARD_PLATES[platesEarned].threshold;
      previousThreshold = AWARD_PLATES[platesEarned - 1].threshold;
    }

    let progressPercentage: number;
    if (allPlatesEarned) {
      progressPercentage = 100;
    } else {
      const progressRange = nextThreshold - previousThreshold;
      const currentProgress = totalAmount - previousThreshold;
      progressPercentage = Math.min(Math.max((currentProgress / progressRange) * 100, 0), 100);
    }

    const remainingAmount = Math.max(nextThreshold - totalAmount, 0);

    // Determine which plate level to check alerts for
    const targetPlateLevel = platesEarned === 0 ? 1 : platesEarned + 1;
    const targetThreshold = platesEarned === 0 
      ? AWARD_PLATES[0].threshold 
      : (platesEarned < AWARD_PLATES.length ? AWARD_PLATES[platesEarned].threshold : AWARD_PLATES[platesEarned - 1].threshold);

    // Check and trigger alerts for current progress
    if (totalAmount > 0) {
      checkAndTriggerAlerts(totalAmount, targetPlateLevel, targetThreshold);
    }

    setData({
      currentPlate,
      currentPlateIndex,
      nextThreshold,
      totalApprovedAmount: totalAmount,
      progressPercentage,
      remainingAmount,
      platesEarned,
      allPlatesEarned,
      isLoading: false,
      approvedSalesCount: salesCount,
    });
  }, [checkAndTriggerAlerts]);

  const fetchSalesData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setUserId(userData.user.id);

      // Buscar vendas aprovadas - USAR VALOR BRUTO (amount)
      const { data: sales, error } = await supabase
        .from("sales")
        .select("amount, id, status")
        .eq("seller_user_id", userData.user.id)
        .eq("status", "approved");

      if (error) {
        console.error("Error fetching sales for plates:", error);
        setData(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Usar valor bruto (amount) ao invés de líquido (net_amount)
      const totalApproved = sales?.reduce((sum, sale) => sum + Number(sale.amount || 0), 0) || 0;
      const salesCount = sales?.length || 0;

      calculateProgress(totalApproved, salesCount);
    } catch (error) {
      console.error("Error in useAwardPlates:", error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [calculateProgress]);

  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("award-plates-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `seller_user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Real-time plate update - sale changed:", payload);
          fetchSalesData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSalesData]);

  return {
    ...data,
    refetch: fetchSalesData,
    plates: AWARD_PLATES,
  };
}
