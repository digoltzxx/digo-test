import { Loader2, KeyRound, ArrowLeft, Mail, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface OtpVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  otpCode: string;
  onOtpChange: (code: string) => void;
  onVerify: () => void;
  onResend: () => void;
  isVerifying: boolean;
  isResending: boolean;
  expiresAt?: Date | null;
  title?: string;
  description?: string;
}

export const OtpVerificationDialog = ({
  open,
  onOpenChange,
  email,
  otpCode,
  onOtpChange,
  onVerify,
  onResend,
  isVerifying,
  isResending,
  expiresAt,
  title = "Verificação de segurança",
  description,
}: OtpVerificationDialogProps) => {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const defaultDescription = `Enviamos um código de 6 dígitos para ${email}. O código expira em 5 minutos.`;

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining(0);
      } else {
        setTimeRemaining(Math.floor(diff / 1000));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle input change - only allow 6 digit numbers
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    onOtpChange(value);
  };

  // Check if code is valid (6 digits)
  const isCodeValid = otpCode.length === 6;
  const isExpired = timeRemaining !== null && timeRemaining <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <KeyRound className="h-6 w-6 text-accent" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Timer display */}
          {timeRemaining !== null && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                isExpired
                  ? "bg-destructive/10 text-destructive"
                  : timeRemaining < 60
                  ? "bg-yellow-500/10 text-yellow-500"
                  : "bg-accent/10 text-accent"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span className="font-mono font-medium">
                {isExpired ? "Código expirado" : `Expira em ${formatTime(timeRemaining)}`}
              </span>
            </div>
          )}

          <div className="w-full max-w-xs">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otpCode}
              onChange={handleCodeChange}
              placeholder="000000"
              className="text-center text-3xl font-mono tracking-[0.5em] h-16 bg-secondary/50 border-border/50"
              autoFocus
              disabled={isExpired}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Digite o código de 6 dígitos enviado para seu e-mail
            </p>
          </div>

          <p className="text-muted-foreground text-sm text-center">
            Não recebeu o código?{" "}
            <button
              type="button"
              onClick={onResend}
              disabled={isResending}
              className="text-accent hover:text-accent/80 font-medium disabled:opacity-50"
            >
              {isResending ? "Enviando..." : "Reenviar"}
            </button>
          </p>

          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={onVerify}
              disabled={isVerifying || !isCodeValid || isExpired}
              className="w-full h-12"
            >
              {isVerifying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Verificar código
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtpVerificationDialog;
