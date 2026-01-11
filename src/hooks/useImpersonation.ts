import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImpersonatedUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface ImpersonationSession {
  id: string;
  token: string;
  expires_at: string;
}

interface UseImpersonationReturn {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  session: ImpersonationSession | null;
  startImpersonation: (targetUserId: string, reason?: string) => Promise<boolean>;
  endImpersonation: () => Promise<void>;
  loading: boolean;
}

const IMPERSONATION_STORAGE_KEY = "impersonation_session";

export const useImpersonation = (): UseImpersonationReturn => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [loading, setLoading] = useState(false);

  // Restaurar sessão do localStorage ao iniciar
  useEffect(() => {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      try {
        const { session: storedSession, impersonatedUser: storedUser } = JSON.parse(stored);
        
        // Verificar se a sessão ainda é válida
        if (new Date(storedSession.expires_at) > new Date()) {
          setSession(storedSession);
          setImpersonatedUser(storedUser);
          setIsImpersonating(true);
        } else {
          // Sessão expirada, limpar
          localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      }
    }
  }, []);

  const startImpersonation = useCallback(async (targetUserId: string, reason?: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: {
          action: "start",
          targetUserId,
          reason,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao iniciar impersonação");
        return false;
      }

      const { session: newSession, impersonatedUser: newUser } = data;

      // Salvar no localStorage
      localStorage.setItem(
        IMPERSONATION_STORAGE_KEY,
        JSON.stringify({ session: newSession, impersonatedUser: newUser })
      );

      setSession(newSession);
      setImpersonatedUser(newUser);
      setIsImpersonating(true);

      toast.success(`Você está visualizando como: ${newUser.name}`);
      return true;
    } catch (error) {
      console.error("Erro na impersonação:", error);
      toast.error("Erro ao iniciar sessão de impersonação");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const endImpersonation = useCallback(async (): Promise<void> => {
    if (!session?.token) return;

    setLoading(true);
    try {
      await supabase.functions.invoke("impersonate-user", {
        body: {
          action: "end",
          token: session.token,
        },
      });

      // Limpar estado local
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
      setSession(null);
      setImpersonatedUser(null);
      setIsImpersonating(false);

      toast.success("Sessão de impersonação encerrada");
    } catch (error) {
      console.error("Erro ao encerrar impersonação:", error);
      toast.error("Erro ao encerrar sessão");
    } finally {
      setLoading(false);
    }
  }, [session]);

  return {
    isImpersonating,
    impersonatedUser,
    session,
    startImpersonation,
    endImpersonation,
    loading,
  };
};

export default useImpersonation;
