import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getValueColorClass, cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  User,
  ShoppingCart,
  Package,
  Wallet,
  UserCheck,
  DollarSign,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  FileText,
  Shield,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Wrench,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { 
  auditarTransacoesUsuario, 
  corrigirTodasTransacoes,
  type ResultadoAuditoria, 
  type TransacaoAuditada 
} from "@/lib/auditoria/financialAudit";
import { useUserRole } from "@/hooks/useUserRole";
import { ImpersonateUserDialog } from "@/components/admin/ImpersonateUserDialog";
import { AdminProductDetails } from "@/components/admin/AdminProductDetails";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  document_number: string | null;
  cep: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  verification_status: string;
  created_at: string;
}

interface Sale {
  id: string;
  transaction_id: string;
  product_id: string;
  buyer_name: string;
  amount: number;
  commission_amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  product?: { name: string };
}

interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  product_type: string | null;
  category: string | null;
  payment_type: string | null;
  delivery_method: string | null;
  marketplace_enabled: boolean | null;
  sales_page_url: string | null;
  sac_name: string | null;
  sac_email: string | null;
  sac_phone: string | null;
  weight: number | null;
  stock: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  image_url: string | null;
  commission_percentage: number | null;
  affiliate_auto_approve: boolean | null;
  subscription_quantity_mode: string | null;
  slug: string | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_grams: number | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
}

interface Affiliation {
  id: string;
  product_id: string;
  status: string;
  created_at: string;
  product?: { name: string; price: number; commission_percentage: number };
}

const PLATFORM_FEE_PERCENT = 4.99; // Example platform fee

