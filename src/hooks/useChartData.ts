import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyData {
  name: string;
  value: number;
  month: number;
}

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const useChartData = (year: number = new Date().getFullYear()) => {
  const [data, setData] = useState<MonthlyData[]>(
    MONTH_NAMES.map((name, index) => ({ name, value: 0, month: index + 1 }))
  );
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get start and end dates for the year
      const startDate = new Date(year, 0, 1).toISOString();
      const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

      const { data: sales, error } = await supabase
        .from("sales")
        .select("amount, created_at, status")
        .eq("seller_user_id", user.id)
        .eq("status", "approved")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) {
        console.error("Error fetching chart data:", error);
        setLoading(false);
        return;
      }

      // Aggregate by month
      const monthlyTotals: Record<number, number> = {};
      
      sales?.forEach((sale) => {
        const saleDate = new Date(sale.created_at);
        const month = saleDate.getMonth() + 1;
        monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(sale.amount);
      });

      const chartData = MONTH_NAMES.map((name, index) => ({
        name,
        value: monthlyTotals[index + 1] || 0,
        month: index + 1,
      }));

      setData(chartData);
    } catch (error) {
      console.error("Error in useChartData:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to sales changes
    const channel = supabase
      .channel("chart-sales-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [year]);

  return { data, loading, refetch: fetchData };
};
