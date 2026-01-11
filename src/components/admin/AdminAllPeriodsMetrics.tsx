import { useState, forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarDays, CalendarRange, TrendingUp, TrendingDown, Minus, CircleDollarSign } from "lucide-react";
import { useAllPeriodsSalesStats, PERIOD_LABELS, METRIC_DISCLAIMERS, PeriodComparison } from "@/hooks/useAllPeriodsSalesStats";
import SalesFiltersBar from "@/components/dashboard/SalesFiltersBar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SingleDateCalendar } from "@/components/ui/single-date-calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Skeleton com forwardRef para evitar warning
const StyledSkeleton = forwardRef<HTMLDivElement, { className?: string }>(
  ({ className }, ref) => (
    <div 
      ref={ref}
      className={cn("animate-pulse rounded-md bg-muted", className)} 
    />
  )
);
StyledSkeleton.displayName = "StyledSkeleton";

interface AdminPeriodCardProps {
  title: string;
  comparisonLabel: string;
  data: PeriodComparison;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  loading?: boolean;
  periodType: "day" | "week" | "month";
  selectedDate?: Date | null;
  onDateSelect?: (date: Date | null) => void;
}

const AdminPeriodCard = ({ 
  title, 
  comparisonLabel,
  data,
  icon, 
  iconBg, 
  valueColor = "text-foreground",
  loading,
  periodType,
  selectedDate,
  onDateSelect
}: AdminPeriodCardProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  
  const formatPercentage = (value: number | null) => {
    if (value === null) return null;
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const getComparisonColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground";
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-muted-foreground";
  };

  const getComparisonIcon = (value: number | null) => {
    if (value === null) return null;
    if (value > 0) return <TrendingUp className="w-3 h-3" />;
    if (value < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const handleDateSelect = (date: Date | null) => {
    onDateSelect?.(date);
    setIsCalendarOpen(false);
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              {selectedDate && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  {format(selectedDate, "dd/MM", { locale: ptBR })}
                </Badge>
              )}
            </div>
            {loading ? (
              <>
                <StyledSkeleton className="h-8 w-28 mt-2" />
                <StyledSkeleton className="h-4 w-20 mt-1" />
                <StyledSkeleton className="h-3 w-24 mt-1" />
              </>
            ) : (
              <>
                <p className={`text-3xl font-bold mt-1 ${valueColor}`}>
                  {formatCurrency(data.current.approvedAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.current.approvedCount} vendas aprovadas
                </p>
                {/* Comparação com período anterior */}
                <div className={`flex items-center gap-1 text-xs mt-1 ${getComparisonColor(data.percentageChange)}`}>
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
          
          {/* Ícone com calendário clicável */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "p-3 rounded-full transition-all cursor-pointer hover:scale-105 hover:brightness-125",
                  iconBg,
                  selectedDate && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                aria-label={`Abrir calendário para ${title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCalendarOpen(true);
                }}
              >
                {icon}
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0 border-border shadow-xl pointer-events-auto" 
              align="end"
              sideOffset={8}
              style={{ 
                zIndex: 9999,
                backgroundColor: 'hsl(var(--card))',
              }}
            >
              <div className="p-1">
                <SingleDateCalendar
                  selectedDate={selectedDate}
                  onDateSelect={(date) => handleDateSelect(date)}
                  disablePastDates={false}
                  showClearButton={true}
                  className="border-0 bg-card"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminAllPeriodsMetrics = () => {
  const {
    stats,
    filters,
    products,
    hasActiveFilters,
    setProductFilter,
    setPaymentMethodFilter,
    clearFilters,
  } = useAllPeriodsSalesStats({ isAdmin: true });

  // State para datas selecionadas por período
  const [selectedDates, setSelectedDates] = useState<{
    day: Date | null;
    week: Date | null;
    month: Date | null;
  }>({
    day: null,
    week: null,
    month: null,
  });

  const handleDateSelect = (periodType: "day" | "week" | "month", date: Date | null) => {
    setSelectedDates(prev => ({ ...prev, [periodType]: date }));
    // Aqui você pode adicionar lógica para filtrar dados pela data selecionada
    console.log(`Data selecionada para ${periodType}:`, date ? format(date, "yyyy-MM-dd") : null);
  };

  // Calcular ticket médio do mês
  const avgTicket = stats.month.current.approvedCount > 0 
    ? stats.month.current.approvedAmount / stats.month.current.approvedCount 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header com título e filtros */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Métricas de vendas aprovadas</h2>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">
                Filtros ativos
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {METRIC_DISCLAIMERS.approvedOnly} • {METRIC_DISCLAIMERS.netValues}
          </p>
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

      {/* Cards principais: DIA | SEMANA | MÊS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminPeriodCard
          title={PERIOD_LABELS.day.title}
          comparisonLabel={PERIOD_LABELS.day.comparison}
          data={stats.day}
          icon={<Calendar className="h-5 w-5 text-blue-400" />}
          iconBg="bg-blue-500/10"
          valueColor="text-blue-400"
          loading={stats.loading}
          periodType="day"
          selectedDate={selectedDates.day}
          onDateSelect={(date) => handleDateSelect("day", date)}
        />
        <AdminPeriodCard
          title={PERIOD_LABELS.week.title}
          comparisonLabel={PERIOD_LABELS.week.comparison}
          data={stats.week}
          icon={<CalendarDays className="h-5 w-5 text-purple-400" />}
          iconBg="bg-purple-500/10"
          valueColor="text-purple-400"
          loading={stats.loading}
          periodType="week"
          selectedDate={selectedDates.week}
          onDateSelect={(date) => handleDateSelect("week", date)}
        />
        <AdminPeriodCard
          title={PERIOD_LABELS.month.title}
          comparisonLabel={PERIOD_LABELS.month.comparison}
          data={stats.month}
          icon={<CalendarRange className="h-5 w-5 text-emerald-400" />}
          iconBg="bg-emerald-500/10"
          valueColor="text-emerald-400"
          loading={stats.loading}
          periodType="month"
          selectedDate={selectedDates.month}
          onDateSelect={(date) => handleDateSelect("month", date)}
        />
      </div>

      {/* Card adicional: Ticket médio + Distribuição */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Ticket médio (mês)</p>
                {stats.loading ? (
                  <StyledSkeleton className="h-8 w-28 mt-2" />
                ) : (
                  <p className="text-3xl font-bold mt-1 text-amber-400">
                    {formatCurrency(avgTicket)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">por venda aprovada</p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <CircleDollarSign className="h-5 w-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por forma de pagamento */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-4">
              Distribuição por forma de pagamento (mês)
            </p>
            {stats.loading ? (
              <StyledSkeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="flex gap-4 flex-wrap text-sm mb-3">
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
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
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
              </>
            )}
          </CardContent>
        </Card>
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

      {/* Timestamp de atualização */}
      {stats.lastUpdated && (
        <p className="text-xs text-center text-muted-foreground">
          {METRIC_DISCLAIMERS.realtime}
        </p>
      )}
    </div>
  );
};

export default AdminAllPeriodsMetrics;