const AdminVisualizarUsuario = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [balance, setBalance] = useState(0);
  
  // Auditoria financeira
  const [auditoria, setAuditoria] = useState<ResultadoAuditoria | null>(null);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const { canImpersonate } = useUserRole();

  useEffect(() => {
    if (userId) {
      loadUserData();
      executarAuditoria();
    }
  }, [userId]);
  
  // Executar auditoria financeira
  const executarAuditoria = async () => {
    if (!userId) return;
    setAuditoriaLoading(true);
    try {
      const resultado = await auditarTransacoesUsuario(userId);
      setAuditoria(resultado);
    } catch (error) {
      console.error('Erro na auditoria:', error);
    } finally {
      setAuditoriaLoading(false);
    }
  };
  
  // Corrigir todas as transações divergentes
  const handleCorrigirTodas = async () => {
    if (!userId) return;
    setCorrigindo(true);
    try {
      const resultado = await corrigirTodasTransacoes(userId);
      if (resultado.corrigidas > 0) {
        toast.success(`${resultado.corrigidas} transações corrigidas com sucesso!`);
        // Reexecutar auditoria
        await executarAuditoria();
        await loadUserData();
      } else {
        toast.info('Nenhuma transação precisou de correção');
      }
      if (resultado.erros > 0) {
        toast.error(`${resultado.erros} transações com erro na correção`);
      }
    } catch (error) {
      toast.error('Erro ao corrigir transações');
    } finally {
      setCorrigindo(false);
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // Load sales
      const { data: salesData } = await supabase
        .from("sales")
        .select("*")
        .eq("seller_user_id", userId)
        .order("created_at", { ascending: false });

      if (salesData) {
        const productIds = [...new Set(salesData.map((s) => s.product_id))];
        const { data: productsInfo } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);

        setSales(
          salesData.map((s) => ({
            ...s,
            product: productsInfo?.find((p) => p.id === s.product_id),
          }))
        );

        // Calculate balance
        const completedSales = salesData.filter((s) => s.status === "completed");
        const totalSales = completedSales.reduce(
          (sum, s) => sum + Number(s.amount) - Number(s.commission_amount),
          0
        );

        // Get withdrawals
        const { data: withdrawalData } = await supabase
          .from("withdrawals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (withdrawalData) {
          setWithdrawals(withdrawalData);
          const completedWithdrawals = withdrawalData
            .filter((w) => w.status === "completed" || w.status === "approved")
            .reduce((sum, w) => sum + Number(w.net_amount), 0);

          setBalance(Math.max(0, totalSales - completedWithdrawals));
        }
      }

      // Load products
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (productsData) {
        setProducts(productsData);
      }

      // Load affiliations
      const { data: affiliationsData } = await supabase
        .from("affiliations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (affiliationsData) {
        const productIds = [...new Set(affiliationsData.map((a) => a.product_id))];
        const { data: productsInfo } = await supabase
          .from("products")
          .select("id, name, price, commission_percentage")
          .in("id", productIds);

        setAffiliations(
          affiliationsData.map((a) => ({
            ...a,
            product: productsInfo?.find((p) => p.id === a.product_id),
          }))
        );
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Erro ao carregar dados do usuário");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
      case "active":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            {status === "completed" ? "Concluída" : status === "approved" ? "Aprovado" : "Ativo"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            Pendente
          </Badge>
        );
      case "blocked":
      case "cancelled":
      case "refused":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            {status === "blocked" ? "Bloqueado" : status === "cancelled" ? "Cancelado" : "Recusado"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate taxes for a sale
  const calculateTaxes = (amount: number, commissionAmount: number) => {
    const platformFee = amount * (PLATFORM_FEE_PERCENT / 100);
    const netToSeller = amount - commissionAmount - platformFee;
    return { platformFee, netToSeller };
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Usuário não encontrado</p>
          <Button variant="outline" onClick={() => navigate("/admin/usuarios")} className="mt-4">
            Voltar
          </Button>
        </div>
      </AdminLayout>
    );
  }

  // Usar dados da auditoria para valores corretos do banco
  const totalSalesAmount = auditoria?.resumo.total_bruto || sales
    .filter((s) => s.status !== "refunded" && s.status !== "cancelled" && s.status !== "failed")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const totalCommissions = auditoria?.resumo.total_comissoes_afiliado || sales
    .filter((s) => s.status !== "refunded" && s.status !== "cancelled" && s.status !== "failed")
    .reduce((sum, s) => sum + Number(s.commission_amount), 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/usuarios")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-accent/20 text-accent text-xl">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{profile.full_name || "Sem nome"}</h1>
                <p className="text-muted-foreground">{profile.email}</p>
                <div className="flex gap-2 mt-1">
                  {getStatusBadge(profile.verification_status)}
                  <Badge variant="outline">
                    Desde {format(new Date(profile.created_at), "MMM yyyy", { locale: ptBR })}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {/* Botão Acessar Conta */}
          {canImpersonate && (
            <Button
              onClick={() => setImpersonateDialogOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              <Eye className="w-4 h-4 mr-2" />
              Acessar conta
            </Button>
          )}
        </div>

        {/* Impersonate Dialog */}
        <ImpersonateUserDialog
          open={impersonateDialogOpen}
          onOpenChange={setImpersonateDialogOpen}
          user={profile}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Disponível</p>
                <p className="text-2xl font-bold text-green-500">{formatCurrency(balance)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-accent/20">
                <ShoppingCart className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total em Vendas</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSalesAmount)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Package className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Produtos</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <UserCheck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Afiliações</p>
                <p className="text-2xl font-bold">{affiliations.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Auditoria Financeira Card */}
        {auditoria && (
          <Card className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent border-blue-500/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <CardTitle className="text-lg">Auditoria Financeira</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={executarAuditoria}
                    disabled={auditoriaLoading}
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${auditoriaLoading ? 'animate-spin' : ''}`} />
                    Reauditar
                  </Button>
                  {(auditoria.transacoes_divergentes > 0 || auditoria.transacoes_corrigidas > 0) && (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleCorrigirTodas}
                      disabled={corrigindo}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                    >
                      <Wrench className={`w-4 h-4 mr-1 ${corrigindo ? 'animate-spin' : ''}`} />
                      Corrigir Todas
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Última auditoria: {format(new Date(auditoria.data_auditoria), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-muted-foreground">Corretas</span>
                  </div>
                  <span className="text-xl font-bold text-green-400">{auditoria.transacoes_corretas}</span>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs text-muted-foreground">Corrigidas</span>
                  </div>
                  <span className="text-xl font-bold text-yellow-400">{auditoria.transacoes_corrigidas}</span>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-muted-foreground">Divergentes</span>
                  </div>
                  <span className="text-xl font-bold text-red-400">{auditoria.transacoes_divergentes}</span>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-muted-foreground">Divergência Total</span>
                  </div>
                  <span className="text-xl font-bold text-blue-400">{formatCurrency(auditoria.resumo.total_divergencia)}</span>
                </div>
              </div>
              
              {/* Resumo Financeiro Auditado */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg bg-card/50 border border-border/50">
                <div>
                  <p className="text-xs text-muted-foreground">Total Bruto</p>
                  <p className="text-sm font-bold">{formatCurrency(auditoria.resumo.total_bruto)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa Plataforma</p>
                  <p className="text-sm font-bold text-red-400">-{formatCurrency(auditoria.resumo.total_taxas_plataforma)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Taxa Adquirente</p>
                  <p className="text-sm font-bold text-orange-400">-{formatCurrency(auditoria.resumo.total_taxas_adquirente)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Comissões Afil.</p>
                  <p className="text-sm font-bold text-purple-400">-{formatCurrency(auditoria.resumo.total_comissoes_afiliado)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Líquido Correto</p>
                  <p className="text-sm font-bold text-green-400">{formatCurrency(auditoria.resumo.total_liquido_correto)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="auditoria" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/30">
            <TabsTrigger value="auditoria" className="gap-2">
              <Shield className="w-4 h-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-2">
              <User className="w-4 h-4" />
              Informações
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              Vendas ({sales.length})
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Produtos ({products.length})
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <Wallet className="w-4 h-4" />
              Saques ({withdrawals.length})
            </TabsTrigger>
            <TabsTrigger value="affiliations" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Afiliações ({affiliations.length})
            </TabsTrigger>
          </TabsList>

          {/* Auditoria Tab - Detalhes por transação */}
          <TabsContent value="auditoria">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Transações Auditadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditoriaLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !auditoria || auditoria.transacoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma transação para auditar</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Valor Bruto</TableHead>
                          <TableHead>Taxa Plat.</TableHead>
                          <TableHead>Taxa Adq.</TableHead>
                          <TableHead>Comissão</TableHead>
                          <TableHead>Líquido (DB)</TableHead>
                          <TableHead>Líquido (Correto)</TableHead>
                          <TableHead>Divergências</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditoria.transacoes.map((t) => {
                          const isApproved = t.status === 'completed' || t.status === 'approved';
                          return (
                            <TableRow key={t.id} className={
                              t.auditoria_status === 'divergente' ? 'bg-red-500/5' :
                              t.auditoria_status === 'corrigido' ? 'bg-yellow-500/5' : ''
                            }>
                              <TableCell>
                                {t.auditoria_status === 'correto' && (
                                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Correto
                                  </Badge>
                                )}
                                {t.auditoria_status === 'corrigido' && (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Corrigido
                                  </Badge>
                                )}
                                {t.auditoria_status === 'divergente' && (
                                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Divergente
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {format(new Date(t.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-sm">{t.produto_nome}</TableCell>
                              <TableCell className="font-medium">{formatCurrency(t.valor_bruto)}</TableCell>
                              <TableCell className="text-red-400">
                                {isApproved ? `-${formatCurrency(t.taxa_plataforma_calculada)}` : '-'}
                              </TableCell>
                              <TableCell className="text-orange-400">
                                {isApproved ? `-${formatCurrency(t.taxa_adquirente_calculada)}` : '-'}
                              </TableCell>
                              <TableCell className="text-purple-400">
                                {isApproved ? `-${formatCurrency(t.comissao_afiliado_calculada)}` : '-'}
                              </TableCell>
                              <TableCell className={cn("font-medium", isApproved ? getValueColorClass(t.valor_liquido_banco) : "text-muted-foreground")}>
                                {isApproved ? formatCurrency(t.valor_liquido_banco) : '-'}
                              </TableCell>
                              <TableCell className={cn("font-medium", isApproved ? getValueColorClass(t.valor_liquido_correto) : "text-muted-foreground")}>
                                {isApproved ? formatCurrency(t.valor_liquido_correto) : '-'}
                              </TableCell>
                              <TableCell>
                                {t.divergencias.length > 0 ? (
                                  <div className="text-xs text-red-400 max-w-[200px]">
                                    {t.divergencias.map((d, i) => (
                                      <div key={i} className="truncate">{d}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-green-400">✓</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle>Dados do Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{profile.email || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Documento</p>
                      <p className="font-medium">{profile.document_number || "Não informado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">
                        {profile.street
                          ? `${profile.street}, ${profile.city} - ${profile.state}`
                          : "Não informado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">CEP</p>
                      <p className="font-medium">{profile.cep || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab - Usando dados auditados */}
          <TabsContent value="sales">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle>Histórico de Vendas (Valores Auditados)</CardTitle>
              </CardHeader>
              <CardContent>
                {!auditoria || auditoria.transacoes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma venda registrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Comprador</TableHead>
                        <TableHead>Valor Bruto</TableHead>
                        <TableHead>Taxa Plataforma</TableHead>
                        <TableHead>Taxa Adquirente</TableHead>
                        <TableHead>Comissão Afil.</TableHead>
                        <TableHead>Valor Líquido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Auditoria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditoria.transacoes.map((t) => {
                        const isApproved = t.status === 'completed' || t.status === 'approved';
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{t.produto_nome}</TableCell>
                            <TableCell>{t.comprador_nome}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(t.valor_bruto)}
                            </TableCell>
                            <TableCell className="text-red-400">
                              {isApproved ? `-${formatCurrency(t.taxa_plataforma_calculada)}` : '-'}
                            </TableCell>
                            <TableCell className="text-orange-400">
                              {isApproved ? `-${formatCurrency(t.taxa_adquirente_calculada)}` : '-'}
                            </TableCell>
                            <TableCell className="text-purple-400">
                              {isApproved ? `-${formatCurrency(t.comissao_afiliado_calculada)}` : '-'}
                            </TableCell>
                            <TableCell className={cn("font-medium", isApproved ? getValueColorClass(t.valor_liquido_correto) : "text-muted-foreground")}>
                              {isApproved ? formatCurrency(t.valor_liquido_correto) : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(t.status)}</TableCell>
                            <TableCell>
                              {t.auditoria_status === 'correto' && (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              )}
                              {t.auditoria_status === 'corrigido' && (
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              )}
                              {t.auditoria_status === 'divergente' && (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle>Produtos do Usuário - Detalhes Completos</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminProductDetails products={products} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Withdrawals Tab */}
          <TabsContent value="withdrawals">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle>Histórico de Saques</CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum saque registrado</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor Solicitado</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Valor Líquido</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>
                            {format(new Date(withdrawal.created_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell>{formatCurrency(withdrawal.amount)}</TableCell>
                          <TableCell className="text-red-400">
                            -{formatCurrency(withdrawal.fee)}
                          </TableCell>
                          <TableCell className={cn("font-medium", getValueColorClass(withdrawal.net_amount))}>
                            {formatCurrency(withdrawal.net_amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affiliations Tab */}
          <TabsContent value="affiliations">
            <Card className="bg-card/50 border-border/30">
              <CardHeader>
                <CardTitle>Afiliações do Usuário</CardTitle>
              </CardHeader>
              <CardContent>
                {affiliations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma afiliação</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Comissão (%)</TableHead>
                        <TableHead>Valor Comissão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Desde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affiliations.map((aff) => {
                        const commissionValue = aff.product
                          ? (aff.product.price * (aff.product.commission_percentage || 0)) / 100
                          : 0;
                        return (
                          <TableRow key={aff.id}>
                            <TableCell className="font-medium">
                              {aff.product?.name || "Produto"}
                            </TableCell>
                            <TableCell>
                              {aff.product ? formatCurrency(aff.product.price) : "-"}
                            </TableCell>
                            <TableCell>{aff.product?.commission_percentage || 0}%</TableCell>
                            <TableCell className="text-accent">
                              {formatCurrency(commissionValue)}
                            </TableCell>
                            <TableCell>{getStatusBadge(aff.status)}</TableCell>
                            <TableCell>
                              {format(new Date(aff.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminVisualizarUsuario;
