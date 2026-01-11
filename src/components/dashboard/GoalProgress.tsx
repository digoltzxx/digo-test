import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Trophy, Sparkles, Award, Bell } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useGoalProgress } from "@/hooks/useGoalProgress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import goal10k from "@/assets/goal-10k.png";
import goal100k from "@/assets/goal-100k.png";
import goal500k from "@/assets/goal-500k.png";
import { cn } from "@/lib/utils";

const ALERT_MESSAGES = {
  "50_percent": {
    title: "50% da meta atingida! 🎯",
    description: "Você atingiu metade do caminho. Continue assim!",
  },
  "80_percent": {
    title: "80% da meta alcançada! 🔥",
    description: "Falta pouco! Você está quase lá.",
  },
  "100_percent": {
    title: "Meta atingida com sucesso! 🚀",
    description: "Parabéns! Você conquistou sua meta!",
  },
};

const GoalProgress = () => {
  const { valuesVisible } = useRevenue();
  const {
    // Total lifetime (todas as vendas aprovadas - não filtrado por data)
    totalLifetimeAmount,
    
    // Placas (progresso acumulado - lifetime)
    currentPlate,
    platesEarned,
    allPlatesEarned,
    plateProgressPercentage,
    plateRemainingAmount,
    nextPlateThreshold,
    
    // Estados
    isLoading,
    plates,
  } = useGoalProgress();

  // Escutar eventos de alerta de meta
  useEffect(() => {
    const handleGoalAlert = (event: CustomEvent) => {
      const { alertType } = event.detail;
      const message = ALERT_MESSAGES[alertType as keyof typeof ALERT_MESSAGES];
      
      if (message) {
        toast.success(message.title, {
          description: message.description,
          duration: 6000,
          icon: <Bell className="w-4 h-4" />,
        });
      }
    };

    window.addEventListener("goal-alert-triggered", handleGoalAlert as EventListener);
    return () => {
      window.removeEventListener("goal-alert-triggered", handleGoalAlert as EventListener);
    };
  }, []);

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const formatShort = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  // A imagem sempre corresponde à meta atual (sincronizada com a barra de progresso)
  // currentPlate.threshold: 10000 = 10k, 100000 = 100k, 500000 = 500k
  const getPlateImage = () => {
    if (currentPlate.threshold === 500000) return goal500k;
    if (currentPlate.threshold === 100000) return goal100k;
    return goal10k;
  };

  // Label da placa atual
  const getPlateLabel = () => {
    if (allPlatesEarned) return "COMPLETO";
    return currentPlate.label;
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="w-36 h-36 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm overflow-hidden relative transition-all duration-500",
      allPlatesEarned && "border-yellow-500/50 from-yellow-500/5 to-card/40"
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/10 to-transparent rounded-full blur-2xl" />
      
      {/* Celebration effects */}
      {allPlatesEarned && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 left-4">
            <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" />
          </div>
          <div className="absolute top-6 right-20">
            <Sparkles className="w-3 h-3 text-yellow-400 animate-pulse delay-100" />
          </div>
          <div className="absolute bottom-4 left-8">
            <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse delay-200" />
          </div>
        </div>
      )}

      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-6">
          {/* Faltam para atingir - texto maior */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <span className="text-base font-medium text-muted-foreground">
                Faltam para atingir <span className="text-xs">(Valor Bruto)</span>
              </span>
              <p className="text-4xl font-bold text-foreground">
                {formatCurrency(plateRemainingAmount)}
              </p>
            </div>

            {/* Progress bar with values - usa totalLifetimeAmount */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{formatCurrency(totalLifetimeAmount)}</span>
                <span>{formatCurrency(nextPlateThreshold)}</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(plateProgressPercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Plate image */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <img 
              src={getPlateImage()} 
              alt={`Placa ${currentPlate.label}`}
              className={cn(
                "w-44 h-auto object-contain transition-all duration-500 drop-shadow-xl",
                allPlatesEarned && "brightness-110 scale-105"
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoalProgress;
