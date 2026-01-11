import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseOtpVerificationOptions {
  onVerified?: () => void;
  onError?: (error: string) => void;
  purpose?: string;
  skipModal?: boolean; // Skip opening modal after OTP is sent (for inline forms)
}

interface UseOtpVerificationReturn {
  isOtpModalOpen: boolean;
  isRequestingOtp: boolean;
  isVerifyingOtp: boolean;
  otpCode: string;
  expiresAt: Date | null;
  setOtpCode: (code: string) => void;
  requestOtp: (email: string, userId?: string) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<boolean>;
  verifyOtpWithSession: (email: string, code: string) => Promise<{ valid: boolean; magicLink?: string }>;
  openOtpModal: () => void;
  closeOtpModal: () => void;
  resetOtp: () => void;
}

export const useOtpVerification = (
  options: UseOtpVerificationOptions = {}
): UseOtpVerificationReturn => {
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const purpose = options.purpose || "authentication";

  const requestOtp = useCallback(async (email: string, userId?: string): Promise<boolean> => {
    if (!email) {
      toast({
        title: "E-mail necessário",
        description: "Por favor, forneça um e-mail válido.",
        variant: "destructive",
      });
      return false;
    }

    setIsRequestingOtp(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, purpose, userId },
      });

      if (error) {
        console.error("Error requesting OTP:", error);
        const errorMessage = "Erro ao enviar código. Tente novamente.";
        toast({
          title: "Erro ao enviar código",
          description: errorMessage,
          variant: "destructive",
        });
        options.onError?.(errorMessage);
        return false;
      }

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
        options.onError?.(data.error);
        return false;
      }

      if (data?.expiresAt) {
        setExpiresAt(new Date(data.expiresAt));
      }

      toast({
        title: "Código enviado!",
        description: "Verifique seu e-mail. O código expira em 5 minutos.",
      });
      
      // Only open modal if skipModal is not set
      if (!options.skipModal) {
        setIsOtpModalOpen(true);
      }
      return true;
    } catch (err) {
      console.error("Unexpected error requesting OTP:", err);
      const errorMessage = "Erro inesperado ao enviar código.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      options.onError?.(errorMessage);
      return false;
    } finally {
      setIsRequestingOtp(false);
    }
  }, [toast, options, purpose]);

  const verifyOtp = useCallback(
    async (email: string, code: string): Promise<boolean> => {
      if (code.length !== 6) {
        toast({
          title: "Código incompleto",
          description: "Por favor, digite o código de 6 dígitos.",
          variant: "destructive",
        });
        return false;
      }

      setIsVerifyingOtp(true);

      try {
        const { data, error } = await supabase.functions.invoke("verify-otp", {
          body: { email, code, purpose },
        });

        if (error) {
          console.error("Error verifying OTP:", error);
          const errorMessage = "Erro ao verificar código. Tente novamente.";
          toast({
            title: "Erro na verificação",
            description: errorMessage,
            variant: "destructive",
          });
          options.onError?.(errorMessage);
          return false;
        }

        if (!data?.valid) {
          const errorMessage = data?.error || "Código inválido ou expirado.";
          toast({
            title: "Código inválido",
            description: errorMessage,
            variant: "destructive",
          });
          options.onError?.(errorMessage);
          return false;
        }

        toast({
          title: "Verificação concluída!",
          description: "Código verificado com sucesso.",
        });
        setIsOtpModalOpen(false);
        setOtpCode("");
        setExpiresAt(null);
        options.onVerified?.();
        return true;
      } catch (err) {
        console.error("Unexpected error verifying OTP:", err);
        const errorMessage = "Erro inesperado na verificação.";
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
        options.onError?.(errorMessage);
        return false;
      } finally {
        setIsVerifyingOtp(false);
      }
    },
    [toast, options, purpose]
  );

  // Verify OTP and get a magic link for session creation (for password-less login)
  const verifyOtpWithSession = useCallback(
    async (email: string, code: string): Promise<{ valid: boolean; magicLink?: string }> => {
      if (code.length !== 6) {
        toast({
          title: "Código incompleto",
          description: "Por favor, digite o código de 6 dígitos.",
          variant: "destructive",
        });
        return { valid: false };
      }

      setIsVerifyingOtp(true);

      try {
        const { data, error } = await supabase.functions.invoke("verify-otp", {
          body: { email, code, purpose, createSession: true },
        });

        if (error) {
          console.error("Error verifying OTP:", error);
          toast({
            title: "Erro na verificação",
            description: "Erro ao verificar código. Tente novamente.",
            variant: "destructive",
          });
          return { valid: false };
        }

        if (!data?.valid) {
          const errorMessage = data?.error || "Código inválido ou expirado.";
          toast({
            title: "Código inválido",
            description: errorMessage,
            variant: "destructive",
          });
          return { valid: false };
        }

        setIsOtpModalOpen(false);
        setOtpCode("");
        setExpiresAt(null);
        
        return { valid: true, magicLink: data.magicLink };
      } catch (err) {
        console.error("Unexpected error verifying OTP:", err);
        toast({
          title: "Erro",
          description: "Erro inesperado na verificação.",
          variant: "destructive",
        });
        return { valid: false };
      } finally {
        setIsVerifyingOtp(false);
      }
    },
    [toast, purpose]
  );

  const openOtpModal = useCallback(() => {
    setIsOtpModalOpen(true);
  }, []);

  const closeOtpModal = useCallback(() => {
    setIsOtpModalOpen(false);
    setOtpCode("");
  }, []);

  const resetOtp = useCallback(() => {
    setOtpCode("");
    setExpiresAt(null);
    setIsOtpModalOpen(false);
    setIsRequestingOtp(false);
    setIsVerifyingOtp(false);
  }, []);

  return {
    isOtpModalOpen,
    isRequestingOtp,
    isVerifyingOtp,
    otpCode,
    expiresAt,
    setOtpCode,
    requestOtp,
    verifyOtp,
    verifyOtpWithSession,
    openOtpModal,
    closeOtpModal,
    resetOtp,
  };
};
