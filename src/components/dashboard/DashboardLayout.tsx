import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { RevenueProvider } from "@/contexts/RevenueContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import DashboardSidebar from "./DashboardSidebar";
import DashboardHeader from "./DashboardHeader";
import LiveChatButton from "./LiveChatButton";
import { Button } from "@/components/ui/button";
import { Clock, FileText, ShieldAlert, X, Ban, MessageCircle } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; verification_status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isConfigPage = location.pathname === "/dashboard/configuracoes";
  const isSupportPage = location.pathname === "/dashboard/suporte";
  const isVerified = profile?.verification_status === "approved";
  const isPending = profile?.verification_status === "pending";
  const isSubmitted = profile?.verification_status === "submitted";
  const isRejected = profile?.verification_status === "rejected";
  const isBlocked = profile?.verification_status === "blocked";
  
  // When impersonating, allow full access
  const canAccessSite = isVerified || isImpersonating;
  const canAccessSupport = canAccessSite || isBlocked;

  useEffect(() => {
    // Check for impersonation
    const impersonatingUser = localStorage.getItem('impersonating_user');
    const impersonatedName = localStorage.getItem('impersonated_user_name');
    
    if (impersonatingUser) {
      setIsImpersonating(true);
      setImpersonatedUserId(impersonatingUser);
      setImpersonatedUserName(impersonatedName);
      
      // Fetch impersonated user's profile
      fetchProfile(impersonatingUser);
      setLoading(false);
      return;
    }
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle session changes - redirect on logout/expiry
        if (event === 'SIGNED_OUT' || !session) {
          navigate("/login");
        }
        
        // Fetch profile on sign in
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session with server validation
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        navigate("/login");
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session.user);
      
      setTimeout(() => {
        fetchProfile(session.user.id);
      }, 0);
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Redirect blocked users to support page, others to documents
  useEffect(() => {
    if (!loading && profile && !canAccessSite && !isImpersonating) {
      if (isBlocked) {
        // Blocked users can only access support
        if (!isSupportPage) {
          navigate("/dashboard/suporte");
        }
      } else if (!isConfigPage) {
        // Pending/submitted/rejected users go to documents
        navigate("/dashboard/configuracoes?tab=documentos");
      }
    }
  }, [loading, profile, canAccessSite, isConfigPage, isSupportPage, isBlocked, navigate, isImpersonating]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, verification_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
  };

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonating_user');
    localStorage.removeItem('impersonated_user_name');
    setIsImpersonating(false);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    toast({
      title: "Saiu da impersonação",
      description: "Voltando ao painel administrativo.",
    });
    navigate("/admin/usuarios");
  };

  const handleLogout = async () => {
    // If impersonating, just exit impersonation
    if (isImpersonating) {
      handleExitImpersonation();
      return;
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      navigate("/login");
    }
  };

  const handleNameUpdated = (newName: string) => {
    setProfile((prev) => prev ? { ...prev, full_name: newName } : null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || impersonatedUserName || "Usuário";
  const displayEmail = profile?.email || user?.email || "";
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;

  // Blocked users - show blocked screen with support only
  if (isBlocked && !isImpersonating) {
    return (
      <DateFilterProvider>
        <RevenueProvider>
          <div className="min-h-screen bg-background flex flex-col">
            <div className="flex flex-1">
              <div className="flex-1">
                <DashboardHeader 
                  displayName={displayName}
                  displayEmail={displayEmail}
                  userId={effectiveUserId || ""}
                  onLogout={handleLogout}
                  onNameUpdated={handleNameUpdated}
                  hideNavigation={true}
                />
                
                {!isSupportPage ? (
                  <main className="p-6">
                    <div className="max-w-2xl mx-auto mt-20">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
                        <div className="mx-auto w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                          <Ban className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-red-400 mb-3">Conta Bloqueada</h1>
                        <p className="text-red-400/80 mb-6">
                          Sua conta foi bloqueada pelo administrador. Para resolver essa situação, 
                          entre em contato com nosso suporte através do botão abaixo.
                        </p>
                        <Button 
                          onClick={() => navigate("/dashboard/suporte")}
                          className="bg-red-500 hover:bg-red-600 text-white gap-2"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Falar com Suporte
                        </Button>
                      </div>
                    </div>
                  </main>
                ) : (
                  <main className="p-6">
                    <div className="mb-6">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-4">
                        <div className="p-3 rounded-full bg-red-500/20">
                          <Ban className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-red-400">Conta Bloqueada</h3>
                          <p className="text-red-400/80 text-sm">
                            Converse com nosso suporte para resolver a situação da sua conta.
                          </p>
                        </div>
                      </div>
                    </div>
                    {children}
                  </main>
                )}
              </div>
              
              {/* Live Chat Button always visible for blocked users */}
              <LiveChatButton />
            </div>
          </div>
        </RevenueProvider>
      </DateFilterProvider>
    );
  }

  // If user is blocked and not on config page, they will be redirected
  // Show loading until redirect happens
  if (!canAccessSite && !isConfigPage && !isSupportPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <DateFilterProvider>
      <RevenueProvider>
        <div className="min-h-screen bg-background flex flex-col">
          {/* Impersonation Banner */}
          {isImpersonating && (
          <div className="bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between z-50 fixed top-0 left-0 right-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-sm font-medium">
                Você está acessando a conta de <strong>{impersonatedUserName}</strong> como administrador
              </span>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleExitImpersonation}
              className="gap-1"
            >
              <X className="w-4 h-4" />
              Sair da impersonação
            </Button>
          </div>
        )}
        
        <div className={`flex flex-1 ${isImpersonating ? 'mt-10' : ''}`}>
          {/* Only show sidebar if user can access site */}
          {canAccessSite && <DashboardSidebar />}
          
          <div className={`flex-1 ${canAccessSite ? "ml-64" : ""}`}>
            <DashboardHeader 
              displayName={displayName}
              displayEmail={displayEmail}
              userId={effectiveUserId || ""}
              onLogout={handleLogout}
              onNameUpdated={handleNameUpdated}
              hideNavigation={!canAccessSite}
            />
            
            {/* Show verification pending alert */}
            {!isImpersonating && !canAccessSite && isConfigPage && (
              <div className="px-6 pt-6">
                <div className={`p-6 rounded-xl flex items-center gap-4 ${
                  isSubmitted 
                    ? "bg-blue-500/10 border border-blue-500/30" 
                    : isPending 
                      ? "bg-yellow-500/10 border border-yellow-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                }`}>
                  <div className={`p-3 rounded-full ${
                    isSubmitted 
                      ? "bg-blue-500/20" 
                      : isPending 
                        ? "bg-yellow-500/20"
                        : "bg-red-500/20"
                  }`}>
                    {isPending ? (
                      <FileText className={`w-6 h-6 ${isPending ? "text-yellow-500" : ""}`} />
                    ) : (
                      <Clock className={`w-6 h-6 ${isSubmitted ? "text-blue-500" : "text-red-500"}`} />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold mb-1 ${
                      isSubmitted 
                        ? "text-blue-400" 
                        : isPending 
                          ? "text-yellow-400"
                          : "text-red-400"
                    }`}>
                      {isSubmitted 
                        ? "Aguardando aprovação" 
                        : isPending 
                          ? "Verificação pendente"
                          : "Documentos rejeitados"}
                    </h3>
                    <p className={`${
                      isSubmitted 
                        ? "text-blue-400/80" 
                        : isPending 
                          ? "text-yellow-400/80"
                          : "text-red-400/80"
                    }`}>
                      {isSubmitted 
                        ? "Seus documentos foram enviados e estão em análise. Aguarde a aprovação para acessar todas as funcionalidades da plataforma."
                        : isPending 
                          ? "Envie seus documentos abaixo para liberar o acesso à plataforma."
                          : "Sua verificação foi rejeitada. Por favor, envie novos documentos corrigindo os problemas apontados."}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <main className="p-6">
              {children}
            </main>
          </div>
          
          {/* Live Chat Button - Always visible */}
          <LiveChatButton />
        </div>
      </div>
    </RevenueProvider>
  </DateFilterProvider>
  );
};

export default DashboardLayout;