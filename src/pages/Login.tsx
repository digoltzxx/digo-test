import { useState, useEffect, useCallback, useRef } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft, KeyRound, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Logo from "@/components/ui/Logo";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useOtpVerification } from "@/hooks/useOtpVerification";


type AuthMode = "password" | "otp-request" | "otp-verify" | "password-otp-verify" | "forgot-password" | "forgot-password-otp" | "reset-password";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [otpCode, setOtpCode] = useState("");
  const [forgotPasswordOtpCode, setForgotPasswordOtpCode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [canResend, setCanResend] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Ref to block navigation during OTP flow (refs are synchronous, unlike state)
  const isInOtpFlowRef = useRef(false);

  // OTP verification for password login
  const {
    isRequestingOtp,
    isVerifyingOtp,
    otpCode: passwordOtpCode,
    expiresAt,
    setOtpCode: setPasswordOtpCode,
    requestOtp,
    verifyOtp,
    verifyOtpWithSession,
    resetOtp,
  } = useOtpVerification({
    purpose: "login",
    skipModal: true, // Use inline form instead of modal
    onError: (error) => {
      if (import.meta.env.DEV) console.error("OTP verification error:", error);
    }
  });

  useEffect(() => {
    // Check if user is already logged in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Block navigation if we're in OTP flow (using ref for synchronous check)
        if (isInOtpFlowRef.current) {
          console.log("[Login] Blocking redirect - in OTP flow");
          return;
        }
        // Block if in password-otp-verify mode
        if (authMode === "password-otp-verify") {
          console.log("[Login] Blocking redirect - in password-otp-verify mode");
          return;
        }
        // Only auto-redirect if has session
        if (session) {
          console.log("[Login] Redirecting to dashboard - session active");
          navigate("/dashboard");
        }
      }
    );

    // Initial session check - only if not in OTP flow
    if (!isInOtpFlowRef.current && authMode === "password") {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !isInOtpFlowRef.current && authMode === "password") {
          navigate("/dashboard");
        }
      });
    }

    return () => subscription.unsubscribe();
  }, [navigate, authMode]);

  // Timer for OTP expiration
  useEffect(() => {
    if (!expiresAt && !otpExpiresAt) {
      setTimeRemaining(null);
      return;
    }

    const targetExpiry = expiresAt || otpExpiresAt;
    if (!targetExpiry) return;

    const updateTimer = () => {
      const now = new Date();
      const diff = targetExpiry.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining(0);
        setCanResend(true);
      } else {
        setTimeRemaining(Math.floor(diff / 1000));
        // Enable resend after 30 seconds
        setCanResend(diff < (4.5 * 60 * 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, otpExpiresAt]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Set flag BEFORE signing in to block navigation from onAuthStateChange
    isInOtpFlowRef.current = true;
    console.log("[Login] Starting login flow - OTP flag set to true");
    
    try {
      // First, verify credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        isInOtpFlowRef.current = false;
        console.log("[Login] Login error - OTP flag reset");
        let errorMessage = "Erro ao fazer login. Tente novamente.";
        
        if (error.message.includes("Invalid login credentials")) {
          errorMessage = "E-mail ou senha incorretos.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Por favor, confirme seu e-mail antes de fazer login.";
        }
        
        toast({
          title: "Erro no login",
          description: errorMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      if (data.user) {
        console.log("[Login] Password verified - checking profile");
        
        // Check if user account is blocked/deleted
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_blocked, blocked_reason, verification_status")
          .eq("user_id", data.user.id)
          .maybeSingle();
        
        if (profile?.is_blocked) {
          await supabase.auth.signOut();
          isInOtpFlowRef.current = false;
          
          toast({
            title: "Conta excluída",
            description: profile.blocked_reason || "Esta conta foi excluída ou suspensa. Entre em contato com o suporte para mais informações.",
            variant: "destructive",
            duration: 10000,
          });
          setIsLoading(false);
          return;
        }

        if (profile?.verification_status === "deleted") {
          await supabase.auth.signOut();
          isInOtpFlowRef.current = false;
          
          toast({
            title: "Conta excluída",
            description: "Esta conta foi permanentemente excluída e não pode mais ser acessada.",
            variant: "destructive",
            duration: 10000,
          });
          setIsLoading(false);
          return;
        }
        
        // Password is correct - sign out to require OTP
        console.log("[Login] Signing out to require OTP verification");
        await supabase.auth.signOut();
        
        // Store user ID for later
        const userId = data.user.id;
        setPendingUserId(userId);
        
        // Request OTP for additional security
        console.log("[Login] Requesting OTP for:", email.trim());
        const otpSent = await requestOtp(email.trim(), userId);
        
        console.log("[Login] OTP request result:", otpSent);
        
        if (otpSent) {
          // Change to OTP mode
          console.log("[Login] OTP sent - switching to verify mode");
          setAuthMode("password-otp-verify");
        } else {
          isInOtpFlowRef.current = false;
          console.log("[Login] OTP failed - resetting flow");
          toast({
            title: "Erro ao enviar código",
            description: "Não foi possível enviar o código de verificação. Tente novamente.",
            variant: "destructive",
          });
          setPendingUserId(null);
        }
      }
    } catch (err) {
      console.error("[Login] Unexpected error:", err);
      isInOtpFlowRef.current = false;
      toast({
        title: "Erro",
        description: "Erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  const handlePasswordOtpVerify = async () => {
    const verified = await verifyOtp(email.trim(), passwordOtpCode);
    if (verified) {
      // OTP verified - reset flag and sign in again
      isInOtpFlowRef.current = false;
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        toast({
          title: "Erro ao finalizar login",
          description: "Tente fazer login novamente.",
          variant: "destructive",
        });
        setAuthMode("password");
        setIsLoading(false);
        return;
      }
      
      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta ao Royal Pay.",
      });
      navigate("/dashboard");
      setIsLoading(false);
    }
  };

  const handleResendPasswordOtp = async () => {
    await requestOtp(email.trim(), pendingUserId || undefined);
  };

  const cancelPasswordOtp = async () => {
    isInOtpFlowRef.current = false; // Reset flag when canceling
    resetOtp();
    setAuthMode("password");
    setPendingUserId(null);
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "E-mail obrigatório",
        description: "Por favor, digite seu e-mail para receber o código.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Use our custom OTP system via Brevo instead of Supabase magic link
    const otpSent = await requestOtp(email.trim());
    
    if (otpSent) {
      setAuthMode("otp-verify");
      // Set expiration for timer display
      setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000));
    }
    
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpCode.length !== 6) {
      toast({
        title: "Código incompleto",
        description: "Por favor, digite o código de 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // Verify OTP and get magic link for session creation
    const result = await verifyOtpWithSession(email.trim(), otpCode);
    
    if (result.valid) {
      if (result.magicLink) {
        // Use the magic link to complete authentication
        toast({
          title: "Verificação concluída!",
          description: "Redirecionando para o painel...",
        });
        window.location.href = result.magicLink;
      } else {
        // Fallback: no magic link, show error
        toast({
          title: "Erro ao criar sessão",
          description: "Não foi possível completar o login. Tente com senha.",
          variant: "destructive",
        });
        setAuthMode("password");
      }
    }
    
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({
        title: "Email necessário",
        description: "Por favor, digite seu email no campo acima para recuperar a senha.",
        variant: "destructive",
      });
      return;
    }

    setAuthMode("forgot-password");
  };

  const handleSendForgotPasswordOtp = async () => {
    if (!email) {
      toast({
        title: "Email necessário",
        description: "Por favor, digite seu email.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim(), purpose: "password_reset" },
      });

      if (error || data?.error) {
        toast({
          title: "Erro ao enviar código",
          description: data?.error || "Não foi possível enviar o código. Tente novamente.",
          variant: "destructive",
        });
        setIsResettingPassword(false);
        return;
      }

      if (data?.expiresAt) {
        setOtpExpiresAt(new Date(data.expiresAt));
      }

      toast({
        title: "Código enviado!",
        description: "Verifique seu e-mail. O código expira em 5 minutos.",
      });
      
      setAuthMode("forgot-password-otp");
      setForgotPasswordOtpCode("");
    } catch (err) {
      console.error("Error sending forgot password OTP:", err);
      toast({
        title: "Erro",
        description: "Erro ao enviar código de verificação.",
        variant: "destructive",
      });
    }
    
    setIsResettingPassword(false);
  };

  const handleVerifyForgotPasswordOtp = async () => {
    if (forgotPasswordOtpCode.length !== 6) {
      toast({
        title: "Código incompleto",
        description: "Por favor, digite o código de 6 dígitos.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Verify the OTP code
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email: email.trim(), code: forgotPasswordOtpCode, purpose: "password_reset" },
      });

      if (error || !data?.valid) {
        toast({
          title: "Código inválido",
          description: data?.error || "Código inválido ou expirado.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // OTP verified - go to reset password screen
      toast({
        title: "Código verificado!",
        description: "Agora você pode definir sua nova senha.",
      });
      
      setAuthMode("reset-password");
    } catch (err) {
      console.error("Error verifying OTP:", err);
      toast({
        title: "Erro",
        description: "Erro ao verificar código.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha a nova senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { 
          email: email.trim(), 
          code: forgotPasswordOtpCode, 
          newPassword 
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Erro ao redefinir senha",
          description: data?.error || "Não foi possível redefinir a senha. Tente novamente.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi alterada com sucesso. Faça login com a nova senha.",
      });
      
      // Reset to password mode
      setAuthMode("password");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotPasswordOtpCode("");
      setOtpExpiresAt(null);
    } catch (err) {
      console.error("Error resetting password:", err);
      toast({
        title: "Erro",
        description: "Erro ao redefinir senha.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const cancelForgotPassword = () => {
    setAuthMode("password");
    setForgotPasswordOtpCode("");
    setNewPassword("");
    setConfirmPassword("");
    setOtpExpiresAt(null);
  };

  const resetToPasswordMode = () => {
    setAuthMode("password");
    setOtpCode("");
  };

  const switchToOtpMode = () => {
    setAuthMode("otp-request");
    setPassword("");
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative py-8 px-4">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20 blur-[150px]"
          style={{
            background: 'linear-gradient(180deg, hsl(210 100% 55%), hsl(220 90% 50%))'
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar ao início</span>
        </Link>

        <div className="bg-card/60 border border-border/50 backdrop-blur-xl rounded-2xl p-8 md:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {authMode === "otp-verify" ? "Digite o código" : "Acesse sua conta"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {authMode === "otp-verify" 
                ? `Enviamos um código de 6 dígitos para ${email}`
                : authMode === "otp-request"
                  ? "Receba um código de acesso no seu e-mail"
                  : "Entre no painel para gerenciar seus pagamentos"}
            </p>
          </div>

          {/* Password Form */}
          {authMode === "password" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-12 pr-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Lembrar-me
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-sm text-accent hover:text-accent/80 transition-colors font-medium disabled:opacity-50"
                >
                  {isResettingPassword ? "Enviando..." : "Esqueci minha senha"}
                </button>
              </div>

              {/* Security notice */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Por segurança, você sempre receberá um código de verificação por e-mail, mesmo com "Lembrar-me" ativado.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              {/* OTP Login Option */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card/60 px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={switchToOtpMode}
                className="w-full h-12 border-border/50 hover:bg-secondary/50 gap-2"
              >
                <KeyRound className="w-5 h-5" />
                <span>Entrar com código por e-mail</span>
              </Button>
            </form>
          )}

          {/* Password OTP Verification */}
          {authMode === "password-otp-verify" && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <Shield className="w-5 h-5 text-accent" />
                <p className="text-sm text-center">
                  Verificação de segurança obrigatória
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>
              </p>

              {/* Timer display */}
              {timeRemaining !== null && (
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg ${
                    timeRemaining <= 0
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : timeRemaining < 60
                      ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                      : "bg-accent/10 text-accent border border-accent/20"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-medium text-sm">
                    {timeRemaining <= 0 
                      ? "Código expirado - solicite um novo" 
                      : `Código expira em ${formatTime(timeRemaining)}`}
                  </span>
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={passwordOtpCode}
                  onChange={(value) => setPasswordOtpCode(value)}
                  disabled={timeRemaining !== null && timeRemaining <= 0}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                  </InputOTPGroup>
                </InputOTP>
                
                <p className="text-muted-foreground text-sm text-center">
                  Não recebeu o código?{" "}
                  <button
                    type="button"
                    onClick={handleResendPasswordOtp}
                    disabled={isRequestingOtp || (!canResend && timeRemaining !== null && timeRemaining > 0)}
                    className="text-accent hover:text-accent/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRequestingOtp ? "Enviando..." : canResend || timeRemaining === null || timeRemaining <= 0 ? "Reenviar" : `Reenviar em ${formatTime(Math.max(0, (timeRemaining || 0) - 270))}`}
                  </button>
                </p>
              </div>

              <Button
                onClick={handlePasswordOtpVerify}
                disabled={isVerifyingOtp || passwordOtpCode.length !== 6 || (timeRemaining !== null && timeRemaining <= 0)}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isVerifyingOtp ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{timeRemaining !== null && timeRemaining <= 0 ? "Código expirado" : "Verificar e entrar"}</span>
                    {!(timeRemaining !== null && timeRemaining <= 0) && (
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    )}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={cancelPasswordOtp}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancelar e voltar
              </Button>
            </div>
          )}

          {/* OTP Request Form */}
          {authMode === "otp-request" && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="otp-email" className="text-sm font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Enviar código</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={resetToPasswordMode}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para login com senha
              </Button>
            </form>
          )}

          {/* OTP Verify Form */}
          {authMode === "otp-verify" && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              {/* OTP Input */}
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(value) => setOtpCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                  </InputOTPGroup>
                </InputOTP>
                
                <p className="text-muted-foreground text-sm text-center">
                  Não recebeu o código?{" "}
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={isLoading}
                    className="text-accent hover:text-accent/80 font-medium disabled:opacity-50"
                  >
                    Reenviar
                  </button>
                </p>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Verificar código</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={resetToPasswordMode}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para login com senha
              </Button>
            </form>
          )}

          {/* Forgot Password - Email Input */}
          {authMode === "forgot-password" && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <KeyRound className="w-5 h-5 text-accent" />
                <p className="text-sm text-center">
                  Recuperação de senha
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Digite seu e-mail para receber um código de verificação
              </p>

              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                </div>
              </div>

              <Button
                onClick={handleSendForgotPasswordOtp}
                disabled={isResettingPassword}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isResettingPassword ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Enviar código</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={cancelForgotPassword}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para login
              </Button>
            </div>
          )}

          {/* Forgot Password - OTP Verification */}
          {authMode === "forgot-password-otp" && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <Shield className="w-5 h-5 text-accent" />
                <p className="text-sm text-center">
                  Verificação de código
                </p>
              </div>
              
              <p className="text-sm text-muted-foreground text-center">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>
              </p>

              {/* Timer display */}
              {timeRemaining !== null && (
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg ${
                    timeRemaining <= 0
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : timeRemaining < 60
                      ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                      : "bg-accent/10 text-accent border border-accent/20"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-medium text-sm">
                    {timeRemaining <= 0 
                      ? "Código expirado - solicite um novo" 
                      : `Código expira em ${formatTime(timeRemaining)}`}
                  </span>
                </div>
              )}

              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={forgotPasswordOtpCode}
                  onChange={(value) => setForgotPasswordOtpCode(value)}
                  disabled={timeRemaining !== null && timeRemaining <= 0}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-lg bg-secondary/50 border-border/50" />
                  </InputOTPGroup>
                </InputOTP>
                
                <p className="text-muted-foreground text-sm text-center">
                  Não recebeu o código?{" "}
                  <button
                    type="button"
                    onClick={handleSendForgotPasswordOtp}
                    disabled={isResettingPassword || (timeRemaining !== null && timeRemaining > 270)}
                    className="text-accent hover:text-accent/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResettingPassword ? "Enviando..." : "Reenviar"}
                  </button>
                </p>
              </div>

              <Button
                onClick={handleVerifyForgotPasswordOtp}
                disabled={isLoading || forgotPasswordOtpCode.length !== 6 || (timeRemaining !== null && timeRemaining <= 0)}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{timeRemaining !== null && timeRemaining <= 0 ? "Código expirado" : "Verificar código"}</span>
                    {!(timeRemaining !== null && timeRemaining <= 0) && (
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    )}
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={cancelForgotPassword}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancelar e voltar
              </Button>
            </div>
          )}

          {/* Reset Password Form */}
          {authMode === "reset-password" && (
            <div className="space-y-5">
              <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <Lock className="w-5 h-5 text-green-500" />
                <p className="text-sm text-center text-green-400">
                  Código verificado! Defina sua nova senha
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-12 pr-12 h-12 bg-secondary/50 border-border/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirm-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-12 h-12 bg-secondary/50 border-border/50"
                      required
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Redefinir senha</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={cancelForgotPassword}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancelar e voltar
              </Button>
            </div>
          )}

          {/* Create account link */}
          {authMode === "password" && (
            <div className="mt-8 text-center">
              <p className="text-muted-foreground text-sm">
                Ainda não tem uma conta?{" "}
                <Link to="/cadastro" className="text-accent hover:text-accent/80 font-semibold transition-colors">
                  Criar conta
                </Link>
              </p>
            </div>
          )}

          {/* Security badge */}
          <div className="mt-8 pt-6 border-t border-border/30">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Conexão segura com criptografia SSL</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
