import { useState } from "react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Video,
  FileText,
  Link as LinkIcon,
  Loader2,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { useLessonManagement, CourseModule } from "@/hooks/useCourseManagement";
import { useToast } from "@/hooks/use-toast";

interface MemberAreaContentProps {
  course: any;
  modules: CourseModule[];
  saving: boolean;
  addModule: (name: string, description?: string) => Promise<void>;
  updateModule: (moduleId: string, updates: Partial<CourseModule>) => Promise<void>;
  deleteModule: (moduleId: string) => Promise<void>;
}

const contentTypes = [
  { value: "video", label: "Vídeo", icon: Video },
  { value: "text", label: "Texto/Artigo", icon: FileText },
  { value: "link", label: "Link Externo", icon: LinkIcon },
  { value: "pdf", label: "PDF", icon: FileText },
];

export default function MemberAreaContent({
  course,
  modules,
  saving,
  addModule,
  updateModule,
  deleteModule,
}: MemberAreaContentProps) {
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ name: "", description: "" });
  const { toast } = useToast();

  const handleOpenModuleDialog = (module?: CourseModule) => {
    if (module) {
      setEditingModule(module);
      setModuleForm({ name: module.name, description: module.description || "" });
    } else {
      setEditingModule(null);
      setModuleForm({ name: "", description: "" });
    }
    setModuleDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!moduleForm.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }

    if (editingModule) {
      await updateModule(editingModule.id, {
        name: moduleForm.name,
        description: moduleForm.description || null,
      });
    } else {
      await addModule(moduleForm.name, moduleForm.description);
    }

    setModuleDialogOpen(false);
    setModuleForm({ name: "", description: "" });
    setEditingModule(null);
  };

  const handleDeleteModule = async () => {
    if (deleteModuleId) {
      await deleteModule(deleteModuleId);
      setDeleteModuleId(null);
    }
  };

  if (!course) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-white font-medium mb-2">Configurando Área de Membros...</h3>
        <p className="text-gray-500 text-sm mb-4">
          Aguarde enquanto preparamos a estrutura do seu curso.
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-accent mx-auto" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Modules List */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium">
            Módulos ({modules.length})
          </h4>
          <Button
            onClick={() => handleOpenModuleDialog()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Módulo
          </Button>
        </div>

        {modules.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-700 rounded-lg">
            <BookOpen className="h-8 w-8 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Nenhum módulo criado ainda. Adicione seu primeiro módulo.
            </p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {modules.map((module, index) => (
              <AccordionItem
                key={module.id}
                value={module.id}
                className="border border-gray-800 rounded-lg bg-[#0d1117] overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-gray-800/50 [&[data-state=open]]:bg-gray-800/50">
                  <div className="flex items-center gap-3 flex-1">
                    <GripVertical className="h-4 w-4 text-gray-500" />
                    <span className="text-white font-medium">
                      {index + 1}. {module.name}
                    </span>
                    {!module.is_active && (
                      <Badge variant="secondary" className="bg-gray-700 text-gray-400 text-xs">
                        Oculto
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {module.description && (
                      <p className="text-gray-400 text-sm">{module.description}</p>
                    )}
                    
                    {/* Module Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenModuleDialog(module)}
                        className="border-gray-700 hover:bg-gray-800 text-gray-300"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateModule(module.id, { is_active: !module.is_active })}
                        className="border-gray-700 hover:bg-gray-800 text-gray-300"
                      >
                        {module.is_active ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Ocultar
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Mostrar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteModuleId(module.id)}
                        className="border-red-900/50 hover:bg-red-950/50 text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </div>

                    {/* Lessons Component */}
                    <ModuleLessons moduleId={module.id} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingModule ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingModule ? "Atualize as informações do módulo." : "Adicione um novo módulo ao seu curso."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome do Módulo</Label>
              <Input
                value={moduleForm.name}
                onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value })}
                placeholder="Ex: Introdução ao Curso"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Descrição (opcional)</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                placeholder="Descreva o conteúdo deste módulo..."
                className="bg-[#0d1117] border-gray-700 text-white min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModuleDialogOpen(false)}
              className="border-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveModule}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingModule ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Confirmation */}
      <AlertDialog open={!!deleteModuleId} onOpenChange={() => setDeleteModuleId(null)}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Módulo</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este módulo? Todas as aulas dentro dele serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-white hover:bg-gray-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModule}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Lessons sub-component for each module
function ModuleLessons({ moduleId }: { moduleId: string }) {
  const { lessons, loading, saving, addLesson, updateLesson, deleteLesson } = useLessonManagement(moduleId);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    name: "",
    description: "",
    content_type: "video",
    content_url: "",
    is_free: false,
  });
  const { toast } = useToast();

  const handleOpenLessonDialog = (lesson?: any) => {
    if (lesson) {
      setEditingLesson(lesson);
      setLessonForm({
        name: lesson.name,
        description: lesson.description || "",
        content_type: lesson.content_type || "video",
        content_url: lesson.content_url || "",
        is_free: lesson.is_free || false,
      });
    } else {
      setEditingLesson(null);
      setLessonForm({
        name: "",
        description: "",
        content_type: "video",
        content_url: "",
        is_free: false,
      });
    }
    setLessonDialogOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!lessonForm.name.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }

    if (editingLesson) {
      await updateLesson(editingLesson.id, {
        name: lessonForm.name,
        description: lessonForm.description || null,
        content_type: lessonForm.content_type,
        content_url: lessonForm.content_url || null,
        is_free: lessonForm.is_free,
      });
    } else {
      await addLesson(lessonForm);
    }

    setLessonDialogOpen(false);
  };

  const handleDeleteLesson = async () => {
    if (deleteLessonId) {
      await deleteLesson(deleteLessonId);
      setDeleteLessonId(null);
    }
  };

  if (loading) {
    return <Skeleton className="h-12 w-full bg-gray-800" />;
  }

  const getContentTypeIcon = (type: string) => {
    const contentType = contentTypes.find(ct => ct.value === type);
    return contentType ? <contentType.icon className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Aulas ({lessons.length})</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleOpenLessonDialog()}
          className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/50"
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Aula
        </Button>
      </div>

      {lessons.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4 border border-dashed border-gray-800 rounded-lg">
          Nenhuma aula neste módulo ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm">{index + 1}.</span>
                <div className="text-gray-400">
                  {getContentTypeIcon(lesson.content_type)}
                </div>
                <div>
                  <span className="text-white text-sm">{lesson.name}</span>
                  {lesson.is_free && (
                    <Badge className="ml-2 bg-green-600/20 text-green-400 border-green-600/30 text-xs">
                      Gratuita
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenLessonDialog(lesson)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteLessonId(lesson.id)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Editar Aula" : "Nova Aula"}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingLesson ? "Atualize as informações da aula." : "Adicione uma nova aula ao módulo."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Nome da Aula</Label>
              <Input
                value={lessonForm.name}
                onChange={(e) => setLessonForm({ ...lessonForm, name: e.target.value })}
                placeholder="Ex: Aula 01 - Introdução"
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Descrição (opcional)</Label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                placeholder="Descreva o conteúdo da aula..."
                className="bg-[#0d1117] border-gray-700 text-white min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Tipo de Conteúdo</Label>
              <Select
                value={lessonForm.content_type}
                onValueChange={(value) => setLessonForm({ ...lessonForm, content_type: value })}
              >
                <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161b22] border-gray-700">
                  {contentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-white hover:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">URL do Conteúdo</Label>
              <Input
                value={lessonForm.content_url}
                onChange={(e) => setLessonForm({ ...lessonForm, content_url: e.target.value })}
                placeholder="https://..."
                className="bg-[#0d1117] border-gray-700 text-white"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-gray-300">Aula Gratuita</Label>
                <p className="text-gray-500 text-xs">Disponível sem compra</p>
              </div>
              <Switch
                checked={lessonForm.is_free}
                onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_free: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLessonDialogOpen(false)}
              className="border-gray-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveLesson}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingLesson ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Confirmation */}
      <AlertDialog open={!!deleteLessonId} onOpenChange={() => setDeleteLessonId(null)}>
        <AlertDialogContent className="bg-[#161b22] border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Aula</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta aula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-white hover:bg-gray-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
