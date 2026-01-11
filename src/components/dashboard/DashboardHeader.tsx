import { Eye, EyeOff, LogOut, ChevronDown, User, FileText, Shield, Settings, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRevenue } from "@/contexts/RevenueContext";
import NotificationsPopover from "./NotificationsPopover";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAccountManagerRole } from "@/hooks/useAccountManagerRole";
import GlobalSalesBadge from "./GlobalSalesBadge";

interface DashboardHeaderProps {
  displayName: string;
  displayEmail: string;
  userId: string;
  onLogout: () => void;
  onNameUpdated: (newName: string) => void;
  hideNavigation?: boolean;
}

const DashboardHeader = ({ 
  displayName, 
  displayEmail, 
  userId,
  onLogout,
  onNameUpdated,
  hideNavigation = false
}: DashboardHeaderProps) => {
  const { valuesVisible, toggleValuesVisibility } = useRevenue();
  const { isAdminOrModerator } = useAdminRole();
  const { isAccountManager } = useAccountManagerRole();
  const navigate = useNavigate();

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Welcome */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Olá <span className="font-semibold text-foreground">{displayName}!</span> Seja bem-vindo de volta.
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Balance - only show if navigation is visible */}
        {!hideNavigation && (
          <div className="hidden md:flex">
            <GlobalSalesBadge />
          </div>
        )}

        {/* Eye toggle - only show if navigation is visible */}
        {!hideNavigation && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-foreground"
            onClick={toggleValuesVisibility}
          >
            {valuesVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </Button>
        )}
        
        {/* Notifications - only show if navigation is visible */}
        {!hideNavigation && <NotificationsPopover />}

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <Avatar className="w-8 h-8 bg-destructive">
                <AvatarFallback className="bg-destructive text-destructive-foreground text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium">{displayName}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            {!hideNavigation && (
              <>
                <DropdownMenuItem 
                  onClick={() => navigate("/dashboard/configuracoes")} 
                  className="cursor-pointer gap-2"
                >
                  <User className="w-4 h-4" />
                  Minha Conta
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate("/dashboard/configuracoes?tab=documentos")} 
                  className="cursor-pointer gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Documentos
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => navigate("/dashboard/configuracoes?tab=seguranca")} 
                  className="cursor-pointer gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Segurança
                </DropdownMenuItem>
                {isAccountManager && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate("/gerente")} 
                      className="cursor-pointer gap-2 text-accent"
                    >
                      <UserCog className="w-4 h-4" />
                      Painel Gerente
                    </DropdownMenuItem>
                  </>
                )}
                {isAdminOrModerator && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => navigate("/admin")} 
                      className="cursor-pointer gap-2 text-destructive"
                    >
                      <Settings className="w-4 h-4" />
                      Painel Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onLogout} className="text-destructive cursor-pointer gap-2">
              <LogOut className="w-4 h-4" />
              Deslogar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardHeader;
