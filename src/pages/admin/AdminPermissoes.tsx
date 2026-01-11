import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Search, Shield, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";

interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user' | 'account_manager';
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

const AdminPermissoes = () => {
  const { isAdmin } = useAdminRole();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<'admin' | 'moderator' | 'account_manager'>("moderator");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [{ data: rolesData }, { data: profilesData }] = await Promise.all([
        supabase.from("user_roles").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*"),
      ]);

      // Map profiles to roles
      const rolesWithProfiles = (rolesData || []).map((role: any) => ({
        ...role,
        profile: profilesData?.find((p: any) => p.user_id === role.user_id),
      }));

      setRoles(rolesWithProfiles);
      setProfiles(profilesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar permissões");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!selectedUserId || !selectedRole) {
      toast.error("Selecione um usuário e uma role");
      return;
    }

    try {
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUserId,
        role: selectedRole,
      });

      if (error) throw error;

      toast.success("Permissão adicionada com sucesso");
      setSelectedUserId("");
      fetchData();
    } catch (error: any) {
      console.error("Error adding role:", error);
      if (error.code === "23505") {
        toast.error("Este usuário já possui esta permissão");
      } else {
        toast.error("Erro ao adicionar permissão");
      }
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    try {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);

      if (error) throw error;

      toast.success("Permissão removida com sucesso");
      fetchData();
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error("Erro ao remover permissão");
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge variant="destructive">Admin</Badge>;
    }
    if (role === "moderator") {
      return <Badge variant="secondary">Moderador</Badge>;
    }
    if (role === "account_manager") {
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Gerente de Contas</Badge>;
    }
    return <Badge variant="outline">Usuário</Badge>;
  };

  // Filter users that don't have special roles yet
  const availableUsers = profiles.filter(
    (p) => !roles.some((r) => r.user_id === p.user_id && (r.role === "admin" || r.role === "moderator" || r.role === "account_manager"))
  );

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Shield className="w-16 h-16 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar permissões.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciar Permissões</h1>
          <p className="text-muted-foreground">Adicione ou remova permissões de administrador e moderador</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Adicionar Permissão
            </CardTitle>
            <CardDescription>
              Selecione um usuário e a permissão que deseja conceder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name || user.email || "Usuário sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={(v: 'admin' | 'moderator' | 'account_manager') => setSelectedRole(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderador</SelectItem>
                  <SelectItem value="account_manager">Gerente de Contas</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleAddRole}>
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissões Ativas ({roles.filter(r => r.role !== 'user').length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : roles.filter(r => r.role !== 'user').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhuma permissão especial configurada
                    </TableCell>
                  </TableRow>
                ) : (
                  roles
                    .filter((r) => r.role !== "user")
                    .map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          {role.profile?.full_name || "Não informado"}
                        </TableCell>
                        <TableCell>{role.profile?.email || "Não informado"}</TableCell>
                        <TableCell>{getRoleBadge(role.role)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRole(role.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPermissoes;
