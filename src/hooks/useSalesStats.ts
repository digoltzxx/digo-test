import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAvailableBalance } from "./useAvailableBalance";
import { useDateFilter } from "@/contexts/DateFilterContext";

interface SalesStats {
  totalRevenue: number;
  totalSalesCount: number;
  approvedSalesCount: number;
  pendingSalesCount: number;
  refusedSalesCount: number;
  refundedSalesCount: number;
  chargebackSalesCount: number;
  approvedAmount: number;
  pendingAmount: number;
  refusedAmount: number;
  refundedAmount: number;
  chargebackAmount: number;
  availableBalance: number;
  retentionAmount: number;
  commissionAmount: number;
  pixPercentage: number;
  creditCardPercentage: number;
  boletoPercentage: number;
  loading: boolean;
  isFiltered: boolean;
  selectedDate: string;
}

const EMPTY_STATS: Omit<SalesStats, 'loading' | 'isFiltered' | 'selectedDate' | 'availableBalance'> = {
  totalRevenue: 0,
  totalSalesCount: 0,
  approvedSalesCount: 0,
  pendingSalesCount: 0,
  refusedSalesCount: 0,
  refundedSalesCount: 0,
  chargebackSalesCount: 0,
  approvedAmount: 0,
  pendingAmount: 0,
  refusedAmount: 0,
  refundedAmount: 0,
  chargebackAmount: 0,
  retentionAmount: 0,
  commissionAmount: 0,
  pixPercentage: 0,
  creditCardPercentage: 0,
  boletoPercentage: 0,
};

export const useSalesStats = () => {
  const balanceData = useAvailableBalance();
  const { startDateISO, endDateISO, isFiltered, selectedDateString } = useDateFilter();
  
  // Request cancellation tracking
  const requestIdRef = useRef(0);
  const prevDateRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  
  const [stats, setStats] = useState<SalesStats>({
    ...EMPTY_STATS,
    availableBalance: 0,
    loading: true,
    isFiltered: false,
    selectedDate: selectedDateString,
  });

  const fetchStats = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    
    // Reset stats immediately when date changes
    if (prevDateRef.current !== selectedDateString) {
      console.log(`[SalesStats] Date changed: ${prevDateRef.current} -> ${selectedDateString} - resetting stats`);
      setStats(prev => ({ 
        ...EMPTY_STATS,
        availableBalance: prev.availableBalance,
        loading: true,
        isFiltered,
        selectedDate: selectedDateString,
      }));
      prevDateRef.current = selectedDateString;
    } else {
      setStats(prev => ({ ...prev, loading: true }));
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !isMountedRef.current) {
        if (currentRequestId === requestIdRef.current) {
          setStats(prev => ({ ...prev, loading: false }));
        }
        return;
      }

      // Build query with strict date filtering
      let query = supabase
        .from("sales")
        .select("id, amount, status, payment_method, commission_amount, created_at")
        .eq("seller_user_id", user.id);

      // Apply date filters - CRITICAL: use exact ISO boundaries
      if (startDateISO) {
        query = query.gte("created_at", startDateISO);
      }
      if (endDateISO) {
        query = query.lte("created_at", endDateISO);
      }

      console.log(`[SalesStats] Querying: ${startDateISO} -> ${endDateISO}`);
      
      const { data: sales, error } = await query;

      // Check if this request is still valid
      if (currentRequestId !== requestIdRef.current || !isMountedRef.current) {
        console.log(`[SalesStats] Request ${currentRequestId} cancelled (current: ${requestIdRef.current})`);
        return;
      }

      if (error) {
        console.error("[SalesStats] Query error:", error);
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      // No sales for this date
      if (!sales || sales.length === 0) {
        console.log(`[SalesStats] No sales for ${selectedDateString}`);
        setStats({ 
          ...EMPTY_STATS,
          availableBalance: balanceData.availableBalance,
          loading: false,
          isFiltered,
          selectedDate: selectedDateString,
        });
        return;
      }

      // Calculate statistics
      const approvedSales = sales.filter(s => s.status === "approved");
      const pendingSales = sales.filter(s => s.status === "pending");
      const refusedSales = sales.filter(s => s.status === "refused");
      const refundedSales = sales.filter(s => s.status === "refunded");
      const chargebackSales = sales.filter(s => s.status === "chargeback");
      const retentionSales = sales.filter(s => s.status === "retention");

      const approvedAmount = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const pendingAmount = pendingSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const refusedAmount = refusedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const refundedAmount = refundedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const chargebackAmount = chargebackSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const retentionAmount = retentionSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const commissionAmount = approvedSales.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0);

      // Payment method percentages (approved sales only)
      const pixSales = approvedSales.filter(s => s.payment_method === "pix").length;
      const creditCardSales = approvedSales.filter(s => s.payment_method === "credit_card").length;
      const boletoSales = approvedSales.filter(s => s.payment_method === "boleto").length;
      const approvedCount = approvedSales.length;

      const pixPercentage = approvedCount > 0 ? (pixSales / approvedCount) * 100 : 0;
      const creditCardPercentage = approvedCount > 0 ? (creditCardSales / approvedCount) * 100 : 0;
      const boletoPercentage = approvedCount > 0 ? (boletoSales / approvedCount) * 100 : 0;

      console.log(`[SalesStats] ${selectedDateString}: ${sales.length} total, ${approvedCount} approved`);

      setStats({
        totalRevenue: approvedAmount,
        totalSalesCount: sales.length,
        approvedSalesCount: approvedCount,
        pendingSalesCount: pendingSales.length,
        refusedSalesCount: refusedSales.length,
        refundedSalesCount: refundedSales.length,
        chargebackSalesCount: chargebackSales.length,
        approvedAmount,
        pendingAmount,
        refusedAmount,
        refundedAmount,
        chargebackAmount,
        availableBalance: balanceData.availableBalance,
        retentionAmount,
        commissionAmount,
        pixPercentage,
        creditCardPercentage,
        boletoPercentage,
        loading: false,
        isFiltered,
        selectedDate: selectedDateString,
      });
    } catch (error) {
      console.error("[SalesStats] Error:", error);
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  }, [startDateISO, endDateISO, isFiltered, selectedDateString, balanceData.availableBalance]);

  // Effect to fetch on date change
  useEffect(() => {
    isMountedRef.current = true;
    requestIdRef.current = 0;
    
    fetchStats();

    // Real-time subscription with unique channel per date
    const channelName = `sales-realtime-${selectedDateString}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        (payload) => {
          console.log(`[SalesStats] Realtime event for ${selectedDateString}:`, payload.eventType);
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
      requestIdRef.current++;
    };
  }, [startDateISO, endDateISO, selectedDateString, fetchStats]);

  // Update available balance when it changes
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      availableBalance: balanceData.availableBalance,
    }));
  }, [balanceData.availableBalance]);

  return { ...stats, refetch: fetchStats };
};
