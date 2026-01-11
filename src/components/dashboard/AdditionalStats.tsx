import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Percent, RotateCcw, PieChart, CreditCard, Smartphone, FileText, Clock, Calendar } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdditionalStats = () => {
  const { 
    valuesVisible, 
    approvedAmount,
    commissionAmount,
    retentionAmount,
    pixPercentage,
    creditCardPercentage,
    boletoPercentage,
    availableBalance
  } = useRevenue();
  
  const { currentDayLabel, isTodayView, dateRange } = useDateFilter();

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    if (!valuesVisible) return "••";
    return `${value.toFixed(0)}%`;
  };

  // Calculate the circle progress for the largest percentage
  const maxPercentage = Math.max(pixPercentage, creditCardPercentage, boletoPercentage);
  const circumference = 2 * Math.PI * 32; // 32 is the radius
  const strokeDashoffset = circumference - (maxPercentage / 100) * circumference;

  // Calculate total value (receita + recuperadas)
  const totalValue = approvedAmount + commissionAmount;
  
  // Placeholder values - these would come from actual data
  const recoveredAmount = 0; // Vendas recuperadas
  const refundAmount = retentionAmount; // Reembolsos

  // Format selected date label
  const getDateLabel = () => {
    if (!dateRange?.from) return currentDayLabel;
    
    const formattedDate = format(dateRange.from, "dd/MM/yyyy", { locale: ptBR });
    
    if (isTodayView) {
      return `Hoje • ${formattedDate}`;
    }
    
    return formattedDate;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Resumo Financeiro */}
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
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
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-3xl font-bold text-accent mb-1">
            {formatCurrency(approvedAmount)}
          </div>
          <p className="text-xs text-muted-foreground mb-6">Valor total do dia</p>
          
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-2 rounded-lg bg-muted/30">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(approvedAmount)}</p>
                <p className="text-xs text-muted-foreground">Receita</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-2 rounded-lg bg-muted/30">
                <Percent className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(recoveredAmount)}</p>
                <p className="text-xs text-muted-foreground">Recuperadas</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-2 rounded-lg bg-muted/30">
                <RotateCcw className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(refundAmount)}</p>
                <p className="text-xs text-muted-foreground">Reembolsos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Percentual de vendas */}
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <PieChart className="w-4 h-4 text-accent" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Métodos de pagamento
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-2">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="6"
                  fill="none"
                  opacity="0.3"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="hsl(var(--accent))"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold">{formatPercentage(maxPercentage)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-accent/10">
                <Smartphone className="w-3 h-3 text-accent" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">PIX</span>
                <span className="text-xs font-medium">{formatPercentage(pixPercentage)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-green-500/10">
                <CreditCard className="w-3 h-3 text-green-500" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cartão</span>
                <span className="text-xs font-medium">{formatPercentage(creditCardPercentage)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-orange-500/10">
                <FileText className="w-3 h-3 text-orange-500" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Boleto</span>
                <span className="text-xs font-medium">{formatPercentage(boletoPercentage)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdditionalStats;
