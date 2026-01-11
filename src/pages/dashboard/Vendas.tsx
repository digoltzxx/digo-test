import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Eye,
  User,
  Mail,
  FileText,
  Shield,
  MapPin,
  Package,
  Hash,
  Activity,
  IdCard,
  Phone
} from "lucide-react";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import FunnelAnalytics from "@/components/dashboard/FunnelAnalytics";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import { 
  PaymentMethodBadge, 
  PaymentMethodSimple, 
  PAYMENT_METHOD_OPTIONS,
  getPaymentMethod 
} from "@/lib/paymentMethods";

interface Sale {
  id: string;
  transaction_id: string;
  product_id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_document?: string | null;
  buyer_phone?: string | null;
  amount: number;
  // Taxas detalhadas
  platform_fee: number;
  platform_fee_percent: number;
  payment_fee: number;
  payment_fee_percent: number;
  commission_amount: number;
  affiliate_commission_percent: number;
  net_amount: number;
  // Outros
  payment_method: string;
  status: string;
  created_at: string;
  product_name?: string;
  affiliation_id?: string | null;
  affiliate_name?: string | null;
  // Shipping address fields
  shipping_cep?: string | null;
  shipping_street?: string | null;
  shipping_number?: string | null;
  shipping_complement?: string | null;
  shipping_neighborhood?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
}

