import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Pencil,
  Power,
  Shield,
  Eye,
  ShoppingCart,
  Wallet,
  Headphones,
  UserCheck,
  Search,
  RefreshCw
} from "lucide-react";

interface AccountManager {
  id: string;
  user_id: string;
  can_view_accounts: boolean;
  can_view_sales: boolean;
  can_view_withdrawals: boolean;
  can_support: boolean;
  can_manage_affiliates: boolean;
  is_active: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

const permissionLabels = {
  can_view_accounts: { label: "Ver Contas", icon: Eye },
  can_view_sales: { label: "Ver Vendas", icon: ShoppingCart },
  can_view_withdrawals: { label: "Ver Saques", icon: Wallet },
  can_support: { label: "Suporte", icon: Headphones },
  can_manage_affiliates: { label: "Afiliados", icon: UserCheck },
};

const AdminGerentes = () => {
  const [managers, setManagers] = useState<AccountManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<AccountManager | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ id: string; email: string; full_name: string | null } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [permissions, setPermissions] = useState({
    can_view_accounts: false,
    can_view_sales: false,
    can_view_withdrawals: false,
    can_support: false,
    can_manage_affiliates: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    try {
      // Buscar permissões
      const { data: permissionsData, error: permError } = await supabase
        .from("account_manager_permissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (permError) throw permError;

      // Buscar perfis dos gerentes
      if (permissionsData && permissionsData.length > 0) {
        const userIds = permissionsData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        // Combinar dados
        const managersWithProfiles = permissionsData.map(perm => ({
          ...perm,
          profiles: profilesData?.find(p => p.user_id === perm.user_id) || null,
        }));

        setManagers(managersWithProfiles as AccountManager[]);
      } else {
        setManagers([]);
      }
    } catch (error) {
      console.error("Error fetching managers:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os gerentes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    
    setIsSearching(true);
    setFoundUser(null);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .ilike("email", `%${searchEmail}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Check if already a manager
        const existing = managers.find(m => m.user_id === data.user_id);
        if (existing) {
          toast({
            title: "Usuário já é gerente",
            description: "Este usuário já possui permissões de gerente.",
            variant: "destructive",
          });
          return;
        }
        
        setFoundUser({
          id: data.user_id,
          email: data.email || "",
          full_name: data.full_name,
        });
      } else {
        toast({
          title: "Usuário não encontrado",
          description: "Nenhum usuário com este email foi encontrado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching user:", error);
      toast({
        title: "Erro",
        description: "Erro ao buscar usuário.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddManager = async () => {
    if (!foundUser) return;

    try {
      // First add permissions
      const { error: permError } = await supabase
        .from("account_manager_permissions")
        .insert({
          user_id: foundUser.id,
          ...permissions,
        });

      if (permError) {
        console.error("Permission error:", permError);
        throw permError;
      }

      // Then add account_manager role (insert, not upsert - if exists, it's fine)
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: foundUser.id,
          role: "account_manager" as const,
        });

      // Ignore duplicate role error (already has the role)
      if (roleError && !roleError.message.includes("duplicate")) {
        console.error("Role error:", roleError);
        throw roleError;
      }

      toast({
        title: "Gerente adicionado!",
        description: `${foundUser.full_name || foundUser.email} agora é um gerente de conta.`,
      });

      setIsDialogOpen(false);
      resetForm();
      fetchManagers();
    } catch (error: any) {
      console.error("Error adding manager:", error);
      toast({
        title: "Erro",
        description: error?.message || "Não foi possível adicionar o gerente.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateManager = async () => {
    if (!editingManager) return;

    try {
      const { error } = await supabase
        .from("account_manager_permissions")
        .update(permissions)
        .eq("id", editingManager.id);

      if (error) throw error;

      toast({
        title: "Permissões atualizadas!",
        description: "As permissões do gerente foram atualizadas.",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchManagers();
    } catch (error) {
      console.error("Error updating manager:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as permissões.",
        variant: "destructive",
      });
    }
  };

  const toggleManagerStatus = async (manager: AccountManager) => {
    try {
      const { error } = await supabase
        .from("account_manager_permissions")
        .update({ is_active: !manager.is_active })
        .eq("id", manager.id);

      if (error) throw error;

      toast({
        title: manager.is_active ? "Gerente desativado" : "Gerente ativado",
        description: `O gerente foi ${manager.is_active ? "desativado" : "ativado"} com sucesso.`,
      });

      fetchManagers();
    } catch (error) {
      console.error("Error toggling manager status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (manager: AccountManager) => {
    setEditingManager(manager);
    setPermissions({
      can_view_accounts: manager.can_view_accounts,
      can_view_sales: manager.can_view_sales,
      can_view_withdrawals: manager.can_view_withdrawals,
      can_support: manager.can_support,
      can_manage_affiliates: manager.can_manage_affiliates,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingManager(null);
    setFoundUser(null);
    setSearchEmail("");
    setPermissions({
      can_view_accounts: false,
      can_view_sales: false,
      can_view_withdrawals: false,
      can_support: false,
      can_manage_affiliates: false,
    });
  };

  const filteredManagers = managers.filter(m => {
    const name = m.profiles?.full_name?.toLowerCase() || "";
    const email = m.profiles?.email?.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-accent" />
              Gerentes de Conta
            </h1>
            <p className="text-muted-foreground">
              Gerencie os gerentes e suas permissões
            </p>
          </div>
          <Button onClick={openAddDialog} className="bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Gerente
          </Button>
        </div>

        <Card className="bg-card/50 border-border/30">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Lista de Gerentes ({managers.length})
              </CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredManagers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum gerente encontrado" : "Nenhum gerente cadastrado"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gerente</TableHead>
                      <TableHead>Permissões</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredManagers.map((manager) => (
                      <TableRow key={manager.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {manager.profiles?.full_name || "Sem nome"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {manager.profiles?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(permissionLabels).map(([key, { label, icon: Icon }]) => {
                              const hasPermission = manager[key as keyof typeof permissions];
                              if (!hasPermission) return null;
                              return (
                                <Badge
                                  key={key}
                                  variant="outline"
                                  className="text-xs bg-accent/10 text-accent border-accent/30"
                                >
                                  <Icon className="w-3 h-3 mr-1" />
                                  {label}
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              manager.is_active
                                ? "bg-green-500/20 text-green-500 border-green-500/30"
                                : "bg-red-500/20 text-red-500 border-red-500/30"
                            }
                          >
                            {manager.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(manager.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(manager)}
                              title="Editar permissões"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleManagerStatus(manager)}
                              title={manager.is_active ? "Desativar" : "Ativar"}
                            >
                              <Power className={`w-4 h-4 ${manager.is_active ? "text-green-500" : "text-red-500"}`} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para adicionar/editar gerente */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingManager ? "Editar Permissões" : "Adicionar Gerente"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {!editingManager && (
                <div className="space-y-4">
                  <div>
                    <Label>Buscar Usuário por Email</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input
                        placeholder="email@exemplo.com"
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                      />
                      <Button 
                        onClick={searchUser} 
                        disabled={isSearching}
                        variant="outline"
                      >
                        {isSearching ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {foundUser && (
                    <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
                      <p className="font-medium">{foundUser.full_name || "Sem nome"}</p>
                      <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                    </div>
                  )}
                </div>
              )}

              {editingManager && (
                <div className="p-3 rounded-lg bg-secondary/30">
                  <p className="font-medium">{editingManager.profiles?.full_name || "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{editingManager.profiles?.email}</p>
                </div>
              )}

              <div className="space-y-4">
                <Label>Permissões</Label>
                {Object.entries(permissionLabels).map(([key, { label, icon: Icon }]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Switch
                      checked={permissions[key as keyof typeof permissions]}
                      onCheckedChange={(checked) =>
                        setPermissions((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-accent hover:bg-accent/90"
                  onClick={editingManager ? handleUpdateManager : handleAddManager}
                  disabled={!editingManager && !foundUser}
                >
                  {editingManager ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminGerentes;
