import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, CreditCard, AlertCircle, Info, Calendar, Clock } from "lucide-react";
import { useDailyReports } from "@/hooks/useDailyReports";
import { useRevenue } from "@/contexts/RevenueContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DailyReportCard = () => {
  const { reportData, isLoading, hasData, isToday } = useDailyReports();
  const { valuesVisible } = useRevenue();
  const { dateRange, isTodayView } = useDateFilter();

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const paymentMethodLabels: Record<string, string> = {
    pix: "PIX",
    credit_card: "Cartão de Crédito",
    boleto: "Boleto",
    outros: "Outros",
  };

  // Format selected date label
  const getDateLabel = () => {
    if (!dateRange?.from) return format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    return format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
  };

  const getNoDataMessage = () => {
    if (isTodayView) {
      return "Sem movimentações registradas hoje";
    }
    return `Nenhuma venda registrada neste dia.`;
  };

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Resumo Financeiro — Ganhos e Operações
            </CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
              {isTodayView ? (
                <Clock className="w-3 h-3" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              <span>{getDateLabel()}</span>
            </div>
          </div>
          
          {/* Faturamento líquido do dia - destaque principal */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Faturamento líquido do dia</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    <p className="text-xs">Total recebido no dia após dedução de taxas, comissões e estornos.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-accent">
                {hasData ? formatCurrency(reportData?.netAmount || 0) : "R$ 0,00"}
              </p>
            )}
            {!isLoading && !hasData && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {getNoDataMessage()}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground font-medium">Sem dados para este dia</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {getNoDataMessage()}
            </p>
          </div>
        ) : (
          <>
            {/* Métricas principais */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-accent/5 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Bruto</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(reportData?.totalAmount || 0)}
                </p>
              </div>
              <div className="bg-green-500/5 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Líquido</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(reportData?.netAmount || 0)}
                </p>
              </div>
              <div className="bg-purple-500/5 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Vendas</p>
                <p className="text-lg font-bold text-purple-500">
                  {valuesVisible ? reportData?.salesCount || 0 : "••"}
                </p>
              </div>
            </div>

            {/* Por produto */}
            {reportData && reportData.byProduct.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="w-4 h-4" />
                  Por produto
                </div>
                <div className="space-y-2">
                  {reportData.byProduct.map((product) => (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm truncate max-w-[150px]">{product.productName}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">{product.salesCount} vendas</span>
                        <span className="font-medium">{formatCurrency(product.netAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por forma de pagamento */}
            {reportData && reportData.byPaymentMethod.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="w-4 h-4" />
                  Por forma de pagamento
                </div>
                <div className="space-y-2">
                  {reportData.byPaymentMethod.map((method) => (
                    <div key={method.paymentMethod} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{paymentMethodLabels[method.paymentMethod] || method.paymentMethod}</span>
                        <span className="text-muted-foreground">
                          {method.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-300"
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                Considera apenas pagamentos aprovados • Valores líquidos
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyReportCard;
