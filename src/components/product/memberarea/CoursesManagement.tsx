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
  BookOpen,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Course {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
}

interface CoursesManagementProps {
  productId: string;
  sellerId: string;
}

export default function CoursesManagement({ productId, sellerId }: CoursesManagementProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
    status: "active",
  });
  const { toast } = useToast();

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar cursos",
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

  const resetForm = () => {
    setFormData({ name: "", description: "", image_url: "", status: "active" });
    setEditingCourse(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      description: course.description || "",
      image_url: course.image_url || "",
      status: course.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingCourse) {
        const { error } = await supabase
          .from("courses")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            image_url: formData.image_url.trim() || null,
            status: formData.status,
          })
          .eq("id", editingCourse.id);

        if (error) throw error;
        toast({ title: "Curso atualizado!" });
      } else {
        const { error } = await supabase.from("courses").insert({
          product_id: productId,
          seller_user_id: sellerId,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          image_url: formData.image_url.trim() || null,
          status: formData.status,
        });

        if (error) throw error;
        toast({ title: "Curso criado!" });
      }

      setDialogOpen(false);
      resetForm();
      fetchCourses();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar curso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .delete()
        .eq("id", courseToDelete.id);

      if (error) throw error;

      toast({ title: "Curso excluído!" });
      setDeleteDialogOpen(false);
      setCourseToDelete(null);
      fetchCourses();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir curso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (course: Course) => {
    const newStatus = course.status === "active" ? "draft" : "active";
    try {
      const { error } = await supabase
        .from("courses")
        .update({ status: newStatus })
        .eq("id", course.id);

      if (error) throw error;
      toast({ title: `Curso ${newStatus === "active" ? "ativado" : "desativado"}!` });
      fetchCourses();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48 bg-gray-800" />
          <Skeleton className="h-10 w-32 bg-gray-800" />
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-600/20">
            <BookOpen className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">Cursos</h3>
            <p className="text-gray-500 text-sm">{courses.length} curso(s) criado(s)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCourses}
            className="border-gray-700 hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Novo Curso
          </Button>
        </div>
      </div>

      {/* Courses List */}
      {courses.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
          <BookOpen className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Nenhum curso criado</h3>
          <p className="text-gray-500 text-sm mb-4">Crie seu primeiro curso para começar.</p>
          <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Criar Curso
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#0d1117] border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                {course.image_url ? (
                  <img
                    src={course.image_url}
                    alt={course.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <h4 className="text-white font-medium">{course.name}</h4>
                  {course.description && (
                    <p className="text-gray-500 text-sm line-clamp-1">{course.description}</p>
                  )}
                  <Badge
                    className={
                      course.status === "active"
                        ? "bg-green-600/20 text-green-400 mt-1"
                        : "bg-gray-600/20 text-gray-400 mt-1"
                    }
                  >
                    {course.status === "active" ? "Ativo" : "Rascunho"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleStatus(course)}
                  className="text-gray-400 hover:text-white"
                >
                  {course.status === "active" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(course)}
                  className="text-gray-400 hover:text-white"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCourseToDelete(course);
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
            <DialogTitle>{editingCourse ? "Editar Curso" : "Novo Curso"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingCourse ? "Atualize as informações do curso." : "Crie um novo curso para seu produto."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome do Curso <span className="text-red-400">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Curso Completo de Marketing"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o conteúdo do curso..."
                className="bg-[#0d1117] border-gray-700 text-white min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">URL da Imagem de Capa</Label>
              <Input
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                className="bg-[#0d1117] border-gray-700 text-white"
              />
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
                  <SelectItem value="active" className="text-white hover:bg-gray-800">Ativo</SelectItem>
                  <SelectItem value="draft" className="text-white hover:bg-gray-800">Rascunho</SelectItem>
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
              {editingCourse ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Curso</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este curso? Todos os módulos, aulas e matrículas serão removidos.
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
