import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDateFilter } from "@/contexts/DateFilterContext";

interface HourlyData {
  name: string;
  value: number;
  hour: number;
}

// Generate empty 24-hour array for display even without sales
const getEmptyHourlyData = (): HourlyData[] => 
  Array.from({ length: 24 }, (_, i) => ({ 
    name: `${i.toString().padStart(2, '0')}h`, 
    value: 0, 
    hour: i 
  }));

export const useDailyChartData = () => {
  const { startDateISO, endDateISO, selectedDateString } = useDateFilter();
  
  const [data, setData] = useState<HourlyData[]>(getEmptyHourlyData());
  const [loading, setLoading] = useState(true);
  const [totalToday, setTotalToday] = useState(0);
  
  // Track request ID for cancellation
  const requestIdRef = useRef(0);
  const prevDateRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    
    // Reset when date changes
    if (prevDateRef.current !== selectedDateString) {
      console.log(`[ChartData] Data alterada: ${prevDateRef.current} -> ${selectedDateString}`);
      setData(getEmptyHourlyData());
      setTotalToday(0);
      prevDateRef.current = selectedDateString;
    }
    
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
        return;
      }

      // Use ISO strings for precise filtering
      const filterStart = startDateISO || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const filterEnd = endDateISO || new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

      console.log(`[ChartData] Buscando: ${filterStart} -> ${filterEnd}`);
      
      const { data: sales, error } = await supabase
        .from("sales")
        .select("amount, created_at")
        .eq("seller_user_id", user.id)
        .eq("status", "approved")
        .gte("created_at", filterStart)
        .lte("created_at", filterEnd);

      // Check if request is still current
      if (currentRequestId !== requestIdRef.current) {
        console.log(`[ChartData] Request ${currentRequestId} descartada`);
        return;
      }

      if (error) {
        console.error("Error fetching daily chart data:", error);
        setData(getEmptyHourlyData());
        setTotalToday(0);
        setLoading(false);
        return;
      }

      if (!sales || sales.length === 0) {
        console.log(`[ChartData] Sem vendas para ${selectedDateString}`);
        setData(getEmptyHourlyData());
        setTotalToday(0);
        setLoading(false);
        return;
      }

      // Aggregate by hour
      const hourlyTotals: Record<number, number> = {};
      let total = 0;
      
      sales.forEach((sale) => {
        const saleDate = new Date(sale.created_at);
        const hour = saleDate.getHours();
        const amount = Number(sale.amount);
        hourlyTotals[hour] = (hourlyTotals[hour] || 0) + amount;
        total += amount;
      });

      const chartData = Array.from({ length: 24 }, (_, i) => ({
        name: `${i.toString().padStart(2, '0')}h`,
        value: hourlyTotals[i] || 0,
        hour: i,
      }));

      console.log(`[ChartData] ${sales.length} vendas, total R$ ${total.toFixed(2)}`);
      setData(chartData);
      setTotalToday(total);
    } catch (error) {
      console.error("Error in useDailyChartData:", error);
      if (currentRequestId === requestIdRef.current) {
        setData(getEmptyHourlyData());
        setTotalToday(0);
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [startDateISO, endDateISO, selectedDateString]);

  useEffect(() => {
    // Reset request counter
    requestIdRef.current = 0;
    
    // Reset data before fetching
    setData(getEmptyHourlyData());
    setTotalToday(0);
    
    fetchData();

    // Subscribe with unique channel per date
    const channel = supabase
      .channel(`daily-chart-${selectedDateString}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          console.log(`[ChartData] Realtime update for ${selectedDateString}`);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      requestIdRef.current++;
    };
  }, [fetchData, selectedDateString]);

  return { data, loading, totalToday, refetch: fetchData };
};
