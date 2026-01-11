import { Link, useLocation } from "react-router-dom";
import Logo from "@/components/ui/Logo";
import {
  LayoutDashboard,
  Package,
  Store,
  Users,
  ShoppingCart,
  CalendarCheck,
  Wallet,
  BarChart3,
  Puzzle,
  MessageCircle,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Package, label: "Meus produtos", path: "/dashboard/produtos" },
  { icon: Store, label: "Marketplace", path: "/dashboard/marketplace" },
  { icon: Users, label: "Meus afiliados", path: "/dashboard/afiliados" },
  { icon: ShoppingCart, label: "Vendas", path: "/dashboard/vendas" },
  { icon: CalendarCheck, label: "Assinaturas", path: "/dashboard/assinaturas" },
  { icon: Wallet, label: "Minha carteira", path: "/dashboard/carteira" },
  { icon: BarChart3, label: "Relatórios", path: "/dashboard/relatorios" },
  { icon: Puzzle, label: "Integrações", path: "/dashboard/integracoes" },
  { icon: MessageCircle, label: "Suporte", path: "/dashboard/suporte" },
];

const DashboardSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Logo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? "bg-accent/10 text-accent" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-accent" : ""}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          © Royal Pay 2026. Todos os direitos reservados.
        </p>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
