import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock, Download, Search, Filter, Eye, RefreshCcw, MoreVertical, CreditCard, Wallet, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { useAdminRole } from "@/hooks/useAdminRole";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  bank_account_id: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
  bank_account?: {
    bank_name: string;
    account_number: string;
    agency: string;
    pix_key: string | null;
    pix_key_type: string | null;
  };
}

const AdminSaques = () => {
  const { isAdmin } = useAdminRole();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-withdrawals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => {
        fetchWithdrawals();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const { data: withdrawalsData, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles and bank accounts
      const userIds = [...new Set(withdrawalsData?.map((w) => w.user_id) || [])];
      const bankAccountIds = [...new Set(withdrawalsData?.map((w) => w.bank_account_id) || [])];

      const [{ data: profiles }, { data: bankAccounts }] = await Promise.all([
        supabase.from("profiles").select("*").in("user_id", userIds),
        supabase.from("bank_accounts").select("*").in("id", bankAccountIds),
      ]);

      const withdrawalsWithDetails = withdrawalsData?.map((w) => ({
        ...w,
        profile: profiles?.find((p) => p.user_id === w.user_id),
        bank_account: bankAccounts?.find((b) => b.id === w.bank_account_id),
      }));

      setWithdrawals(withdrawalsWithDetails || []);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      toast.error("Erro ao carregar saques");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Saque ${status === "approved" ? "aprovado" : "rejeitado"} com sucesso`);
      fetchWithdrawals();
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      toast.error("Erro ao atualizar saque");
    } finally {
      setShowApproveDialog(false);
      setShowRejectDialog(false);
      setSelectedWithdrawal(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Aprovado</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethod = (withdrawal: Withdrawal) => {
    if (withdrawal.bank_account?.pix_key) {
      return { icon: <Wallet className="w-4 h-4" />, label: "PIX" };
    }
    return { icon: <CreditCard className="w-4 h-4" />, label: "TED" };
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesSearch = 
      w.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      w.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || w.status === statusFilter;
    
    const hasPix = w.bank_account?.pix_key;
    const matchesMethod = methodFilter === "all" || 
      (methodFilter === "pix" && hasPix) || 
      (methodFilter === "ted" && !hasPix);
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  // Statistics
  const stats = {
    total: withdrawals.length,
    approved: withdrawals.filter(w => w.status === 'approved').length,
    approvedVolume: withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.net_amount), 0),
    totalFees: withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.fee), 0),
  };

  const formatTransactionId = (id: string) => {
    return `TXN-${id.substring(0, 6).toUpperCase()}`;
  };

  const handleExport = () => {
    // Export to CSV
    const headers = ['ID', 'Usuário', 'Valor', 'Taxa', 'Valor Líquido', 'Método', 'Status', 'Data'];
    const rows = filteredWithdrawals.map(w => [
      formatTransactionId(w.id),
      w.profile?.full_name || 'N/A',
      w.amount,
      w.fee,
      w.net_amount,
      getPaymentMethod(w).label,
      w.status,
      format(new Date(w.created_at), "dd/MM/yyyy HH:mm")
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saques-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Relatório exportado com sucesso');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Transações</p>
                  <p className="text-3xl font-bold mt-1">{stats.total}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <Wallet className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                  <p className="text-3xl font-bold mt-1 text-green-400">{stats.approved}</p>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Volume Aprovado</p>
                  <p className="text-3xl font-bold mt-1 text-blue-400">{formatCurrency(stats.approvedVolume)}</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total em Taxas</p>
                  <p className="text-3xl font-bold mt-1 text-orange-400">{formatCurrency(stats.totalFees)}</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <DollarSign className="w-5 h-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, usuário ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-32">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Withdrawals Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">ID</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Usuário</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Valor</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Método</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Status</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Data</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredWithdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum saque encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWithdrawals.map((withdrawal) => {
                    const paymentMethod = getPaymentMethod(withdrawal);
                    return (
                      <TableRow key={withdrawal.id} className="hover:bg-muted/30">
                        <TableCell className="text-blue-400 font-mono text-sm">
                          {formatTransactionId(withdrawal.id)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{withdrawal.profile?.full_name || "N/A"}</p>
                            <p className="text-xs text-muted-foreground">{withdrawal.bank_account?.bank_name || 'Conta não informada'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{formatCurrency(withdrawal.amount)}</p>
                            <p className="text-xs text-muted-foreground">Taxa: {formatCurrency(withdrawal.fee)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {paymentMethod.icon}
                            <span>{paymentMethod.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>
                          {format(new Date(withdrawal.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {withdrawal.status === "pending" && isAdmin && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedWithdrawal(withdrawal);
                                      setShowApproveDialog(true);
                                    }}
                                    className="text-green-400"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Aprovar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedWithdrawal(withdrawal);
                                      setShowRejectDialog(true);
                                    }}
                                    className="text-red-400"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Rejeitar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Saque</DialogTitle>
            <DialogDescription>
              {selectedWithdrawal && formatTransactionId(selectedWithdrawal.id)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Usuário</h4>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="font-medium">{selectedWithdrawal.profile?.full_name || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{selectedWithdrawal.profile?.email}</p>
                </div>
              </div>
              
              {/* Values */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Valor Bruto</p>
                  <p className="text-lg font-bold">{formatCurrency(selectedWithdrawal.amount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Taxa</p>
                  <p className="text-lg font-bold text-red-400">-{formatCurrency(selectedWithdrawal.fee)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Valor Líquido</p>
                  <p className="text-lg font-bold text-green-400">{formatCurrency(selectedWithdrawal.net_amount)}</p>
                </div>
              </div>
              
              {/* Bank Account */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Conta Bancária</h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Banco</span>
                    <span className="font-medium">{selectedWithdrawal.bank_account?.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agência</span>
                    <span className="font-medium">{selectedWithdrawal.bank_account?.agency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Conta</span>
                    <span className="font-medium">{selectedWithdrawal.bank_account?.account_number}</span>
                  </div>
                  {selectedWithdrawal.bank_account?.pix_key && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Chave PIX ({selectedWithdrawal.bank_account.pix_key_type})</span>
                      <span className="font-medium">{selectedWithdrawal.bank_account.pix_key}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status and Date */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {getStatusBadge(selectedWithdrawal.status)}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Data da Solicitação</p>
                  <p className="font-medium">
                    {format(new Date(selectedWithdrawal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              
              {/* Actions for pending */}
              {selectedWithdrawal.status === "pending" && isAdmin && (
                <div className="flex gap-3 pt-4">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setShowDetailsDialog(false);
                      setShowApproveDialog(true);
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar Saque
                  </Button>
                  <Button 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setShowDetailsDialog(false);
                      setShowRejectDialog(true);
                    }}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar Saque
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Saque?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja aprovar o saque de{' '}
              <strong>{formatCurrency(selectedWithdrawal?.net_amount || 0)}</strong> para{' '}
              <strong>{selectedWithdrawal?.profile?.full_name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedWithdrawal && handleUpdateStatus(selectedWithdrawal.id, "approved")}
            >
              Aprovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Saque?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rejeitar o saque de{' '}
              <strong>{formatCurrency(selectedWithdrawal?.amount || 0)}</strong> de{' '}
              <strong>{selectedWithdrawal?.profile?.full_name}</strong>?
              O valor retornará ao saldo do usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => selectedWithdrawal && handleUpdateStatus(selectedWithdrawal.id, "rejected")}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminSaques;