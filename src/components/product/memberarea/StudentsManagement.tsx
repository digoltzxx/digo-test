import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  MoreHorizontal,
  Ban,
  Unlock,
  Eye,
  GraduationCap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  document: string | null;
  status: string;
  notes: string | null;
  enrolled_at: string;
  created_at: string;
  is_blocked: boolean | null;
  blocked_at: string | null;
  blocked_reason: string | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  course_name?: string;
}

interface StudentsManagementProps {
  productId: string;
  sellerId: string;
}

const studentSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().email("Email inválido").max(255, "Email muito longo"),
  phone: z.string().max(20, "Telefone muito longo").optional().or(z.literal("")),
  document: z.string().max(20, "Documento muito longo").optional().or(z.literal("")),
  notes: z.string().max(500, "Observações muito longas").optional().or(z.literal("")),
});

type StudentFormData = z.infer<typeof studentSchema>;

export default function StudentsManagement({ productId, sellerId }: StudentsManagementProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");
  
  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Selected student
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToBlock, setStudentToBlock] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentEnrollments, setStudentEnrollments] = useState<Enrollment[]>([]);
  
  // Form
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<StudentFormData>({
    name: "",
    email: "",
    phone: "",
    document: "",
    notes: "",
  });
  const [blockReason, setBlockReason] = useState("");
  
  const { toast } = useToast();

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStudents((data as Student[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar alunos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentEnrollments = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id,
          course_id,
          status,
          enrolled_at,
          courses (name)
        `)
        .eq("student_id", studentId);

      if (error) throw error;
      
      setStudentEnrollments(
        (data || []).map((e: any) => ({
          id: e.id,
          course_id: e.course_id,
          status: e.status,
          enrolled_at: e.enrolled_at,
          course_name: e.courses?.name,
        }))
      );
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [productId]);

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", document: "", notes: "" });
    setFormErrors({});
    setEditingStudent(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      email: student.email,
      phone: student.phone || "",
      document: student.document || "",
      notes: student.notes || "",
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const openDeleteDialog = (student: Student) => {
    setStudentToDelete(student);
    setDeleteDialogOpen(true);
  };

  const openBlockDialog = (student: Student) => {
    setStudentToBlock(student);
    setBlockReason("");
    setBlockDialogOpen(true);
  };

  const openDetailsDialog = async (student: Student) => {
    setSelectedStudent(student);
    await fetchStudentEnrollments(student.id);
    setDetailsDialogOpen(true);
  };

  const handleSubmit = async () => {
    setFormErrors({});
    
    const result = studentSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      if (editingStudent) {
        const { error } = await supabase
          .from("students")
          .update({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone?.trim() || null,
            document: formData.document?.trim() || null,
            notes: formData.notes?.trim() || null,
          })
          .eq("id", editingStudent.id);

        if (error) throw error;
        
        toast({
          title: "Aluno atualizado",
          description: "Os dados do aluno foram atualizados com sucesso.",
        });
      } else {
        const { error } = await supabase.from("students").insert({
          product_id: productId,
          seller_user_id: sellerId,
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone?.trim() || null,
          document: formData.document?.trim() || null,
          notes: formData.notes?.trim() || null,
        });

        if (error) throw error;
        
        toast({
          title: "Aluno adicionado",
          description: "O aluno foi cadastrado com sucesso.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar aluno",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;

    setSaving(true);
    try {
      // First delete related enrollments
      await supabase
        .from("enrollments")
        .delete()
        .eq("student_id", studentToDelete.id);

      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", studentToDelete.id);

      if (error) throw error;

      toast({
        title: "Aluno removido",
        description: "O aluno foi removido com sucesso.",
      });
      setDeleteDialogOpen(false);
      setStudentToDelete(null);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Erro ao remover aluno",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBlockToggle = async () => {
    if (!studentToBlock) return;

    setSaving(true);
    try {
      const isBlocking = !studentToBlock.is_blocked;
      
      const { error } = await supabase
        .from("students")
        .update({
          is_blocked: isBlocking,
          blocked_at: isBlocking ? new Date().toISOString() : null,
          blocked_reason: isBlocking ? blockReason || null : null,
          status: isBlocking ? "blocked" : "active",
        })
        .eq("id", studentToBlock.id);

      if (error) throw error;

      // If blocking, also revoke all enrollments
      if (isBlocking) {
        await supabase
          .from("enrollments")
          .update({
            status: "revoked",
            access_revoked_at: new Date().toISOString(),
            revoke_reason: blockReason || "Aluno bloqueado",
          })
          .eq("student_id", studentToBlock.id);
      }

      toast({
        title: isBlocking ? "Aluno bloqueado" : "Aluno desbloqueado",
        description: isBlocking 
          ? "O aluno foi bloqueado e seus acessos foram revogados."
          : "O aluno foi desbloqueado com sucesso.",
      });

      setBlockDialogOpen(false);
      setStudentToBlock(null);
      setBlockReason("");
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeEnrollment = async (enrollmentId: string) => {
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "revoked",
          access_revoked_at: new Date().toISOString(),
          revoke_reason: "Revogado manualmente",
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({
        title: "Matrícula revogada",
        description: "O acesso do aluno foi revogado.",
      });

      if (selectedStudent) {
        fetchStudentEnrollments(selectedStudent.id);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao revogar matrícula",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !student.is_blocked) ||
      (statusFilter === "blocked" && student.is_blocked);

    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/20">
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Gestão de Alunos</h3>
            <p className="text-gray-500 text-sm">
              {students.length} aluno{students.length !== 1 ? "s" : ""} cadastrado{students.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStudents}
            disabled={loading}
            className="border-gray-700 hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={openCreateDialog}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Aluno
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0d1117] border-gray-700 text-white"
          />
        </div>
        <div className="flex gap-2">
          {["all", "active", "blocked"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(status as typeof statusFilter)}
              className={statusFilter === status 
                ? "bg-blue-600 text-white" 
                : "border-gray-700 text-gray-400 hover:text-white"}
            >
              {status === "all" ? "Todos" : status === "active" ? "Ativos" : "Bloqueados"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-[#0d1117]">
              <Skeleton className="h-10 w-10 rounded-full bg-gray-800" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px] bg-gray-800" />
                <Skeleton className="h-3 w-[150px] bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-700 rounded-lg">
          <Users className="h-12 w-12 text-gray-500 mb-4" />
          <h3 className="text-white font-medium mb-1">
            {searchTerm || statusFilter !== "all" ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
          </h3>
          <p className="text-gray-500 text-sm mb-4 max-w-sm">
            {searchTerm || statusFilter !== "all"
              ? "Tente ajustar os filtros"
              : "Adicione alunos ou eles serão cadastrados automaticamente após uma compra."}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Aluno
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800 hover:bg-transparent">
                <TableHead className="text-gray-400">Nome</TableHead>
                <TableHead className="text-gray-400">Email</TableHead>
                <TableHead className="text-gray-400 hidden md:table-cell">Telefone</TableHead>
                <TableHead className="text-gray-400 hidden lg:table-cell">Inscrito em</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} className="border-gray-800 hover:bg-gray-800/50">
                  <TableCell className="font-medium text-white">{student.name}</TableCell>
                  <TableCell className="text-gray-300">{student.email}</TableCell>
                  <TableCell className="text-gray-300 hidden md:table-cell">
                    {student.phone || "-"}
                  </TableCell>
                  <TableCell className="text-gray-300 hidden lg:table-cell">
                    {formatDate(student.enrolled_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        student.is_blocked
                          ? "bg-red-600/20 text-red-400 border-red-600/30"
                          : student.status === "active"
                          ? "bg-green-600/20 text-green-400 border-green-600/30"
                          : "bg-gray-600/20 text-gray-400 border-gray-600/30"
                      }
                    >
                      {student.is_blocked ? (
                        <><Ban className="h-3 w-3 mr-1" /> Bloqueado</>
                      ) : student.status === "active" ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Ativo</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#161b22] border-gray-700">
                        <DropdownMenuItem 
                          onClick={() => openDetailsDialog(student)}
                          className="text-gray-300 hover:bg-gray-800"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openEditDialog(student)}
                          className="text-gray-300 hover:bg-gray-800"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-gray-700" />
                        <DropdownMenuItem 
                          onClick={() => openBlockDialog(student)}
                          className={student.is_blocked ? "text-green-400 hover:bg-gray-800" : "text-yellow-400 hover:bg-gray-800"}
                        >
                          {student.is_blocked ? (
                            <><Unlock className="h-4 w-4 mr-2" /> Desbloquear</>
                          ) : (
                            <><Ban className="h-4 w-4 mr-2" /> Bloquear</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(student)}
                          className="text-red-400 hover:bg-gray-800"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStudent ? "Editar Aluno" : "Adicionar Aluno"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingStudent ? "Atualize os dados do aluno." : "Preencha os dados do novo aluno."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome <span className="text-red-400">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
                className={`bg-[#0d1117] border-gray-700 text-white ${formErrors.name ? "border-red-500" : ""}`}
              />
              {formErrors.name && <p className="text-red-400 text-xs">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Email <span className="text-red-400">*</span></Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className={`bg-[#0d1117] border-gray-700 text-white ${formErrors.email ? "border-red-500" : ""}`}
              />
              {formErrors.email && <p className="text-red-400 text-xs">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Documento (CPF/CNPJ)</Label>
              <Input
                value={formData.document}
                onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                placeholder="000.000.000-00"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações sobre o aluno..."
                className="bg-[#0d1117] border-gray-700 text-white min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-700">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingStudent ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aluno</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este aluno? Todas as matrículas e progressos serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-white hover:bg-gray-800">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {studentToBlock?.is_blocked ? "Desbloquear Aluno" : "Bloquear Aluno"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {studentToBlock?.is_blocked 
                ? "O aluno terá seu acesso restaurado."
                : "O aluno perderá acesso a todos os cursos imediatamente."}
            </DialogDescription>
          </DialogHeader>
          {!studentToBlock?.is_blocked && (
            <div className="space-y-2 py-4">
              <Label className="text-gray-300">Motivo do bloqueio (opcional)</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Solicitação de reembolso"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)} className="border-gray-700">
              Cancelar
            </Button>
            <Button 
              onClick={handleBlockToggle} 
              disabled={saving}
              className={studentToBlock?.is_blocked ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {studentToBlock?.is_blocked ? "Desbloquear" : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Aluno</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Nome</p>
                  <p className="text-white">{selectedStudent.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Email</p>
                  <p className="text-white">{selectedStudent.email}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Telefone</p>
                  <p className="text-white">{selectedStudent.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Documento</p>
                  <p className="text-white">{selectedStudent.document || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
                  <Badge className={selectedStudent.is_blocked ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"}>
                    {selectedStudent.is_blocked ? "Bloqueado" : "Ativo"}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Inscrito em</p>
                  <p className="text-white">{formatDate(selectedStudent.enrolled_at)}</p>
                </div>
              </div>

              {selectedStudent.blocked_reason && (
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Motivo do Bloqueio</p>
                  <p className="text-red-400">{selectedStudent.blocked_reason}</p>
                </div>
              )}

              {selectedStudent.notes && (
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Observações</p>
                  <p className="text-gray-300">{selectedStudent.notes}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-4 w-4 text-purple-400" />
                  <p className="text-white font-medium">Matrículas ({studentEnrollments.length})</p>
                </div>
                {studentEnrollments.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhuma matrícula encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {studentEnrollments.map((enrollment) => (
                      <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-gray-800">
                        <div>
                          <p className="text-white text-sm">{enrollment.course_name || "Curso"}</p>
                          <p className="text-gray-500 text-xs">Matriculado em {formatDate(enrollment.enrolled_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={enrollment.status === "active" ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}>
                            {enrollment.status === "active" ? "Ativo" : "Revogado"}
                          </Badge>
                          {enrollment.status === "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeEnrollment(enrollment.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
