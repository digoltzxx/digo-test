import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryDebugPanel } from "@/components/admin/DeliveryDebugPanel";
import { SupportChecklist } from "@/components/admin/SupportChecklist";
import { DeliveryLogsTable } from "@/components/admin/DeliveryLogsTable";
import { DiagnosticScreen } from "@/components/admin/DiagnosticScreen";
import { BillingStatement } from "@/components/admin/BillingStatement";
import { useGatewayFees, getGatewayFeeForMethod, DEFAULT_GATEWAY_FEES } from "@/hooks/useGatewayFees";
import { 
  DollarSign, ShoppingCart, Users, TrendingUp, 
  CreditCard, Bell, CalendarIcon, FileText, 
  Building2, Wallet, Check, X, Receipt,
  RotateCcw, AlertTriangle, ArrowRight, Info,
  ChevronDown, TrendingDown, Bug, Search
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Notification sound
const NOTIFICATION_SOUND = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQoAJI7B9rF/Ox8ph7zdqpJ8U0B3nqmAfGZSToBsRz8+U3iWm4FmUlWNfWdNOkxZXGhoamltam14h3t2hYuDeHJ2bmRkZFxhZG1xb3J0dm94cnV6d3qFiYuDfYGEgYB+gYOGhoqJiIR9en98eXx/hIeKiomKi4iEgHx4dXFwb21sa2tsbG1tbW1ubm9vcHFxcnJycnJycnFxcHBwb29vb29vb29vb29vb29vb29vb29vb29vb29vb29vb29v";

// ============================================
// DEFINIÇÃO DE CUSTOS OPERACIONAIS
// ============================================

/**
 * CUSTOS OPERACIONAIS (reduzem o lucro do gateway):
 * 1. Taxas da Adquirente (PodPay) - configurável via admin
 * 2. Taxas de Banking (saques, transferências)
 * 3. Serviços externos (antifraude, KYC, BaaS)
 * 
 * TODAS AS TAXAS SÃO CARREGADAS DO BANCO DE DADOS
 * Configuráveis em: Admin > Configurações > Taxas
 */

type PeriodType = 'today' | '7days' | '30days' | 'month' | 'custom';

interface GatewayFinancials {
  originalGrossVolume: number;            // Valor original pago pelo cliente
  transactionCount: number;               // Número de transações aprovadas
  gatewayFees: number;                    // Taxas do gateway (percentual + fixo por método)
  acquirerFees: number;                   // Taxa da adquirente (R$ 0,60 × transações)
  gatewayProfit: number;                  // Lucro do gateway (apenas taxas do gateway)
  netProfit: number;                      // Lucro líquido final (após todas as taxas)
}

interface Stats {
  totalRevenue: number;
  totalSales: number;
  activeUsers: number;
  ticketMedio: number;
  paidOrders: number;
  // Gateway Financials (new structure)
  financials: GatewayFinancials;
  // Payment methods
  pixSales: number;
  pixAmount: number;
  cardSales: number;
  cardAmount: number;
  boletoSales: number;
  boletoAmount: number;
  // Refunds
  chargebacks: number;
  refunds: number;
  // Pending and conversion
  pendingSales: number;
  pendingAmount: number;
  conversionRate: number;
  // Installments data
  installmentsData: { installment: string; count: number }[];
}

interface Notification {
  id: string;
  type: 'withdrawal' | 'document' | 'bank_account';
  title: string;
  description: string;
  status: string;
  created_at: string;
  data: any;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Carregar taxas dinâmicas do banco de dados
  const { fees: gatewayFeesConfig, loading: feesLoading } = useGatewayFees();
  
  const [periodType, setPeriodType] = useState<PeriodType>('30days');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 29),
    to: new Date()
  });
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalSales: 0,
    activeUsers: 0,
    ticketMedio: 0,
    paidOrders: 0,
    financials: {
      originalGrossVolume: 0,
      transactionCount: 0,
      gatewayFees: 0,
      acquirerFees: 0,
      gatewayProfit: 0,
      netProfit: 0,
    },
    pixSales: 0,
    pixAmount: 0,
    cardSales: 0,
    cardAmount: 0,
    boletoSales: 0,
    boletoAmount: 0,
    chargebacks: 0,
    refunds: 0,
    pendingSales: 0,
    pendingAmount: 0,
    conversionRate: 0,
    installmentsData: [],
  });
  const [dailyRevenueData, setDailyRevenueData] = useState<any[]>([]);
  const [dailyFinancialsData, setDailyFinancialsData] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const previousNotificationCount = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND);
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, []);

  // Recarregar dados quando taxas ou período mudar
  useEffect(() => {
    if (!feesLoading) {
      fetchDashboardData();
    }
  }, [dateRange, feesLoading, gatewayFeesConfig]);

  useEffect(() => {
    const channels = [
      supabase
        .channel('withdrawals-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => {
          fetchDashboardData();
          setHasNewNotification(true);
          playNotificationSound();
        })
        .subscribe(),
      supabase
        .channel('documents-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
          fetchDashboardData();
          setHasNewNotification(true);
          playNotificationSound();
        })
        .subscribe(),
      supabase
        .channel('sales-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
          fetchDashboardData();
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [playNotificationSound]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Buscar todos os dados necessários em paralelo
      const [
        { count: usersCount },
        { data: salesData },
        { data: refundsData },
        { data: chargebacksData },
        { data: paymentAttemptsData },
        { data: withdrawalsData },
        { data: documentsData },
        { data: bankAccountsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("sales").select("*").gte("created_at", startDate).lte("created_at", endDate).order("created_at", { ascending: true }),
        supabase.from("refunds").select("*").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("chargebacks").select("*").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("payment_attempts").select("*").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("withdrawals").select("*, bank_accounts(bank_name)").order("created_at", { ascending: false }),
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("bank_accounts").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
      ]);

      // ============================================
      // CÁLCULOS 100% REAIS DO BANCO DE DADOS
      // ============================================

      // Vendas aprovadas (excluindo recusadas, chargebacks e canceladas)
      const approvedSales = salesData?.filter(s => s.status === 'approved' || s.status === 'completed') || [];
      
      // Total em vendas (apenas transações pagas)
      const totalRevenue = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      
      // Pedidos pagos
      const paidOrders = approvedSales.length;
      
      // Ticket médio real
      const ticketMedio = paidOrders > 0 ? totalRevenue / paidOrders : 0;
      
      // ============================================
      // MÉTODOS DE PAGAMENTO (DADOS REAIS)
      // ============================================
      const pixSales = approvedSales.filter(s => s.payment_method === 'pix');
      const cardSales = approvedSales.filter(s => s.payment_method === 'card' || s.payment_method === 'cartao' || s.payment_method === 'credit_card');
      const boletoSales = approvedSales.filter(s => s.payment_method === 'boleto');
      
      // ============================================
      // REFUNDS E CHARGEBACKS (DADOS REAIS)
      // ============================================
      const chargebackCount = chargebacksData?.length || 0;
      const refundCount = refundsData?.filter(r => r.status === 'completed')?.length || 0;
      
      // Também contar vendas com status de chargeback/refunded
      const chargebackSalesCount = salesData?.filter(s => s.status === 'chargeback')?.length || 0;
      const refundedSalesCount = salesData?.filter(s => s.status === 'refunded')?.length || 0;
      
      // Total de chargebacks e refunds
      const totalChargebacks = chargebackCount + chargebackSalesCount;
      const totalRefunds = refundCount + refundedSalesCount;
      
      // ============================================
      // VENDAS PENDENTES (DADOS REAIS)
      // ============================================
      const pendingSalesArr = salesData?.filter(s => s.status === 'pending') || [];
      const pendingSales = pendingSalesArr.length;
      const pendingAmount = pendingSalesArr.reduce((sum, s) => sum + Number(s.amount), 0);
      
      // ============================================
      // TAXA DE CONVERSÃO (DADOS REAIS)
      // ============================================
      // Usar tentativas de pagamento se disponível, senão usar total de vendas
      const totalAttempts = paymentAttemptsData?.length || salesData?.length || 0;
      const approvedAttempts = paymentAttemptsData?.filter(a => a.status === 'approved')?.length || paidOrders;
      const conversionRate = totalAttempts > 0 ? (approvedAttempts / totalAttempts) * 100 : 0;
      
      // ============================================
      // CÁLCULO FINANCEIRO DO GATEWAY
      // ============================================
      const originalGrossVolume = totalRevenue;
      const transactionCount = approvedSales.length;
      
      // Calcular taxas do gateway por método (usando dados reais do banco)
      let gatewayFees = 0;
      approvedSales.forEach(sale => {
        // Usar platform_fee se disponível, senão calcular
        if (sale.platform_fee && Number(sale.platform_fee) > 0) {
          gatewayFees += Number(sale.platform_fee);
        } else {
          const amount = Number(sale.amount);
          const methodFee = getGatewayFeeForMethod(gatewayFeesConfig, sale.payment_method);
          const percentualFee = amount * (methodFee.percentual / 100);
          gatewayFees += percentualFee + methodFee.fixo;
        }
      });
      
      // Taxa da adquirente (usando dados reais se disponível)
      let acquirerFees = 0;
      approvedSales.forEach(sale => {
        if (sale.payment_fee && Number(sale.payment_fee) > 0) {
          acquirerFees += Number(sale.payment_fee);
        } else {
          acquirerFees += gatewayFeesConfig.acquirer_fee;
        }
      });
      
      // Lucro do gateway e lucro líquido
      const gatewayProfit = gatewayFees;
      const netProfit = gatewayFees - acquirerFees;

      // ============================================
      // GRÁFICO DE VENDAS DIÁRIAS (DADOS REAIS)
      // ============================================
      const dailyMap = new Map<string, number>();
      const dailyPlatformFees = new Map<string, number>();
      approvedSales.forEach(sale => {
        const day = format(new Date(sale.created_at), 'dd/MM');
        dailyMap.set(day, (dailyMap.get(day) || 0) + Number(sale.amount));
        dailyPlatformFees.set(day, (dailyPlatformFees.get(day) || 0) + Number(sale.platform_fee || 0));
      });
      
      const dailyData: any[] = [];
      const dailyProfitDataArr: any[] = [];
      let accumulatedProfit = 0;
      let currentDate = new Date(dateRange.from);
      while (currentDate <= dateRange.to) {
        const day = format(currentDate, 'dd/MM');
        dailyData.push({ day, revenue: dailyMap.get(day) || 0 });
        const dayProfit = dailyPlatformFees.get(day) || 0;
        accumulatedProfit += dayProfit;
        dailyProfitDataArr.push({ day, profit: dayProfit, accumulated: accumulatedProfit });
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      }

      // ============================================
      // PARCELAS NO CARTÃO (DADOS REAIS)
      // ============================================
      const installmentsMap = new Map<number, number>();
      cardSales.forEach(sale => {
        const installment = sale.installments || 1;
        installmentsMap.set(installment, (installmentsMap.get(installment) || 0) + 1);
      });
      
      const installmentsData = Array.from({ length: 12 }, (_, i) => ({
        installment: `${i + 1}x`,
        count: installmentsMap.get(i + 1) || 0
      }));

      // ============================================
      // NOTIFICAÇÕES
      // ============================================
      const notificationsList: Notification[] = [];
      withdrawalsData?.forEach((w) => {
        const profile = profilesData?.find((p) => p.user_id === w.user_id);
        notificationsList.push({
          id: w.id,
          type: 'withdrawal',
          title: w.status === 'pending' ? 'Solicitação de Saque' : w.status === 'approved' ? 'Saque Aprovado' : 'Saque Rejeitado',
          description: `${profile?.full_name || 'Usuário'} - ${formatCurrency(w.amount)}`,
          status: w.status,
          created_at: w.created_at,
          data: { ...w, profile },
        });
      });
      documentsData?.forEach((d) => {
        const profile = profilesData?.find((p) => p.user_id === d.user_id);
        notificationsList.push({
          id: d.id,
          type: 'document',
          title: d.status === 'pending' ? 'Documento Enviado' : d.status === 'approved' ? 'Documento Aprovado' : 'Documento Rejeitado',
          description: `${profile?.full_name || 'Usuário'} - ${d.document_type}`,
          status: d.status,
          created_at: d.created_at,
          data: { ...d, profile },
        });
      });
      bankAccountsData?.forEach((b) => {
        const profile = profilesData?.find((p) => p.user_id === b.user_id);
        notificationsList.push({
          id: b.id,
          type: 'bank_account',
          title: b.status === 'pending' ? 'Conta Bancária Enviada' : b.status === 'approved' ? 'Conta Aprovada' : 'Conta Rejeitada',
          description: `${profile?.full_name || 'Usuário'} - ${b.bank_name}`,
          status: b.status,
          created_at: b.created_at,
          data: { ...b, profile },
        });
      });
      notificationsList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // ============================================
      // ATUALIZAR ESTADO COM DADOS REAIS
      // ============================================
      setStats({
        totalRevenue,
        totalSales: salesData?.length || 0,
        activeUsers: usersCount || 0,
        ticketMedio,
        paidOrders,
        financials: {
          originalGrossVolume,
          transactionCount,
          gatewayFees,
          acquirerFees,
          gatewayProfit,
          netProfit,
        },
        pixSales: pixSales.length,
        pixAmount: pixSales.reduce((sum, s) => sum + Number(s.amount), 0),
        cardSales: cardSales.length,
        cardAmount: cardSales.reduce((sum, s) => sum + Number(s.amount), 0),
        boletoSales: boletoSales.length,
        boletoAmount: boletoSales.reduce((sum, s) => sum + Number(s.amount), 0),
        chargebacks: totalChargebacks,
        refunds: totalRefunds,
        pendingSales,
        pendingAmount,
        conversionRate,
        installmentsData,
      });

      setDailyRevenueData(dailyData);
      setDailyFinancialsData(dailyProfitDataArr);
      setNotifications(notificationsList);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveItem = async (notification: Notification) => {
    try {
      let error;
      if (notification.type === 'withdrawal') {
        const result = await supabase.from("withdrawals").update({ status: "approved" }).eq("id", notification.id);
        error = result.error;
      } else if (notification.type === 'document') {
        const result = await supabase.from("documents").update({ status: "approved" }).eq("id", notification.id);
        error = result.error;
      } else if (notification.type === 'bank_account') {
        const result = await supabase.from("bank_accounts").update({ status: "approved" }).eq("id", notification.id);
        error = result.error;
      }
      if (error) throw error;
      toast.success("Item aprovado com sucesso");
      fetchDashboardData();
    } catch (error) {
      console.error("Error approving item:", error);
      toast.error("Erro ao aprovar item");
    }
  };

  const handleRejectItem = async (notification: Notification) => {
    try {
      let error;
      if (notification.type === 'withdrawal') {
        const result = await supabase.from("withdrawals").update({ status: "rejected" }).eq("id", notification.id);
        error = result.error;
      } else if (notification.type === 'document') {
        const result = await supabase.from("documents").update({ status: "rejected" }).eq("id", notification.id);
        error = result.error;
      } else if (notification.type === 'bank_account') {
        const result = await supabase.from("bank_accounts").update({ status: "rejected" }).eq("id", notification.id);
        error = result.error;
      }
      if (error) throw error;
      toast.success("Item rejeitado");
      fetchDashboardData();
    } catch (error) {
      console.error("Error rejecting item:", error);
      toast.error("Erro ao rejeitar item");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Pendente</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Rejeitado</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'withdrawal': return <Wallet className="w-4 h-4 text-blue-400" />;
      case 'document': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'bank_account': return <Building2 className="w-4 h-4 text-green-400" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const totalPaymentMethodSales = stats.pixSales + stats.cardSales + stats.boletoSales;
  const pixPercentage = totalPaymentMethodSales > 0 ? Math.round((stats.pixSales / totalPaymentMethodSales) * 100) : 0;
  const cardPercentage = totalPaymentMethodSales > 0 ? Math.round((stats.cardSales / totalPaymentMethodSales) * 100) : 0;
  const boletoPercentage = totalPaymentMethodSales > 0 ? Math.round((stats.boletoSales / totalPaymentMethodSales) * 100) : 0;

  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  // Period options for quick selection
  const handlePeriodChange = (type: PeriodType) => {
    setPeriodType(type);
    const today = new Date();
    
    switch (type) {
      case 'today':
        setDateRange({ from: today, to: today });
        break;
      case '7days':
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case '30days':
        setDateRange({ from: subDays(today, 29), to: today });
        break;
      case 'month':
        setDateRange({ from: startOfMonth(today), to: today });
        break;
      // custom uses the calendar picker
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Visão geral do gateway de pagamentos</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Period Quick Filters */}
            <div className="flex bg-muted/50 rounded-lg p-1 gap-1">
              <Button 
                variant={periodType === 'today' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-3 text-xs"
                onClick={() => handlePeriodChange('today')}
              >
                Hoje
              </Button>
              <Button 
                variant={periodType === '7days' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-3 text-xs"
                onClick={() => handlePeriodChange('7days')}
              >
                7 dias
              </Button>
              <Button 
                variant={periodType === '30days' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-3 text-xs"
                onClick={() => handlePeriodChange('30days')}
              >
                30 dias
              </Button>
              <Button 
                variant={periodType === 'month' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 px-3 text-xs"
                onClick={() => handlePeriodChange('month')}
              >
                Mês
              </Button>
            </div>

            {/* Custom Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={periodType === 'custom' ? 'secondary' : 'outline'} 
                  className="h-8 px-3 text-xs"
                  onClick={() => setPeriodType('custom')}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM/yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                      setPeriodType('custom');
                    }
                  }}
                  initialFocus
                  locale={ptBR}
                  numberOfMonths={1}
                  defaultMonth={new Date()}
                  month={new Date()}
                  disableNavigation={true}
                  fromMonth={startOfMonth(new Date())}
                  toMonth={endOfMonth(new Date())}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Notifications */}
            <Popover onOpenChange={(open) => { if (open) setHasNewNotification(false); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9">
                  <Bell className="h-5 w-5" />
                  {(pendingCount > 0 || hasNewNotification) && (
                    <span className={cn(
                      "absolute -top-1 -right-1 rounded-full flex items-center justify-center text-white font-bold",
                      hasNewNotification ? "w-3 h-3 bg-red-500 animate-pulse" : "w-5 h-5 bg-red-500 text-xs"
                    )}>
                      {!hasNewNotification && (pendingCount > 9 ? '9+' : pendingCount)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-0" align="end">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Notificações</h3>
                  <p className="text-xs text-muted-foreground">{pendingCount} pendentes</p>
                </div>
                <ScrollArea className="h-[350px]">
                  <div className="p-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma notificação</div>
                    ) : (
                      notifications.slice(0, 10).map((notification) => (
                        <div key={`${notification.type}-${notification.id}`} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{notification.title}</p>
                                {getStatusBadge(notification.status)}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">{format(new Date(notification.created_at), "dd/MM HH:mm")}</p>
                            </div>
                            {notification.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="icon" className="h-7 w-7 bg-green-600 hover:bg-green-700" onClick={() => handleApproveItem(notification)}>
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleRejectItem(notification)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Main Grid - Stats + Billing Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - 3 cols */}
          <div className="lg:col-span-3 space-y-6">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total em Vendas */}
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-400">Total em vendas</p>
                      <h3 className="text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</h3>
                      <p className="text-xs text-muted-foreground mt-1">durante este período!</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ticket Médio */}
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-400">Ticket Médio</p>
                      <h3 className="text-2xl font-bold mt-1">{formatCurrency(stats.ticketMedio)}</h3>
                      <p className="text-xs text-muted-foreground mt-1">Em {stats.paidOrders} vendas!</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pedidos Pagos */}
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-400">Pedidos Pagos</p>
                      <h3 className="text-2xl font-bold mt-1">{stats.paidOrders}</h3>
                      <p className="text-xs text-muted-foreground mt-1">durante este período!</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Sales Chart */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-purple-500 rounded-full" />
                  <CardTitle className="text-base font-semibold">Vendas Diárias</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyRevenueData}>
                      <defs>
                        <linearGradient id="colorDailyRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="day" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => value > 0 ? `${(value / 1000).toFixed(0)}k` : '0'}
                        width={40}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), "Vendas"]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#f97316"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorDailyRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>Acompanhe o volume diário do seu gateway</span>
                </div>
              </CardContent>
            </Card>


            {/* Bottom Row - Payment Methods + Installments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Methods */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-purple-500 rounded-full" />
                    <CardTitle className="text-base font-semibold">Métodos de Pagamento</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* PIX */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <span className="text-green-400 text-xs font-bold">PIX</span>
                      </div>
                      <span className="text-sm">Pix</span>
                    </div>
                    <span className="text-sm font-medium text-green-400">{pixPercentage}%</span>
                  </div>
                  
                  {/* Cartão */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-yellow-400" />
                      </div>
                      <span className="text-sm">Cartão de Crédito</span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{cardPercentage}%</span>
                  </div>
                  
                  {/* Boleto */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-orange-400" />
                      </div>
                      <span className="text-sm">Boleto</span>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{boletoPercentage}%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Installments Chart */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-purple-500 rounded-full" />
                    <CardTitle className="text-base font-semibold">Parcelas no Cartão</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.installmentsData} barSize={16}>
                        <XAxis 
                          dataKey="installment" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis hide />
                        <Tooltip 
                          formatter={(value: number) => [value, "Vendas"]}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Acompanhe a quantidade de vendas parceladas</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Refunds Card */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-purple-500 rounded-full" />
                  <CardTitle className="text-base font-semibold">Reembolsos no Período</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-4">
                {/* Chargebacks */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chargebacks</p>
                    <p className="text-sm font-medium text-muted-foreground">{stats.chargebacks > 0 ? `${stats.chargebacks}` : '0%'}</p>
                  </div>
                </div>
                
                {/* Reembolsos */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reembolsos</p>
                    <p className="text-sm font-medium text-muted-foreground">{stats.refunds > 0 ? `${stats.refunds}` : '0%'}</p>
                  </div>
                </div>
                
              </CardContent>
            </Card>

            {/* Sales Status Pie Chart - Premium Layout */}
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full" />
                  <CardTitle className="text-base font-semibold">Status das Vendas</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {stats.totalSales === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nenhuma venda no período
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Donut Chart - Centered and Larger */}
                    <div className="relative mx-auto">
                      <div className="h-[200px] w-[200px] mx-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Aprovadas', value: stats.paidOrders, color: '#eab308' },
                                { name: 'Pendentes', value: stats.pendingSales, color: '#22d3ee' },
                                { name: 'Recusadas', value: Math.max(0, stats.totalSales - stats.paidOrders - stats.pendingSales - stats.chargebacks - stats.refunds), color: '#ef4444' },
                                { name: 'Chargebacks', value: stats.chargebacks, color: '#f97316' },
                              ].filter(item => item.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {[
                                { name: 'Aprovadas', value: stats.paidOrders, color: '#eab308' },
                                { name: 'Pendentes', value: stats.pendingSales, color: '#22d3ee' },
                                { name: 'Recusadas', value: Math.max(0, stats.totalSales - stats.paidOrders - stats.pendingSales - stats.chargebacks - stats.refunds), color: '#ef4444' },
                                { name: 'Chargebacks', value: stats.chargebacks, color: '#f97316' },
                              ].filter(item => item.value > 0).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, name: string) => [value, name]}
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Center total */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <span className="text-2xl font-bold">{stats.totalSales}</span>
                          <p className="text-xs text-muted-foreground">total</p>
                        </div>
                      </div>
                    </div>

                    {/* Legend Grid - 2x2 with better spacing */}
                    <div className="grid grid-cols-2 gap-4 px-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50" />
                          <span className="text-sm text-muted-foreground">Aprovadas</span>
                        </div>
                        <span className="text-sm font-bold">{stats.paidOrders}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                          <span className="text-sm text-muted-foreground">Pendentes</span>
                        </div>
                        <span className="text-sm font-bold">{stats.pendingSales}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                          <span className="text-sm text-muted-foreground">Recusadas</span>
                        </div>
                        <span className="text-sm font-bold">{Math.max(0, stats.totalSales - stats.paidOrders - stats.pendingSales - stats.chargebacks - stats.refunds)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                          <span className="text-sm text-muted-foreground">Chargebacks</span>
                        </div>
                        <span className="text-sm font-bold">{stats.chargebacks}</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border/50" />

                    {/* Conversion Rate */}
                    <div className="flex justify-between items-center px-2">
                      <span className="text-sm text-muted-foreground">Taxa de Conversão</span>
                      <span className={`text-xl font-bold ${stats.conversionRate >= 50 ? 'text-green-400' : stats.conversionRate >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {stats.conversionRate.toFixed(1)}%
                      </span>
                    </div>

                    {/* Pending Amount - Highlight Box */}
                    {stats.pendingAmount > 0 && (
                      <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500/15 via-yellow-500/10 to-transparent border border-yellow-500/30">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-yellow-400">Valor Pendente</span>
                          <span className="text-base font-bold text-yellow-400">{formatCurrency(stats.pendingAmount)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Billing Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="sticky top-6">
              <BillingStatement />
            </div>
          </div>
        </div>

        {/* Delivery Debug Section */}
        <div className="mt-6 space-y-6">
          <Tabs defaultValue="diagnostic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="diagnostic" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Diagnóstico
              </TabsTrigger>
              <TabsTrigger value="debug" className="flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Técnico
              </TabsTrigger>
              <TabsTrigger value="support" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Checklist Suporte
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Logs
              </TabsTrigger>
            </TabsList>
            <TabsContent value="diagnostic" className="mt-4">
              <DiagnosticScreen />
            </TabsContent>
            <TabsContent value="debug" className="mt-4">
              <DeliveryDebugPanel />
            </TabsContent>
            <TabsContent value="support" className="mt-4">
              <SupportChecklist />
            </TabsContent>
            <TabsContent value="logs" className="mt-4">
              <DeliveryLogsTable />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;