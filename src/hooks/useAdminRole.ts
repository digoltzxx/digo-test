import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'moderator' | 'user';

interface UserRole {
  role: AppRole;
}

export const useAdminRole = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data: roles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user roles:', error);
          setIsLoading(false);
          return;
        }

        const roleList = (roles as UserRole[])?.map(r => r.role) || [];
        
        setIsAdmin(roleList.includes('admin'));
        setIsModerator(roleList.includes('moderator'));
        setUserRole(roleList.includes('admin') ? 'admin' : roleList.includes('moderator') ? 'moderator' : 'user');
      } catch (error) {
        console.error('Error checking admin role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAdmin, isModerator, isAdminOrModerator: isAdmin || isModerator, isLoading, userRole };
};
