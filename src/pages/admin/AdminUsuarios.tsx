import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, MoreVertical, LogIn, Ban, Trash2, Filter, Users, UserCheck, Clock, UserX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

interface UserWithData {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  verification_status: string;
  role: string;
  balance: number;
}

const AdminUsuarios = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithData | null>(null);

  useEffect(() => {
    fetchUsers();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('admin-users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchUsers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        fetchUsers();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch roles for all users
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Fetch sales to calculate balance (deducting withdrawals)
      const { data: salesData } = await supabase
        .from("sales")
        .select("seller_user_id, amount, commission_amount, status");

      // Fetch withdrawals to deduct from balance
      const { data: withdrawalsData } = await supabase
        .from("withdrawals")
        .select("user_id, net_amount, status");

      const rolesMap: Record<string, string> = {};
      (roles as { user_id: string; role: string }[] || []).forEach((r) => {
        // Priority: admin > moderator > user
        if (!rolesMap[r.user_id] || 
            (r.role === 'admin') || 
            (r.role === 'moderator' && rolesMap[r.user_id] !== 'admin')) {
          rolesMap[r.user_id] = r.role;
        }
      });

      // Calculate balances per user (sales - withdrawals)
      const balanceMap: Record<string, number> = {};
      
      // Add completed sales
      (salesData || []).forEach((sale) => {
        if (sale.status === 'completed') {
          const net = Number(sale.amount) - Number(sale.commission_amount || 0);
          balanceMap[sale.seller_user_id] = (balanceMap[sale.seller_user_id] || 0) + net;
        }
      });
      
      // Subtract completed withdrawals
      (withdrawalsData || []).forEach((withdrawal) => {
        if (withdrawal.status === 'completed' || withdrawal.status === 'approved') {
          balanceMap[withdrawal.user_id] = (balanceMap[withdrawal.user_id] || 0) - Number(withdrawal.net_amount);
        }
      });

      const usersWithData: UserWithData[] = (profiles || []).map((profile) => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        created_at: profile.created_at,
        verification_status: profile.verification_status || 'pending',
        role: rolesMap[profile.user_id] || 'user',
        balance: Math.max(0, balanceMap[profile.user_id] || 0),
      }));

      setUsers(usersWithData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "active") return matchesSearch && user.verification_status === 'approved';
    if (statusFilter === "pending") return matchesSearch && user.verification_status === 'pending';
    if (statusFilter === "blocked") return matchesSearch && user.verification_status === 'blocked';
    return matchesSearch;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.verification_status === 'approved').length,
    pending: users.filter(u => u.verification_status === 'pending').length,
    blocked: users.filter(u => u.verification_status === 'blocked').length,
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'moderator': return 'Moderador';
      case 'account_manager': return 'Gerente';
      default: return 'Vendedor';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativo</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case 'blocked':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name: string | null) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 
      'bg-pink-500', 'bg-red-500', 'bg-orange-500', 'bg-teal-500'
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleAccessAccount = (user: UserWithData) => {
    // Store admin view mode in sessionStorage for viewing user data
    sessionStorage.setItem('admin_viewing_user', JSON.stringify({
      userId: user.user_id,
      userName: user.full_name || user.email,
      startedAt: new Date().toISOString(),
    }));
    
    // Navigate to a special admin view page for this user
    navigate(`/admin/visualizar-usuario/${user.user_id}`);
    
    toast.success(`Visualizando conta de ${user.full_name || user.email}`);
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    try {
      // When unblocking, return to 'approved' (verified) so user doesn't need to resubmit documents
      const newStatus = selectedUser.verification_status === 'blocked' ? 'approved' : 'blocked';
      const { error } = await supabase
        .from("profiles")
        .update({ verification_status: newStatus })
        .eq("user_id", selectedUser.user_id);

      if (error) throw error;
      toast.success(newStatus === 'blocked' ? 'Usuário bloqueado' : 'Usuário desbloqueado e reativado');
      fetchUsers();
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Erro ao alterar status do usuário");
    } finally {
      setBlockDialogOpen(false);
      setSelectedUser(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      // Call edge function to delete user completely
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: selectedUser.user_id }
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(data?.message || 'Usuário excluído com sucesso');
      
      if (data?.warning) {
        toast.warning(data.warning);
      }
      
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir usuário");
    } finally {
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="blocked">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total de Usuários</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-3xl font-bold mt-1 text-green-400">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-3xl font-bold mt-1 text-yellow-400">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Inativos</p>
              <p className="text-3xl font-bold mt-1">{stats.blocked}</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Nome</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Função</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Status</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Saldo</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium">Cadastro</TableHead>
                  <TableHead className="text-xs uppercase text-muted-foreground font-medium text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`${getAvatarColor(user.full_name)} text-white`}>
                            <AvatarFallback className="bg-transparent">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'Não informado'}</p>
                            <p className="text-xs text-blue-400">{user.email || 'Sem email'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleLabel(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.verification_status)}</TableCell>
                      <TableCell>{formatCurrency(user.balance)}</TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAccessAccount(user)}>
                              <LogIn className="h-4 w-4 mr-2" />
                              Acessar conta
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedUser(user);
                                setBlockDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              {user.verification_status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-400"
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir conta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Block Dialog */}
      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.verification_status === 'blocked' ? 'Desbloquear usuário?' : 'Bloquear usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.verification_status === 'blocked' 
                ? `Tem certeza que deseja desbloquear ${selectedUser?.full_name || selectedUser?.email}?`
                : `Tem certeza que deseja bloquear ${selectedUser?.full_name || selectedUser?.email}? O usuário não poderá acessar a plataforma.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser}>
              {selectedUser?.verification_status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta de usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente a conta de{' '}
              <strong>{selectedUser?.full_name || selectedUser?.email}</strong> e todos os dados associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsuarios;
