import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarDays, CalendarRange, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useAllPeriodsSalesStats, PERIOD_LABELS, METRIC_DISCLAIMERS, PeriodComparison } from "@/hooks/useAllPeriodsSalesStats";
import SalesFiltersBar from "./SalesFiltersBar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface PeriodCardProps {
  title: string;
  comparisonLabel: string;
  data: PeriodComparison;
  icon: React.ReactNode;
  iconBg: string;
  valuesVisible: boolean;
  loading?: boolean;
}

const PeriodCard = ({ 
  title, 
  comparisonLabel,
  data,
  icon, 
  iconBg, 
  valuesVisible,
  loading 
}: PeriodCardProps) => {
  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number | null) => {
    if (value === null) return null;
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getComparisonColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground";
    if (value > 0) return "text-green-500";
    if (value < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const getComparisonIcon = (value: number | null) => {
    if (value === null) return null;
    if (value > 0) return <TrendingUp className="w-3 h-3" />;
    if (value < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            {loading ? (
              <>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-28" />
              </>
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(data.current.approvedAmount)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {valuesVisible ? `${data.current.approvedCount} vendas aprovadas` : "••• vendas"}
                </div>
                {/* Comparação com período anterior */}
                <div className={`flex items-center gap-1 text-xs ${getComparisonColor(data.percentageChange)}`}>
                  {data.hasPreviousData ? (
                    <>
                      {getComparisonIcon(data.percentageChange)}
                      <span>
                        {formatPercentage(data.percentageChange)} {comparisonLabel}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sem dados para comparação</span>
                  )}
                </div>
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
};

const AllPeriodsStatsCards = () => {
  const { valuesVisible } = useRevenue();
  
  const {
    stats,
    filters,
    products,
    hasActiveFilters,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
  } = useAllPeriodsSalesStats();

  return (
    <div className="space-y-4">
      {/* Header com título e filtros */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Métricas de vendas aprovadas</h2>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              Filtros ativos
            </Badge>
          )}
        </div>
        <SalesFiltersBar
          productId={filters.productId}
          paymentMethod={filters.paymentMethod}
          products={products}
          hasActiveFilters={hasActiveFilters}
          onProductChange={setProductFilter}
          onPaymentMethodChange={setPaymentMethodFilter}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Cards de métricas: DIA | SEMANA | MÊS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PeriodCard
          title={PERIOD_LABELS.day.title}
          comparisonLabel={PERIOD_LABELS.day.comparison}
          data={stats.day}
          icon={<Calendar className="w-5 h-5 text-blue-500" />}
          iconBg="bg-blue-500/10"
          valuesVisible={valuesVisible}
          loading={stats.loading}
        />
        <PeriodCard
          title={PERIOD_LABELS.week.title}
          comparisonLabel={PERIOD_LABELS.week.comparison}
          data={stats.week}
          icon={<CalendarDays className="w-5 h-5 text-purple-500" />}
          iconBg="bg-purple-500/10"
          valuesVisible={valuesVisible}
          loading={stats.loading}
        />
        <PeriodCard
          title={PERIOD_LABELS.month.title}
          comparisonLabel={PERIOD_LABELS.month.comparison}
          data={stats.month}
          icon={<CalendarRange className="w-5 h-5 text-green-500" />}
          iconBg="bg-green-500/10"
          valuesVisible={valuesVisible}
          loading={stats.loading}
        />
      </div>

      {/* Indicadores de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <span>Exibindo dados filtrados por:</span>
          {filters.productId && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {products.find(p => p.id === filters.productId)?.name || "Produto"}
            </Badge>
          )}
          {filters.paymentMethod && (
            <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20">
              {filters.paymentMethod === "pix" ? "PIX" : 
               filters.paymentMethod === "credit_card" ? "Cartão de crédito" : "Boleto"}
            </Badge>
          )}
        </div>
      )}

      {/* Distribuição por forma de pagamento */}
      {!stats.loading && stats.month.current.approvedCount > 0 && (
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                Distribuição por forma de pagamento (mês)
              </span>
              <span className="text-xs text-muted-foreground">
                {METRIC_DISCLAIMERS.approvedOnly}
              </span>
            </div>
            <div className="flex gap-6 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>PIX: {stats.pixPercentage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Cartão: {stats.creditCardPercentage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>Boleto: {stats.boletoPercentage.toFixed(1)}%</span>
              </div>
            </div>
            {/* Barra visual */}
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
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
      )}

      {/* Disclaimer */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>• {METRIC_DISCLAIMERS.realtime}</span>
        <span>• {METRIC_DISCLAIMERS.netValues}</span>
      </div>
    </div>
  );
};

export default AllPeriodsStatsCards;
