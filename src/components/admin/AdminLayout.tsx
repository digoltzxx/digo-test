import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "./AdminSidebar";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useOtpVerification } from "@/hooks/useOtpVerification";
import OtpVerificationDialog from "@/components/security/OtpVerificationDialog";
import { Loader2, ShieldAlert, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationsPopover from "@/components/dashboard/NotificationsPopover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { isAdminOrModerator, isLoading: roleLoading } = useAdminRole();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);

  // OTP verification for admin access
  const {
    isOtpModalOpen,
    isRequestingOtp,
    isVerifyingOtp,
    otpCode,
    expiresAt,
    setOtpCode,
    requestOtp,
    verifyOtp,
    closeOtpModal,
    resetOtp,
  } = useOtpVerification({
    purpose: "admin_access",
    onVerified: () => {
      setIdentityVerified(true);
      // Store verification in session storage (expires when browser closes)
      sessionStorage.setItem("admin_verified", "true");
      sessionStorage.setItem("admin_verified_at", Date.now().toString());
    },
  });

  useEffect(() => {
    // Check if identity was already verified in this session (within last 30 minutes)
    const storedVerification = sessionStorage.getItem("admin_verified");
    const verifiedAt = sessionStorage.getItem("admin_verified_at");

    if (storedVerification === "true" && verifiedAt) {
      const verifiedTime = parseInt(verifiedAt, 10);
      const thirtyMinutesMs = 30 * 60 * 1000;

      if (Date.now() - verifiedTime < thirtyMinutesMs) {
        setIdentityVerified(true);
      } else {
        // Clear expired verification
        sessionStorage.removeItem("admin_verified");
        sessionStorage.removeItem("admin_verified_at");
      }
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/login");
      } else {
        setUser(session.user);
      }
    });

    // THEN check for existing session with error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        navigate("/login");
        setLoading(false);
        return;
      }

      setUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Server-side role verification using RPC
  useEffect(() => {
    const verifyServerSideRole = async () => {
      if (!user?.id) {
        setServerVerified(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin_or_moderator", {
          _user_id: user.id,
        });

        if (error) {
          console.error("Server-side role verification failed:", error);
          setServerVerified(false);
          return;
        }

        setServerVerified(data === true);
      } catch (err) {
        console.error("Error verifying role:", err);
        setServerVerified(false);
      }
    };

    if (user?.id) {
      verifyServerSideRole();
    }
  }, [user?.id]);

  const handleRequestOtp = async () => {
    if (user?.email) {
      await requestOtp(user.email, user.id);
    }
  };

  const handleVerifyOtp = async () => {
    if (user?.email && otpCode) {
      await verifyOtp(user.email, otpCode);
    }
  };

  if (loading || roleLoading || serverVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Require BOTH client-side and server-side verification
  if (!isAdminOrModerator || !serverVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
          <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
        </div>
      </div>
    );
  }

  // Require OTP verification for admin access
  if (!identityVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <KeyRound className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-xl">Verificação de Segurança</CardTitle>
            <CardDescription>
              Para acessar a área administrativa, confirme sua identidade com um código enviado
              para seu e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                E-mail: <span className="font-medium text-foreground">{user?.email}</span>
              </p>
            </div>

            <Button
              onClick={handleRequestOtp}
              className="w-full"
              size="lg"
              disabled={isRequestingOtp}
            >
              {isRequestingOtp ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Mail className="w-5 h-5 mr-2" />
              )}
              {isRequestingOtp ? "Enviando código..." : "Enviar código de verificação"}
            </Button>

            <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>

        <OtpVerificationDialog
          open={isOtpModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeOtpModal();
            }
          }}
          email={user?.email || ""}
          otpCode={otpCode}
          onOtpChange={setOtpCode}
          onVerify={handleVerifyOtp}
          onResend={handleRequestOtp}
          isVerifying={isVerifyingOtp}
          isResending={isRequestingOtp}
          expiresAt={expiresAt}
          title="Verificação Administrativa"
          description={`Digite o código de 6 dígitos enviado para ${user?.email}`}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-64 min-h-screen">
        {/* Admin Header */}
        <div className="h-16 border-b border-border flex items-center justify-end px-6 bg-card/50">
          <NotificationsPopover />
        </div>
        <div className="p-6 w-full">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;
