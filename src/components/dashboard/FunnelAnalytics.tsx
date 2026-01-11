import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Eye,
  ArrowDown,
  Loader2,
  BarChart3,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FunnelStats {
  checkoutCompleted: number;
  upsellViewed: number;
  upsellAccepted: number;
  upsellDeclined: number;
  downsellViewed: number;
  downsellAccepted: number;
  downsellDeclined: number;
  upsellRevenue: number;
  downsellRevenue: number;
  totalRevenue: number;
}

interface FunnelOrder {
  id: string;
  order_type: string;
  amount: number;
  status: string;
  created_at: string;
  product: { name: string } | null;
}

const FunnelAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<FunnelStats>({
    checkoutCompleted: 0,
    upsellViewed: 0,
    upsellAccepted: 0,
    upsellDeclined: 0,
    downsellViewed: 0,
    downsellAccepted: 0,
    downsellDeclined: 0,
    upsellRevenue: 0,
    downsellRevenue: 0,
    totalRevenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<FunnelOrder[]>([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = startOfDay(subDays(new Date(), parseInt(period)));
      const endDate = endOfDay(new Date());

      // Fetch funnel events for this seller's products
      const { data: userProducts } = await supabase
        .from("products")
        .select("id")
        .eq("user_id", user.id);

      const productIds = userProducts?.map(p => p.id) || [];

      // Fetch funnel events
      const { data: events } = await supabase
        .from("sales_funnel_events")
        .select("step, action, amount, sale_id")
        .in("product_id", productIds.length > 0 ? productIds : ['none'])
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Fetch ALL funnel orders for this seller (for counting)
      const { data: allOrders } = await supabase
        .from("funnel_orders")
        .select("id, order_type, amount, net_amount, status, created_at, buyer_name, buyer_email, product:product_id(name)")
        .eq("seller_user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      // Fetch completed checkouts (approved sales) for this seller
      const { count: checkoutCount } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("seller_user_id", user.id)
        .eq("status", "approved")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      // Calculate stats
      const newStats: FunnelStats = {
        checkoutCompleted: checkoutCount || 0,
        upsellViewed: 0,
        upsellAccepted: 0,
        upsellDeclined: 0,
        downsellViewed: 0,
        downsellAccepted: 0,
        downsellDeclined: 0,
        upsellRevenue: 0,
        downsellRevenue: 0,
        totalRevenue: 0,
      };

      // Count from events
      events?.forEach((event) => {
        if (event.step === "upsell") {
          if (event.action === "viewed") newStats.upsellViewed++;
          if (event.action === "accepted") newStats.upsellAccepted++;
          if (event.action === "declined") newStats.upsellDeclined++;
        }
        if (event.step === "downsell") {
          if (event.action === "viewed") newStats.downsellViewed++;
          if (event.action === "accepted") newStats.downsellAccepted++;
          if (event.action === "declined") newStats.downsellDeclined++;
        }
      });

      // Count and sum from funnel_orders (primary source for revenue)
      const approvedUpsells = allOrders?.filter(o => o.order_type === "upsell" && o.status === "approved") || [];
      const approvedDownsells = allOrders?.filter(o => o.order_type === "downsell" && o.status === "approved") || [];
      
      // If events don't have data, use orders for counts
      if (newStats.upsellAccepted === 0) {
        newStats.upsellAccepted = approvedUpsells.length;
      }
      if (newStats.downsellAccepted === 0) {
        newStats.downsellAccepted = approvedDownsells.length;
      }

      // Calculate revenue from orders
      newStats.upsellRevenue = approvedUpsells.reduce((sum, o) => sum + (o.net_amount || o.amount || 0), 0);
      newStats.downsellRevenue = approvedDownsells.reduce((sum, o) => sum + (o.net_amount || o.amount || 0), 0);
      newStats.totalRevenue = newStats.upsellRevenue + newStats.downsellRevenue;

      // Use checkout count as base for viewed if not available
      if (newStats.upsellViewed === 0 && newStats.checkoutCompleted > 0) {
        newStats.upsellViewed = newStats.checkoutCompleted;
      }

      setStats(newStats);
      setRecentOrders(allOrders?.slice(0, 10) || []);
    } catch (error) {
      console.error("Error fetching funnel stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Taxas com 2 casas decimais
  const upsellRate = useMemo(() => {
    if (stats.upsellViewed === 0) return 0;
    return Number(((stats.upsellAccepted / stats.upsellViewed) * 100).toFixed(2));
  }, [stats]);

  const downsellRate = useMemo(() => {
    if (stats.downsellViewed === 0) return 0;
    return Number(((stats.downsellAccepted / stats.downsellViewed) * 100).toFixed(2));
  }, [stats]);

  // Funnel data for chart
  const funnelData = [
    { name: "Checkout Aprovado", value: stats.checkoutCompleted, fill: "hsl(var(--primary))" },
    { name: "Upsell Visualizado", value: stats.upsellViewed, fill: "hsl(142, 76%, 36%)" },
    { name: "Upsell Aceito", value: stats.upsellAccepted, fill: "hsl(142, 76%, 46%)" },
    { name: "Downsell Visualizado", value: stats.downsellViewed, fill: "hsl(45, 93%, 47%)" },
    { name: "Downsell Aceito", value: stats.downsellAccepted, fill: "hsl(45, 93%, 57%)" },
  ].filter((d) => d.value > 0);

  // Bar chart data
  const barData = [
    { name: "Upsell", visualizado: stats.upsellViewed, aceito: stats.upsellAccepted, recusado: stats.upsellDeclined },
    { name: "Downsell", visualizado: stats.downsellViewed, aceito: stats.downsellAccepted, recusado: stats.downsellDeclined },
  ];

  // Pie chart for revenue
  const revenueData = [
    { name: "Upsell", value: stats.upsellRevenue, fill: "hsl(142, 76%, 46%)" },
    { name: "Downsell", value: stats.downsellRevenue, fill: "hsl(45, 93%, 47%)" },
  ].filter((d) => d.value > 0);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="h-6 w-64 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-[180px] bg-muted rounded animate-pulse" />
        </div>
        {/* Skeleton Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-2 bg-muted rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-5 w-48 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics do Funil Pós-Compra
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe as conversões de upsell e downsell
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Extra</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Upsell</p>
                <p className="text-xl font-bold">{upsellRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Downsell</p>
                <p className="text-xl font-bold">{downsellRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Extra</p>
                <p className="text-xl font-bold">{stats.upsellAccepted + stats.downsellAccepted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Visualization */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Checkout Aprovado", value: stats.checkoutCompleted, color: "bg-primary" },
                { label: "Upsell Visualizado", value: stats.upsellViewed, color: "bg-green-500" },
                { label: "Upsell Aceito", value: stats.upsellAccepted, color: "bg-green-600" },
                { label: "Downsell Visualizado", value: stats.downsellViewed, color: "bg-amber-500" },
                { label: "Downsell Aceito", value: stats.downsellAccepted, color: "bg-amber-600" },
              ].map((item, idx) => {
                const maxValue = stats.checkoutCompleted || 1;
                const percentage = Math.round((item.value / maxValue) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Conversion Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visualizações vs Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="visualizado" name="Visualizado" fill="hsl(var(--muted))" />
                  <Bar dataKey="aceito" name="Aceito" fill="hsl(142, 76%, 46%)" />
                  <Bar dataKey="recusado" name="Recusado" fill="hsl(0, 84%, 60%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {revenueData.length > 0 ? (
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {revenueData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 w-48 flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Upsell</p>
                    <p className="font-semibold">{formatCurrency(stats.upsellRevenue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Downsell</p>
                    <p className="font-semibold">{formatCurrency(stats.downsellRevenue)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos Recentes do Funil</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          order.status === "approved"
                            ? "bg-green-500/10"
                            : "bg-amber-500/10"
                        }`}
                      >
                        {order.status === "approved" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{order.order_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.product?.name || "Produto"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(order.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum pedido do funil ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FunnelAnalytics;
