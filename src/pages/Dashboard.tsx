import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardBanner from "@/components/dashboard/DashboardBanner";
import StatsCards from "@/components/dashboard/StatsCards";
import RevenueChart from "@/components/dashboard/RevenueChart";
import AdditionalStats from "@/components/dashboard/AdditionalStats";
import GoalProgress from "@/components/dashboard/GoalProgress";
import DashboardActions from "@/components/dashboard/DashboardActions";

const Dashboard = () => {
  return (
    <DashboardLayout>
      {/* Top bar with title and filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DashboardActions />
      </div>

      {/* Banner */}
      <div className="mb-6">
        <DashboardBanner />
      </div>

      {/* Stats cards: Total vendas aprovadas, Vendas aprovadas, Saldo disponível */}
      <div className="mb-6">
        <StatsCards />
      </div>

      {/* Revenue chart (Gráfico de receitas) */}
      <div className="mb-6">
        <RevenueChart />
      </div>

      {/* Additional stats: Relatório de ganhos + Métodos de pagamento */}
      <div className="mb-6">
        <AdditionalStats />
      </div>

      {/* Meta mensal with plate */}
      <div className="mb-6">
        <GoalProgress />
      </div>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          © Royal Pay 2026. Todos os direitos reservados.
        </p>
      </footer>
    </DashboardLayout>
  );
};

export default Dashboard;
