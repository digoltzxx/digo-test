import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Loader2, Quote, User, Star, Upload, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SocialProof {
  id: string;
  product_id: string;
  type: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  video_url: string | null;
  is_active: boolean;
  position: number;
  rating?: number;
}

interface ProvasSociaisTabProps {
  productId: string;
}

const ProvasSociaisTab = ({ productId }: ProvasSociaisTabProps) => {
  const [proofs, setProofs] = useState<SocialProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProof, setEditingProof] = useState<SocialProof | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("O que dizem nossos clientes");
  const [savingTitle, setSavingTitle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    type: "testimonial",
    author_name: "",
    author_avatar_url: "",
    content: "",
    video_url: "",
    is_active: true,
    rating: 5,
  });

  const [errors, setErrors] = useState({
    author_name: false,
    content: false,
  });

  useEffect(() => {
    fetchProofs();
    fetchSectionTitle();
  }, [productId]);

  const fetchSectionTitle = async () => {
    try {
      const { data } = await supabase
        .from("checkout_settings")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      
      if (data && (data as any).social_proof_title) {
        setSectionTitle((data as any).social_proof_title);
      }
    } catch (error) {
      console.error("Error fetching section title:", error);
    }
  };

  const saveSectionTitle = async () => {
    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from("checkout_settings")
        .update({ social_proof_title: sectionTitle } as any)
        .eq("product_id", productId);
      
      if (error) throw error;
      toast.success("Título atualizado!");
    } catch (error) {
      console.error("Error saving section title:", error);
      toast.error("Erro ao salvar título");
    } finally {
      setSavingTitle(false);
    }
  };

  const fetchProofs = async () => {
    try {
      const { data, error } = await supabase
        .from("social_proofs")
        .select("*")
        .eq("product_id", productId)
        .order("position");

      if (error) throw error;
      setProofs(data || []);
    } catch (error) {
      console.error("Error fetching social proofs:", error);
      toast.error("Erro ao carregar provas sociais");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {
      author_name: !formData.author_name.trim(),
      content: !formData.content.trim(),
    };
    setErrors(newErrors);
    return !newErrors.author_name && !newErrors.content;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: formData.type,
        author_name: formData.author_name.trim(),
        author_avatar_url: formData.author_avatar_url || null,
        content: formData.content.trim(),
        video_url: formData.video_url || null,
        is_active: formData.is_active,
      };

      if (editingProof) {
        const { error } = await supabase
          .from("social_proofs")
          .update(payload)
          .eq("id", editingProof.id);

        if (error) throw error;
        toast.success("Prova social atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("social_proofs")
          .insert({
            ...payload,
            product_id: productId,
            position: proofs.length,
          });

        if (error) throw error;
        toast.success("Prova social criada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchProofs();
    } catch (error) {
      console.error("Error saving social proof:", error);
      toast.error("Erro ao salvar prova social");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta prova social?")) return;

    try {
      const { error } = await supabase
        .from("social_proofs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Prova social excluída!");
      fetchProofs();
    } catch (error) {
      console.error("Error deleting social proof:", error);
      toast.error("Erro ao excluir prova social");
    }
  };

  const handleToggleActive = async (proof: SocialProof) => {
    try {
      const { error } = await supabase
        .from("social_proofs")
        .update({ is_active: !proof.is_active })
        .eq("id", proof.id);

      if (error) throw error;
      fetchProofs();
      toast.success(proof.is_active ? "Prova social desativada" : "Prova social ativada");
    } catch (error) {
      console.error("Error toggling social proof:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openEditDialog = (proof: SocialProof) => {
    setEditingProof(proof);
    setFormData({
      type: proof.type,
      author_name: proof.author_name,
      author_avatar_url: proof.author_avatar_url || "",
      content: proof.content,
      video_url: proof.video_url || "",
      is_active: proof.is_active,
      rating: proof.rating || 5,
    });
    setErrors({ author_name: false, content: false });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProof(null);
    setFormData({
      type: "testimonial",
      author_name: "",
      author_avatar_url: "",
      content: "",
      video_url: "",
      is_active: true,
      rating: 5,
    });
    setErrors({ author_name: false, content: false });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload(file);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('social-proofs')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('social-proofs')
        .getPublicUrl(data.path);

      setFormData(prev => ({ ...prev, author_avatar_url: urlData.publicUrl }));
      toast.success("Imagem carregada!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao carregar imagem");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, author_avatar_url: "" }));
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
    const [hoverValue, setHoverValue] = useState(0);
    
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="focus:outline-none transition-transform hover:scale-110"
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hoverValue || value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#161b22] border-gray-800">
      <CardContent className="p-6">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Provas Sociais</h3>
            <p className="text-sm text-gray-500">Depoimentos e provas sociais para aumentar conversão</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Nova Prova Social
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0d1117] border-gray-700/50 sm:max-w-2xl p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-700/50">
                <DialogTitle className="text-white text-xl font-semibold">
                  {editingProof ? "Editar Prova Social" : "Adicionar Prova Social"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Image Upload */}
                  <div className="space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                    
                    {formData.author_avatar_url ? (
                      <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-700/50 bg-[#161b22]">
                        <img
                          src={formData.author_avatar_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
                          isDragOver 
                            ? "border-blue-500 bg-blue-500/10" 
                            : "border-gray-700/50 hover:border-gray-600 bg-[#161b22]"
                        }`}
                      >
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
                          <ImageIcon className="w-8 h-8 text-amber-500" />
                        </div>
                        <p className="text-sm text-gray-400 text-center px-4">
                          Arraste e solte uma imagem, ou{" "}
                          <span className="text-blue-400 hover:underline">procure</span>
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 text-center">
                      Medida recomendada: 250×256
                    </p>

                    {/* Avatar URL alternative */}
                    <div className="pt-2">
                      <Label className="text-xs text-gray-500">Ou cole a URL da imagem</Label>
                      <Input
                        value={formData.author_avatar_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, author_avatar_url: e.target.value }))}
                        className="bg-[#161b22] border-gray-700/50 text-white text-sm h-10 mt-1.5 placeholder:text-gray-600"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  {/* Right Column - Form Fields */}
                  <div className="space-y-5">
                    {/* Name Field */}
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-300">Nome</Label>
                      <Input
                        value={formData.author_name}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, author_name: e.target.value }));
                          if (e.target.value.trim()) setErrors(prev => ({ ...prev, author_name: false }));
                        }}
                        className={`bg-[#161b22] text-white h-11 placeholder:text-gray-600 transition-colors ${
                          errors.author_name 
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                            : "border-gray-700/50 focus:border-blue-500 focus:ring-blue-500/20"
                        }`}
                        placeholder="Nome do autor"
                      />
                      {errors.author_name && (
                        <p className="text-xs text-red-400">Campo obrigatório</p>
                      )}
                    </div>

                    {/* Description Field */}
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-300">Descrição</Label>
                      <Textarea
                        value={formData.content}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, content: e.target.value }));
                          if (e.target.value.trim()) setErrors(prev => ({ ...prev, content: false }));
                        }}
                        className={`bg-[#161b22] text-white placeholder:text-gray-600 min-h-[100px] resize-none transition-colors ${
                          errors.content 
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" 
                            : "border-gray-700/50 focus:border-blue-500 focus:ring-blue-500/20"
                        }`}
                        placeholder="Escreva o depoimento ou prova social..."
                      />
                      {errors.content && (
                        <p className="text-xs text-red-400">Campo obrigatório</p>
                      )}
                      <p className="text-xs text-gray-500 text-right">
                        {formData.content.length}/500 caracteres
                      </p>
                    </div>

                    {/* Rating */}
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-300">Classificação</Label>
                      <StarRating
                        value={formData.rating}
                        onChange={(v) => setFormData(prev => ({ ...prev, rating: v }))}
                      />
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between py-2 px-3 bg-[#161b22] rounded-lg border border-gray-700/50">
                      <div>
                        <Label className="text-sm text-gray-300">Status</Label>
                        <p className="text-xs text-gray-500">
                          {formData.is_active ? "Visível no checkout" : "Oculto do checkout"}
                        </p>
                      </div>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                    </div>

                    {/* Section Title */}
                    <div className="space-y-2 pt-2 border-t border-gray-700/50">
                      <Label className="text-sm text-gray-300">Título da seção no checkout</Label>
                      <div className="flex gap-2">
                        <Input
                          value={sectionTitle}
                          onChange={(e) => setSectionTitle(e.target.value)}
                          placeholder="O que dizem nossos clientes"
                          className="bg-[#161b22] border-gray-700/50 text-white flex-1"
                        />
                        <Button
                          type="button"
                          onClick={saveSectionTitle}
                          disabled={savingTitle}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white px-3"
                        >
                          {savingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">Este título será exibido acima dos depoimentos no checkout</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-gray-700/50 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white min-w-[180px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    editingProof ? "Salvar Alterações" : "Adicionar Prova Social"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {proofs.length === 0 ? (
          <div className="bg-[#0d1117] border border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center">
            <Quote className="w-12 h-12 text-gray-500 mb-3" />
            <p className="text-sm text-gray-500 text-center">Nenhuma prova social criada</p>
            <p className="text-xs text-gray-600 text-center mt-1">
              Adicione depoimentos para aumentar a credibilidade
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {proofs.map((proof) => (
              <div
                key={proof.id}
                className="bg-[#0d1117] border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                      {proof.author_avatar_url && !proof.author_avatar_url.startsWith('blob:') ? (
                        <img 
                          src={proof.author_avatar_url} 
                          alt={proof.author_name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('fallback-icon');
                          }}
                        />
                      ) : (
                        <User className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium">{proof.author_name}</h4>
                        <div className="flex gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= (proof.rating || 5)
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-600"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400">{proof.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      proof.is_active 
                        ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    }`}>
                      {proof.is_active ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={proof.is_active}
                      onCheckedChange={() => handleToggleActive(proof)}
                    />
                    <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white hover:bg-gray-700/50" onClick={() => openEditDialog(proof)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-gray-400 hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(proof.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProvasSociaisTab;
