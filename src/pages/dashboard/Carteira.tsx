import { useState, useEffect } from "react";
import { bankAccountSchema, validateData } from "@/lib/validations";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  ArrowUpRight, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Copy,
  Plus,
  FileText,
  CreditCard,
  Banknote,
  Shield,
  Check,
  X,
  Trash2,
  Building2,
  Key,
  User,
  RefreshCw,
  Timer,
  Zap
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRevenue } from "@/contexts/RevenueContext";
import { useAvailableBalance } from "@/hooks/useAvailableBalance";
import { useOtpVerification } from "@/hooks/useOtpVerification";
import { STATUS_MESSAGES } from "@/lib/financialStatusConfig";
import { CommissionAnticipationTab } from "@/components/dashboard/CommissionAnticipationTab";

// Interface removida - agora usa useAvailableBalance

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  agency: string;
  pix_key: string | null;
  pix_key_type: string | null;
  status: string;
  account_type: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  bank_account_id: string;
  bank_accounts?: BankAccount;
}

const MAX_WITHDRAWAL = 10000;
const WITHDRAWAL_COOLDOWN_MINUTES = 15;

const Carteira = () => {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("saldo");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [selectedBank, setSelectedBank] = useState("");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [withdrawalFee, setWithdrawalFee] = useState(4.90);
  const [minWithdrawal, setMinWithdrawal] = useState(50);
  const [lastWithdrawalTime, setLastWithdrawalTime] = useState<Date | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [withdrawalStep, setWithdrawalStep] = useState<'form' | 'otp'>('form');
  const [feeSettings, setFeeSettings] = useState({
    pix_instant_percent: "4.99",
    pix_instant_fixed: "1.49",
    boleto_percent: "5.99",
    boleto_fixed: "1.49",
    boleto_days: "2",
    card_2d_percent: "6.99",
    card_2d_fixed: "1.49",
    card_7d_percent: "6.99",
    card_7d_fixed: "1.49",
    card_15d_percent: "6.99",
    card_15d_fixed: "1.49",
    card_30d_percent: "4.99",
    card_30d_fixed: "1.49",
    reserve_card_7d: "10",
    reserve_card_15d: "10",
    reserve_card_30d: "10",
    reserve_pix_days: "10",
    reserve_pix_percent: "0",
  });
  
  // Usar hook centralizado para saldo - ÚNICA FONTE DE VERDADE
  const balanceData = useAvailableBalance();
  const [localWithdrawnTotal, setLocalWithdrawnTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { addNotification } = useRevenue();

  // OTP verification for withdrawals - only for sending OTP, verification is done in edge function
  const {
    isRequestingOtp,
    otpCode,
    setOtpCode,
    requestOtp,
    resetOtp,
  } = useOtpVerification({
    purpose: "withdrawal",
  });

  // New account form state
  const [newAccount, setNewAccount] = useState({
    bank_name: "",
    account_type: "checking",
    account_number: "",
    agency: "",
    pix_key: "",
    pix_key_type: "cpf",
    holder_name: "",
    holder_document: ""
  });

  // Dados consolidados do saldo - vindo exclusivamente do backend
  // REGRA: Frontend nunca calcula saldo, apenas exibe dados da API
  const stats = {
    available: balanceData.saldoDisponivel,
    total: balanceData.saldoTotal,
    cardToRelease: balanceData.cartaoALiberar,
    cardToReleaseCount: balanceData.cartaoALiberarQtd,
    pendingSales: balanceData.vendasPendentes,
    pendingSalesCount: balanceData.vendasPendentesQtd,
    inRetention: balanceData.saldoEmRetencao,
    totalWithdrawn: balanceData.totalSacado,
    pendingWithdrawals: balanceData.saquesPendentes,
    podeSacar: balanceData.podeSacar,
  };

  // Usar taxa de saque do backend
  const dynamicWithdrawalFee = balanceData.taxaSaque || withdrawalFee;
  const dynamicMinWithdrawal = balanceData.valorMinimoSaque || minWithdrawal;

  const netAmount = Math.max(withdrawAmount - dynamicWithdrawalFee, 0);
  const approvedAccounts = bankAccounts.filter(acc => acc.status === 'approved');

  // Get current user ID securely (removed insecure impersonation)
  const getEffectiveUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  // Cooldown timer effect
  useEffect(() => {
    if (!lastWithdrawalTime) {
      setCooldownRemaining(0);
      return;
    }

    const updateCooldown = () => {
      const now = new Date();
      const elapsed = (now.getTime() - lastWithdrawalTime.getTime()) / 1000 / 60; // minutes
      const remaining = Math.max(0, WITHDRAWAL_COOLDOWN_MINUTES - elapsed);
      setCooldownRemaining(Math.ceil(remaining));
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastWithdrawalTime]);

  useEffect(() => {
    fetchSystemSettings();
    fetchUserData();
    fetchBankAccounts();
    fetchWithdrawals();
    fetchLastWithdrawalTime();
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });

      setWithdrawalFee(parseFloat(settingsMap['withdrawal_fee']) || 4.90);
      setMinWithdrawal(parseFloat(settingsMap['minimum_withdrawal']) || 50);

      setFeeSettings(prev => ({
        ...prev,
        pix_instant_percent: settingsMap['pix_instant_percent'] || '4.99',
        pix_instant_fixed: settingsMap['pix_instant_fixed'] || '1.49',
        boleto_percent: settingsMap['boleto_percent'] || '5.99',
        boleto_fixed: settingsMap['boleto_fixed'] || '1.49',
        boleto_days: settingsMap['boleto_days'] || '2',
        card_2d_percent: settingsMap['card_2d_percent'] || '6.99',
        card_2d_fixed: settingsMap['card_2d_fixed'] || '1.49',
        card_7d_percent: settingsMap['card_7d_percent'] || '6.99',
        card_7d_fixed: settingsMap['card_7d_fixed'] || '1.49',
        card_15d_percent: settingsMap['card_15d_percent'] || '6.99',
        card_15d_fixed: settingsMap['card_15d_fixed'] || '1.49',
        card_30d_percent: settingsMap['card_30d_percent'] || '4.99',
        card_30d_fixed: settingsMap['card_30d_fixed'] || '1.49',
        reserve_card_7d: settingsMap['reserve_card_7d'] || '10',
        reserve_card_15d: settingsMap['reserve_card_15d'] || '10',
        reserve_card_30d: settingsMap['reserve_card_30d'] || '10',
        reserve_pix_days: settingsMap['reserve_pix_days'] || '10',
        reserve_pix_percent: settingsMap['reserve_pix_percent'] || '0',
      }));
    } catch (error) {
      console.error('Error fetching system settings:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from("withdrawals")
        .select("*, bank_accounts(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
    }
  };

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        setUserName(profile.full_name);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLastWithdrawalTime = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from("withdrawals")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLastWithdrawalTime(new Date(data.created_at));
      }
    } catch (error) {
      console.error("Error fetching last withdrawal time:", error);
    }
  };

  const handleAddAccount = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) return;

      if (!newAccount.bank_name || !newAccount.account_number || !newAccount.agency) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      // Validate bank account data with Zod schema
      const bankData = {
        bank_name: newAccount.bank_name,
        account_type: newAccount.account_type as 'checking' | 'savings',
        account_number: newAccount.account_number,
        agency: newAccount.agency,
        pix_key: newAccount.pix_key || null,
        pix_key_type: newAccount.pix_key ? newAccount.pix_key_type as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' : null,
      };

      const validation = validateData(bankAccountSchema, bankData);
      if (!validation.success) {
        const firstError = Object.values(validation.errors || {})[0];
        toast({
          title: "Erro de validação",
          description: firstError || "Verifique os dados da conta bancária.",
          variant: "destructive",
        });
        return;
      }

      const { data: insertedAccount, error } = await supabase
        .from("bank_accounts")
        .insert({
          user_id: userId,
          bank_name: validation.data!.bank_name,
          account_type: validation.data!.account_type,
          account_number: validation.data!.account_number,
          agency: validation.data!.agency,
          pix_key: validation.data!.pix_key,
          pix_key_type: validation.data!.pix_key_type,
          status: "pending"
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger auto-approve check via edge function
      try {
        const { error: autoApproveError } = await supabase.functions.invoke('auto-approve-bank-account', {
          body: { bank_account_id: insertedAccount.id }
        });
        
        if (autoApproveError) {
          console.error('Auto-approve check failed:', autoApproveError);
        }
      } catch (autoApproveErr) {
        console.error('Auto-approve invocation failed:', autoApproveErr);
      }

      // Add notification for pending bank account
      addNotification({
        type: "bank_account_pending",
        title: "Conta bancária adicionada",
        description: `Sua conta ${newAccount.bank_name} foi adicionada.`,
        amount: 0,
      });

      toast({
        title: "Conta adicionada!",
        description: "Sua conta está sendo processada.",
      });

      setIsAddAccountOpen(false);
      setNewAccount({
        bank_name: "",
        account_type: "checking",
        account_number: "",
        agency: "",
        pix_key: "",
        pix_key_type: "cpf",
        holder_name: "",
        holder_document: ""
      });
      fetchBankAccounts();
    } catch (error) {
      console.error("Error adding bank account:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a conta.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bank_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Conta removida!",
        description: "A conta bancária foi removida com sucesso.",
      });
      fetchBankAccounts();
    } catch (error) {
      console.error("Error deleting bank account:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a conta.",
        variant: "destructive",
      });
    }
  };

  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);

  // Validate withdrawal before requesting OTP
  const handleWithdraw = async () => {
    // Prevenir duplo clique
    if (isProcessingWithdraw) return;

    // ===== RATE LIMITING CHECK (15 minutes cooldown) =====
    if (cooldownRemaining > 0) {
      toast({
        title: "Aguarde para solicitar novo saque",
        description: `Você só pode realizar um saque a cada ${WITHDRAWAL_COOLDOWN_MINUTES} minutos. Aguarde ${cooldownRemaining} minuto(s).`,
        variant: "destructive",
      });
      return;
    }
    
    if (withdrawAmount < dynamicMinWithdrawal) {
      toast({
        title: "Valor mínimo",
        description: `O valor mínimo para saque é ${formatCurrency(dynamicMinWithdrawal)}.`,
        variant: "destructive",
      });
      return;
    }

    if (withdrawAmount > MAX_WITHDRAWAL) {
      toast({
        title: "Valor máximo excedido",
        description: `O valor máximo por saque é ${formatCurrency(MAX_WITHDRAWAL)}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validar saldo disponível usando dados atualizados
    if (withdrawAmount > stats.available) {
      toast({
        title: "Saldo insuficiente",
        description: `Você possui apenas ${formatCurrency(stats.available)} disponível para saque.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedBank) {
      toast({
        title: "Selecione uma conta",
        description: "Por favor, selecione uma conta bancária.",
        variant: "destructive",
      });
      return;
    }

    // ===== BANK ACCOUNT OWNERSHIP VERIFICATION =====
    const selectedAccountData = approvedAccounts.find(a => a.id === selectedBank);
    if (!selectedAccountData) {
      toast({
        title: "Conta inválida",
        description: "A conta selecionada não foi encontrada ou não está aprovada.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingWithdraw(true);

    try {
      const userId = await getEffectiveUserId();
      if (!userId) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        setIsProcessingWithdraw(false);
        return;
      }

      // ===== VERIFY BANK ACCOUNT BELONGS TO USER =====
      const { data: bankAccountCheck, error: bankError } = await supabase
        .from("bank_accounts")
        .select("id, user_id, status")
        .eq("id", selectedBank)
        .eq("user_id", userId)
        .eq("status", "approved")
        .maybeSingle();

      if (bankError || !bankAccountCheck) {
        toast({
          title: "Conta bancária inválida",
          description: "Esta conta não pertence ao seu usuário ou não está aprovada.",
          variant: "destructive",
        });
        setIsProcessingWithdraw(false);
        return;
      }

      // ===== REAL-TIME BALANCE VERIFICATION =====
      // IMPORTANTE: Usar net_amount (valor líquido) que já tem TODAS as taxas descontadas
      const { data: currentSales } = await supabase
        .from("sales")
        .select("net_amount")  // Usar net_amount, não recalcular
        .eq("seller_user_id", userId)
        .eq("status", "approved");

      const { data: currentWithdrawals } = await supabase
        .from("withdrawals")
        .select("amount, status, created_at")
        .eq("user_id", userId);

      // CORRETO: Somar net_amount das vendas (já com todas as taxas descontadas)
      const totalLiquidoVendas = currentSales?.reduce((sum, s) => 
        sum + Number(s.net_amount || 0), 0) || 0;
      
      const completedWithdrawals = currentWithdrawals
        ?.filter(w => w.status === "completed" || w.status === "approved")
        .reduce((sum, w) => sum + Number(w.amount), 0) || 0;
      
      const pendingWithdrawals = currentWithdrawals
        ?.filter(w => w.status === "pending")
        .reduce((sum, w) => sum + Number(w.amount), 0) || 0;

      // Saldo disponível = total líquido vendas - saques completados - saques pendentes
      const realAvailableBalance = Math.max(0, totalLiquidoVendas - completedWithdrawals - pendingWithdrawals);

      if (withdrawAmount > realAvailableBalance) {
        toast({
          title: "Saldo insuficiente",
          description: `Saldo real disponível: ${formatCurrency(Math.max(0, realAvailableBalance))}. Seu saque de ${formatCurrency(withdrawAmount)} excede o limite.`,
          variant: "destructive",
        });
        setIsProcessingWithdraw(false);
        balanceData.refetch();
        return;
      }

      // ===== CHECK RATE LIMITING (15 min cooldown) =====
      const lastWithdrawal = currentWithdrawals
        ?.filter(w => w.status !== "rejected")
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastWithdrawal) {
        const lastTime = new Date(lastWithdrawal.created_at);
        const now = new Date();
        const minutesSinceLast = (now.getTime() - lastTime.getTime()) / 1000 / 60;
        
        if (minutesSinceLast < WITHDRAWAL_COOLDOWN_MINUTES) {
          const remaining = Math.ceil(WITHDRAWAL_COOLDOWN_MINUTES - minutesSinceLast);
          toast({
            title: "Aguarde para solicitar novo saque",
            description: `Você só pode realizar um saque a cada ${WITHDRAWAL_COOLDOWN_MINUTES} minutos. Aguarde ${remaining} minuto(s).`,
            variant: "destructive",
          });
          setIsProcessingWithdraw(false);
          setLastWithdrawalTime(lastTime);
          return;
        }
      }

      // All validations passed - now request OTP
      if (!userEmail) {
        toast({
          title: "E-mail não encontrado",
          description: "Por favor, verifique seu perfil e tente novamente.",
          variant: "destructive",
        });
        setIsProcessingWithdraw(false);
        return;
      }

      setWithdrawalStep('otp');
      const otpSent = await requestOtp(userEmail, userId);
      
      if (!otpSent) {
        setWithdrawalStep('form');
        setIsProcessingWithdraw(false);
      }
      // If OTP is sent successfully, the modal will open and processing continues in processWithdrawalAfterOtp

    } catch (error) {
      console.error("Error validating withdrawal:", error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o saque. Tente novamente.",
        variant: "destructive",
      });
      setIsProcessingWithdraw(false);
    }
  };

  // Process withdrawal after OTP verification - uses backend edge function
  const processWithdrawalAfterOtp = async () => {
    try {
      // Get current session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      // Call edge function with all validations on backend

      // Call edge function with all validations on backend
      const { data, error } = await supabase.functions.invoke('process-withdrawal', {
        body: {
          amount: withdrawAmount,
          bank_account_id: selectedBank,
          otp_code: otpCode,
        }
      });

      if (error) {
        toast({
          title: "Erro no servidor",
          description: error.message || "Não foi possível processar o saque.",
          variant: "destructive",
        });
        return;
      }

      // Check for backend validation errors
      if (data?.error) {
        toast({
          title: "Erro na validação",
          description: data.error,
          variant: "destructive",
        });
        // Refresh balance in case it changed
        balanceData.refetch();
        return;
      }

      // Success - Update state

      // Update state
      setLastWithdrawalTime(new Date());
      await balanceData.refetch();

      const selectedAccountData = approvedAccounts.find(a => a.id === selectedBank);
      addNotification({
        type: "withdrawal_pending",
        title: "Saque pendente",
        description: `Saque de ${formatCurrency(data.withdrawal?.net_amount || netAmount)} para ${selectedAccountData?.bank_name || "conta"} está aguardando aprovação.`,
        amount: data.withdrawal?.net_amount || netAmount,
      });

      toast({
        title: "Saque solicitado com sucesso!",
        description: `Valor de ${formatCurrency(data.withdrawal?.net_amount || netAmount)} será transferido em até 24 horas.`,
      });

      setIsWithdrawOpen(false);
      setWithdrawAmount(0);
      setSelectedBank("");
      setWithdrawalStep('form');
      resetOtp();
      fetchWithdrawals();
      fetchLastWithdrawalTime();

    } catch (error) {
      console.error("Error creating withdrawal:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar o saque. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingWithdraw(false);
      setWithdrawalStep('form');
    }
  };

  const cancelWithdrawalOtp = () => {
    resetOtp();
    setWithdrawalStep('form');
    setIsProcessingWithdraw(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const maskAccountNumber = (account: string) => {
    if (account.length <= 4) return account;
    return "****" + account.slice(-4);
  };

  // Fee table data - now using dynamic settings
  const pixFees = [{ availability: "Na hora", fee: `${feeSettings.pix_instant_percent}% + R$ ${feeSettings.pix_instant_fixed}` }];
  const boletoFees = [{ availability: `Até ${feeSettings.boleto_days} dias`, fee: `${feeSettings.boleto_percent}% + R$ ${feeSettings.boleto_fixed}` }];
  const cardFees = [
    { availability: "2 dias", fee: `${feeSettings.card_2d_percent}% + R$ ${feeSettings.card_2d_fixed}` },
    { availability: "7 dias", fee: `${feeSettings.card_7d_percent}% + R$ ${feeSettings.card_7d_fixed}` },
    { availability: "15 dias", fee: `${feeSettings.card_15d_percent}% + R$ ${feeSettings.card_15d_fixed}` },
    { availability: "30 dias", fee: `${feeSettings.card_30d_percent}% + R$ ${feeSettings.card_30d_fixed}` }
  ];
  const securityReserveCard = [
    { availability: "7 dias", fee: `${feeSettings.reserve_card_7d}%` },
    { availability: "15 dias", fee: `${feeSettings.reserve_card_15d}%` },
    { availability: "30 dias", fee: `${feeSettings.reserve_card_30d}%` }
  ];
  const securityReservePix = [{ availability: `${feeSettings.reserve_pix_days} dias`, fee: `${feeSettings.reserve_pix_percent}%` }];

  const FeeTable = ({ title, icon: Icon, data }: { title: string; icon: any; data: { availability: string; fee: string }[] }) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-accent" />
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      <div className="rounded-lg overflow-hidden border border-border/30">
        <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 text-xs text-muted-foreground font-medium">
          <span>Dinheiro disponível</span>
          <span className="text-right">Taxa</span>
        </div>
        {data.map((row, index) => (
          <div key={index} className="grid grid-cols-2 gap-4 p-3 border-t border-border/20 hover:bg-muted/10 transition-colors">
            <span className="text-sm text-accent">{row.availability}</span>
            <span className="text-sm text-right">{row.fee}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Minha Carteira</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie seu saldo e realize saques
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-transparent border-b border-border/30 rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger value="saldo" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3 text-sm">
              Saldo e saque
            </TabsTrigger>
            <TabsTrigger value="antecipacao" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3 text-sm flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Antecipação
            </TabsTrigger>
            <TabsTrigger value="extrato" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3 text-sm">
              Extrato
            </TabsTrigger>
            <TabsTrigger value="contas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3 text-sm">
              Contas bancárias
            </TabsTrigger>
            <TabsTrigger value="taxas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent px-0 pb-3 text-sm">
              Taxas
            </TabsTrigger>
          </TabsList>

          {/* Antecipação Tab */}
          <TabsContent value="antecipacao" className="mt-6">
            <CommissionAnticipationTab />
          </TabsContent>

          {/* Saldo e Saque Tab */}
          <TabsContent value="saldo" className="mt-6">
            {/* Estado de erro */}
            {balanceData.error && (
              <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-red-500">Erro ao carregar saldo</p>
                  <p className="text-xs text-muted-foreground">{balanceData.error}</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => balanceData.refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Stats */}
              <div className="space-y-4">
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground">Saldo Total</p>
                    {/* Saldo Total vem direto do backend - já calculado corretamente */}
                    {balanceData.loading ? (
                      <div className="animate-pulse">
                        <div className="h-10 bg-muted/50 rounded w-48 mt-2" />
                        <div className="h-4 bg-muted/30 rounded w-32 mt-2" />
                      </div>
                    ) : (
                      <>
                        <p className="text-4xl font-bold mt-2">{formatCurrency(stats.total)}</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {formatCurrency(stats.available)} disponível para sacar
                        </p>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      className="mt-4 gap-2" 
                      onClick={() => setIsWithdrawOpen(true)}
                      disabled={!stats.podeSacar || balanceData.loading}
                    >
                      <Copy className="w-4 h-4" />
                      Efetuar saque
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-green-500/20">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold text-green-500">{formatCurrency(stats.available)}</p>
                      <p className="text-xs text-muted-foreground">Disponível para saque</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Saldo à liberar - Vendas APROVADAS por cartão de crédito */}
                {stats.cardToReleaseCount > 0 && (
                  <Card className="bg-card/50 border-yellow-500/30 border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-lg bg-yellow-500/20">
                          <Clock className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-yellow-500">{formatCurrency(stats.cardToRelease)}</p>
                          <p className="text-xs text-yellow-500">
                            Saldo à liberar
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {STATUS_MESSAGES.wallet.releaseInfo}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-orange-500/20">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold">{formatCurrency(stats.inRetention)}</p>
                      <p className="text-xs text-orange-500">Em retenção</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-accent/20">
                      <ArrowUpRight className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-bold">{formatCurrency(stats.totalWithdrawn)}</p>
                      <p className="text-xs text-muted-foreground">Total sacado</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Extrato Tab */}
          <TabsContent value="extrato" className="mt-6">
            <Card className="bg-card/80 border-border/40 shadow-xl shadow-black/20 backdrop-blur-sm">
              <CardHeader className="border-b border-border/30 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Histórico de Saques</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {withdrawals.length > 0 
                          ? `${withdrawals.length} transação${withdrawals.length > 1 ? 'ões' : ''} registrada${withdrawals.length > 1 ? 's' : ''}`
                          : 'Nenhuma transação registrada'}
                      </p>
                    </div>
                  </div>
                  {withdrawals.length > 0 && (
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                      {withdrawals.filter(w => w.status === 'completed' || w.status === 'approved').length} concluídas
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse" />
                      <div className="relative p-5 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50">
                        <FileText className="w-10 h-10 text-muted-foreground/60" strokeWidth={1.5} />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-foreground">Nenhuma transação</h3>
                    <p className="text-muted-foreground text-sm text-center max-w-sm leading-relaxed">
                      Suas transações de entrada e saída aparecerão aqui assim que você realizar seu primeiro saque.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-6 gap-2 border-accent/30 text-accent hover:bg-accent/10"
                      onClick={() => setActiveTab("saldo")}
                    >
                      <Wallet className="w-4 h-4" />
                      Ir para Saldo e Saque
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {withdrawals.map((withdrawal, index) => (
                      <div 
                        key={withdrawal.id} 
                        className="flex items-center justify-between p-5 hover:bg-muted/20 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${
                            withdrawal.status === 'completed' || withdrawal.status === 'approved' 
                              ? 'bg-green-500/15' 
                              : withdrawal.status === 'pending' 
                                ? 'bg-yellow-500/15' 
                                : 'bg-accent/15'
                          }`}>
                            <ArrowUpRight className={`w-5 h-5 ${
                              withdrawal.status === 'completed' || withdrawal.status === 'approved'
                                ? 'text-green-500' 
                                : withdrawal.status === 'pending' 
                                  ? 'text-yellow-500' 
                                  : 'text-accent'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              Saque para {withdrawal.bank_accounts?.bank_name || "Conta bancária"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{formatDate(withdrawal.created_at)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <p className="font-bold text-lg text-foreground">
                              {formatCurrency(withdrawal.net_amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Taxa: {formatCurrency(withdrawal.fee)}
                            </p>
                          </div>
                          {getStatusBadge(withdrawal.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contas Bancárias Tab */}
          <TabsContent value="contas" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Contas</h2>
              <Button size="sm" variant="ghost" className="gap-2 text-accent" onClick={() => setIsAddAccountOpen(true)}>
                <Plus className="w-4 h-4" />
                Nova conta
              </Button>
            </div>

            {bankAccounts.length === 0 ? (
              <Card className="bg-card/50 border-border/30">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center">
                    <div className="p-4 rounded-full bg-muted/50 mb-4">
                      <Wallet className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-muted-foreground">Nenhuma conta cadastrada</h3>
                    <p className="text-muted-foreground text-sm text-center max-w-md">
                      Adicione uma conta bancária ou chave PIX para receber seus saques.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column - Account list */}
                <div className="space-y-2">
                  {bankAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedAccount?.id === account.id 
                          ? "bg-accent/10 border-accent/50" 
                          : "bg-secondary/20 border-border/30 hover:bg-secondary/40"
                      }`}
                    >
                      <p className="font-medium">{account.bank_name}</p>
                      <p className="text-xs text-muted-foreground">{account.pix_key || account.account_number}</p>
                    </button>
                  ))}
                </div>

                {/* Right column - Account details */}
                {selectedAccount ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold">{selectedAccount.bank_name}</h3>
                      <p className="text-sm text-muted-foreground">Conta de pagamentos</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Nome</p>
                          <p className="text-sm font-medium">{userName || "Titular da conta"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CPF/CNPJ do titular</p>
                          <p className="text-sm font-medium text-accent">{selectedAccount.pix_key || "Não informado"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Banco</p>
                          <p className="text-sm font-medium">{selectedAccount.bank_name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Agência e Número da conta</p>
                          <p className="text-sm font-medium text-accent">{selectedAccount.agency} / {selectedAccount.account_number}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <Wallet className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo de conta</p>
                          <p className="text-sm font-medium">{selectedAccount.account_type === 'checking' ? 'Conta corrente' : 'Conta poupança'}</p>
                        </div>
                      </div>

                      {selectedAccount.pix_key && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted/30">
                            <Key className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Chave PIX</p>
                            <p className="text-sm font-medium text-accent">{selectedAccount.pix_key}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted/30">
                          <RefreshCw className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          {selectedAccount.status === 'pending' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-yellow-500">Pendente</span>
                              <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[10px]">
                                Aguardando aprovação
                              </Badge>
                            </div>
                          ) : selectedAccount.status === 'approved' ? (
                            <span className="text-sm font-medium text-green-500">Confirmado</span>
                          ) : (
                            <span className="text-sm font-medium text-red-500">Rejeitado</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full text-red-400 border-red-400/30 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => {
                        handleDeleteAccount(selectedAccount.id);
                        setSelectedAccount(null);
                      }}
                    >
                      Remover conta bancária
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Selecione uma conta para ver os detalhes</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Taxas Tab */}
          <TabsContent value="taxas" className="mt-6">
            <div className="space-y-8">
              <FeeTable title="PIX" icon={Banknote} data={pixFees} />
              <FeeTable title="Boleto" icon={FileText} data={boletoFees} />
              <FeeTable title="Cartão de crédito" icon={CreditCard} data={cardFees} />
              <p className="text-xs text-muted-foreground">
                Para antecipar suas vendas em cartão, solicite ao seu Gerente de Contas
              </p>
              <FeeTable title="Taxa Reserva de Segurança (Cartão de Crédito)" icon={Shield} data={securityReserveCard} />
              <FeeTable title="Taxa Reserva de Segurança (Pix)" icon={Shield} data={securityReservePix} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Account Dialog */}
        <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
          <DialogContent className="max-w-md bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="text-lg">Adicionar Conta Bancária</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome do Banco</Label>
                <Input 
                  value={newAccount.bank_name} 
                  onChange={(e) => setNewAccount(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="Ex: Nubank, Inter, Bradesco"
                  className="bg-secondary/50 border-border/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Conta</Label>
                <Select value={newAccount.account_type} onValueChange={(v) => setNewAccount(prev => ({ ...prev, account_type: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/30">
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Agência</Label>
                  <Input 
                    value={newAccount.agency} 
                    onChange={(e) => setNewAccount(prev => ({ ...prev, agency: e.target.value }))}
                    placeholder="0001"
                    className="bg-secondary/50 border-border/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Número da Conta</Label>
                  <Input 
                    value={newAccount.account_number} 
                    onChange={(e) => setNewAccount(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="12345-6"
                    className="bg-secondary/50 border-border/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Chave PIX (opcional)</Label>
                <Select value={newAccount.pix_key_type} onValueChange={(v) => setNewAccount(prev => ({ ...prev, pix_key_type: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/30">
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Chave PIX (opcional)</Label>
                <Input 
                  value={newAccount.pix_key} 
                  onChange={(e) => setNewAccount(prev => ({ ...prev, pix_key: e.target.value }))}
                  placeholder="Digite sua chave PIX"
                  className="bg-secondary/50 border-border/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsAddAccountOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAccount} className="flex-1 bg-accent hover:bg-accent/90">
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw Dialog */}
        <Dialog open={isWithdrawOpen} onOpenChange={(open) => {
          if (!open) {
            cancelWithdrawalOtp();
          }
          setIsWithdrawOpen(open);
        }}>
          <DialogContent className="max-w-md bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-accent" />
                {withdrawalStep === 'otp' ? 'Verificação de Segurança' : 'Novo saque'}
              </DialogTitle>
            </DialogHeader>
            
            {/* Rate limiting warning */}
            {cooldownRemaining > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Timer className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-yellow-500">
                  Aguarde {cooldownRemaining} minuto(s) para solicitar novo saque.
                </p>
              </div>
            )}

            {withdrawalStep === 'form' ? (
              <div className="space-y-5 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Conta</Label>
                  <Select value={selectedBank} onValueChange={setSelectedBank}>
                    <SelectTrigger className="bg-secondary/50 border-border/30">
                      <SelectValue placeholder="Selecione um banco" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border/30">
                      {approvedAccounts.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Nenhuma conta aprovada
                        </div>
                      ) : (
                        approvedAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.bank_name} - {maskAccountNumber(account.account_number)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {approvedAccounts.length === 0 && (
                    <p className="text-xs text-yellow-500">
                      Você precisa ter uma conta bancária aprovada para realizar saques.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Valor</Label>
                  <Input 
                    type="number" 
                    value={withdrawAmount || ""} 
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    placeholder={`R$ 0,00 (Mín: R$ ${dynamicMinWithdrawal.toFixed(2)}, Máx: R$ ${MAX_WITHDRAWAL.toFixed(2)})`}
                    className="bg-secondary/50 border-border/30"
                  />
                  <p className="text-xs text-muted-foreground">
                    Saldo disponível: {formatCurrency(stats.available)}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Resumo</Label>
                  <div className="rounded-lg bg-secondary/30 border border-border/30 p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor solicitado</span>
                      <span>{formatCurrency(withdrawAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa do saque</span>
                      <span className="text-red-400">- {formatCurrency(dynamicWithdrawalFee)}</span>
                    </div>
                    <div className="border-t border-border/30 pt-3 flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Valor a receber</span>
                      <span className="text-accent">{formatCurrency(netAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Security notice */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <Shield className="w-4 h-4 text-accent flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Você receberá um código de verificação por e-mail para confirmar o saque.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsWithdrawOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleWithdraw} 
                    className="flex-1 bg-accent hover:bg-accent/90"
                    disabled={isProcessingWithdraw || withdrawAmount < dynamicMinWithdrawal || withdrawAmount > stats.available || !selectedBank || approvedAccounts.length === 0 || cooldownRemaining > 0 || !stats.podeSacar}
                  >
                    {isProcessingWithdraw ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      "Solicitar saque"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // OTP verification step
              <div className="space-y-5 mt-2">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Enviamos um código de 6 dígitos para <strong>{userEmail}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Saque de <strong className="text-accent">{formatCurrency(netAmount)}</strong> para{" "}
                    <strong>{approvedAccounts.find(a => a.id === selectedBank)?.bank_name}</strong>
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-3xl font-mono tracking-[0.5em] h-16 bg-secondary/50 border-border/50 max-w-xs"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Digite o código de 6 dígitos enviado para seu e-mail
                  </p>
                </div>

                <p className="text-muted-foreground text-sm text-center">
                  Não recebeu o código?{" "}
                  <button
                    type="button"
                    onClick={() => requestOtp(userEmail)}
                    disabled={isRequestingOtp}
                    className="text-accent hover:text-accent/80 font-medium disabled:opacity-50"
                  >
                    {isRequestingOtp ? "Enviando..." : "Reenviar"}
                  </button>
                </p>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={cancelWithdrawalOtp}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={async () => {
                      // Send OTP code directly to process-withdrawal
                      // The edge function will verify the OTP
                      await processWithdrawalAfterOtp();
                    }}
                    className="flex-1 bg-accent hover:bg-accent/90"
                    disabled={isProcessingWithdraw || otpCode.length !== 6}
                  >
                    {isProcessingWithdraw ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      "Confirmar saque"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Carteira;