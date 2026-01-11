import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { startOfDay, endOfDay } from "date-fns";
import { isStatusAllowedInWallet } from "@/lib/financialStatusConfig";

export interface DailyBalanceData {
  dailyNetAmount: number;      // Receita líquida do dia selecionado
  dailyGrossAmount: number;    // Receita bruta do dia selecionado
  dailyTotalFees: number;      // Taxas do dia
  dailySalesCount: number;     // Quantidade de vendas do dia
  dailyPixAmount: number;      // Valor em PIX do dia
  dailyCardAmount: number;     // Valor em cartão do dia
  dailyBoletoAmount: number;   // Valor em boleto do dia
  pixPercentage: number;       // % de vendas PIX
  creditCardPercentage: number;// % de vendas cartão
  boletoPercentage: number;    // % de vendas boleto
  hasData: boolean;            // Se há vendas no dia
  loading: boolean;
}

/**
 * Hook para cálculo de saldo/métricas do DIA SELECIONADO no filtro
 * Sempre retorna dados (zerados se não houver vendas) para manter a UI consistente
 */
export const useDailyBalance = () => {
  const { startDate, endDate } = useDateFilter();
  
  const [data, setData] = useState<DailyBalanceData>({
    dailyNetAmount: 0,
    dailyGrossAmount: 0,
    dailyTotalFees: 0,
    dailySalesCount: 0,
    dailyPixAmount: 0,
    dailyCardAmount: 0,
    dailyBoletoAmount: 0,
    pixPercentage: 0,
    creditCardPercentage: 0,
    boletoPercentage: 0,
    hasData: false,
    loading: true,
  });

  const arredondarMoeda = (valor: number): number => Math.round(valor * 100) / 100;

  const calculateDailyBalance = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      // Usar datas do contexto ou default para hoje
      const filterStart = startDate ? startOfDay(startDate) : startOfDay(new Date());
      const filterEnd = endDate ? endOfDay(endDate) : endOfDay(new Date());

      // Query de vendas APENAS do dia selecionado
      const { data: sales, error } = await supabase
        .from("sales")
        .select("amount, net_amount, payment_fee, platform_fee, commission_amount, status, payment_method")
        .eq("seller_user_id", user.id)
        .gte("created_at", filterStart.toISOString())
        .lte("created_at", filterEnd.toISOString());

      if (error) {
        console.error("Error fetching daily sales:", error);
        setData(prev => ({ ...prev, loading: false, hasData: false }));
        return;
      }

      // Filtrar apenas vendas aprovadas do dia
      const approvedSales = sales?.filter(s => isStatusAllowedInWallet(s.status)) || [];

      // Se não houver vendas, retornar valores zerados (mantendo o dia na UI)
      if (approvedSales.length === 0) {
        setData({
          dailyNetAmount: 0,
          dailyGrossAmount: 0,
          dailyTotalFees: 0,
          dailySalesCount: 0,
          dailyPixAmount: 0,
          dailyCardAmount: 0,
          dailyBoletoAmount: 0,
          pixPercentage: 0,
          creditCardPercentage: 0,
          boletoPercentage: 0,
          hasData: false,
          loading: false,
        });
        return;
      }

      // Calcular métricas do dia
      const dailyGrossAmount = arredondarMoeda(
        approvedSales.reduce((sum, s) => sum + Number(s.amount || 0), 0)
      );

      const dailyNetAmount = arredondarMoeda(
        approvedSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      );

      const dailyTotalFees = arredondarMoeda(
        approvedSales.reduce((sum, s) => 
          sum + Number(s.payment_fee || 0) + Number(s.platform_fee || 0) + Number(s.commission_amount || 0)
        , 0)
      );

      // Separar por método de pagamento
      const pixSales = approvedSales.filter(s => s.payment_method === "pix");
      const cardSales = approvedSales.filter(s => s.payment_method === "credit_card" || s.payment_method === "card");
      const boletoSales = approvedSales.filter(s => s.payment_method === "boleto");

      const dailyPixAmount = arredondarMoeda(
        pixSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      );

      const dailyCardAmount = arredondarMoeda(
        cardSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      );

      const dailyBoletoAmount = arredondarMoeda(
        boletoSales.reduce((sum, s) => sum + Number(s.net_amount || 0), 0)
      );

      // Calcular percentuais - baseado na quantidade de vendas (não valor)
      const totalCount = approvedSales.length;
      const pixPercentage = totalCount > 0 ? (pixSales.length / totalCount) * 100 : 0;
      const creditCardPercentage = totalCount > 0 ? (cardSales.length / totalCount) * 100 : 0;
      const boletoPercentage = totalCount > 0 ? (boletoSales.length / totalCount) * 100 : 0;

      setData({
        dailyNetAmount,
        dailyGrossAmount,
        dailyTotalFees,
        dailySalesCount: approvedSales.length,
        dailyPixAmount,
        dailyCardAmount,
        dailyBoletoAmount,
        pixPercentage,
        creditCardPercentage,
        boletoPercentage,
        hasData: true,
        loading: false,
      });
    } catch (error) {
      console.error("Error calculating daily balance:", error);
      setData(prev => ({ ...prev, loading: false, hasData: false }));
    }
  }, [startDate, endDate]);

  useEffect(() => {
    calculateDailyBalance();

    // Subscrever para mudanças em vendas
    const channel = supabase
      .channel("daily-balance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => calculateDailyBalance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [calculateDailyBalance]);

  return { ...data, refetch: calculateDailyBalance };
};
