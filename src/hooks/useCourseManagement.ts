import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Course {
  id: string;
  product_id: string;
  seller_user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  name: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  duration_minutes: number | null;
  position: number;
  is_active: boolean;
  is_free: boolean;
  created_at: string;
  updated_at: string;
}

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
}

export const useCourseManagement = (productId: string) => {
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchCourse = useCallback(async () => {
    if (!productId) return;
    
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;
      setCourse(data);
    } catch (error) {
      console.error("Error fetching course:", error);
    }
  }, [productId]);

  const fetchModules = useCallback(async () => {
    if (!course?.id) return;

    try {
      const { data, error } = await supabase
        .from("course_modules")
        .select("*")
        .eq("course_id", course.id)
        .order("position", { ascending: true });

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error("Error fetching modules:", error);
    }
  }, [course?.id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCourse();
      setLoading(false);
    };
    load();
  }, [fetchCourse]);

  useEffect(() => {
    if (course?.id) {
      fetchModules();
    }
  }, [course?.id, fetchModules]);

  // Create or update course linked to product
  const createOrUpdateCourse = async (productName: string, sellerId: string) => {
    setSaving(true);
    try {
      if (course) {
        // Update existing course
        const { error } = await supabase
          .from("courses")
          .update({
            name: productName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", course.id);

        if (error) throw error;
      } else {
        // Create new course
        const { data, error } = await supabase
          .from("courses")
          .insert({
            product_id: productId,
            seller_user_id: sellerId,
            name: productName,
            status: "active",
          })
          .select()
          .single();

        if (error) throw error;
        setCourse(data);

        // Create default module
        await supabase.from("course_modules").insert({
          course_id: data.id,
          name: "Módulo 1",
          position: 0,
        });
      }

      toast({
        title: "Curso configurado!",
        description: "O curso foi vinculado ao produto.",
      });

      await fetchCourse();
      await fetchModules();
    } catch (error: any) {
      console.error("Error creating/updating course:", error);
      toast({
        title: "Erro ao configurar curso",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Update course details
  const updateCourse = async (updates: Partial<Course>) => {
    if (!course?.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("courses")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", course.id);

      if (error) throw error;

      toast({
        title: "Curso atualizado!",
        description: "As informações do curso foram salvas.",
      });

      await fetchCourse();
    } catch (error: any) {
      console.error("Error updating course:", error);
      toast({
        title: "Erro ao atualizar curso",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  // Add a new module
  const addModule = async (name: string, description?: string) => {
    if (!course?.id) return;

    setSaving(true);
    try {
      const maxPosition = modules.length > 0 
        ? Math.max(...modules.map(m => m.position)) + 1 
        : 0;

      const { error } = await supabase.from("course_modules").insert({
        course_id: course.id,
        name,
        description: description || null,
        position: maxPosition,
      });

      if (error) throw error;

      toast({ title: "Módulo adicionado!" });
      await fetchModules();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar módulo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Update module
  const updateModule = async (moduleId: string, updates: Partial<CourseModule>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("course_modules")
        .update(updates)
        .eq("id", moduleId);

      if (error) throw error;

      toast({ title: "Módulo atualizado!" });
      await fetchModules();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar módulo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete module
  const deleteModule = async (moduleId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("course_modules")
        .delete()
        .eq("id", moduleId);

      if (error) throw error;

      toast({ title: "Módulo removido!" });
      await fetchModules();
    } catch (error: any) {
      toast({
        title: "Erro ao remover módulo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    course,
    modules,
    loading,
    saving,
    createOrUpdateCourse,
    updateCourse,
    addModule,
    updateModule,
    deleteModule,
    refetch: fetchCourse,
  };
};

// Hook for managing lessons within a module
export const useLessonManagement = (moduleId: string) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchLessons = useCallback(async () => {
    if (!moduleId) return;

    try {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("module_id", moduleId)
        .order("position", { ascending: true });

      if (error) throw error;
      setLessons(data || []);
    } catch (error) {
      console.error("Error fetching lessons:", error);
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const addLesson = async (data: {
    name: string;
    description?: string;
    content_type?: string;
    content_url?: string;
    is_free?: boolean;
  }) => {
    if (!moduleId) return;

    setSaving(true);
    try {
      const maxPosition = lessons.length > 0 
        ? Math.max(...lessons.map(l => l.position)) + 1 
        : 0;

      const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        name: data.name,
        description: data.description || null,
        content_type: data.content_type || "video",
        content_url: data.content_url || null,
        is_free: data.is_free || false,
        position: maxPosition,
      });

      if (error) throw error;

      toast({ title: "Aula adicionada!" });
      await fetchLessons();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar aula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateLesson = async (lessonId: string, updates: Partial<Lesson>) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lessons")
        .update(updates)
        .eq("id", lessonId);

      if (error) throw error;

      toast({ title: "Aula atualizada!" });
      await fetchLessons();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar aula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteLesson = async (lessonId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      toast({ title: "Aula removida!" });
      await fetchLessons();
    } catch (error: any) {
      toast({
        title: "Erro ao remover aula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return {
    lessons,
    loading,
    saving,
    addLesson,
    updateLesson,
    deleteLesson,
    refetch: fetchLessons,
  };
};

// Hook for enrollment management
export const useEnrollmentManagement = (productId: string) => {
  const [enrollments, setEnrollments] = useState<(Enrollment & { student_name?: string; student_email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEnrollments = useCallback(async () => {
    if (!productId) return;

    try {
      // Get course for this product
      const { data: course } = await supabase
        .from("courses")
        .select("id")
        .eq("product_id", productId)
        .maybeSingle();

      if (!course) {
        setEnrollments([]);
        setLoading(false);
        return;
      }

      // Get enrollments with student info
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          students (name, email)
        `)
        .eq("course_id", course.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((e: any) => ({
        ...e,
        student_name: e.students?.name,
        student_email: e.students?.email,
      }));

      setEnrollments(enriched);
    } catch (error) {
      console.error("Error fetching enrollments:", error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const revokeAccess = async (enrollmentId: string, reason: string) => {
    try {
      const { error } = await supabase
        .from("enrollments")
        .update({
          status: "revoked",
          access_revoked_at: new Date().toISOString(),
          revoke_reason: reason,
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast({ title: "Acesso revogado" });
      await fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Erro ao revogar acesso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const restoreAccess = async (enrollmentId: string) => {
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

      toast({ title: "Acesso restaurado" });
      await fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Erro ao restaurar acesso",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    enrollments,
    loading,
    revokeAccess,
    restoreAccess,
    refetch: fetchEnrollments,
  };
};
