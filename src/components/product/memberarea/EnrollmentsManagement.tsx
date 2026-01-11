import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Search,
  GraduationCap,
  RefreshCw,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  product_id: string;
  sale_id: string | null;
  status: string;
  enrolled_at: string;
  expires_at: string | null;
  access_revoked_at: string | null;
  revoke_reason: string | null;
  student_name?: string;
  student_email?: string;
  course_name?: string;
}

interface EnrollmentsManagementProps {
  productId: string;
}

export default function EnrollmentsManagement({ productId }: EnrollmentsManagementProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked" | "expired">("all");
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [enrollmentToRevoke, setEnrollmentToRevoke] = useState<Enrollment | null>(null);
  const { toast } = useToast();

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          students (name, email),
          courses (name)
        `)
        .eq("product_id", productId)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      setEnrollments(
        (data || []).map((e: any) => ({
          ...e,
          student_name: e.students?.name,
          student_email: e.students?.email,
          course_name: e.courses?.name,
        }))
      );
    } catch (error: any) {
      toast({
        title: "Erro ao carregar matrículas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [productId]);

  const handleRevoke = async () => {
    if (!enrollmentToRevoke) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "revoked",
          access_revoked_at: new Date().toISOString(),
          revoke_reason: "Revogado manualmente pelo administrador",
        })
        .eq("id", enrollmentToRevoke.id);

      if (error) throw error;

      toast({ title: "Matrícula revogada!" });
      setRevokeDialogOpen(false);
      setEnrollmentToRevoke(null);
      fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Erro ao revogar matrícula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (enrollmentId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "active",
          access_revoked_at: null,
          revoke_reason: null,
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({ title: "Matrícula restaurada!" });
      fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Erro ao restaurar matrícula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      enrollment.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.student_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.course_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      enrollment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
            <CheckCircle className="h-3 w-3 mr-1" /> Ativa
          </Badge>
        );
      case "revoked":
        return (
          <Badge className="bg-red-600/20 text-red-400 border-red-600/30">
            <XCircle className="h-3 w-3 mr-1" /> Revogada
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
            Expirada
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-600/20">
            <GraduationCap className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Matrículas</h3>
            <p className="text-gray-500 text-sm">
              {enrollments.length} matrícula(s) no total
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEnrollments}
          disabled={loading}
          className="border-gray-700 hover:bg-gray-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por aluno ou curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0d1117] border-gray-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "revoked", "expired"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status as typeof statusFilter)}
              className={statusFilter === status
                ? "bg-blue-600 text-white"
                : "border-gray-700 text-gray-400 hover:text-white"}
            >
              {status === "all" ? "Todas" : status === "active" ? "Ativas" : status === "revoked" ? "Revogadas" : "Expiradas"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full bg-gray-800" />
          ))}
        </div>
      ) : filteredEnrollments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
          <GraduationCap className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-1">
            {searchTerm || statusFilter !== "all" ? "Nenhuma matrícula encontrada" : "Nenhuma matrícula"}
          </h3>
          <p className="text-gray-500 text-sm">
            {searchTerm || statusFilter !== "all"
              ? "Tente ajustar os filtros"
              : "Matrículas são criadas automaticamente após pagamentos aprovados."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Aluno</TableHead>
                <TableHead className="text-gray-400">Curso</TableHead>
                <TableHead className="text-gray-400 hidden md:table-cell">Matriculado em</TableHead>
                <TableHead className="text-gray-400 hidden lg:table-cell">Expira em</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEnrollments.map((enrollment) => (
                <TableRow key={enrollment.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell>
                    <div>
                      <p className="text-white font-medium">{enrollment.student_name || "N/A"}</p>
                      <p className="text-gray-500 text-xs">{enrollment.student_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{enrollment.course_name || "N/A"}</TableCell>
                  <TableCell className="text-gray-300 hidden md:table-cell">
                    {formatDate(enrollment.enrolled_at)}
                  </TableCell>
                  <TableCell className="text-gray-300 hidden lg:table-cell">
                    {formatDate(enrollment.expires_at)}
                  </TableCell>
                  <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#161b22] border-gray-700">
                        {enrollment.status === "active" ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setEnrollmentToRevoke(enrollment);
                              setRevokeDialogOpen(true);
                            }}
                            className="text-red-400 hover:bg-gray-800"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Revogar Acesso
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleRestore(enrollment.id)}
                            className="text-green-400 hover:bg-gray-800"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restaurar Acesso
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Revoke Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar Matrícula</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja revogar o acesso de{" "}
              <strong className="text-white">{enrollmentToRevoke?.student_name}</strong> ao curso{" "}
              <strong className="text-white">{enrollmentToRevoke?.course_name}</strong>?
              O aluno perderá o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-white hover:bg-gray-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