const Vendas = () => {
  const { toast } = useToast();
  const { isAdmin, isAdminOrModerator } = useAdminRole();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const itemsPerPage = 10;

  // Fetch sales with realtime subscription
  useEffect(() => {
    fetchSales();

    // Subscribe to realtime sales updates
    const channel = supabase
      .channel('sales-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          console.log('Realtime sale update:', payload);
          // Refresh sales on any change
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: salesData, error } = await supabase
        .from("sales")
        .select("*")
        .eq("seller_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (salesData) {
        // Fetch product names and affiliate info
        const productIds = [...new Set(salesData.map(s => s.product_id))];
        const affiliationIds = [...new Set(salesData.filter(s => s.affiliation_id).map(s => s.affiliation_id))];
        
        const [productsResult, affiliationsResult] = await Promise.all([
          supabase.from("products").select("id, name").in("id", productIds),
          affiliationIds.length > 0 
            ? supabase.from("affiliations").select("id, user_id").in("id", affiliationIds)
            : { data: [] }
        ]);

        // Get affiliate profile names
        const affiliateUserIds = affiliationsResult.data?.map(a => a.user_id) || [];
        const { data: affiliateProfiles } = affiliateUserIds.length > 0
          ? await supabase.from("profiles").select("user_id, full_name").in("user_id", affiliateUserIds)
          : { data: [] };

        const salesWithProducts = salesData.map(sale => {
          const affiliation = affiliationsResult.data?.find(a => a.id === sale.affiliation_id);
          const affiliateProfile = affiliation 
            ? affiliateProfiles?.find(p => p.user_id === affiliation.user_id)
            : null;
          
          return {
            ...sale,
            product_name: productsResult.data?.find(p => p.id === sale.product_id)?.name || "Produto",
            affiliate_name: affiliateProfile?.full_name || null,
          };
        });

        setSales(salesWithProducts);
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.buyer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sale.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
    
    const matchesPaymentMethod = paymentMethodFilter === "all" || sale.payment_method === paymentMethodFilter;
    
    // Affiliate filter
    const matchesAffiliate = affiliateFilter === "all" 
      ? true 
      : affiliateFilter === "direct" 
        ? !sale.affiliation_id 
        : sale.affiliation_id === affiliateFilter;
    
    let matchesDate = true;
    if (dateRange.from) {
      const saleDate = new Date(sale.created_at);
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        matchesDate = saleDate >= fromDate && saleDate <= toDate;
      } else {
        // Only from date selected - filter for that single day
        const endOfDay = new Date(dateRange.from);
        endOfDay.setHours(23, 59, 59, 999);
        matchesDate = saleDate >= fromDate && saleDate <= endOfDay;
      }
    }
    
    return matchesSearch && matchesStatus && matchesPaymentMethod && matchesAffiliate && matchesDate;
  });

  // Get unique affiliates for filter dropdown
  const uniqueAffiliates = [...new Map(
    sales
      .filter(s => s.affiliation_id && s.affiliate_name)
      .map(s => [s.affiliation_id, { id: s.affiliation_id, name: s.affiliate_name }])
  ).values()];

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10">
            <CheckCircle className="w-3 h-3 mr-1" />
            Autorizada
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "retention":
        return (
          <Badge variant="outline" className="text-orange-500 border-orange-500/50 bg-orange-500/10">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Em Retenção
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-red-500 border-red-500/50 bg-red-500/10">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelada
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Removido - agora usando PaymentMethodBadge e PaymentMethodSimple do lib/paymentMethods

  const getStatusLabel = (status: string) => {
    const statuses: Record<string, string> = {
      approved: "Pago / Aprovado",
      pending: "Aguardando Pagamento",
      retention: "Em Retenção",
      cancelled: "Cancelado",
      refused: "Recusado",
      refunded: "Reembolsado",
    };
    return statuses[status] || status;
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsOpen(true);
  };

  // Get today's sales
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.created_at);
    saleDate.setHours(0, 0, 0, 0);
    return saleDate.getTime() === today.getTime();
  });

  // Calculate stats usando os valores do banco de dados (não recalculando)
  const approvedSalesAll = sales.filter(s => s.status === "approved");
  
  // Usar valores do banco ao invés de recalcular
  const totalPlatformFees = approvedSalesAll.reduce((sum, s) => sum + Number(s.platform_fee || 0), 0);
  const totalPaymentFees = approvedSalesAll.reduce((sum, s) => sum + Number(s.payment_fee || 0), 0);
  const totalCommissions = approvedSalesAll.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0);
  const totalNet = approvedSalesAll.reduce((sum, s) => sum + Number(s.net_amount || 0), 0);

  // Taxa de conversão: (aprovadas + retenção) / (total - canceladas/recusadas/reembolsadas)
  const excludedStatuses = ["cancelled", "refused", "refunded"];
  const validSalesCount = sales.filter(s => !excludedStatuses.includes(s.status)).length;
  const convertedSalesCount = sales.filter(s => s.status === "approved" || s.status === "retention").length;
  const conversionRate = validSalesCount > 0 ? (convertedSalesCount / validSalesCount) * 100 : 0;

  const stats = {
    totalApprovedToday: todaySales.filter(s => s.status === "approved").reduce((sum, s) => sum + Number(s.amount), 0),
    totalPendingToday: todaySales.filter(s => s.status === "pending").reduce((sum, s) => sum + Number(s.amount), 0),
    totalRetentionToday: todaySales.filter(s => s.status === "retention").reduce((sum, s) => sum + Number(s.amount), 0),
    totalCancelledToday: todaySales.filter(s => ["cancelled", "refused", "refunded"].includes(s.status)).reduce((sum, s) => sum + Number(s.amount), 0),
    approvedCount: todaySales.filter(s => s.status === "approved").length,
    pendingCount: todaySales.filter(s => s.status === "pending").length,
    retentionCount: todaySales.filter(s => s.status === "retention").length,
    cancelledCount: todaySales.filter(s => ["cancelled", "refused", "refunded"].includes(s.status)).length,
    // Totais usando valores do banco
    totalApproved: approvedSalesAll.reduce((sum, s) => sum + Number(s.amount), 0),
    totalPlatformFees,
    totalPaymentFees,
    totalCommissions,
    totalNet,
    totalFees: totalPlatformFees + totalPaymentFees, // Total de todas as taxas
    conversionRate,
    validSalesCount,
    convertedSalesCount,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovadas hoje ({stats.approvedCount})</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(stats.totalApprovedToday)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/20">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes hoje ({stats.pendingCount})</p>
                <p className="text-2xl font-bold text-yellow-500">{formatCurrency(stats.totalPendingToday)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/20">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em retenção ({stats.retentionCount})</p>
                <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.totalRetentionToday)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/20">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Canceladas hoje ({stats.cancelledCount})</p>
                <p className="text-2xl font-bold text-red-500">{formatCurrency(stats.totalCancelledToday)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards - Total with Fees */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Bruto (aprovadas)</p>
              <p className="text-xl font-bold">{formatCurrency(stats.totalApproved)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 border-green-500/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Valor Líquido Total</p>
              <p className="text-xl font-bold text-green-500">{formatCurrency(stats.totalNet)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 border-blue-500/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">Taxa de Conversão</p>
              <p className="text-xl font-bold text-blue-500">
                {stats.conversionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Header with Date Picker */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Vendas</h1>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="w-4 h-4" />
                {dateRange.from && dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM, yyyy", { locale: ptBR })} - {format(dateRange.to, "dd MMM, yyyy", { locale: ptBR })}
                  </>
                ) : (
                  "Selecionar período"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.from || new Date()}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                  setCurrentPage(1);
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
              {(dateRange.from || dateRange.to) && (
                <div className="p-2 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-muted-foreground"
                    onClick={() => {
                      setDateRange({ from: undefined, to: undefined });
                      setCurrentPage(1);
                    }}
                  >
                    Limpar datas
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por ID, transação ou comprador" 
              className="pl-10 bg-card/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-card/50">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="retention">Em Retenção</SelectItem>
              <SelectItem value="refused">Recusadas</SelectItem>
              <SelectItem value="refunded">Reembolsadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="w-[170px] bg-card/50">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Métodos</SelectItem>
              {PAYMENT_METHOD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.emoji} {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="w-[150px] bg-card/50">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Origens</SelectItem>
              <SelectItem value="direct">Venda Direta</SelectItem>
              {uniqueAffiliates.map(aff => (
                <SelectItem key={aff.id} value={aff.id!}>
                  {aff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => {
              // Export sales data as CSV
              if (filteredSales.length === 0) {
                toast({
                  title: "Nenhum dado para exportar",
                  description: "Não há vendas para exportar com os filtros atuais.",
                  variant: "destructive",
                });
                return;
              }
              
              const headers = ["ID", "Produto", "Comprador", "Data", "Valor Bruto", "Taxas", "Valor Líquido", "Método", "Status"];
              const csvContent = [
                headers.join(","),
                ...filteredSales.map(sale => {
                  const platformFee = Number(sale.platform_fee || 0);
                  const paymentFee = Number(sale.payment_fee || 0);
                  const commissionAmount = Number(sale.commission_amount || 0);
                  const totalFees = platformFee + paymentFee + commissionAmount;
                  const netAmount = Number(sale.net_amount || 0);
                  const date = new Date(sale.created_at).toLocaleDateString("pt-BR");
                  
                  return [
                    sale.transaction_id,
                    `"${sale.product_name}"`,
                    `"${sale.buyer_name}"`,
                    date,
                    sale.amount.toFixed(2),
                    totalFees.toFixed(2),
                    netAmount.toFixed(2),
                    sale.payment_method,
                    sale.status
                  ].join(",");
                })
              ].join("\n");
              
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `vendas_${new Date().toISOString().split("T")[0]}.csv`;
              link.click();
              URL.revokeObjectURL(link.href);
              
              toast({
                title: "Exportação concluída",
                description: `${filteredSales.length} vendas exportadas com sucesso.`,
              });
            }}
          >
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>

        {/* Sales Table */}
        {loading ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        ) : paginatedSales.length === 0 ? (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <ShoppingCart className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Nenhuma venda encontrada</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Quando você realizar sua primeira venda, ela aparecerá aqui com todos os detalhes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card/50 border-border/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border/30">
                  <tr className="text-left text-sm text-muted-foreground">
                    <th className="p-4 font-medium">ID</th>
                    <th className="p-4 font-medium">Produto(s)</th>
                    <th className="p-4 font-medium">Comprador</th>
                    <th className="p-4 font-medium">Data</th>
                    <th className="p-4 font-medium">Valor Bruto</th>
                    <th className="p-4 font-medium">Taxas</th>
                    <th className="p-4 font-medium">Valor Líquido</th>
                    <th className="p-4 font-medium">Método</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => {
                    // Usar valores do banco de dados
                    const platformFee = Number(sale.platform_fee || 0);
                    const paymentFee = Number(sale.payment_fee || 0);
                    const commissionAmount = Number(sale.commission_amount || 0);
                    const totalFees = platformFee + paymentFee + commissionAmount;
                    const netAmount = Number(sale.net_amount || 0);
                    
                    return (
                      <tr key={sale.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-mono text-xs">{sale.transaction_id}</td>
                        <td className="p-4">{sale.product_name}</td>
                        <td className="p-4">{sale.buyer_name}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          <br />
                          <span className="text-xs">às {format(new Date(sale.created_at), "HH:mm", { locale: ptBR })}</span>
                        </td>
                        <td className="p-4 font-medium">{formatCurrency(sale.amount)}</td>
                        <td className="p-4 text-red-400 text-sm">
                          <div className="space-y-0.5">
                            <div>-{formatCurrency(totalFees)}</div>
                            <div className="text-xs text-muted-foreground">
                              {platformFee > 0 && <span>Plat: {formatCurrency(platformFee)}</span>}
                              {paymentFee > 0 && <span className="ml-1">| Pag: {formatCurrency(paymentFee)}</span>}
                              {commissionAmount > 0 && <span className="ml-1">| Afil: {formatCurrency(commissionAmount)}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-green-500">{formatCurrency(netAmount)}</td>
                        <td className="p-4"><PaymentMethodSimple method={sale.payment_method} /></td>
                        <td className="p-4">{getStatusBadge(sale.status)}</td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(sale)}
                            className="gap-1 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="w-4 h-4" />
                            Detalhes
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages || 1} ({filteredSales.length} registro{filteredSales.length !== 1 ? "s" : ""})
          </p>
          <div className="flex items-center gap-1">
            <button 
              className="p-2 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              className="p-2 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-50"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sale Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent" />
                Detalhes da Venda
              </DialogTitle>
            </DialogHeader>
            
            {selectedSale && (
              <div className="space-y-6">
                {/* Product Info */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Produto
                  </h4>
                  <p className="text-foreground">{selectedSale.product_name}</p>
                </div>

                <Separator />

                {/* Buyer Info */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Comprador
                  </h4>
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">{selectedSale.buyer_name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {selectedSale.buyer_email}
                    </p>
                    {selectedSale.buyer_document && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <IdCard className="w-3 h-3" />
                        {selectedSale.buyer_document}
                      </p>
                    )}
                    {selectedSale.buyer_phone && (
                      <a 
                        href={`https://wa.me/55${selectedSale.buyer_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground flex items-center gap-2 hover:text-green-500 transition-colors"
                      >
                        <WhatsAppIcon className="w-3 h-3" />
                        {selectedSale.buyer_phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Shipping Address Section - Only for physical products */}
                {selectedSale.shipping_cep && (
                  <>
                    <Separator />
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" />
                        <span className="text-blue-500">Endereço de Entrega</span>
                        <Badge variant="outline" className="text-blue-500 border-blue-500/50 bg-blue-500/10 ml-auto">
                          <Package className="w-3 h-3 mr-1" />
                          Físico
                        </Badge>
                      </h4>
                      <div className="space-y-1 text-sm">
                        <p className="text-foreground">
                          {selectedSale.shipping_street}, {selectedSale.shipping_number}
                          {selectedSale.shipping_complement && ` - ${selectedSale.shipping_complement}`}
                        </p>
                        <p className="text-muted-foreground">
                          {selectedSale.shipping_neighborhood} - {selectedSale.shipping_city}/{selectedSale.shipping_state}
                        </p>
                        <p className="text-muted-foreground font-mono">
                          CEP: {selectedSale.shipping_cep?.replace(/(\d{5})(\d{3})/, '$1-$2')}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Payment Info - MAIN FEATURE */}
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    {getPaymentMethod(selectedSale.payment_method).icon}
                    <span className="text-accent">Informações de Pagamento</span>
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Forma de pagamento:</span>
                      <PaymentMethodBadge method={selectedSale.payment_method} showFullLabel showIcon />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status do pagamento:</span>
                      {getStatusBadge(selectedSale.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <span className="text-sm font-medium">{getStatusLabel(selectedSale.status)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Date */}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data da venda:</span>
                  <span>
                    {format(new Date(selectedSale.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {/* Admin-only section */}
                {isAdminOrModerator && (
                  <>
                    <Separator />
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-yellow-600">
                        <Shield className="w-4 h-4" />
                        Informações Administrativas
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            ID da Transação:
                          </span>
                          <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                            {selectedSale.transaction_id}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            ID da Venda:
                          </span>
                          <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                            {selectedSale.id}
                          </span>
                        </div>
                        {selectedSale.affiliation_id && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">ID Afiliação:</span>
                            <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">
                              {selectedSale.affiliation_id}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Funnel Analytics */}
        <FunnelAnalytics />
      </div>
    </DashboardLayout>
  );
};

export default Vendas;
