import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "moderator" | "user" | "instructor" | "account_manager" | "owner" | "admin_super";

interface UseUserRoleReturn {
  role: AppRole | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  isOwner: boolean;
  isAdminSuper: boolean;
  canImpersonate: boolean;
  hasRole: (role: AppRole) => boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UseUserRoleReturn => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles([]);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
        return;
      }

      const userRoles = data?.map(r => r.role as AppRole) || [];
      setRoles(userRoles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const hasRole = useCallback((role: AppRole): boolean => {
    return roles.includes(role);
  }, [roles]);

  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator");
  const isInstructor = roles.includes("instructor");
  const isOwner = roles.includes("owner");
  const isAdminSuper = roles.includes("admin_super");
  const canImpersonate = isOwner || isAdminSuper;
  // Users without special roles are considered students
  const isStudent = roles.length === 0 || (!isAdmin && !isModerator && !isInstructor && !isOwner && !isAdminSuper);

  return {
    role: roles[0] || null,
    roles,
    loading,
    isAdmin,
    isModerator,
    isInstructor,
    isStudent,
    isOwner,
    isAdminSuper,
    canImpersonate,
    hasRole,
    refetch: fetchRoles,
  };
};

export default useUserRole;
