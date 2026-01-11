import { Link, useLocation } from "react-router-dom";
import Logo from "@/components/ui/Logo";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Wallet,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  ArrowLeft,
  FileText,
  MessageCircle,
  Banknote,
  UserCog,
  Percent,
  Receipt,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão Geral", path: "/admin" },
  { icon: Users, label: "Usuários", path: "/admin/usuarios" },
  { icon: Shield, label: "Permissões", path: "/admin/permissoes" },
  { icon: UserCog, label: "Gerentes", path: "/admin/gerentes" },
  { icon: MessageCircle, label: "Suporte", path: "/admin/suporte" },
  { icon: FileText, label: "Documentos", path: "/admin/documentos" },
  { icon: Package, label: "Produtos", path: "/admin/produtos" },
  { icon: ShoppingCart, label: "Vendas", path: "/admin/vendas" },
  { icon: Wallet, label: "Saques", path: "/admin/saques" },
  { icon: CreditCard, label: "Contas Bancárias", path: "/admin/contas" },
  { icon: Banknote, label: "Gateway", path: "/admin/gateway" },
  { icon: Percent, label: "Taxas", path: "/admin/taxas" },
  { icon: Receipt, label: "Faturamento", path: "/admin/faturamento" },
  { icon: BarChart3, label: "Relatórios", path: "/admin/relatorios" },
  { icon: Settings, label: "Configurações", path: "/admin/configuracoes" },
];

const AdminSidebar = () => {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Logo />
        <span className="ml-2 text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-medium">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? "bg-destructive/10 text-destructive" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-destructive" : ""}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Separator */}
        <div className="my-4 border-t border-sidebar-border" />

        {/* Back to Dashboard */}
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar ao Dashboard
        </Link>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Painel Administrativo
        </p>
      </div>
    </aside>
  );
};

export default AdminSidebar;
