import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Download, FileText, TrendingUp, DollarSign, Users, ShoppingCart, Calendar, Loader2, ArrowUpDown, ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Sale {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_document: string | null;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  product_id: string;
  transaction_id: string;
  commission_amount: number;
  products?: {
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  status: string;
  category: string;
  created_at: string;
}

interface Affiliation {
  id: string;
  status: string;
  created_at: string;
  user_id: string;
  products?: {
    name: string;
  };
}

interface Withdrawal {
  id: string;
  amount: number;
  net_amount: number;
  fee: number;
  status: string;
  created_at: string;
  bank_accounts?: {
    bank_name: string;
  };
}

interface Movement {
  id: string;
  date: string;
  transaction_id: string;
  type: 'sale' | 'withdrawal' | 'chargeback' | 'cancelled';
  previous_balance: number;
  new_balance: number;
  discounts: number;
  value: number;
}

interface AbandonedCart {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  created_at: string;
  recovered: boolean;
  recovered_at: string | null;
  products?: {
    name: string;
  };
}

interface ReportStats {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  conversionRate: number;
}

const Relatorios = () => {
  const [period, setPeriod] = useState("30days");
  const [activeTab, setActiveTab] = useState("relatorios");
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [stats, setStats] = useState<ReportStats>({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const { toast } = useToast();

  const getPeriodDays = (periodValue: string) => {
    switch (periodValue) {
      case "7days": return 7;
      case "30days": return 30;
      case "90days": return 90;
      case "year": return 365;
      case "all": return 9999;
      default: return 30;
    }
  };

  const getDateRange = (periodValue: string) => {
    const days = getPeriodDays(periodValue);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { startDate } = getDateRange(period);
      const startDateStr = startDate.toISOString();

      // Fetch sales with product info
      const { data: salesData } = await supabase
        .from("sales")
        .select("*, products(name)")
        .eq("seller_user_id", user.id)
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: false });

      // Fetch all sales for conversion calculation
      const { data: allSalesData } = await supabase
        .from("sales")
        .select("id, status")
        .eq("seller_user_id", user.id)
        .gte("created_at", startDateStr);

      // Fetch products
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Fetch affiliations
      const { data: affiliationsData } = await supabase
        .from("affiliations")
        .select("*, products(name)")
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: false });

      // Fetch withdrawals
      const { data: withdrawalsData } = await supabase
        .from("withdrawals")
        .select("*, bank_accounts(bank_name)")
        .eq("user_id", user.id)
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: false });

      // Fetch abandoned carts
      const { data: abandonedCartsData } = await supabase
        .from("abandoned_carts")
        .select("*, products(name)")
        .eq("seller_user_id", user.id)
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: false });

      setSales(salesData || []);
      setProducts(productsData || []);
      setAffiliations(affiliationsData || []);
      setAbandonedCarts((abandonedCartsData as AbandonedCart[]) || []);

      // Generate movements from sales and withdrawals
      const generatedMovements: Movement[] = [];
      let runningBalance = 0;

      // Combine and sort by date
      const allTransactions = [
        ...(salesData || []).map(sale => ({
          ...sale,
          type: sale.status === 'approved' ? 'sale' : sale.status === 'cancelled' ? 'cancelled' : 'sale',
          sortDate: new Date(sale.created_at)
        })),
        ...(withdrawalsData || []).map(withdrawal => ({
          ...withdrawal,
          type: 'withdrawal',
          sortDate: new Date(withdrawal.created_at)
        }))
      ].sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

      allTransactions.forEach((tx, index) => {
        const previousBalance = runningBalance;
        let value = 0;
        let discounts = 0;
        let type: Movement['type'] = 'sale';

        if ('buyer_name' in tx) {
          // It's a sale
          const sale = tx as Sale;
          if (sale.status === 'approved') {
            value = sale.amount - sale.commission_amount;
            discounts = sale.commission_amount;
            type = 'sale';
            runningBalance += value;
          } else if (sale.status === 'cancelled') {
            value = -(sale.amount - sale.commission_amount);
            type = 'cancelled';
            runningBalance += value;
          }
        } else {
          // It's a withdrawal
          const withdrawal = tx as Withdrawal;
          value = -withdrawal.net_amount;
          discounts = withdrawal.fee;
          type = 'withdrawal';
          runningBalance += value;
        }

        generatedMovements.push({
          id: tx.id,
          date: tx.created_at,
          transaction_id: 'transaction_id' in tx ? tx.transaction_id : tx.id.substring(0, 20),
          type,
          previous_balance: previousBalance,
          new_balance: runningBalance,
          discounts,
          value: Math.abs(value) * (value < 0 ? -1 : 1)
        });
      });

      // Reverse to show newest first
      setMovements(generatedMovements.reverse());

      // Calculate stats
      const approvedSales = (salesData || []).filter(s => s.status === 'approved');
      const totalRevenue = approvedSales.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalSales = approvedSales.length;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      
      // Conversion rate: approved sales / all sales attempts
      const allSalesCount = (allSalesData || []).length;
      const conversionRate = allSalesCount > 0 ? (totalSales / allSalesCount) * 100 : 0;

      setStats({
        totalRevenue,
        totalSales,
        averageTicket,
        conversionRate,
      });

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const generateCSV = (data: any[], headers: string[], filename: string) => {
    const csvContent = [
      headers.join(";"),
      ...data.map(row => headers.map(header => {
        const value = row[header] ?? "";
        const stringValue = String(value).replace(/"/g, '""');
        return stringValue.includes(";") ? `"${stringValue}"` : stringValue;
      }).join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSalesReport = async () => {
    setDownloadingReport("vendas");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { startDate } = getDateRange(period);
      const { data } = await supabase
        .from("sales")
        .select("*, products(name)")
        .eq("seller_user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        toast({
          title: "Sem dados",
          description: "Não há vendas no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const reportData = data.map(sale => ({
        "Data": formatDate(sale.created_at),
        "Produto": sale.products?.name || "N/A",
        "Comprador": sale.buyer_name,
        "Email": sale.buyer_email,
        "Documento": sale.buyer_document || "N/A",
        "Valor": formatCurrency(sale.amount),
        "Método de Pagamento": sale.payment_method,
        "Status": sale.status === 'approved' ? 'Aprovado' : sale.status === 'pending' ? 'Pendente' : sale.status,
      }));

      generateCSV(reportData, Object.keys(reportData[0]), `relatorio-vendas-${new Date().toISOString().split('T')[0]}.csv`);
      
      toast({
        title: "Download iniciado!",
        description: "Seu relatório de vendas está sendo baixado.",
      });
    } finally {
      setDownloadingReport(null);
    }
  };

  const downloadAffiliatesReport = async () => {
    setDownloadingReport("afiliados");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProducts } = await supabase
        .from("products")
        .select("id")
        .eq("user_id", user.id);

      if (!userProducts || userProducts.length === 0) {
        toast({
          title: "Sem dados",
          description: "Você não possui produtos com afiliados.",
          variant: "destructive",
        });
        return;
      }

      const productIds = userProducts.map(p => p.id);
      const { startDate } = getDateRange(period);
      
      const { data } = await supabase
        .from("affiliations")
        .select("*, products(name)")
        .in("product_id", productIds)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        toast({
          title: "Sem dados",
          description: "Não há afiliações no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const { data: affiliateSales } = await supabase
        .from("affiliate_sales")
        .select("*")
        .eq("owner_user_id", user.id);

      const reportData = data.map(aff => {
        const sales = (affiliateSales || []).filter(s => s.affiliation_id === aff.id);
        const totalSales = sales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
        const totalCommission = sales.reduce((sum, s) => sum + Number(s.commission_amount), 0);

        return {
          "Data de Afiliação": formatDate(aff.created_at),
          "Produto": aff.products?.name || "N/A",
          "Status": aff.status === 'approved' ? 'Aprovado' : aff.status === 'pending' ? 'Pendente' : aff.status,
          "Total de Vendas": formatCurrency(totalSales),
          "Comissões Geradas": formatCurrency(totalCommission),
        };
      });

      generateCSV(reportData, Object.keys(reportData[0]), `relatorio-afiliados-${new Date().toISOString().split('T')[0]}.csv`);
      
      toast({
        title: "Download iniciado!",
        description: "Seu relatório de afiliados está sendo baixado.",
      });
    } finally {
      setDownloadingReport(null);
    }
  };

  const downloadProductsReport = async () => {
    setDownloadingReport("produtos");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        toast({
          title: "Sem dados",
          description: "Você não possui produtos cadastrados.",
          variant: "destructive",
        });
        return;
      }

      const { data: salesData } = await supabase
        .from("sales")
        .select("product_id, amount, status")
        .eq("seller_user_id", user.id);

      const reportData = data.map(product => {
        const productSales = (salesData || []).filter(s => s.product_id === product.id && s.status === 'approved');
        const totalRevenue = productSales.reduce((sum, s) => sum + Number(s.amount), 0);

        return {
          "Nome": product.name,
          "Categoria": product.category,
          "Preço": formatCurrency(product.price),
          "Status": product.status === 'active' ? 'Ativo' : product.status === 'draft' ? 'Rascunho' : product.status,
          "Vendas": productSales.length,
          "Receita Total": formatCurrency(totalRevenue),
          "Criado em": formatDate(product.created_at),
        };
      });

      generateCSV(reportData, Object.keys(reportData[0]), `relatorio-produtos-${new Date().toISOString().split('T')[0]}.csv`);
      
      toast({
        title: "Download iniciado!",
        description: "Seu relatório de produtos está sendo baixado.",
      });
    } finally {
      setDownloadingReport(null);
    }
  };

  const downloadFinancialReport = async () => {
    setDownloadingReport("financeiro");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { startDate } = getDateRange(period);

      const { data: salesData } = await supabase
        .from("sales")
        .select("*, products(name)")
        .eq("seller_user_id", user.id)
        .eq("status", "approved")
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      const { data: withdrawalsData } = await supabase
        .from("withdrawals")
        .select("*, bank_accounts(bank_name)")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });

      if ((!salesData || salesData.length === 0) && (!withdrawalsData || withdrawalsData.length === 0)) {
        toast({
          title: "Sem dados",
          description: "Não há movimentações no período selecionado.",
          variant: "destructive",
        });
        return;
      }

      const transactions: any[] = [];

      (salesData || []).forEach(sale => {
        transactions.push({
          "Data": formatDate(sale.created_at),
          "Tipo": "Entrada",
          "Descrição": `Venda: ${sale.products?.name || 'Produto'}`,
          "Comprador": sale.buyer_name,
          "Valor Bruto": formatCurrency(sale.amount),
          "Comissão": formatCurrency(sale.commission_amount),
          "Valor Líquido": formatCurrency(sale.amount - sale.commission_amount),
        });
      });

      (withdrawalsData || []).forEach(withdrawal => {
        transactions.push({
          "Data": formatDate(withdrawal.created_at),
          "Tipo": "Saída",
          "Descrição": `Saque: ${withdrawal.bank_accounts?.bank_name || 'Conta'}`,
          "Comprador": "-",
          "Valor Bruto": formatCurrency(withdrawal.amount),
          "Comissão": formatCurrency(withdrawal.fee),
          "Valor Líquido": formatCurrency(withdrawal.net_amount),
        });
      });

      transactions.sort((a, b) => new Date(b["Data"]).getTime() - new Date(a["Data"]).getTime());

      generateCSV(transactions, Object.keys(transactions[0]), `relatorio-financeiro-${new Date().toISOString().split('T')[0]}.csv`);
      
      toast({
        title: "Download iniciado!",
        description: "Seu relatório financeiro está sendo baixado.",
      });
    } finally {
      setDownloadingReport(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMovementTypeLabel = (type: Movement['type']) => {
    switch (type) {
      case 'sale': return 'Venda';
      case 'withdrawal': return 'Retirada';
      case 'chargeback': return 'Multa por chargeback';
      case 'cancelled': return 'Venda cancelada';
    }
  };

  const reportTypes = [
    { 
      id: "vendas",
      icon: DollarSign, 
      title: "Relatório de Vendas", 
      description: "Análise completa das suas vendas",
      color: "text-green-500",
      bg: "bg-green-500/10",
      onClick: downloadSalesReport
    },
    { 
      id: "afiliados",
      icon: Users, 
      title: "Relatório de Afiliados", 
      description: "Performance do seu time de afiliados",
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      onClick: downloadAffiliatesReport
    },
    { 
      id: "produtos",
      icon: ShoppingCart, 
      title: "Relatório de Produtos", 
      description: "Desempenho dos seus produtos",
      color: "text-accent",
      bg: "bg-accent/10",
      onClick: downloadProductsReport
    },
    { 
      id: "financeiro",
      icon: TrendingUp, 
      title: "Relatório Financeiro", 
      description: "Fluxo de caixa e receitas",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      onClick: downloadFinancialReport
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Analise seus dados e exporte relatórios
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px] bg-secondary/40 border-border/40 hover:border-accent/40 transition-colors">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Últimos 7 dias</SelectItem>
                <SelectItem value="30days">Últimos 30 dias</SelectItem>
                <SelectItem value="90days">Últimos 90 dias</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
                <SelectItem value="all">Todo o período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-transparent border-b border-border/40 rounded-none w-full justify-start h-auto p-0 gap-0">
            <TabsTrigger 
              value="relatorios" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-accent/5 data-[state=active]:text-accent px-5 py-3 text-sm font-medium transition-all"
            >
              <FileText className="w-4 h-4 mr-2" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger 
              value="movimentacoes" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-accent/5 data-[state=active]:text-accent px-5 py-3 text-sm font-medium transition-all"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Movimentações
            </TabsTrigger>
            <TabsTrigger 
              value="carrinhos" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-accent/5 data-[state=active]:text-accent px-5 py-3 text-sm font-medium transition-all"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Carrinhos Abandonados
            </TabsTrigger>
          </TabsList>

          {/* Relatórios Tab */}
          <TabsContent value="relatorios" className="space-y-6">
            {/* Report Types - 2x2 Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportTypes.map((report) => (
                <Card 
                  key={report.id} 
                  className="bg-card/80 border-border/40 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300 cursor-pointer group backdrop-blur-sm"
                  onClick={report.onClick}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3.5 rounded-xl ${report.bg} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                        <report.icon className={`w-6 h-6 ${report.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1.5 group-hover:text-accent transition-colors">{report.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{report.description}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent/10 hover:text-accent"
                        disabled={downloadingReport === report.id}
                      >
                        {downloadingReport === report.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Summary - Period Metrics */}
            <Card className="bg-card/80 border-border/40 shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <BarChart3 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Resumo do Período</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">Métricas consolidadas do período selecionado</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="relative overflow-hidden text-center p-5 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-accent/10 rounded-full blur-2xl" />
                      <p className="text-2xl font-bold text-accent">{formatCurrency(stats.totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground mt-2 font-medium">Receita Total</p>
                    </div>
                    <div className="text-center p-5 rounded-xl bg-secondary/30 border border-border/30">
                      <p className="text-2xl font-bold text-foreground">{stats.totalSales}</p>
                      <p className="text-xs text-muted-foreground mt-2 font-medium">Total de Vendas</p>
                    </div>
                    <div className="text-center p-5 rounded-xl bg-secondary/30 border border-border/30">
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.averageTicket)}</p>
                      <p className="text-xs text-muted-foreground mt-2 font-medium">Ticket Médio</p>
                    </div>
                    <div className="text-center p-5 rounded-xl bg-secondary/30 border border-border/30">
                      <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground mt-2 font-medium">Conversão</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Sales Table */}
            <Card className="bg-card/80 border-border/40 shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Últimas Vendas</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Informações do Comprador</p>
                    </div>
                  </div>
                  {sales.length > 0 && (
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                      {sales.length} venda{sales.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  </div>
                ) : sales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative p-5 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50">
                        <BarChart3 className="w-10 h-10 text-muted-foreground/60" strokeWidth={1.5} />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Nenhuma venda</h3>
                    <p className="text-muted-foreground text-sm text-center max-w-sm leading-relaxed">
                      Realize vendas para ver os dados dos compradores aqui.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 bg-muted/20 hover:bg-muted/20">
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Data</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Comprador</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Email</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Documento</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Produto</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Valor</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sales.slice(0, 10).map((sale, index) => (
                          <TableRow 
                            key={sale.id} 
                            className={`border-border/20 hover:bg-muted/30 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                          >
                            <TableCell className="text-sm text-muted-foreground">{formatDate(sale.created_at)}</TableCell>
                            <TableCell className="font-medium text-foreground">{sale.buyer_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{sale.buyer_email}</TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">{sale.buyer_document || "-"}</TableCell>
                            <TableCell className="text-sm text-foreground">{sale.products?.name || "N/A"}</TableCell>
                            <TableCell className="font-semibold text-accent">{formatCurrency(sale.amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize bg-secondary/50">
                                {sale.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {sales.length > 10 && (
                      <div className="p-4 border-t border-border/30 bg-muted/10">
                        <p className="text-xs text-muted-foreground text-center">
                          Mostrando 10 de {sales.length} vendas. 
                          <button 
                            onClick={downloadSalesReport}
                            className="text-accent hover:underline ml-1 font-medium"
                          >
                            Baixe o relatório completo
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Movimentações Tab */}
          <TabsContent value="movimentacoes" className="space-y-6">
            <Card className="bg-card/80 border-border/40 shadow-xl shadow-black/10 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
                      <ArrowUpDown className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-foreground">Movimentações</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Histórico completo de entradas e saídas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {movements.length > 0 && (
                      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 px-3 py-1">
                        {movements.length} registro{movements.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  // Skeleton loader
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-7 gap-4 mb-4">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted/40 rounded animate-pulse" />
                      ))}
                    </div>
                    {[...Array(5)].map((_, rowIndex) => (
                      <div key={rowIndex} className={`grid grid-cols-7 gap-4 py-4 ${rowIndex % 2 === 1 ? 'bg-muted/10' : ''} rounded-lg`}>
                        {[...Array(7)].map((_, colIndex) => (
                          <div 
                            key={colIndex} 
                            className={`h-5 bg-muted/30 rounded animate-pulse ${colIndex === 6 ? 'w-20 ml-auto' : ''}`} 
                            style={{ animationDelay: `${(rowIndex * 7 + colIndex) * 50}ms` }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : movements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 px-6">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl animate-pulse" />
                      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 shadow-lg">
                        <ArrowUpDown className="w-12 h-12 text-muted-foreground/50" strokeWidth={1.5} />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Nenhuma movimentação encontrada</h3>
                    <p className="text-muted-foreground text-sm text-center max-w-md leading-relaxed">
                      Nenhuma movimentação encontrada para o período selecionado. Suas entradas e saídas aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 bg-muted/20 hover:bg-muted/20">
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground pl-6">Data</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">ID da transação</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Tipo de operação</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">Saldo anterior</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">Saldo posterior</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">Descontos</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right pr-6">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((movement, index) => (
                          <TableRow 
                            key={movement.id} 
                            className={`border-border/20 hover:bg-accent/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                          >
                            <TableCell className="text-sm text-muted-foreground pl-6 whitespace-nowrap">
                              {formatDate(movement.date)}
                            </TableCell>
                            <TableCell className="text-sm font-mono text-muted-foreground/80">
                              <span className="px-2 py-1 bg-muted/30 rounded text-xs">
                                {movement.transaction_id.substring(0, 8).toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-lg ${
                                  movement.type === 'sale' 
                                    ? 'bg-green-500/15' 
                                    : movement.type === 'withdrawal' 
                                      ? 'bg-red-500/15' 
                                      : 'bg-yellow-500/15'
                                }`}>
                                  {movement.type === 'sale' ? (
                                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                                  ) : movement.type === 'withdrawal' ? (
                                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                                  ) : (
                                    <ArrowUpRight className="w-4 h-4 text-yellow-500" />
                                  )}
                                </div>
                                <span className="text-sm text-foreground font-medium">
                                  {getMovementTypeLabel(movement.type)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground text-right font-mono">
                              {formatCurrency(movement.previous_balance)}
                            </TableCell>
                            <TableCell className="text-sm text-foreground text-right font-mono font-medium">
                              {formatCurrency(movement.new_balance)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground text-right font-mono">
                              {movement.discounts > 0 ? `-${formatCurrency(movement.discounts)}` : formatCurrency(0)}
                            </TableCell>
                            <TableCell className={`text-right pr-6 font-semibold font-mono ${
                              movement.value >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg ${
                                movement.value >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                              }`}>
                                {movement.value >= 0 ? '+' : ''}{formatCurrency(movement.value)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Carrinhos Abandonados Tab */}
          <TabsContent value="carrinhos" className="space-y-6">
            <Card className="bg-card/80 border-border/40 shadow-xl shadow-black/10 backdrop-blur-sm rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-border/30 pb-5 pt-6 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5">
                      <ShoppingCart className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold text-foreground tracking-tight">Carrinhos Abandonados</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Oportunidades de recuperação de vendas</p>
                    </div>
                  </div>
                  {abandonedCarts.length > 0 && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 px-4 py-1.5 text-sm font-medium">
                      {abandonedCarts.length} carrinho{abandonedCarts.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  // Skeleton loader
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-7 gap-4 mb-4">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted/40 rounded animate-pulse" />
                      ))}
                    </div>
                    {[...Array(4)].map((_, rowIndex) => (
                      <div key={rowIndex} className={`grid grid-cols-7 gap-4 py-4 ${rowIndex % 2 === 1 ? 'bg-muted/10' : ''} rounded-lg`}>
                        {[...Array(7)].map((_, colIndex) => (
                          <div 
                            key={colIndex} 
                            className={`h-5 bg-muted/30 rounded animate-pulse ${colIndex === 5 ? 'w-24' : ''}`} 
                            style={{ animationDelay: `${(rowIndex * 7 + colIndex) * 50}ms` }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : abandonedCarts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 px-6">
                    <div className="relative mb-8">
                      {/* Glow effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/20 rounded-full blur-2xl scale-150 animate-pulse" />
                      {/* Icon container */}
                      <div className="relative p-7 rounded-2xl bg-gradient-to-br from-muted/90 to-muted/50 border border-border/60 shadow-2xl shadow-black/20">
                        <ShoppingCart className="w-14 h-14 text-muted-foreground/50" strokeWidth={1.2} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold mb-3 text-foreground tracking-tight">Nenhum carrinho abandonado</h3>
                    <p className="text-muted-foreground text-base text-center max-w-md leading-relaxed">
                      Quando clientes abandonarem carrinhos de compra, eles aparecerão aqui para você acompanhar.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 bg-muted/20 hover:bg-muted/20">
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground pl-6">Data</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Cliente</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Email</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Telefone</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Produto</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">Valor</TableHead>
                          <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right pr-6">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abandonedCarts.map((cart, index) => (
                          <TableRow 
                            key={cart.id} 
                            className={`border-border/20 hover:bg-accent/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                          >
                            <TableCell className="text-sm text-muted-foreground pl-6 whitespace-nowrap">{formatDate(cart.created_at)}</TableCell>
                            <TableCell className="font-medium text-foreground">{cart.customer_name || "Não informado"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{cart.customer_email || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">{cart.customer_phone || "-"}</TableCell>
                            <TableCell className="text-sm text-foreground">{cart.products?.name || "N/A"}</TableCell>
                            <TableCell className="font-semibold text-accent text-right font-mono">{formatCurrency(cart.amount)}</TableCell>
                            <TableCell className="text-right pr-6">
                              {cart.recovered ? (
                                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 hover:bg-green-500/20">
                                  Recuperado
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/20">
                                  Abandonado
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {abandonedCarts.length > 10 && (
                      <div className="p-4 border-t border-border/30 bg-muted/10">
                        <p className="text-xs text-muted-foreground text-center">
                          Mostrando {abandonedCarts.length} carrinhos abandonados
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Relatorios;
