import { useImpersonation } from "@/hooks/useImpersonation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, X, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ImpersonationBar = () => {
  const { isImpersonating, impersonatedUser, endImpersonation, loading } = useImpersonation();
  const navigate = useNavigate();

  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  const handleEnd = async () => {
    await endImpersonation();
    navigate("/admin/usuarios");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black px-4 py-2">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <Eye className="w-5 h-5" />
          <span className="font-semibold text-sm">MODO IMPERSONAÇÃO</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm">Visualizando como:</span>
          <div className="flex items-center gap-2 bg-black/10 rounded-full px-3 py-1">
            <Avatar className="w-6 h-6">
              <AvatarImage src={impersonatedUser.avatar_url} />
              <AvatarFallback className="bg-black/20 text-black text-xs">
                {getInitials(impersonatedUser.name)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">{impersonatedUser.name}</span>
            <span className="text-xs opacity-75">({impersonatedUser.email})</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleEnd}
          disabled={loading}
          className="bg-black text-white hover:bg-black/80 border-black"
        >
          <X className="w-4 h-4 mr-1" />
          Encerrar Sessão
        </Button>
      </div>
    </div>
  );
};

export default ImpersonationBar;
