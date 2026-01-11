import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  startOfDay, startOfWeek, startOfMonth, 
  endOfDay, endOfWeek, endOfMonth,
  subDays, subWeeks, subMonths
} from "date-fns";

export interface SalesFilters {
  productId?: string;
  paymentMethod?: string; // 'pix' | 'credit_card' | 'boleto' | undefined (all)
}

export interface PeriodMetrics {
  approvedAmount: number;
  approvedCount: number;
}

export interface PeriodComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  percentageChange: number | null; // null = sem dados para comparar
  absoluteChange: number;
  hasPreviousData: boolean;
}

export interface AllPeriodsStats {
  day: PeriodComparison;
  week: PeriodComparison;
  month: PeriodComparison;
  // Distribuição por forma de pagamento (baseado no mês)
  pixPercentage: number;
  creditCardPercentage: number;
  boletoPercentage: number;
  loading: boolean;
  lastUpdated: Date | null;
}

export interface ProductOption {
  id: string;
  name: string;
}

interface UseAllPeriodsSalesStatsOptions {
  isAdmin?: boolean;
}

// Status que representam pagamento confirmado (evento payment_confirmed)
const APPROVED_STATUSES = ["approved", "completed", "paid"];

// Labels padronizados (copy definitiva)
export const PERIOD_LABELS = {
  day: {
    title: "Vendas aprovadas hoje",
    countLabel: "Quantidade de vendas hoje",
    comparison: "em relação a ontem",
  },
  week: {
    title: "Vendas aprovadas na semana",
    countLabel: "Quantidade de vendas na semana",
    comparison: "em relação à semana anterior",
  },
  month: {
    title: "Vendas aprovadas no mês",
    countLabel: "Quantidade de vendas no mês",
    comparison: "em relação ao mês anterior",
  },
} as const;

export const METRIC_DISCLAIMERS = {
  realtime: "Dados atualizados em tempo real",
  approvedOnly: "Considera apenas pagamentos aprovados",
  netValues: "Valores líquidos",
} as const;

const createEmptyComparison = (): PeriodComparison => ({
  current: { approvedAmount: 0, approvedCount: 0 },
  previous: { approvedAmount: 0, approvedCount: 0 },
  percentageChange: null,
  absoluteChange: 0,
  hasPreviousData: false,
});

