import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Eye, Shield } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNavigate } from "react-router-dom";

interface ImpersonateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
}

export const ImpersonateUserDialog = ({
  open,
  onOpenChange,
  user,
}: ImpersonateUserDialogProps) => {
  const [reason, setReason] = useState("");
  const { startImpersonation, loading } = useImpersonation();
  const navigate = useNavigate();

  if (!user) return null;

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleConfirm = async () => {
    const success = await startImpersonation(user.id, reason || undefined);
    if (success) {
      onOpenChange(false);
      // Redirecionar para o dashboard do usuário
      navigate("/dashboard");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-amber-500" />
            Assumir Conta do Usuário
          </DialogTitle>
          <DialogDescription>
            Você irá visualizar o sistema como este usuário. Todas as ações serão
            registradas para auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Usuário alvo */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <Avatar className="w-12 h-12">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user.full_name || "Sem nome"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {/* Aviso LGPD/GDPR */}
          <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Aviso de Conformidade LGPD/GDPR
              </p>
              <p className="text-muted-foreground mt-1">
                Esta ação será registrada com data/hora, IP e motivo. Use apenas
                para suporte legítimo ao usuário.
              </p>
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Suporte ao usuário, verificação de problema reportado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* O que acontece */}
          <div className="flex gap-3 p-4 bg-muted rounded-lg">
            <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">Durante a impersonação:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                <li>Você verá o sistema como o usuário</li>
                <li>Uma barra indicará o modo de impersonação</li>
                <li>Sessão expira em 2 horas automaticamente</li>
                <li>O usuário NÃO será notificado</li>
                <li>Logs internos serão mantidos para auditoria</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            {loading ? "Iniciando..." : "Iniciar Impersonação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImpersonateUserDialog;
