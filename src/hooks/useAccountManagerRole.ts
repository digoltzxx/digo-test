import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAccountManagerRole = () => {
  const [isAccountManager, setIsAccountManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAccountManager(false);
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "account_manager")
          .maybeSingle();

        setIsAccountManager(!!data);
      } catch (error) {
        console.error("Error checking account manager role:", error);
        setIsAccountManager(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, []);

  return { isAccountManager, loading };
};
