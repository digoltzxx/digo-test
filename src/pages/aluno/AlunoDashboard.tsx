import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  GraduationCap, 
  BookOpen, 
  Trophy, 
  Clock, 
  Play,
  ChevronRight,
  User,
  LogOut,
  Award
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CourseWithProgress {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  enrollment: {
    id: string;
    status: string;
    enrolled_at: string;
    expires_at: string | null;
  };
  nextLesson?: {
    id: string;
    name: string;
    module_name: string;
  };
}

export default function AlunoDashboard() {
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setStudentName(profile.full_name || user.email?.split("@")[0] || "Aluno");
        setStudentEmail(profile.email || user.email || "");
      }

      // Get student record by email
      const email = profile?.email || user.email;
      if (!email) return;

      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("email", email);

      if (!students || students.length === 0) {
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);

      // Get enrollments with courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          id,
          status,
          enrolled_at,
          expires_at,
          course_id,
          student_id,
          courses (
            id,
            name,
            description,
            image_url
          )
        `)
        .in("student_id", studentIds)
        .eq("status", "active");

      if (!enrollments) {
        setLoading(false);
        return;
      }

      // Process courses with progress
      const coursesWithProgress: CourseWithProgress[] = [];

      for (const enrollment of enrollments) {
        const course = enrollment.courses as any;
        if (!course) continue;

        // Get all lessons for this course
        const { data: modules } = await supabase
          .from("course_modules")
          .select("id, name")
          .eq("course_id", course.id)
          .eq("is_active", true);

        if (!modules) continue;

        const moduleIds = modules.map(m => m.id);
        
        const { data: lessons } = await supabase
          .from("lessons")
          .select("id, name, module_id")
          .in("module_id", moduleIds)
          .eq("is_active", true)
          .order("position");

        const totalLessons = lessons?.length || 0;

        // Get completed lessons
        const { data: progressData } = await supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
          .eq("student_id", enrollment.student_id)
          .eq("enrollment_id", enrollment.id)
          .eq("completed", true);

        const completedLessons = progressData?.length || 0;
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        // Find next lesson
        const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);
        const nextLesson = lessons?.find(l => !completedLessonIds.has(l.id));
        const nextModule = nextLesson ? modules.find(m => m.id === nextLesson.module_id) : null;

        coursesWithProgress.push({
          id: course.id,
          name: course.name,
          description: course.description,
          image_url: course.image_url,
          totalLessons,
          completedLessons,
          progress,
          enrollment: {
            id: enrollment.id,
            status: enrollment.status,
            enrolled_at: enrollment.enrolled_at,
            expires_at: enrollment.expires_at,
          },
          nextLesson: nextLesson ? {
            id: nextLesson.id,
            name: nextLesson.name,
            module_name: nextModule?.name || "",
          } : undefined,
        });
      }

      setCourses(coursesWithProgress);
    } catch (error) {
      console.error("Error fetching student data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar seus cursos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const totalCourses = courses.length;
  const completedCourses = courses.filter(c => c.progress === 100).length;
  const inProgressCourses = courses.filter(c => c.progress > 0 && c.progress < 100).length;
  const averageProgress = courses.length > 0 
    ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Área do Aluno</h1>
              <p className="text-sm text-muted-foreground">Olá, {studentName}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/aluno/perfil")}
            >
              <User className="h-4 w-4 mr-2" />
              Perfil
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Meus Cursos</p>
                  <p className="text-3xl font-bold text-foreground">{totalCourses}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Progresso</p>
                  <p className="text-3xl font-bold text-yellow-500">{inProgressCourses}</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídos</p>
                  <p className="text-3xl font-bold text-green-500">{completedCourses}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Trophy className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Progresso Geral</p>
                  <p className="text-3xl font-bold text-foreground">{averageProgress}%</p>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <Award className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Courses List */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground">Meus Cursos</h2>

          {courses.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum curso encontrado</h3>
                <p className="text-muted-foreground">
                  Você ainda não está matriculado em nenhum curso.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Card key={course.id} className="bg-card border-border overflow-hidden hover:border-primary/50 transition-colors">
                  <div className="aspect-video bg-muted relative">
                    {course.image_url ? (
                      <img 
                        src={course.image_url} 
                        alt={course.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    {course.progress === 100 && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-500 text-white">Concluído</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground truncate">{course.name}</h3>
                      {course.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {course.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {course.completedLessons} de {course.totalLessons} aulas
                        </span>
                        <span className="font-medium text-foreground">{course.progress}%</span>
                      </div>
                      <Progress value={course.progress} className="h-2" />
                    </div>

                    {course.nextLesson && course.progress < 100 && (
                      <div className="text-sm text-muted-foreground">
                        <p>Próxima aula:</p>
                        <p className="text-foreground font-medium truncate">{course.nextLesson.name}</p>
                      </div>
                    )}

                    <Button 
                      className="w-full"
                      onClick={() => navigate(`/aluno/curso/${course.id}`)}
                    >
                      {course.progress === 0 ? (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Começar Curso
                        </>
                      ) : course.progress === 100 ? (
                        <>
                          <BookOpen className="h-4 w-4 mr-2" />
                          Revisar Curso
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Continuar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
