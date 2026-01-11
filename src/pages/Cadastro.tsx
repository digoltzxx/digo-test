import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ArrowLeft, User, KeyRound, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Logo from "@/components/ui/Logo";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type SignupStep = "form" | "verify-email";
type DocumentType = "cpf" | "cnpj";

// Validation functions
const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10]);
};

const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleaned[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleaned[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cleaned[13]);
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  return cleaned
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatCNPJ = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 14);
  return cleaned
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const Cadastro = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [otpCode, setOtpCode] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("cpf");
  const [documentNumber, setDocumentNumber] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate("/dashboard");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleDocumentChange = (value: string) => {
    const formatted = documentType === "cpf" ? formatCPF(value) : formatCNPJ(value);
    setDocumentNumber(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword || !documentNumber) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    // Validate document
    const cleanedDoc = documentNumber.replace(/\D/g, "");
    if (documentType === "cpf") {
      if (!validateCPF(cleanedDoc)) {
        toast({
          title: "CPF inválido",
          description: "Por favor, insira um CPF válido.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!validateCNPJ(cleanedDoc)) {
        toast({
          title: "CNPJ inválido",
          description: "Por favor, insira um CNPJ válido.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate password strength
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (password.length < 8 || !hasLetter || !hasNumber || !hasSymbol) {
      toast({
        title: "Senha fraca",
        description: "A senha deve ter no mínimo 8 caracteres, incluindo letras, números e símbolos.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "As senhas digitadas não são iguais.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: "Termos obrigatórios",
        description: "Você precisa aceitar os termos de uso.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Check if document number already exists
    const { data: existingDocument } = await supabase
      .from('profiles')
      .select('id')
      .eq('document_number', cleanedDoc)
      .maybeSingle();

    if (existingDocument) {
      setIsLoading(false);
      toast({
        title: "Documento já cadastrado",
        description: `Este ${documentType.toUpperCase()} já está vinculado a outra conta.`,
        variant: "destructive",
      });
      return;
    }

    // Check if email already exists in profiles
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      setIsLoading(false);
      toast({
        title: "E-mail já cadastrado",
        description: "Este e-mail já está vinculado a outra conta. Faça login ou use outro e-mail.",
        variant: "destructive",
      });
      return;
    }
    
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
          document_type: documentType,
          document_number: cleanedDoc,
        },
      },
    });
    
    setIsLoading(false);

    if (error) {
      let errorMessage = "Erro ao criar conta. Tente novamente.";
      
      if (error.message.includes("User already registered")) {
        errorMessage = "Este e-mail já está cadastrado. Faça login ou use outro e-mail.";
      } else if (error.message.includes("Invalid email")) {
        errorMessage = "Por favor, insira um e-mail válido.";
      } else if (error.message.includes("Password")) {
        errorMessage = "A senha deve ter pelo menos 6 caracteres.";
      }
      
      toast({
        title: "Erro no cadastro",
        description: errorMessage,
        variant: "destructive",
      });
    } else if (data.user) {
      // Check if email confirmation is required
      if (data.session) {
        // Auto-confirm is enabled, user is logged in
        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo ao Royal Pay!",
        });
        navigate("/dashboard");
      } else {
        // Email confirmation required - show OTP verification step
        toast({
          title: "Código enviado!",
          description: "Verifique sua caixa de entrada e digite o código de verificação.",
        });
        setSignupStep("verify-email");
      }
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
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
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode,
      type: "signup",
    });
    
    setIsLoading(false);

    if (error) {
      let errorMessage = "Código inválido ou expirado. Tente novamente.";
      
      if (error.message.includes("Token has expired")) {
        errorMessage = "O código expirou. Solicite um novo código.";
      } else if (error.message.includes("Invalid")) {
        errorMessage = "Código incorreto. Verifique e tente novamente.";
      }
      
      toast({
        title: "Erro na verificação",
        description: errorMessage,
        variant: "destructive",
      });
    } else if (data.user) {
      toast({
        title: "Conta verificada!",
        description: "Bem-vindo ao Royal Pay!",
      });
      navigate("/dashboard");
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    
    setIsLoading(false);

    if (error) {
      toast({
        title: "Erro ao reenviar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Código reenviado!",
        description: "Verifique sua caixa de entrada.",
      });
    }
  };

  const handleBackToForm = () => {
    setSignupStep("form");
    setOtpCode("");
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
              {signupStep === "verify-email" ? "Verifique seu e-mail" : "Crie sua conta"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {signupStep === "verify-email" 
                ? `Enviamos um código de 6 dígitos para ${email}`
                : "Comece a vender produtos digitais hoje mesmo"}
            </p>
          </div>

          {/* Registration Form */}
          {signupStep === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                </div>
              </div>

              {/* Document Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de documento</Label>
                <RadioGroup
                  value={documentType}
                  onValueChange={(value) => {
                    setDocumentType(value as DocumentType);
                    setDocumentNumber("");
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="cpf" />
                    <Label htmlFor="cpf" className="cursor-pointer">CPF (Pessoa Física)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cnpj" id="cnpj" />
                    <Label htmlFor="cnpj" className="cursor-pointer">CNPJ (Pessoa Jurídica)</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Document Number Field */}
              <div className="space-y-2">
                <Label htmlFor="documentNumber" className="text-sm font-medium">
                  {documentType === "cpf" ? "CPF" : "CNPJ"}
                </Label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="documentNumber"
                    type="text"
                    placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                    value={documentNumber}
                    onChange={(e) => handleDocumentChange(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Este documento não poderá ser alterado após o cadastro.
                </p>
              </div>

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
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, incluindo letras, números e símbolos (!@#$%...)
                </p>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 h-12 bg-secondary/50 border-border/50"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                  Eu concordo com os{" "}
                  <a 
                    href="/termos-de-uso" 
                    className="text-accent hover:underline"
                  >
                    Termos de Uso
                  </a>
                  {" "}e{" "}
                  <a 
                    href="/politica-de-privacidade" 
                    className="text-accent hover:underline"
                  >
                    Política de Privacidade
                  </a>
                </Label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group mt-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Criar conta</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Email Verification Step */}
          {signupStep === "verify-email" && (
            <form onSubmit={handleVerifyEmail} className="space-y-5">
              <div className="flex flex-col items-center gap-4">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                  <KeyRound className="h-6 w-6 text-accent" />
                </div>
                
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
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-accent hover:text-accent/80 font-medium disabled:opacity-50"
                  >
                    Reenviar
                  </button>
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full h-12 bg-foreground text-background font-semibold text-base hover:bg-foreground/90 transition-all group"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Verificar e-mail</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleBackToForm}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para o cadastro
              </Button>
            </form>
          )}

          {/* Login link */}
          {signupStep === "form" && (
            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                Já tem uma conta?{" "}
                <Link to="/login" className="text-accent hover:text-accent/80 font-semibold transition-colors">
                  Fazer login
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Cadastro;
