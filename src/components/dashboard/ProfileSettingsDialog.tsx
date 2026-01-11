import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Upload, FileText, CheckCircle, Loader2, Camera, X } from "lucide-react";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  userId: string;
  onNameUpdated: (newName: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ProfileSettingsDialog = ({
  open,
  onOpenChange,
  currentName,
  userId,
  onNameUpdated,
}: ProfileSettingsDialogProps) => {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<{
    type: string | null;
    number: string | null;
  }>({ type: null, number: null });
  const [documents, setDocuments] = useState<{
    identity: File | null;
    selfie: File | null;
    address: File | null;
  }>({
    identity: null,
    selfie: null,
    address: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      loadProfileData();
    }
  }, [open, userId]);

  const loadProfileData = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, document_type, document_number")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (data) {
      if (data.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
      setDocumentInfo({
        type: data.document_type,
        number: data.document_number,
      });
    }
  };

  const formatDocumentDisplay = (type: string | null, number: string | null): string => {
    if (!number) return "Não informado";
    
    if (type === "cpf") {
      return number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (type === "cnpj") {
      return number.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return number;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use apenas imagens JPG, PNG ou WEBP.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    setAvatarUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("user-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("user-documents")
        .getPublicUrl(fileName);

      const newAvatarUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      toast({
        title: "Foto atualizada!",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Erro ao enviar foto",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("user_id", userId);

      if (error) throw error;

      setAvatarUrl(null);
      toast({
        title: "Foto removida",
        description: "Sua foto de perfil foi removida.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover a foto.",
        variant: "destructive",
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome inválido",
        description: "Por favor, insira um nome válido.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("user_id", userId);

    setLoading(false);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Nome atualizado",
        description: "Seu nome foi atualizado com sucesso.",
      });
      onNameUpdated(name.trim());
    }
  };

  const handleFileChange = (type: keyof typeof documents, file: File | null) => {
    setDocuments((prev) => ({ ...prev, [type]: file }));
    if (file) {
      toast({
        title: "Documento selecionado",
        description: `${file.name} foi selecionado para envio.`,
      });
    }
  };

  const handleUploadDocuments = async () => {
    const hasDocuments = Object.values(documents).some((doc) => doc !== null);
    if (!hasDocuments) {
      toast({
        title: "Nenhum documento",
        description: "Selecione pelo menos um documento para enviar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      for (const [type, file] of Object.entries(documents)) {
        if (file) {
          const fileExt = file.name.split(".").pop();
          const fileName = `${userId}/${type}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("user-documents")
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Save document record
          const { data: urlData } = supabase.storage
            .from("user-documents")
            .getPublicUrl(fileName);

          await supabase.from("documents").insert({
            user_id: userId,
            document_type: type,
            file_name: file.name,
            file_url: urlData.publicUrl,
          });
        }
      }

      toast({
        title: "Documentos enviados",
        description: "Seus documentos foram enviados para análise.",
      });
      setDocuments({ identity: null, selfie: null, address: null });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-accent" />
            Configurações do Perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24 border-2 border-accent/30">
                <AvatarImage src={avatarUrl || undefined} alt={currentName} />
                <AvatarFallback className="bg-accent/20 text-accent text-xl">
                  {getInitials(currentName || "U")}
                </AvatarFallback>
              </Avatar>
              
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              )}

              <Label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-2 bg-accent rounded-full cursor-pointer hover:bg-accent/90 transition-colors"
              >
                <Camera className="w-4 h-4 text-accent-foreground" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={avatarUploading}
                />
              </Label>
            </div>

            <div className="flex gap-2">
              <Label
                htmlFor="avatar-upload-btn"
                className="cursor-pointer"
              >
                <Button variant="outline" size="sm" asChild disabled={avatarUploading}>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Alterar foto
                  </span>
                </Button>
                <input
                  id="avatar-upload-btn"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={avatarUploading}
                />
              </Label>
              
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remover
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG ou WEBP. Máximo 5MB.
            </p>
          </div>

          {/* Document Section (Read-Only) */}
          {documentInfo.number && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                {documentInfo.type === "cpf" ? "CPF" : "CNPJ"}
              </Label>
              <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                <p className="text-sm font-mono">{formatDocumentDisplay(documentInfo.type, documentInfo.number)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Este documento não pode ser alterado.
              </p>
            </div>
          )}

          {/* Name Section */}
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-medium">
              Nome da conta
            </Label>
            <div className="flex gap-2">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="flex-1"
              />
              <Button
                onClick={handleSaveName}
                disabled={loading || name === currentName}
                size="sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Enviar Documentos</Label>
            <p className="text-xs text-muted-foreground">
              Envie seus documentos para verificação da conta.
            </p>

            <div className="space-y-3">
              {/* Identity Document */}
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-secondary/20">
                <FileText className="w-5 h-5 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Documento de Identidade</p>
                  <p className="text-xs text-muted-foreground">
                    {documents.identity ? documents.identity.name : "RG ou CNH (frente e verso)"}
                  </p>
                </div>
                <Label htmlFor="identity-upload" className="cursor-pointer">
                  <div className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors">
                    {documents.identity ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <input
                    id="identity-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange("identity", e.target.files?.[0] || null)}
                  />
                </Label>
              </div>

              {/* Selfie */}
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-secondary/20">
                <User className="w-5 h-5 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Selfie com Documento</p>
                  <p className="text-xs text-muted-foreground">
                    {documents.selfie ? documents.selfie.name : "Foto segurando o documento"}
                  </p>
                </div>
                <Label htmlFor="selfie-upload" className="cursor-pointer">
                  <div className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors">
                    {documents.selfie ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <input
                    id="selfie-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange("selfie", e.target.files?.[0] || null)}
                  />
                </Label>
              </div>

              {/* Address Proof */}
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-secondary/20">
                <FileText className="w-5 h-5 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Comprovante de Endereço</p>
                  <p className="text-xs text-muted-foreground">
                    {documents.address ? documents.address.name : "Conta de luz, água ou banco"}
                  </p>
                </div>
                <Label htmlFor="address-upload" className="cursor-pointer">
                  <div className="p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors">
                    {documents.address ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <input
                    id="address-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange("address", e.target.files?.[0] || null)}
                  />
                </Label>
              </div>
            </div>

            <Button
              onClick={handleUploadDocuments}
              disabled={loading || !Object.values(documents).some((d) => d !== null)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar Documentos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettingsDialog;
