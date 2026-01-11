import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useRevenue } from "@/contexts/RevenueContext";
import { useNavigate } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  iconBg: string;
  onClick?: () => void;
}

const StatCard = ({ title, value, icon, trend = "neutral", trendValue, iconBg, onClick }: StatCardProps) => (
  <Card 
    className={`bg-gradient-to-br from-card/80 to-card/40 border-border/30 backdrop-blur-sm hover:border-accent/30 transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
          {trendValue && (
            <div className={`flex items-center gap-1 text-xs ${
              trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
            }`}>
              {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
              {trend === "down" && <ArrowDownRight className="w-3 h-3" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const StatsCards = () => {
  const { 
    totalRevenue, 
    valuesVisible, 
    availableBalance,
    approvedSalesCount 
  } = useRevenue();
  const navigate = useNavigate();

  const formatCurrency = (value: number) => {
    if (!valuesVisible) return "••••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  const handleWalletClick = () => {
    navigate("/dashboard/carteira");
  };

  const stats: StatCardProps[] = [
    {
      title: "Total em vendas aprovadas",
      value: formatCurrency(totalRevenue),
      icon: <DollarSign className="w-5 h-5 text-green-500" />,
      iconBg: "bg-green-500/10",
    },
    {
      title: "Vendas aprovadas",
      value: valuesVisible ? String(approvedSalesCount) : "••",
      icon: <ShoppingCart className="w-5 h-5 text-accent" />,
      iconBg: "bg-accent/10",
    },
    {
      title: "Saldo disponível",
      value: formatCurrency(availableBalance),
      icon: <Wallet className="w-5 h-5 text-purple-500" />,
      iconBg: "bg-purple-500/10",
      trend: availableBalance > 0 ? "up" : "neutral",
      trendValue: valuesVisible ? "para saque" : "•••••••",
      onClick: handleWalletClick,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
};

export default StatsCards;
