import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay } from "date-fns";
import { useDateFilter } from "@/contexts/DateFilterContext";

interface DailyReportData {
  totalAmount: number;
  netAmount: number;
  salesCount: number;
  byProduct: {
    productId: string;
    productName: string;
    totalAmount: number;
    netAmount: number;
    salesCount: number;
  }[];
  byPaymentMethod: {
    paymentMethod: string;
    totalAmount: number;
    netAmount: number;
    salesCount: number;
    percentage: number;
  }[];
}

interface UseDailyReportsReturn {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  reportData: DailyReportData | null;
  isLoading: boolean;
  isToday: boolean;
  hasData: boolean;
}

export function useDailyReports(): UseDailyReportsReturn {
  // Usar o contexto de filtro de data centralizado
  const { startDate, endDate, isTodayView, dateRange } = useDateFilter();
  
  // selectedDate derivado do contexto
  const selectedDate = dateRange?.from || new Date();
  const setSelectedDate = () => {}; // Não mais usado diretamente, controlado pelo contexto
  
  const [reportData, setReportData] = useState<DailyReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isToday = isTodayView;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // Usar datas do contexto ou fallback para hoje
      const filterStart = startDate ? startDate.toISOString() : startOfDay(new Date()).toISOString();
      const filterEnd = endDate ? endDate.toISOString() : endOfDay(new Date()).toISOString();

      // Buscar vendas do período selecionado
      const { data: sales, error } = await supabase
        .from("sales")
        .select(`
          id,
          amount,
          net_amount,
          payment_method,
          product_id,
          products(name)
        `)
        .eq("seller_user_id", userData.user.id)
        .eq("status", "approved")
        .gte("created_at", filterStart)
        .lte("created_at", filterEnd);

      if (error) throw error;

      if (!sales || sales.length === 0) {
        setReportData({
          totalAmount: 0,
          netAmount: 0,
          salesCount: 0,
          byProduct: [],
          byPaymentMethod: [],
        });
        return;
      }

      // Agregar por produto
      const productMap = new Map<string, {
        productId: string;
        productName: string;
        totalAmount: number;
        netAmount: number;
        salesCount: number;
      }>();

      // Agregar por método de pagamento
      const paymentMap = new Map<string, {
        totalAmount: number;
        netAmount: number;
        salesCount: number;
      }>();

      let totalAmount = 0;
      let netAmount = 0;

      sales.forEach((sale) => {
        totalAmount += Number(sale.amount);
        netAmount += Number(sale.net_amount);

        // Por produto
        const productName = (sale.products as any)?.name || "Produto";
        const existing = productMap.get(sale.product_id) || {
          productId: sale.product_id,
          productName,
          totalAmount: 0,
          netAmount: 0,
          salesCount: 0,
        };
        existing.totalAmount += Number(sale.amount);
        existing.netAmount += Number(sale.net_amount);
        existing.salesCount += 1;
        productMap.set(sale.product_id, existing);

        // Por método de pagamento
        const method = sale.payment_method || "outros";
        const paymentExisting = paymentMap.get(method) || {
          totalAmount: 0,
          netAmount: 0,
          salesCount: 0,
        };
        paymentExisting.totalAmount += Number(sale.amount);
        paymentExisting.netAmount += Number(sale.net_amount);
        paymentExisting.salesCount += 1;
        paymentMap.set(method, paymentExisting);
      });

      const byProduct = Array.from(productMap.values());
      const byPaymentMethod = Array.from(paymentMap.entries()).map(([method, data]) => ({
        paymentMethod: method,
        ...data,
        percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
      }));

      setReportData({
        totalAmount,
        netAmount,
        salesCount: sales.length,
        byProduct,
        byPaymentMethod,
      });
    } catch (error) {
      console.error("Error fetching daily report data:", error);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  // Refetch quando as datas do filtro mudarem
  useEffect(() => {
    fetchData();

    // Subscribe para mudanças em tempo real
    const channel = supabase
      .channel("daily-reports-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return {
    selectedDate,
    setSelectedDate,
    reportData,
    isLoading,
    isToday,
    hasData: reportData !== null && reportData.salesCount > 0,
  };
}