export const useAllPeriodsSalesStats = (options: UseAllPeriodsSalesStatsOptions = {}) => {
  const { isAdmin = false } = options;
  
  const [filters, setFilters] = useState<SalesFilters>({
    productId: undefined,
    paymentMethod: undefined,
  });

  const [stats, setStats] = useState<AllPeriodsStats>({
    day: createEmptyComparison(),
    week: createEmptyComparison(),
    month: createEmptyComparison(),
    pixPercentage: 0,
    creditCardPercentage: 0,
    boletoPercentage: 0,
    loading: true,
    lastUpdated: null,
  });

  const [products, setProducts] = useState<ProductOption[]>([]);

  const getDateRanges = useCallback(() => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const lastWeekStart = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);
    const lastMonthStart = subMonths(startOfMonth(now), 1);
    
    return {
      // Período atual
      day: { 
        start: startOfDay(now), 
        end: endOfDay(now) 
      },
      week: { 
        start: startOfWeek(now, { weekStartsOn: 1 }), 
        end: endOfWeek(now, { weekStartsOn: 1 }) 
      },
      month: { 
        start: startOfMonth(now), 
        end: endOfMonth(now) 
      },
      // Período anterior (para comparação)
      previousDay: {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      },
      previousWeek: {
        start: lastWeekStart,
        end: endOfWeek(lastWeekStart, { weekStartsOn: 1 }),
      },
      previousMonth: {
        start: lastMonthStart,
        end: endOfMonth(lastMonthStart),
      },
    };
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

      const ranges = getDateRanges();

      // Buscar vendas incluindo mês anterior para comparação
      const earliestDate = ranges.previousMonth.start;
      
      let query = supabase
        .from("sales")
        .select("id, transaction_id, product_id, seller_user_id, amount, net_amount, payment_method, status, created_at, updated_at")
        .gte("created_at", earliestDate.toISOString())
        .lte("created_at", ranges.month.end.toISOString());

      // Filtro por usuário (apenas para não-admin)
      if (!isAdmin && user) {
        query = query.eq("seller_user_id", user.id);
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

      // Filtrar apenas vendas aprovadas (evento payment_confirmed)
      // Cada transaction_id só é contado uma vez (deduplicação)
      const seenTransactions = new Set<string>();
      const approvedSales = (sales || []).filter(s => {
        if (!APPROVED_STATUSES.includes(s.status)) return false;
        if (seenTransactions.has(s.transaction_id)) return false;
        seenTransactions.add(s.transaction_id);
        return true;
      });

      // Função para calcular métricas de um período
      // Usa net_amount (valor líquido) quando disponível, senão amount
      const calculatePeriodMetrics = (startDate: Date, endDate: Date): PeriodMetrics => {
        const periodSales = approvedSales.filter(s => {
          const saleDate = new Date(s.created_at);
          return saleDate >= startDate && saleDate <= endDate;
        });

        return {
          approvedAmount: periodSales.reduce((sum, s) => {
            // Usar net_amount se disponível, senão amount
            const value = s.net_amount !== null && s.net_amount !== undefined 
              ? Number(s.net_amount) 
              : Number(s.amount);
            return sum + value;
          }, 0),
          approvedCount: periodSales.length,
        };
      };

      // Função para calcular comparação entre períodos
      const calculateComparison = (
        currentStart: Date, 
        currentEnd: Date, 
        previousStart: Date, 
        previousEnd: Date
      ): PeriodComparison => {
        const current = calculatePeriodMetrics(currentStart, currentEnd);
        const previous = calculatePeriodMetrics(previousStart, previousEnd);
        
        const hasPreviousData = previous.approvedCount > 0;
        
        let percentageChange: number | null = null;
        if (hasPreviousData && previous.approvedAmount > 0) {
          percentageChange = ((current.approvedAmount - previous.approvedAmount) / previous.approvedAmount) * 100;
        } else if (current.approvedAmount > 0 && previous.approvedAmount === 0) {
          percentageChange = 100; // 100% de crescimento se não havia vendas antes
        }

        return {
          current,
          previous,
          percentageChange,
          absoluteChange: current.approvedAmount - previous.approvedAmount,
          hasPreviousData,
        };
      };

      const dayComparison = calculateComparison(
        ranges.day.start, ranges.day.end,
        ranges.previousDay.start, ranges.previousDay.end
      );
      
      const weekComparison = calculateComparison(
        ranges.week.start, ranges.week.end,
        ranges.previousWeek.start, ranges.previousWeek.end
      );
      
      const monthComparison = calculateComparison(
        ranges.month.start, ranges.month.end,
        ranges.previousMonth.start, ranges.previousMonth.end
      );

      // Distribuição por forma de pagamento (baseado nas vendas aprovadas do mês atual)
      const monthSales = approvedSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= ranges.month.start && saleDate <= ranges.month.end;
      });
      
      const totalApproved = monthSales.length;
      const pixSales = monthSales.filter(s => s.payment_method === "pix").length;
      const creditCardSales = monthSales.filter(s => s.payment_method === "credit_card").length;
      const boletoSales = monthSales.filter(s => s.payment_method === "boleto").length;

      setStats({
        day: dayComparison,
        week: weekComparison,
        month: monthComparison,
        pixPercentage: totalApproved > 0 ? (pixSales / totalApproved) * 100 : 0,
        creditCardPercentage: totalApproved > 0 ? (creditCardSales / totalApproved) * 100 : 0,
        boletoPercentage: totalApproved > 0 ? (boletoSales / totalApproved) * 100 : 0,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error("Error in useAllPeriodsSalesStats:", error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [filters, isAdmin, getDateRanges]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchStats();

    // Subscribe to sales changes para atualização em tempo real
    const channel = supabase
      .channel("all-periods-sales-changes")
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

  const setProductFilter = useCallback((productId: string | undefined) => {
    setFilters(prev => ({ ...prev, productId }));
  }, []);

  const setPaymentMethodFilter = useCallback((paymentMethod: string | undefined) => {
    setFilters(prev => ({ ...prev, paymentMethod }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      productId: undefined,
      paymentMethod: undefined,
    });
  }, []);

  const hasActiveFilters = Boolean(filters.productId || filters.paymentMethod);

  return {
    stats,
    filters,
    products,
    hasActiveFilters,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
    refetch: fetchStats,
  };
};
