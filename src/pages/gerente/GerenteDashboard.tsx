import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/ui/Logo";
import {
  Users,
  ShoppingCart,
  Wallet,
  Headphones,
  UserCheck,
  LogOut,
  Eye,
  RefreshCw,
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Package,
  MessageCircle,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ManagerPermissions {
  can_view_accounts: boolean;
  can_view_sales: boolean;
  can_view_withdrawals: boolean;
  can_support: boolean;
  can_manage_affiliates: boolean;
  is_active: boolean;
}

const GerenteDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<ManagerPermissions | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [userName, setUserName] = useState("");
  
  // Data states
  const [accounts, setAccounts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [affiliations, setAffiliations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalSales: 0,
    totalSalesAmount: 0,
    pendingWithdrawals: 0,
    pendingSupport: 0,
    pendingAffiliations: 0,
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Check if user has account_manager role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "account_manager")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Get manager permissions
      const { data: permData } = await supabase
        .from("account_manager_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!permData || !permData.is_active) {
        toast({
          title: "Conta desativada",
          description: "Sua conta de gerente está desativada.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      setUserName(profile?.full_name || "Gerente");
      setPermissions(permData);
      
      // Load data based on permissions
      await loadData(permData);
    } catch (error) {
      console.error("Error checking permissions:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (perms: ManagerPermissions) => {
    const statsTemp = { ...stats };

    if (perms.can_view_accounts) {
      const { data, count } = await supabase
        .from("profiles")
        .select("*, user_id", { count: "exact" })
        .limit(50);
      setAccounts(data || []);
      statsTemp.totalAccounts = count || 0;
    }

    if (perms.can_view_sales) {
      const { data } = await supabase
        .from("sales")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setSales(data || []);
      statsTemp.totalSales = data?.length || 0;
      statsTemp.totalSalesAmount = data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
    }

    if (perms.can_view_withdrawals) {
      // Query corrigida: não usar join com profiles diretamente
      const { data: withdrawalsData } = await supabase
        .from("withdrawals")
        .select("*, bank_accounts(*)")
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Buscar profiles separadamente para cada withdrawal
      if (withdrawalsData && withdrawalsData.length > 0) {
        const userIds = [...new Set(withdrawalsData.map(w => w.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        const enrichedWithdrawals = withdrawalsData.map(w => ({
          ...w,
          profiles: profilesMap.get(w.user_id) || { full_name: "Usuário", email: "" }
        }));
        setWithdrawals(enrichedWithdrawals);
        statsTemp.pendingWithdrawals = enrichedWithdrawals.filter(w => w.status === "pending").length;
      } else {
        setWithdrawals([]);
        statsTemp.pendingWithdrawals = 0;
      }
    }

    if (perms.can_support) {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("is_from_user", true)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50);
      setSupportMessages(data || []);
      statsTemp.pendingSupport = data?.length || 0;
    }

    if (perms.can_manage_affiliates) {
      // Query corrigida: buscar afiliações e enriquecer com dados
      const { data: affiliationsData } = await supabase
        .from("affiliations")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Buscar profiles separadamente
      if (affiliationsData && affiliationsData.length > 0) {
        const userIds = [...new Set(affiliationsData.map(a => a.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        const enrichedAffiliations = affiliationsData.map(a => ({
          ...a,
          profiles: profilesMap.get(a.user_id) || { full_name: "Afiliado", email: "" }
        }));
        setAffiliations(enrichedAffiliations);
        statsTemp.pendingAffiliations = enrichedAffiliations.filter(a => a.status === "pending").length;
      } else {
        setAffiliations([]);
        statsTemp.pendingAffiliations = 0;
      }
    }

    setStats(statsTemp);
  };

  const handleAffiliationAction = async (affiliationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("affiliations")
        .update({ status: newStatus })
        .eq("id", affiliationId);

      if (error) throw error;

      toast({
        title: newStatus === "active" ? "Afiliação aprovada!" : "Afiliação recusada",
        description: newStatus === "active" 
          ? "O afiliado agora pode divulgar o produto." 
          : "A solicitação foi recusada.",
      });

      // Reload affiliations
      if (permissions) {
        const { data } = await supabase
          .from("affiliations")
          .select("*, products(name), profiles:user_id(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(50);
        setAffiliations(data || []);
        setStats(prev => ({
          ...prev,
          pendingAffiliations: data?.filter(a => a.status === "pending").length || 0,
        }));
      }
    } catch (error) {
      console.error("Error updating affiliation:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a afiliação.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
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
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
      case "active":
      case "completed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Aprovado</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pendente</Badge>;
      case "refused":
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Recusado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!permissions) {
    return null;
  }

  const availableTabs = [
    { id: "overview", label: "Visão Geral", icon: Eye, always: true },
    { id: "accounts", label: "Contas", icon: Users, show: permissions.can_view_accounts },
    { id: "sales", label: "Vendas", icon: ShoppingCart, show: permissions.can_view_sales },
    { id: "withdrawals", label: "Saques", icon: Wallet, show: permissions.can_view_withdrawals },
    { id: "support", label: "Suporte", icon: Headphones, show: permissions.can_support },
    { id: "affiliates", label: "Afiliados", icon: UserCheck, show: permissions.can_manage_affiliates },
  ].filter(tab => tab.always || tab.show);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/30 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo />
            <Badge className="bg-accent/20 text-accent border-accent/30">
              Gerente de Conta
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Olá, {userName}</span>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Painel do Gerente</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/50 border border-border/30">
            {availableTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {permissions.can_view_accounts && (
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-accent/20">
                      <Users className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Contas</p>
                      <p className="text-2xl font-bold">{stats.totalAccounts}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {permissions.can_view_sales && (
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/20">
                      <DollarSign className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total em Vendas</p>
                      <p className="text-2xl font-bold">{formatCurrency(stats.totalSalesAmount)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {permissions.can_view_withdrawals && (
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-yellow-500/20">
                      <Clock className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Saques Pendentes</p>
                      <p className="text-2xl font-bold">{stats.pendingWithdrawals}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {permissions.can_support && (
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/20">
                      <MessageCircle className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mensagens Não Lidas</p>
                      <p className="text-2xl font-bold">{stats.pendingSupport}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {permissions.can_manage_affiliates && (
                <Card className="bg-card/50 border-border/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-500/20">
                      <UserCheck className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Afiliações Pendentes</p>
                      <p className="text-2xl font-bold">{stats.pendingAffiliations}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Accounts Tab */}
          {permissions.can_view_accounts && (
            <TabsContent value="accounts" className="mt-6">
              <Card className="bg-card/50 border-border/30">
                <CardHeader>
                  <CardTitle>Contas de Usuários</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Cadastro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>{account.full_name || "Sem nome"}</TableCell>
                          <TableCell>{account.email}</TableCell>
                          <TableCell>{getStatusBadge(account.verification_status)}</TableCell>
                          <TableCell>{formatDate(account.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Sales Tab */}
          {permissions.can_view_sales && (
            <TabsContent value="sales" className="mt-6">
              <Card className="bg-card/50 border-border/30">
                <CardHeader>
                  <CardTitle>Vendas Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Comprador</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>{sale.products?.name || "Produto"}</TableCell>
                          <TableCell>{sale.buyer_name}</TableCell>
                          <TableCell>{formatCurrency(sale.amount)}</TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          <TableCell>{formatDate(sale.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Withdrawals Tab */}
          {permissions.can_view_withdrawals && (
            <TabsContent value="withdrawals" className="mt-6">
              <Card className="bg-card/50 border-border/30">
                <CardHeader>
                  <CardTitle>Saques Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Taxa</TableHead>
                        <TableHead>Líquido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id}>
                          <TableCell>{withdrawal.profiles?.full_name || "Usuário"}</TableCell>
                          <TableCell>{formatCurrency(withdrawal.amount)}</TableCell>
                          <TableCell>{formatCurrency(withdrawal.fee)}</TableCell>
                          <TableCell>{formatCurrency(withdrawal.net_amount)}</TableCell>
                          <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                          <TableCell>{formatDate(withdrawal.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Support Tab */}
          {permissions.can_support && (
            <TabsContent value="support" className="mt-6">
              <Card className="bg-card/50 border-border/30">
                <CardHeader>
                  <CardTitle>Mensagens de Suporte</CardTitle>
                </CardHeader>
                <CardContent>
                  {supportMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma mensagem pendente</p>
                  ) : (
                    <div className="space-y-4">
                      {supportMessages.map((msg) => (
                        <div key={msg.id} className="p-4 rounded-lg bg-secondary/30 border border-border/30">
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatDate(msg.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Affiliates Tab */}
          {permissions.can_manage_affiliates && (
            <TabsContent value="affiliates" className="mt-6">
              <Card className="bg-card/50 border-border/30">
                <CardHeader>
                  <CardTitle>Solicitações de Afiliação</CardTitle>
                </CardHeader>
                <CardContent>
                  {affiliations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Nenhuma afiliação encontrada</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Afiliado</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {affiliations.map((aff) => (
                          <TableRow key={aff.id}>
                            <TableCell>{aff.profiles?.full_name || "Afiliado"}</TableCell>
                            <TableCell>{aff.products?.name || "Produto"}</TableCell>
                            <TableCell>{getStatusBadge(aff.status)}</TableCell>
                            <TableCell>{formatDate(aff.created_at)}</TableCell>
                            <TableCell className="text-right">
                              {aff.status === "pending" && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleAffiliationAction(aff.id, "active")}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleAffiliationAction(aff.id, "refused")}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Recusar
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default GerenteDashboard;
