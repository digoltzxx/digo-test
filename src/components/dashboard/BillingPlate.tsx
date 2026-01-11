import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Star, Target, TrendingUp, Crown, Medal } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useSalesStats } from "@/hooks/useSalesStats";
import goal10k from "@/assets/goal-10k.png";
import goal100k from "@/assets/goal-100k.png";
import goal500k from "@/assets/goal-500k.png";

interface Milestone {
  value: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  achieved: boolean;
  image?: string;
}

const BillingPlate = () => {
  const { totalRevenue, valuesVisible } = useRevenue();
  const { approvedAmount } = useSalesStats();
  
  // Usar o maior valor entre totalRevenue e approvedAmount
  const currentValue = Math.max(totalRevenue, approvedAmount);

  const milestones: Milestone[] = [
    {
      value: 1000,
      label: "R$ 1.000",
      icon: <Star className="w-6 h-6" />,
      color: "from-zinc-400 to-zinc-600",
      achieved: currentValue >= 1000,
    },
    {
      value: 5000,
      label: "R$ 5.000",
      icon: <Medal className="w-6 h-6" />,
      color: "from-amber-400 to-amber-600",
      achieved: currentValue >= 5000,
    },
    {
      value: 10000,
      label: "R$ 10.000",
      icon: <Trophy className="w-6 h-6" />,
      color: "from-yellow-400 to-yellow-600",
      achieved: currentValue >= 10000,
      image: goal10k,
    },
    {
      value: 50000,
      label: "R$ 50.000",
      icon: <Award className="w-6 h-6" />,
      color: "from-emerald-400 to-emerald-600",
      achieved: currentValue >= 50000,
    },
    {
      value: 100000,
      label: "R$ 100.000",
      icon: <Crown className="w-6 h-6" />,
      color: "from-blue-400 to-blue-600",
      achieved: currentValue >= 100000,
      image: goal100k,
    },
    {
      value: 500000,
      label: "R$ 500.000",
      icon: <Target className="w-6 h-6" />,
      color: "from-purple-400 to-purple-600",
      achieved: currentValue >= 500000,
      image: goal500k,
    },
    {
      value: 1000000,
      label: "R$ 1.000.000",
      icon: <TrendingUp className="w-6 h-6" />,
      color: "from-pink-400 to-pink-600",
      achieved: currentValue >= 1000000,
    },
  ];

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  // Encontrar próxima meta
  const nextMilestone = milestones.find(m => !m.achieved);
  const achievedMilestones = milestones.filter(m => m.achieved);
  const lastAchieved = achievedMilestones[achievedMilestones.length - 1];

  return (
    <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20">
              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>
            <CardTitle className="text-lg">Placa de Faturamento</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {achievedMilestones.length} conquista{achievedMilestones.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Value */}
        <div className="text-center p-4 rounded-xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20">
          <p className="text-sm text-muted-foreground mb-1">Faturamento Total</p>
          <p className="text-3xl font-bold text-accent">{formatCurrency(currentValue)}</p>
        </div>

        {/* Milestones Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className={`relative p-4 rounded-xl border-2 transition-all ${
                milestone.achieved
                  ? "border-accent/50 bg-gradient-to-br from-accent/10 to-accent/5"
                  : "border-border/30 bg-card/50 opacity-50"
              }`}
            >
              {milestone.image && milestone.achieved && (
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full overflow-hidden border-2 border-accent shadow-lg">
                  <img src={milestone.image} alt={milestone.label} className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br ${milestone.color} ${
                milestone.achieved ? "" : "grayscale"
              }`}>
                <span className="text-white">{milestone.icon}</span>
              </div>
              
              <p className={`text-sm font-bold ${milestone.achieved ? "text-foreground" : "text-muted-foreground"}`}>
                {milestone.label}
              </p>
              
              {milestone.achieved && (
                <Badge className="mt-2 text-xs bg-green-500/20 text-green-500 border-green-500/30">
                  Conquistado!
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* Next Goal */}
        {nextMilestone && (
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Próxima conquista</p>
                <p className="text-lg font-bold text-foreground">{nextMilestone.label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Faltam</p>
                <p className="text-lg font-bold text-accent">
                  {formatCurrency(nextMilestone.value - currentValue)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BillingPlate;
