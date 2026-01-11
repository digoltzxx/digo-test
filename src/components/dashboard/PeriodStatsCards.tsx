import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Wallet, Clock, ArrowUpRight, TrendingUp } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useNavigate } from "react-router-dom";
import { usePeriodSalesStats } from "@/hooks/usePeriodSalesStats";
import SalesMetricsFilters from "./SalesMetricsFilters";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
  loading?: boolean;
}

const StatCard = ({ title, value, subtitle, icon, iconBg, onClick, loading }: StatCardProps) => (
  <Card 
    className={`bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm hover:border-accent/30 transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
              {subtitle && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{subtitle}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const PeriodStatsCards = () => {
  const { valuesVisible, availableBalance } = useRevenue();
  const navigate = useNavigate();
  
  const {
    stats,
    filters,
    products,
    periodLabel,
    setPeriod,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
  } = usePeriodSalesStats();

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const handleWalletClick = () => {
    navigate("/dashboard/carteira");
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Métricas de vendas
          <span className="text-sm font-normal text-muted-foreground">({periodLabel})</span>
        </h2>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={`Vendas aprovadas (${periodLabel.toLowerCase()})`}
          value={formatCurrency(stats.approvedAmount)}
          subtitle={valuesVisible ? `${stats.approvedCount} vendas` : "•••••••"}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
          iconBg="bg-green-500/10"
          loading={stats.loading}
        />
        <StatCard
          title="Quantidade de vendas"
          value={valuesVisible ? String(stats.approvedCount) : "••"}
          subtitle={valuesVisible ? `de ${stats.totalCount} total` : "•••••••"}
          icon={<ShoppingCart className="w-5 h-5 text-accent" />}
          iconBg="bg-accent/10"
          loading={stats.loading}
        />
        <StatCard
          title="Vendas pendentes"
          value={formatCurrency(stats.pendingAmount)}
          subtitle={valuesVisible ? `${stats.pendingCount} aguardando` : "•••••••"}
          icon={<Clock className="w-5 h-5 text-yellow-500" />}
          iconBg="bg-yellow-500/10"
          loading={stats.loading}
        />
        <StatCard
          title="Saldo disponível"
          value={formatCurrency(availableBalance)}
          subtitle={valuesVisible ? "para saque" : "•••••••"}
          icon={<Wallet className="w-5 h-5 text-purple-500" />}
          iconBg="bg-purple-500/10"
          onClick={handleWalletClick}
          loading={stats.loading}
        />
      </div>

      {/* Indicadores de filtros ativos */}
      {(filters.productId || filters.paymentMethod) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Filtros ativos:</span>
          {filters.productId && (
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
              {products.find(p => p.id === filters.productId)?.name || "Produto"}
            </span>
          )}
          {filters.paymentMethod && (
            <span className="bg-accent/10 text-accent px-2 py-1 rounded-md text-xs">
              {filters.paymentMethod === "pix" ? "PIX" : 
               filters.paymentMethod === "credit_card" ? "Cartão" : "Boleto"}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PeriodStatsCards;
