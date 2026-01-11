import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Users, ShoppingCart, Wallet, TrendingUp, Package } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminRelatorios = () => {
  const [period, setPeriod] = useState("30days");
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsers: 0,
    totalProducts: 0,
    newProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
    approvedWithdrawals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "7days":
        return { start: subDays(now, 7), end: now };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "90days":
        return { start: subDays(now, 90), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startDate = start.toISOString();
      const endDate = end.toISOString();

      const [
        { count: totalUsers },
        { count: newUsers },
        { count: totalProducts },
        { count: newProducts },
        { data: salesData },
        { data: withdrawalsData },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("sales").select("amount, status").gte("created_at", startDate).lte("created_at", endDate),
        supabase.from("withdrawals").select("amount, status").gte("created_at", startDate).lte("created_at", endDate),
      ]);

      const totalRevenue = salesData?.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.amount), 0) || 0;
      const totalWithdrawals = withdrawalsData?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;
      const pendingWithdrawals = withdrawalsData?.filter(w => w.status === 'pending').length || 0;
      const approvedWithdrawals = withdrawalsData?.filter(w => w.status === 'approved').length || 0;

      setStats({
        totalUsers: totalUsers || 0,
        newUsers: newUsers || 0,
        totalProducts: totalProducts || 0,
        newProducts: newProducts || 0,
        totalSales: salesData?.length || 0,
        totalRevenue,
        totalWithdrawals,
        pendingWithdrawals,
        approvedWithdrawals,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Erro ao carregar relatórios");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async (type: string) => {
    try {
      const { start, end } = getDateRange();
      let data: any[] = [];
      let filename = "";

      switch (type) {
        case "users":
          const { data: usersData } = await supabase
            .from("profiles")
            .select("*")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());
          data = usersData || [];
          filename = "usuarios";
          break;
        case "products":
          const { data: productsData } = await supabase
            .from("products")
            .select("*")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());
          data = productsData || [];
          filename = "produtos";
          break;
        case "sales":
          const { data: salesData } = await supabase
            .from("sales")
            .select("*")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());
          data = salesData || [];
          filename = "vendas";
          break;
        case "withdrawals":
          const { data: withdrawalsData } = await supabase
            .from("withdrawals")
            .select("*")
            .gte("created_at", start.toISOString())
            .lte("created_at", end.toISOString());
          data = withdrawalsData || [];
          filename = "saques";
          break;
      }

      if (data.length === 0) {
        toast.error("Nenhum dado para exportar");
        return;
      }

      const headers = Object.keys(data[0]).join(",");
      const rows = data.map(row => Object.values(row).join(",")).join("\n");
      const csv = `${headers}\n${rows}`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      toast.success("Relatório exportado com sucesso");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Erro ao exportar relatório");
    }
  };

  const statCards = [
    { title: "Total de Usuários", value: stats.totalUsers, subValue: `+${stats.newUsers} novos`, icon: Users, color: "text-blue-500" },
    { title: "Total de Produtos", value: stats.totalProducts, subValue: `+${stats.newProducts} novos`, icon: Package, color: "text-purple-500" },
    { title: "Vendas no Período", value: stats.totalSales, subValue: formatCurrency(stats.totalRevenue), icon: ShoppingCart, color: "text-green-500" },
    { title: "Saques no Período", value: stats.pendingWithdrawals + stats.approvedWithdrawals, subValue: `${stats.pendingWithdrawals} pendentes`, icon: Wallet, color: "text-orange-500" },
  ];

  const exportOptions = [
    { label: "Exportar Usuários", type: "users", icon: Users },
    { label: "Exportar Produtos", type: "products", icon: Package },
    { label: "Exportar Vendas", type: "sales", icon: ShoppingCart },
    { label: "Exportar Saques", type: "withdrawals", icon: Wallet },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
            <p className="text-muted-foreground">Visualize métricas e exporte dados da plataforma</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="thisMonth">Este mês</SelectItem>
              <SelectItem value="lastMonth">Mês passado</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
                <p className="text-xs text-muted-foreground">{loading ? "..." : stat.subValue}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Exportar Relatórios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {exportOptions.map((option) => (
                <Button
                  key={option.type}
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => handleExportCSV(option.type)}
                >
                  <option.icon className="h-6 w-6" />
                  <span>{option.label}</span>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span>Receita Total no Período</span>
                </div>
                <span className="font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-orange-500" />
                  <span>Total em Saques</span>
                </div>
                <span className="font-bold text-orange-600">{formatCurrency(stats.totalWithdrawals)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ticket Médio</span>
                <span className="font-medium">
                  {stats.totalSales > 0 ? formatCurrency(stats.totalRevenue / stats.totalSales) : formatCurrency(0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Crescimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Novos usuários no período</span>
                <span className="font-medium text-blue-600">+{stats.newUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Novos produtos no período</span>
                <span className="font-medium text-purple-600">+{stats.newProducts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saques aprovados</span>
                <span className="font-medium text-green-600">{stats.approvedWithdrawals}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saques pendentes</span>
                <span className="font-medium text-yellow-600">{stats.pendingWithdrawals}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRelatorios;
