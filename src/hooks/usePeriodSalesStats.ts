import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth } from "date-fns";

export type SalesPeriod = "day" | "week" | "month" | "all";

export interface PeriodFilters {
  period: SalesPeriod;
  productId?: string;
  paymentMethod?: string; // 'pix' | 'credit_card' | 'boleto' | undefined (all)
}

export interface PeriodSalesStats {
  approvedAmount: number;
  approvedCount: number;
  totalAmount: number;
  totalCount: number;
  pendingAmount: number;
  pendingCount: number;
  refundedAmount: number;
  refundedCount: number;
  pixPercentage: number;
  creditCardPercentage: number;
  boletoPercentage: number;
  loading: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
}

interface UsePeriodSalesStatsOptions {
  isAdmin?: boolean;
}

export const usePeriodSalesStats = (options: UsePeriodSalesStatsOptions = {}) => {
  const { isAdmin = false } = options;
  
  const [filters, setFilters] = useState<PeriodFilters>({
    period: "month",
    productId: undefined,
    paymentMethod: undefined,
  });

  const [stats, setStats] = useState<PeriodSalesStats>({
    approvedAmount: 0,
    approvedCount: 0,
    totalAmount: 0,
    totalCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    refundedAmount: 0,
    refundedCount: 0,
    pixPercentage: 0,
    creditCardPercentage: 0,
    boletoPercentage: 0,
    loading: true,
  });

  const [products, setProducts] = useState<ProductOption[]>([]);

  const getDateRange = useCallback((period: SalesPeriod) => {
    const now = new Date();
    switch (period) {
      case "day":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        // Semana começa na segunda-feira
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "all":
      default:
        return { start: null, end: null };
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase.from("products").select("id, name");
      
      if (!isAdmin && user) {
        query = query.eq("user_id", user.id);
      }
      
      const { data, error } = await query.order("name");
      
      if (error) {
        console.error("Error fetching products:", error);
        return;
      }
      
      setProducts(data || []);
    } catch (error) {
      console.error("Error in fetchProducts:", error);
    }
  }, [isAdmin]);

  const fetchStats = useCallback(async () => {
    setStats(prev => ({ ...prev, loading: true }));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user && !isAdmin) {
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      let query = supabase.from("sales").select("*");

      // Filtro por usuário (apenas para não-admin)
      if (!isAdmin && user) {
        query = query.eq("seller_user_id", user.id);
      }

      // Filtro por período
      const { start, end } = getDateRange(filters.period);
      if (start && end) {
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      // Filtro por produto
      if (filters.productId) {
        query = query.eq("product_id", filters.productId);
      }

      // Filtro por forma de pagamento
      if (filters.paymentMethod) {
        query = query.eq("payment_method", filters.paymentMethod);
      }

      const { data: sales, error } = await query;

      if (error) {
        console.error("Error fetching sales:", error);
        setStats(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!sales || sales.length === 0) {
        setStats({
          approvedAmount: 0,
          approvedCount: 0,
          totalAmount: 0,
          totalCount: 0,
          pendingAmount: 0,
          pendingCount: 0,
          refundedAmount: 0,
          refundedCount: 0,
          pixPercentage: 0,
          creditCardPercentage: 0,
          boletoPercentage: 0,
          loading: false,
        });
        return;
      }

      // Calcular estatísticas
      const approvedSales = sales.filter(s => s.status === "approved" || s.status === "completed");
      const pendingSales = sales.filter(s => s.status === "pending");
      const refundedSales = sales.filter(s => s.status === "refunded");

      const approvedAmount = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const pendingAmount = pendingSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const refundedAmount = refundedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalAmount = sales.reduce((sum, s) => sum + Number(s.amount), 0);

      // Porcentagens por forma de pagamento
      const pixSales = sales.filter(s => s.payment_method === "pix").length;
      const creditCardSales = sales.filter(s => s.payment_method === "credit_card").length;
      const boletoSales = sales.filter(s => s.payment_method === "boleto").length;
      const totalCount = sales.length;

      setStats({
        approvedAmount,
        approvedCount: approvedSales.length,
        totalAmount,
        totalCount,
        pendingAmount,
        pendingCount: pendingSales.length,
        refundedAmount,
        refundedCount: refundedSales.length,
        pixPercentage: totalCount > 0 ? (pixSales / totalCount) * 100 : 0,
        creditCardPercentage: totalCount > 0 ? (creditCardSales / totalCount) * 100 : 0,
        boletoPercentage: totalCount > 0 ? (boletoSales / totalCount) * 100 : 0,
        loading: false,
      });
    } catch (error) {
      console.error("Error in usePeriodSalesStats:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [filters, isAdmin, getDateRange]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchStats();

    // Subscribe to sales changes
    const channel = supabase
      .channel("period-sales-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  const setPeriod = useCallback((period: SalesPeriod) => {
    setFilters(prev => ({ ...prev, period }));
  }, []);

  const setProductFilter = useCallback((productId: string | undefined) => {
    setFilters(prev => ({ ...prev, productId }));
  }, []);

  const setPaymentMethodFilter = useCallback((paymentMethod: string | undefined) => {
    setFilters(prev => ({ ...prev, paymentMethod }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      period: "month",
      productId: undefined,
      paymentMethod: undefined,
    });
  }, []);

  const periodLabel = useMemo(() => {
    switch (filters.period) {
      case "day": return "Hoje";
      case "week": return "Esta semana";
      case "month": return "Este mês";
      case "all": return "Todo período";
      default: return "Este mês";
    }
  }, [filters.period]);

  return {
    stats,
    filters,
    products,
    periodLabel,
    setPeriod,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
    refetch: fetchStats,
  };
};
