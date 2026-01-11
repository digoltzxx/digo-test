import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ArrowLeft,
  Play,
  CheckCircle,
  Clock,
  BookOpen,
  Video,
  FileText,
  Lock,
  ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Module {
  id: string;
  name: string;
  description: string | null;
  position: number;
  lessons: Lesson[];
}

interface Lesson {
  id: string;
  name: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  duration_minutes: number | null;
  position: number;
  is_free: boolean;
  completed: boolean;
}

interface Course {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
}

export default function AlunoCurso() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [markingComplete, setMarkingComplete] = useState(false);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const completedLessons = modules.reduce((sum, m) => sum + m.lessons.filter(l => l.completed).length, 0);
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  const fetchCourseData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      const email = profile?.email || user.email;
      if (!email) return;

      // Get student
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!student) {
        toast({
          title: "Acesso negado",
          description: "Você não tem matrícula neste curso.",
          variant: "destructive",
        });
        navigate("/aluno");
        return;
      }

      setStudentId(student.id);

      // Get enrollment
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("student_id", student.id)
        .eq("course_id", courseId)
        .eq("status", "active")
        .maybeSingle();

      if (!enrollment) {
        toast({
          title: "Acesso negado",
          description: "Sua matrícula não está ativa.",
          variant: "destructive",
        });
        navigate("/aluno");
        return;
      }

      setEnrollmentId(enrollment.id);

      // Get course
      const { data: courseData } = await supabase
        .from("courses")
        .select("id, name, description, image_url")
        .eq("id", courseId)
        .single();

      if (!courseData) {
        navigate("/aluno");
        return;
      }

      setCourse(courseData);

      // Get modules with lessons
      const { data: modulesData } = await supabase
        .from("course_modules")
        .select("id, name, description, position")
        .eq("course_id", courseId)
        .eq("is_active", true)
        .order("position");

      if (!modulesData) return;

      // Get lessons progress
      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("enrollment_id", enrollment.id)
        .eq("completed", true);

      const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

      // Get lessons for each module
      const modulesWithLessons: Module[] = [];
      
      for (const mod of modulesData) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, name, description, content_type, content_url, duration_minutes, position, is_free")
          .eq("module_id", mod.id)
          .eq("is_active", true)
          .order("position");

        modulesWithLessons.push({
          ...mod,
          lessons: (lessons || []).map(lesson => ({
            ...lesson,
            completed: completedLessonIds.has(lesson.id),
          })),
        });
      }

      setModules(modulesWithLessons);

      // Select first incomplete lesson or first lesson
      const allLessons = modulesWithLessons.flatMap(m => m.lessons);
      const firstIncomplete = allLessons.find(l => !l.completed);
      setSelectedLesson(firstIncomplete || allLessons[0] || null);

    } catch (error) {
      console.error("Error fetching course:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o curso.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markLessonComplete = async (lessonId: string) => {
    if (!enrollmentId || !studentId || markingComplete) return;

    setMarkingComplete(true);
    try {
      // Check if progress record exists
      const { data: existing } = await supabase
        .from("lesson_progress")
        .select("id")
        .eq("enrollment_id", enrollmentId)
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("lesson_progress")
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            progress_percent: 100,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("lesson_progress").insert({
          enrollment_id: enrollmentId,
          student_id: studentId,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
          progress_percent: 100,
        });
      }

      // Update local state
      setModules(prevModules => 
        prevModules.map(mod => ({
          ...mod,
          lessons: mod.lessons.map(lesson => 
            lesson.id === lessonId ? { ...lesson, completed: true } : lesson
          ),
        }))
      );

      toast({
        title: "Aula concluída!",
        description: "Seu progresso foi salvo.",
      });

      // Move to next lesson
      const allLessons = modules.flatMap(m => m.lessons);
      const currentIndex = allLessons.findIndex(l => l.id === lessonId);
      if (currentIndex < allLessons.length - 1) {
        setSelectedLesson(allLessons[currentIndex + 1]);
      }

    } catch (error) {
      console.error("Error marking complete:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o progresso.",
        variant: "destructive",
      });
    } finally {
      setMarkingComplete(false);
    }
  };

  const getContentIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Curso não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/aluno")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{course.name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{completedLessons} de {totalLessons} aulas</span>
                  <span>{progress}% concluído</span>
                </div>
              </div>
            </div>
            <Progress value={progress} className="w-32 h-2" />
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {selectedLesson ? (
              <>
                {/* Video/Content Player */}
                <Card className="bg-card border-border overflow-hidden">
                  <div className="aspect-video bg-black relative">
                    {selectedLesson.content_type === "video" && selectedLesson.content_url ? (
                      <iframe
                        src={selectedLesson.content_url}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Card>

                {/* Lesson Info */}
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-foreground">{selectedLesson.name}</h2>
                        {selectedLesson.description && (
                          <p className="text-muted-foreground">{selectedLesson.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {selectedLesson.duration_minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {selectedLesson.duration_minutes} min
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            {getContentIcon(selectedLesson.content_type)}
                            {selectedLesson.content_type === "video" ? "Vídeo" : "Conteúdo"}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => markLessonComplete(selectedLesson.id)}
                        disabled={selectedLesson.completed || markingComplete}
                        className={selectedLesson.completed ? "bg-green-500 hover:bg-green-500" : ""}
                      >
                        {selectedLesson.completed ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Concluída
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Marcar como Concluída
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Text Content */}
                {selectedLesson.content_type === "text" && selectedLesson.content_url && (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 prose prose-invert max-w-none">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(selectedLesson.content_url, {
                            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'pre', 'code', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
                            ALLOWED_ATTR: ['href', 'class', 'src', 'alt', 'title', 'target', 'rel', 'style'],
                            ALLOW_DATA_ATTR: false,
                            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
                            FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
                          })
                        }} 
                      />
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Selecione uma aula para começar</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Modules & Lessons */}
          <div className="space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Conteúdo do Curso</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Accordion type="multiple" defaultValue={modules.map(m => m.id)}>
                    {modules.map((module) => (
                      <AccordionItem key={module.id} value={module.id} className="border-b border-border">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
                          <div className="flex items-center gap-3 text-left">
                            <div className="text-sm">
                              <p className="font-medium text-foreground">{module.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {module.lessons.filter(l => l.completed).length} de {module.lessons.length} aulas
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 pb-2">
                            {module.lessons.map((lesson) => (
                              <button
                                key={lesson.id}
                                onClick={() => setSelectedLesson(lesson)}
                                className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors ${
                                  selectedLesson?.id === lesson.id ? "bg-primary/10 border-l-2 border-primary" : ""
                                }`}
                              >
                                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                                  lesson.completed 
                                    ? "bg-green-500 text-white" 
                                    : "border border-muted-foreground text-muted-foreground"
                                }`}>
                                  {lesson.completed ? (
                                    <CheckCircle className="h-3 w-3" />
                                  ) : (
                                    <Play className="h-2.5 w-2.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate ${
                                    lesson.completed ? "text-muted-foreground" : "text-foreground"
                                  }`}>
                                    {lesson.name}
                                  </p>
                                  {lesson.duration_minutes && (
                                    <p className="text-xs text-muted-foreground">
                                      {lesson.duration_minutes} min
                                    </p>
                                  )}
                                </div>
                                {lesson.is_free && (
                                  <Badge variant="outline" className="text-xs">Grátis</Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
