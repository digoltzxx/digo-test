import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingCart, TrendingUp, CircleDollarSign, Clock } from "lucide-react";
import { usePeriodSalesStats } from "@/hooks/usePeriodSalesStats";
import SalesMetricsFilters from "@/components/dashboard/SalesMetricsFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface AdminStatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  loading?: boolean;
}

const AdminStatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  iconBg, 
  valueColor = "text-foreground",
  loading 
}: AdminStatCardProps) => (
  <Card className="bg-card border-border">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <>
              <p className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </>
          )}
        </div>
        <div className={`p-3 rounded-full ${iconBg}`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const AdminSalesMetrics = () => {
  const {
    stats,
    filters,
    products,
    periodLabel,
    setPeriod,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
  } = usePeriodSalesStats({ isAdmin: true });

  const avgTicket = stats.approvedCount > 0 
    ? stats.approvedAmount / stats.approvedCount 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Métricas de vendas</h2>
          <p className="text-sm text-muted-foreground">
            Visualização: <span className="text-primary font-medium">{periodLabel}</span>
            {(filters.productId || filters.paymentMethod) && (
              <span className="text-muted-foreground"> • com filtros ativos</span>
            )}
          </p>
        </div>
        <SalesMetricsFilters
          period={filters.period}
          productId={filters.productId}
          paymentMethod={filters.paymentMethod}
          products={products}
          onPeriodChange={setPeriod}
          onProductChange={setProductFilter}
          onPaymentMethodChange={setPaymentMethodFilter}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminStatCard
          title="Total de vendas"
          value={String(stats.totalCount)}
          subtitle={`${stats.approvedCount} aprovadas`}
          icon={<ShoppingCart className="h-5 w-5 text-primary" />}
          iconBg="bg-primary/10"
          loading={stats.loading}
        />
        <AdminStatCard
          title="Receita aprovada"
          value={formatCurrency(stats.approvedAmount)}
          subtitle={periodLabel}
          icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          valueColor="text-emerald-400"
          loading={stats.loading}
        />
        <AdminStatCard
          title="Pendentes"
          value={formatCurrency(stats.pendingAmount)}
          subtitle={`${stats.pendingCount} aguardando`}
          icon={<Clock className="h-5 w-5 text-yellow-400" />}
          iconBg="bg-yellow-500/10"
          valueColor="text-yellow-400"
          loading={stats.loading}
        />
        <AdminStatCard
          title="Reembolsados"
          value={formatCurrency(stats.refundedAmount)}
          subtitle={`${stats.refundedCount} vendas`}
          icon={<DollarSign className="h-5 w-5 text-red-400" />}
          iconBg="bg-red-500/10"
          valueColor="text-red-400"
          loading={stats.loading}
        />
        <AdminStatCard
          title="Ticket médio"
          value={formatCurrency(avgTicket)}
          subtitle="por venda aprovada"
          icon={<CircleDollarSign className="h-5 w-5 text-purple-400" />}
          iconBg="bg-purple-500/10"
          valueColor="text-purple-400"
          loading={stats.loading}
        />
      </div>

      {/* Indicadores de distribuição por método de pagamento */}
      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Distribuição por forma de pagamento ({periodLabel})
          </h3>
          <div className="flex gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">PIX: {stats.pixPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">Cartão: {stats.creditCardPercentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">Boleto: {stats.boletoPercentage.toFixed(1)}%</span>
            </div>
          </div>
          {/* Barra visual */}
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden flex">
            <div 
              className="h-full bg-green-500 transition-all duration-300" 
              style={{ width: `${stats.pixPercentage}%` }} 
            />
            <div 
              className="h-full bg-blue-500 transition-all duration-300" 
              style={{ width: `${stats.creditCardPercentage}%` }} 
            />
            <div 
              className="h-full bg-orange-500 transition-all duration-300" 
              style={{ width: `${stats.boletoPercentage}%` }} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSalesMetrics;
