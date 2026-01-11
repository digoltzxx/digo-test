import { Trophy } from "lucide-react";
import { useGlobalSalesIndicator } from "@/hooks/useGlobalSalesIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const GlobalSalesBadge = () => {
  const { totalAmount, goalLabel, goalReached, loading } = useGlobalSalesIndicator();

  const formatValue = (value: number): string => {
    return value.toLocaleString("pt-BR", { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 border border-accent/30">
        <Trophy className="w-4 h-4 text-accent" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all",
        goalReached 
          ? "bg-green-500/20 border border-green-500/40 animate-pulse" 
          : "bg-[#1a1f2e] border border-[#2a3142]"
      )}
      title="Progresso da Meta (Valor Bruto)"
    >
      <Trophy className={cn("w-4 h-4", goalReached ? "text-green-400" : "text-blue-400")} />
      <span className="text-sm font-medium text-white">
        R$ {formatValue(totalAmount)}
        <span className="text-muted-foreground font-normal"> /{goalLabel}</span>
      </span>
    </div>
  );
};

export default GlobalSalesBadge;
