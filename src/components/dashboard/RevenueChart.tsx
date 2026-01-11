import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, Calendar, Clock, Loader2 } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useDailyChartData } from "@/hooks/useDailyChartData";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const RevenueChart = () => {
  const { valuesVisible } = useRevenue();
  const { data, loading, totalToday } = useDailyChartData();
  const { isTodayView, dateRange, selectedDateString, isLoading: dateLoading } = useDateFilter();

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  // Format selected date label
  const getDateLabel = () => {
    if (!dateRange?.from) return format(new Date(), "dd/MM/yyyy");
    return format(dateRange.from, "dd 'de' MMMM", { locale: ptBR });
  };

  const isDataLoading = loading || dateLoading;

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <CardTitle className="text-base font-medium">Gráfico de receitas</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
            {isTodayView ? (
              <Clock className="w-3 h-3" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            <span>{isTodayView ? "Hoje" : getDateLabel()}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          {isDataLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-sm">Carregando dados de {getDateLabel()}...</span>
            </div>
          ) : data.every(d => d.value === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Calendar className="w-8 h-8 opacity-50" />
              <span className="text-sm">Sem vendas para {getDateLabel()}</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  dy={10}
                  interval={2}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={(value) => valuesVisible ? `R$${value}` : "•••"}
                  width={50}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
                  }}
                  formatter={(value: number) => [valuesVisible ? `R$ ${value.toFixed(2)}` : "••••••", "Receita"]}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
