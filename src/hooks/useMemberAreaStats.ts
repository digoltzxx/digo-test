import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MemberAreaStats {
  total_students: number;
  active_students: number;
  blocked_students: number;
  total_enrollments: number;
  active_enrollments: number;
  total_modules: number;
  total_lessons: number;
}

export function useMemberAreaStats(productId: string) {
  const [stats, setStats] = useState<MemberAreaStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!productId) return;

    try {
      setLoading(true);
      
      // Fetch stats using direct queries since RPC might not work
      const [studentsResult, enrollmentsResult, modulesResult, lessonsResult] = await Promise.all([
        supabase
          .from("students")
          .select("id, status, is_blocked")
          .eq("product_id", productId),
        supabase
          .from("enrollments")
          .select("id, status, course_id, courses!inner(product_id)")
          .eq("courses.product_id", productId),
        supabase
          .from("course_modules")
          .select("id, courses!inner(product_id)")
          .eq("courses.product_id", productId),
        supabase
          .from("lessons")
          .select("id, course_modules!inner(courses!inner(product_id))")
          .eq("course_modules.courses.product_id", productId),
      ]);

      const students = studentsResult.data || [];
      const enrollments = enrollmentsResult.data || [];
      const modules = modulesResult.data || [];
      const lessons = lessonsResult.data || [];

      setStats({
        total_students: students.length,
        active_students: students.filter(s => s.status === 'active' && !s.is_blocked).length,
        blocked_students: students.filter(s => s.is_blocked).length,
        total_enrollments: enrollments.length,
        active_enrollments: enrollments.filter(e => e.status === 'active').length,
        total_modules: modules.length,
        total_lessons: lessons.length,
      });
    } catch (error) {
      console.error("Error fetching member area stats:", error);
      setStats({
        total_students: 0,
        active_students: 0,
        blocked_students: 0,
        total_enrollments: 0,
        active_enrollments: 0,
        total_modules: 0,
        total_lessons: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
