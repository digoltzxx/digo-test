import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useOtpVerification } from "@/hooks/useOtpVerification";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import OtpVerificationDialog from "@/components/security/OtpVerificationDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User as UserIcon,
  FileText,
  Bell,
  Shield,
  Mail,
  CreditCard,
  MapPin,
  Building,
  Save,
  Upload,
  CheckCircle,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Lock,
  Camera,
  Clock,
  AlertCircle,
  Sun,
  Moon,
  KeyRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/useTheme";

const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const CATEGORIAS_MCC = [
  { value: "5411", label: "Supermercados" },
  { value: "5812", label: "Restaurantes" },
  { value: "5999", label: "Outros estabelecimentos" },
  { value: "7311", label: "Publicidade" },
  { value: "7392", label: "Consultoria" },
  { value: "8299", label: "Educação" },
  { value: "5818", label: "Produtos digitais" },
];

const ThemeSettingsCard = () => {
  const { theme, setTheme } = useTheme();
  
  return (
    <Card className="bg-card border-border lg:col-span-2">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-accent" />
            ) : (
              <Sun className="w-5 h-5 text-accent" />
            )}
          </div>
          <div>
            <CardTitle className="text-base">Aparência</CardTitle>
            <p className="text-xs text-muted-foreground">Escolha o tema da interface</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Button
            type="button"
            variant={theme === 'dark' ? 'default' : 'outline'}
            className={`flex-1 h-20 flex-col gap-2 ${theme === 'dark' ? 'bg-accent text-accent-foreground' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <Moon className="w-6 h-6" />
            <span>Tema Escuro</span>
          </Button>
          <Button
            type="button"
            variant={theme === 'light' ? 'default' : 'outline'}
            className={`flex-1 h-20 flex-col gap-2 ${theme === 'light' ? 'bg-accent text-accent-foreground' : ''}`}
            onClick={() => setTheme('light')}
          >
            <Sun className="w-6 h-6" />
            <span>Tema Claro</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const Configuracoes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>("pending");
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  
  // Get tab from URL or default to "documentos" if blocked
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "conta");
  
  const isVerified = verificationStatus === "approved";
  const isPending = verificationStatus === "pending";
  const isSubmitted = verificationStatus === "submitted";
  const isRejected = verificationStatus === "rejected";
  
  // When impersonating, allow full access
  const canAccessAllTabs = isVerified || isImpersonating;
  
  // Update tab when URL changes, but force documents tab if blocked
  useEffect(() => {
    if (!canAccessAllTabs) {
      setActiveTab("documentos");
    } else if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, canAccessAllTabs]);
  

  // Profile data
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    documento: "",
    tipoDocumento: "cpf",
  });

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Address data
  const [endereco, setEndereco] = useState({
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    complemento: "",
    cidade: "",
    estado: "",
    categoriaMcc: "",
  });

  // Documents
  const [documents, setDocuments] = useState<{
    identity_front: File | null;
    identity_back: File | null;
    selfie: File | null;
  }>({
    identity_front: null,
    identity_back: null,
    selfie: null,
  });

  // Notifications settings
  const [notifications, setNotifications] = useState({
    emailVendas: true,
    emailSaques: true,
    emailPromocoes: false,
    pushVendas: true,
    pushSaques: true,
  });

  // Security
  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [pendingPasswordChange, setPendingPasswordChange] = useState(false);

  // OTP verification for password change
  const {
    isOtpModalOpen,
    isRequestingOtp,
    isVerifyingOtp,
    otpCode,
    setOtpCode,
    requestOtp,
    verifyOtp,
    closeOtpModal,
  } = useOtpVerification({
    onVerified: () => {
      // After OTP verification, proceed with password change
      executePasswordChange();
    },
  });

  useEffect(() => {
    const fetchUser = async () => {
      // Check if impersonating
      const impersonatingUser = localStorage.getItem('impersonating_user');
      
      if (impersonatingUser) {
        setIsImpersonating(true);
        setImpersonatedUserId(impersonatingUser);
        
        // Fetch impersonated user's profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", impersonatingUser)
          .maybeSingle();

        if (profileData) {
          setProfile({
            fullName: profileData.full_name || "",
            email: profileData.email || "",
            documento: (profileData as any).document_number || "",
            tipoDocumento: (profileData as any).document_type || "cpf",
          });
          setVerificationStatus(profileData.verification_status || "pending");
          
          // Load address data
          setEndereco({
            cep: (profileData as any).cep || "",
            logradouro: (profileData as any).street || "",
            numero: (profileData as any).street_number || "",
            bairro: (profileData as any).neighborhood || "",
            complemento: (profileData as any).complement || "",
            cidade: (profileData as any).city || "",
            estado: (profileData as any).state || "",
            categoriaMcc: (profileData as any).mcc_category || "",
          });

          // Load avatar if exists
          if ((profileData as any).avatar_url) {
            setProfilePhoto((profileData as any).avatar_url);
          }
        }
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUser(session.user);

      // Fetch profile with verification status and extended fields
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          fullName: profileData.full_name || "",
          email: profileData.email || session.user.email || "",
          documento: (profileData as any).document_number || "",
          tipoDocumento: (profileData as any).document_type || "cpf",
        });
        
        let currentStatus = profileData.verification_status || "pending";
        
        // Se status é 'pending', verificar se os documentos já foram enviados
        if (currentStatus === 'pending') {
          const { data: docs } = await supabase
            .from('documents')
            .select('document_type, status')
            .eq('user_id', session.user.id);

          const uploadedTypes = new Set(
            (docs || [])
              .filter(doc => doc.status !== 'rejected')
              .map(doc => doc.document_type)
          );

          const requiredTypes = ['identity_front', 'identity_back', 'selfie'];
          const allTypesUploaded = requiredTypes.every(type => uploadedTypes.has(type));

          // Se todos os documentos foram enviados, atualizar status para 'submitted'
          if (allTypesUploaded) {
            await supabase
              .from('profiles')
              .update({ verification_status: 'submitted' })
              .eq('user_id', session.user.id);
            currentStatus = 'submitted';
          }
        }
        
        setVerificationStatus(currentStatus);
        
        // Load address data
        setEndereco({
          cep: (profileData as any).cep || "",
          logradouro: (profileData as any).street || "",
          numero: (profileData as any).street_number || "",
          bairro: (profileData as any).neighborhood || "",
          complemento: (profileData as any).complement || "",
          cidade: (profileData as any).city || "",
          estado: (profileData as any).state || "",
          categoriaMcc: (profileData as any).mcc_category || "",
        });

        // Load avatar if exists
        if ((profileData as any).avatar_url) {
          setProfilePhoto((profileData as any).avatar_url);
        }
      }
    };

    fetchUser();
  }, [navigate]);

  // Zod schema for ViaCEP API response validation
  const ViaCepSchema = z.object({
    logradouro: z.string().max(255).optional().nullable(),
    bairro: z.string().max(100).optional().nullable(),
    localidade: z.string().max(100).optional().nullable(),
    uf: z.string().max(2).optional().nullable(),
    erro: z.boolean().optional(),
  }).passthrough();

  const handleCepSearch = async () => {
    // Validate CEP format: exactly 8 digits
    const cepRegex = /^\d{8}$/;
    if (!cepRegex.test(endereco.cep)) {
      toast({
        title: "CEP inválido",
        description: "Digite um CEP válido com 8 dígitos numéricos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `https://viacep.com.br/ws/${endereco.cep}/json/`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error("Falha na requisição ao serviço de CEP");
      }
      
      const rawData = await response.json();
      
      // Validate response with Zod schema
      const parseResult = ViaCepSchema.safeParse(rawData);
      if (!parseResult.success) {
        throw new Error("Resposta inválida do serviço de CEP");
      }
      
      const data = parseResult.data;

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP e tente novamente.",
          variant: "destructive",
        });
      } else {
        setEndereco((prev) => ({
          ...prev,
          logradouro: (data.logradouro || "").slice(0, 255),
          bairro: (data.bairro || "").slice(0, 100),
          cidade: (data.localidade || "").slice(0, 100),
          estado: (data.uf || "").slice(0, 2),
        }));
        toast({
          title: "Endereço encontrado",
          description: "Os campos foram preenchidos automaticamente.",
        });
      }
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' 
        ? "Tempo limite excedido. Tente novamente."
        : "Tente novamente mais tarde.";
      toast({
        title: "Erro ao buscar CEP",
        description: message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
    if (!effectiveUserId) return;

    setLoading(true);
    
    try {
      // Upload photo if changed
      let avatarUrl = profilePhoto;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${effectiveUserId}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('user-documents')
          .upload(fileName, photoFile);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('user-documents')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
        }
      }

      // Update profile with all fields
      const { error } = await supabase
        .from("profiles")
        .update({ 
          full_name: profile.fullName,
          document_number: profile.documento,
          document_type: profile.tipoDocumento,
          cep: endereco.cep,
          street: endereco.logradouro,
          street_number: endereco.numero,
          neighborhood: endereco.bairro,
          complement: endereco.complemento,
          city: endereco.cidade,
          state: endereco.estado,
          mcc_category: endereco.categoriaMcc,
          avatar_url: avatarUrl,
        } as any)
        .eq("user_id", effectiveUserId);

      if (error) throw error;

      setPhotoFile(null);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A foto deve ter no máximo 5MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
        setPhotoFile(file);
        toast({
          title: "Foto selecionada",
          description: "Clique em salvar para atualizar sua foto de perfil.",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (type: keyof typeof documents, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [type]: file }));
    if (file) {
      toast({
        title: "Documento selecionado",
        description: `${file.name} foi selecionado.`,
      });
    }
  };

  const handleUploadDocuments = async () => {
    const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id;
    if (!effectiveUserId) return;
    
    const hasDocuments = Object.values(documents).some((doc) => doc !== null);
    if (!hasDocuments) {
      toast({
        title: "Nenhum documento",
        description: "Selecione pelo menos um documento.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Upload each document to Supabase Storage
      for (const [docType, file] of Object.entries(documents)) {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${effectiveUserId}/${docType}-${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('user-documents')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Save document record with file path (not public URL)
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              user_id: effectiveUserId,
              document_type: docType,
              file_name: file.name,
              file_url: fileName, // Store the path, not the public URL
              status: 'pending'
            });

          if (insertError) throw insertError;
        }
      }

      // Verificar se todos os 3 tipos de documentos foram enviados
      const { data: allDocs } = await supabase
        .from('documents')
        .select('document_type, status')
        .eq('user_id', effectiveUserId);

      const uploadedTypes = new Set(
        (allDocs || [])
          .filter(doc => doc.status !== 'rejected')
          .map(doc => doc.document_type)
      );

      const requiredTypes = ['identity_front', 'identity_back', 'selfie'];
      const allTypesUploaded = requiredTypes.every(type => uploadedTypes.has(type));

      // Se todos os documentos foram enviados, atualizar status para 'submitted'
      if (allTypesUploaded) {
        await supabase
          .from('profiles')
          .update({ verification_status: 'submitted' })
          .eq('user_id', effectiveUserId);

        setVerificationStatus('submitted');
      }
      
      toast({
        title: "Documentos enviados",
        description: allTypesUploaded 
          ? "Seus documentos foram enviados e estão aguardando análise. Aguarde a aprovação para liberar o acesso à plataforma."
          : "Documento(s) enviado(s). Continue enviando os documentos restantes.",
      });
      setDocuments({ identity_front: null, identity_back: null, selfie: null });
    } catch (error: any) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Erro ao enviar documentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    if (!profile.email) {
      toast({
        title: "Email não encontrado",
        description: "Não foi possível identificar seu email.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/dashboard/configuracoes?tab=seguranca`,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    }
  };

  // Execute password change after OTP verification
  const executePasswordChange = async () => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: security.newPassword,
    });
    setLoading(false);
    setPendingPasswordChange(false);

    if (error) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
      });
      setSecurity({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
  };

  const handleChangePassword = async () => {
    if (security.newPassword !== security.confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (security.newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    // Request OTP verification before allowing password change
    setPendingPasswordChange(true);
    const otpSent = await requestOtp(profile.email);
    if (!otpSent) {
      setPendingPasswordChange(false);
    }
  };

  const handleVerifyOtpAndChangePassword = async () => {
    const verified = await verifyOtp(profile.email, otpCode);
    // Password change is handled in onVerified callback
  };

  const handleResendOtp = async () => {
    await requestOtp(profile.email);
  };

  // Handle tab change - block if not allowed and update URL
  const handleTabChange = (value: string) => {
    if (!canAccessAllTabs && value !== "documentos") {
      toast({
        title: "Acesso bloqueado",
        description: "Aguarde a aprovação dos documentos para acessar outras áreas.",
        variant: "destructive",
      });
      return;
    }
    setActiveTab(value);
    // Atualizar URL sem recarregar a página
    navigate(`/dashboard/configuracoes?tab=${value}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start bg-card border border-border rounded-lg p-1 h-auto flex-wrap">
            <TabsTrigger
              value="conta"
              disabled={!canAccessAllTabs}
              className={`data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 ${!canAccessAllTabs ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <UserIcon className="w-4 h-4" />
              MINHA CONTA
            </TabsTrigger>
            <TabsTrigger 
              value="documentos" 
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2"
            >
              <FileText className="w-4 h-4" />
              DOCUMENTOS
            </TabsTrigger>
            <TabsTrigger 
              value="notificacoes" 
              disabled={!canAccessAllTabs}
              className={`data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 ${!canAccessAllTabs ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Bell className="w-4 h-4" />
              NOTIFICAÇÕES
            </TabsTrigger>
            <TabsTrigger 
              value="seguranca" 
              disabled={!canAccessAllTabs}
              className={`data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 ${!canAccessAllTabs ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Shield className="w-4 h-4" />
              SEGURANÇA
            </TabsTrigger>
          </TabsList>

          {/* Minha Conta */}
          <TabsContent value="conta" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Info básica */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <UserIcon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Minha Conta</CardTitle>
                        <p className="text-xs text-muted-foreground">Informações básicas</p>
                      </div>
                    </div>
                    
                    {/* Profile Photo */}
                    <div className="relative group">
                      <Avatar className="w-16 h-16 border-2 border-accent/30">
                        <AvatarImage src={profilePhoto || undefined} alt="Foto de perfil" />
                        <AvatarFallback className="bg-accent text-accent-foreground text-xl font-semibold">
                          {profile.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <Label 
                        htmlFor="photo-upload" 
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-white" />
                      </Label>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <UserIcon className="w-3 h-3" />
                      Nome
                    </Label>
                    <Input
                      value={profile.fullName}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      E-mail
                    </Label>
                    <Input
                      value={profile.email}
                      disabled
                      className="bg-secondary/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <CreditCard className="w-3 h-3" />
                      Documento
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={profile.documento}
                        onChange={(e) => setProfile({ ...profile, documento: e.target.value })}
                        placeholder={profile.tipoDocumento === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        className="flex-1"
                      />
                      <div className="flex border border-border rounded-md overflow-hidden">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className={`rounded-none border-r border-border ${
                            profile.tipoDocumento === "cpf" 
                              ? "bg-accent text-accent-foreground" 
                              : "hover:bg-secondary/50"
                          }`}
                          onClick={() => setProfile({ ...profile, tipoDocumento: "cpf", documento: "" })}
                        >
                          Pessoa Física
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className={`rounded-none ${
                            profile.tipoDocumento === "cnpj" 
                              ? "bg-accent text-accent-foreground" 
                              : "hover:bg-secondary/50"
                          }`}
                          onClick={() => setProfile({ ...profile, tipoDocumento: "cnpj", documento: "" })}
                        >
                          Pessoa Jurídica
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dados Cadastrais */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Building className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Dados Cadastrais</CardTitle>
                      <p className="text-xs text-muted-foreground">Atualize suas informações</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <CreditCard className="w-3 h-3" />
                      Categoria do Negócio (MCC)
                    </Label>
                    <Select
                      value={endereco.categoriaMcc}
                      onValueChange={(value) => setEndereco({ ...endereco, categoriaMcc: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_MCC.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">
                      O MCC identifica o tipo de negócio da sua empresa
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      Endereço
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={endereco.cep}
                          onChange={(e) => setEndereco({ ...endereco, cep: e.target.value.replace(/\D/g, "") })}
                          onBlur={handleCepSearch}
                          placeholder="CEP"
                          className="pl-9"
                          maxLength={8}
                        />
                      </div>
                      <Input
                        value={endereco.logradouro}
                        onChange={(e) => setEndereco({ ...endereco, logradouro: e.target.value })}
                        placeholder="Logradouro"
                        className="col-span-1"
                      />
                      <Input
                        value={endereco.numero}
                        onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
                        placeholder="Número"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={endereco.bairro}
                        onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
                        placeholder="Bairro"
                      />
                      <Input
                        value={endereco.complemento}
                        onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
                        placeholder="Complemento"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={endereco.cidade}
                        onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
                        placeholder="Cidade"
                      />
                      <Select
                        value={endereco.estado}
                        onValueChange={(value) => setEndereco({ ...endereco, estado: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {ESTADOS_BR.map((uf) => (
                            <SelectItem key={uf} value={uf}>
                              {uf}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Theme Settings */}
              <ThemeSettingsCard />
            </div>

            {/* Save Button */}
            <div className="flex justify-end mt-6">
              <Button
                onClick={handleSaveProfile}
                disabled={loading}
                className="bg-accent hover:bg-accent/90"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                SALVAR ALTERAÇÕES
              </Button>
            </div>
          </TabsContent>

          {/* Documentos */}
          <TabsContent value="documentos" className="mt-6 space-y-6">
            {/* Alert de status de verificação - só mostra quando aprovado */}
            {verificationStatus === "approved" && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                <div className="p-1 rounded-full bg-green-500/20">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-sm text-green-500">
                  🎉 Parabéns! Sua conta está verificada! Você tem acesso completo a todas as funcionalidades.
                </p>
              </div>
            )}

            {/* Mostrar grid de upload apenas se pending ou rejected */}
            {(verificationStatus === "pending" || verificationStatus === "rejected") && (
              <>
                {/* Grid de documentos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Documento de Identidade - Frente */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="w-5 h-5" />
                        Documento - Frente
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Frente do RG ou CNH</p>
                    </CardHeader>
                    <CardContent>
                      <Label htmlFor="identity-front-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center gap-2 p-8 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                          {documents.identity_front ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          ) : (
                            <Upload className="w-8 h-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {documents.identity_front ? documents.identity_front.name : "Clique para enviar"}
                          </span>
                        </div>
                      </Label>
                      <input
                        id="identity-front-upload"
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileChange("identity_front", e.target.files?.[0] || null)}
                      />
                    </CardContent>
                  </Card>

                  {/* Documento de Identidade - Verso */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="w-5 h-5" />
                        Documento - Verso
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Verso do RG ou CNH</p>
                    </CardHeader>
                    <CardContent>
                      <Label htmlFor="identity-back-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center gap-2 p-8 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                          {documents.identity_back ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          ) : (
                            <Upload className="w-8 h-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {documents.identity_back ? documents.identity_back.name : "Clique para enviar"}
                          </span>
                        </div>
                      </Label>
                      <input
                        id="identity-back-upload"
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => handleFileChange("identity_back", e.target.files?.[0] || null)}
                      />
                    </CardContent>
                  </Card>

                  {/* Selfie com Documento */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <UserIcon className="w-5 h-5" />
                        Selfie com Documento
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">Foto segurando o documento próximo ao rosto</p>
                    </CardHeader>
                    <CardContent>
                      <Label htmlFor="selfie-upload-card" className="cursor-pointer">
                        <div className="flex flex-col items-center justify-center gap-2 p-8 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                          {documents.selfie ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                          ) : (
                            <Upload className="w-8 h-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {documents.selfie ? documents.selfie.name : "Clique para enviar"}
                          </span>
                        </div>
                      </Label>
                      <input
                        id="selfie-upload-card"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange("selfie", e.target.files?.[0] || null)}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Botão de enviar */}
                <Button
                  onClick={handleUploadDocuments}
                  disabled={loading || !Object.values(documents).some((d) => d !== null)}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Enviar Documentos
                </Button>
              </>
            )}

            {/* Mensagem para documentos já enviados (submitted ou approved) */}
            {(verificationStatus === "submitted" || verificationStatus === "approved") && (
              <Card className="bg-card border-border">
                <CardContent className="p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className={`p-4 rounded-full ${verificationStatus === "approved" ? "bg-green-500/20" : "bg-blue-500/20"}`}>
                      {verificationStatus === "approved" ? (
                        <CheckCircle className="w-12 h-12 text-green-500" />
                      ) : (
                        <Clock className="w-12 h-12 text-blue-500" />
                      )}
                    </div>
                    <h3 className={`text-xl font-semibold ${verificationStatus === "approved" ? "text-green-500" : "text-blue-500"}`}>
                      {verificationStatus === "approved" 
                        ? "Documentos Aprovados!" 
                        : "Documentos Enviados!"}
                    </h3>
                    <p className="text-muted-foreground max-w-md">
                      {verificationStatus === "approved" 
                        ? "Seus documentos já foram aprovados. Você tem acesso completo a todas as funcionalidades da plataforma." 
                        : "Seus documentos já foram enviados e estão em análise. Você será notificado assim que a verificação for concluída."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notificacoes" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Bell className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Notificações</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Configure suas preferências de notificação
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-4">Notificações por E-mail</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Vendas aprovadas</p>
                        <p className="text-xs text-muted-foreground">Receba e-mails quando uma venda for aprovada</p>
                      </div>
                      <Switch
                        checked={notifications.emailVendas}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, emailVendas: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Saques processados</p>
                        <p className="text-xs text-muted-foreground">Receba e-mails sobre status de saques</p>
                      </div>
                      <Switch
                        checked={notifications.emailSaques}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, emailSaques: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Promoções e novidades</p>
                        <p className="text-xs text-muted-foreground">Receba e-mails sobre promoções</p>
                      </div>
                      <Switch
                        checked={notifications.emailPromocoes}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, emailPromocoes: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <h3 className="font-medium mb-4">Notificações Push</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Vendas em tempo real</p>
                        <p className="text-xs text-muted-foreground">Notificações instantâneas de vendas</p>
                      </div>
                      <Switch
                        checked={notifications.pushVendas}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, pushVendas: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">Saques em tempo real</p>
                        <p className="text-xs text-muted-foreground">Notificações instantâneas de saques</p>
                      </div>
                      <Switch
                        checked={notifications.pushSaques}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, pushSaques: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seguranca" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Shield className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Segurança</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Altere sua senha e configure opções de segurança
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 max-w-md">
                {/* Password Reset via Email */}
                <div className="p-4 border border-border rounded-lg bg-secondary/20">
                  <h3 className="text-sm font-medium mb-2">Redefinir senha por e-mail</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Enviaremos um link para {profile.email || "seu email"} para redefinir sua senha com segurança.
                  </p>
                  <Button
                    onClick={handleSendPasswordResetEmail}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Enviar link de redefinição
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou altere diretamente</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Senha atual
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.current ? "text" : "password"}
                      value={security.currentPassword}
                      onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.new ? "text" : "password"}
                      value={security.newPassword}
                      onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={loading || isRequestingOtp || !security.newPassword || !security.confirmPassword}
                  className="w-full"
                >
                  {loading || isRequestingOtp ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  Alterar Senha com Verificação OTP
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* OTP Verification Dialog for Password Change */}
        <OtpVerificationDialog
          open={isOtpModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeOtpModal();
              setPendingPasswordChange(false);
            }
          }}
          email={profile.email}
          otpCode={otpCode}
          onOtpChange={setOtpCode}
          onVerify={handleVerifyOtpAndChangePassword}
          onResend={handleResendOtp}
          isVerifying={isVerifyingOtp}
          isResending={isRequestingOtp}
          title="Verificação de segurança"
          description="Para alterar sua senha, precisamos verificar sua identidade. Digite o código de 6 dígitos enviado para seu e-mail."
        />
      </div>
    </DashboardLayout>
  );
};

export default Configuracoes;
