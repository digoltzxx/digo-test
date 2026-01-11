import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  Loader2,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Turma {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  max_students: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  created_at: string;
  course_name?: string;
  student_count?: number;
}

interface Course {
  id: string;
  name: string;
}

interface TurmasManagementProps {
  productId: string;
}

export default function TurmasManagement({ productId }: TurmasManagementProps) {
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [turmaToDelete, setTurmaToDelete] = useState<Turma | null>(null);
  const [formData, setFormData] = useState({
    course_id: "",
    name: "",
    description: "",
    max_students: "",
    starts_at: "",
    ends_at: "",
    status: "active",
  });
  const { toast } = useToast();

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .eq("product_id", productId);

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchTurmas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("turmas")
        .select(`
          *,
          courses (name)
        `)
        .in("course_id", courses.map(c => c.id))
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get student counts per turma
      const turmasWithCounts = await Promise.all(
        (data || []).map(async (turma: any) => {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("turma_id", turma.id);
          
          return {
            ...turma,
            course_name: turma.courses?.name,
            student_count: count || 0,
          };
        })
      );

      setTurmas(turmasWithCounts);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar turmas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [productId]);

  useEffect(() => {
    if (courses.length > 0) {
      fetchTurmas();
    } else {
      setLoading(false);
    }
  }, [courses]);

  const resetForm = () => {
    setFormData({
      course_id: courses[0]?.id || "",
      name: "",
      description: "",
      max_students: "",
      starts_at: "",
      ends_at: "",
      status: "active",
    });
    setEditingTurma(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (turma: Turma) => {
    setEditingTurma(turma);
    setFormData({
      course_id: turma.course_id,
      name: turma.name,
      description: turma.description || "",
      max_students: turma.max_students?.toString() || "",
      starts_at: turma.starts_at?.split("T")[0] || "",
      ends_at: turma.ends_at?.split("T")[0] || "",
      status: turma.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.course_id) {
      toast({ title: "Nome e curso são obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        course_id: formData.course_id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        max_students: formData.max_students ? parseInt(formData.max_students) : null,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        status: formData.status,
      };

      if (editingTurma) {
        const { error } = await supabase
          .from("turmas")
          .update(payload)
          .eq("id", editingTurma.id);

        if (error) throw error;
        toast({ title: "Turma atualizada!" });
      } else {
        const { error } = await supabase.from("turmas").insert(payload);
        if (error) throw error;
        toast({ title: "Turma criada!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchTurmas();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar turma",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!turmaToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("turmas")
        .delete()
        .eq("id", turmaToDelete.id);

      if (error) throw error;

      toast({ title: "Turma excluída!" });
      setDeleteDialogOpen(false);
      setTurmaToDelete(null);
      fetchTurmas();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir turma",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48 bg-gray-800" />
          <Skeleton className="h-10 w-32 bg-gray-800" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full bg-gray-800" />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
        <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-white font-medium mb-2">Crie um curso primeiro</h3>
        <p className="text-gray-500 text-sm">Para criar turmas, você precisa ter pelo menos um curso.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600/20">
            <Users className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Turmas</h3>
            <p className="text-gray-500 text-sm">{turmas.length} turma(s) criada(s)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTurmas}
            className="border-gray-700 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Turma
          </Button>
        </div>
      </div>

      {/* Turmas List */}
      {turmas.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Nenhuma turma criada</h3>
          <p className="text-gray-500 text-sm mb-4">Crie turmas para organizar seus alunos.</p>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Criar Turma
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {turmas.map((turma) => (
            <div
              key={turma.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#0d1117] border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-medium">{turma.name}</h4>
                  <Badge
                    className={
                      turma.status === "active"
                        ? "bg-green-600/20 text-green-400"
                        : "bg-gray-600/20 text-gray-400"
                    }
                  >
                    {turma.status === "active" ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-gray-500 text-sm">
                  Curso: {turma.course_name} • {turma.student_count} aluno(s)
                  {turma.max_students && ` / ${turma.max_students} vagas`}
                </p>
                {(turma.starts_at || turma.ends_at) && (
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Calendar className="h-3 w-3" />
                    {formatDate(turma.starts_at)} - {formatDate(turma.ends_at)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(turma)}
                  className="text-gray-400 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTurmaToDelete(turma);
                    setDeleteDialogOpen(true);
                  }}
                  className="text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTurma ? "Editar Turma" : "Nova Turma"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingTurma ? "Atualize as informações da turma." : "Crie uma nova turma para seu curso."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Curso <span className="text-red-400">*</span></Label>
              <Select
                value={formData.course_id}
                onValueChange={(value) => setFormData({ ...formData, course_id: value })}
              >
                <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                  <SelectValue placeholder="Selecione um curso" />
                </SelectTrigger>
                <SelectContent className="bg-[#161b22] border-gray-700">
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id} className="text-white hover:bg-gray-800">
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Nome da Turma <span className="text-red-400">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Turma Janeiro 2025"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da turma..."
                className="bg-[#0d1117] border-gray-700 text-white min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Limite de Alunos</Label>
              <Input
                type="number"
                value={formData.max_students}
                onChange={(e) => setFormData({ ...formData, max_students: e.target.value })}
                placeholder="Sem limite"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Data de Início</Label>
                <Input
                  type="date"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="bg-[#0d1117] border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Data de Término</Label>
                <Input
                  type="date"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="bg-[#0d1117] border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161b22] border-gray-700">
                  <SelectItem value="active" className="text-white hover:bg-gray-800">Ativa</SelectItem>
                  <SelectItem value="inactive" className="text-white hover:bg-gray-800">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-700">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTurma ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Turma</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta turma? Os alunos matriculados perderão o vínculo.
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
    </div>
  );
}
