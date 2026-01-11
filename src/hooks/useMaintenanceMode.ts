import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceStatus {
  isMaintenanceMode: boolean;
  isAdmin: boolean;
  loading: boolean;
  message?: string;
}

export const useMaintenanceMode = () => {
  const [status, setStatus] = useState<MaintenanceStatus>({
    isMaintenanceMode: false,
    isAdmin: false,
    loading: true,
  });

  const checkMaintenanceMode = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('check-maintenance', {
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (response.error) {
        console.error('Failed to check maintenance mode:', response.error);
        setStatus({
          isMaintenanceMode: false,
          isAdmin: false,
          loading: false,
        });
        return;
      }

      setStatus({
        isMaintenanceMode: response.data.maintenance_mode || false,
        isAdmin: response.data.is_admin || false,
        loading: false,
        message: response.data.message,
      });
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
      setStatus({
        isMaintenanceMode: false,
        isAdmin: false,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkMaintenanceMode();
  }, [checkMaintenanceMode]);

  return {
    ...status,
    refresh: checkMaintenanceMode,
  };
};

export default useMaintenanceMode;
