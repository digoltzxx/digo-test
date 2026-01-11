import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GripVertical, Image, Loader2, Upload, Link, FileImage, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BannerSlide {
  id: string;
  image_url: string;
  link_url: string | null;
  alt_text: string | null;
  position: number;
  is_active: boolean;
}

const MAX_BANNERS = 5;
const MIN_BANNERS = 1;
const RECOMMENDED_WIDTH = 2048;
const RECOMMENDED_HEIGHT = 342;
const ASPECT_RATIO = RECOMMENDED_WIDTH / RECOMMENDED_HEIGHT; // ~6:1

const BannerCarouselManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [slides, setSlides] = useState<BannerSlide[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('banner_slides')
        .select('id, image_url, link_url, alt_text, position, is_active')
        .order('position', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error fetching slides:', error);
      toast.error('Erro ao carregar banners');
    } finally {
      setLoading(false);
    }
  };

  const addSlide = async () => {
    if (slides.length >= MAX_BANNERS) {
      toast.error(`Máximo de ${MAX_BANNERS} banners permitidos`);
      return;
    }

    const newPosition = slides.length;
    
    try {
      const { data, error } = await supabase
        .from('banner_slides')
        .insert({
          image_url: '',
          position: newPosition,
          is_active: false,
        })
        .select('id, image_url, link_url, alt_text, position, is_active')
        .single();

      if (error) throw error;
      setSlides([...slides, data]);
      toast.success('Novo banner adicionado');
    } catch (error) {
      console.error('Error adding slide:', error);
      toast.error('Erro ao adicionar banner');
    }
  };

  const updateSlide = async (id: string, updates: Partial<BannerSlide>) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('banner_slides')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s));
      toast.success('Banner atualizado');
    } catch (error) {
      console.error('Error updating slide:', error);
      toast.error('Erro ao atualizar banner');
    } finally {
      setSaving(null);
    }
  };

  const deleteSlide = async (id: string) => {
    if (slides.length <= MIN_BANNERS) {
      toast.error(`Mínimo de ${MIN_BANNERS} banner necessário`);
      return;
    }

    try {
      const { error } = await supabase
        .from('banner_slides')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      const newSlides = slides.filter(s => s.id !== id);
      // Update positions
      for (let i = 0; i < newSlides.length; i++) {
        if (newSlides[i].position !== i) {
          await supabase
            .from('banner_slides')
            .update({ position: i })
            .eq('id', newSlides[i].id);
          newSlides[i].position = i;
        }
      }
      
      setSlides(newSlides);
      toast.success('Banner removido');
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Erro ao remover banner');
    }
  };

  const moveSlide = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const newSlides = [...slides];
    [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];
    
    // Update positions
    try {
      await Promise.all([
        supabase.from('banner_slides').update({ position: index }).eq('id', newSlides[index].id),
        supabase.from('banner_slides').update({ position: newIndex }).eq('id', newSlides[newIndex].id)
      ]);
      
      newSlides[index].position = index;
      newSlides[newIndex].position = newIndex;
      setSlides(newSlides);
      toast.success('Posição alterada');
    } catch (error) {
      console.error('Error reordering slides:', error);
      toast.error('Erro ao reordenar banners');
    }
  };

  const handleFileUpload = async (id: string, file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setUploading(id);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${id}-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      await updateSlide(id, { image_url: publicUrl });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeBannersCount = slides.filter(s => s.is_active && s.image_url).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Carrossel de Banners</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os banners exibidos no topo da dashboard
          </p>
        </div>
        <Button onClick={addSlide} disabled={slides.length >= MAX_BANNERS}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Banner
        </Button>
      </div>

      <Alert>
        <FileImage className="h-4 w-4" />
        <AlertDescription>
          <strong>Especificações recomendadas:</strong> {RECOMMENDED_WIDTH} × {RECOMMENDED_HEIGHT}px (proporção 6:1). 
          Formatos aceitos: JPG, PNG, WEBP. Máximo 5MB.
        </AlertDescription>
      </Alert>

      {slides.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Image className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum banner configurado</p>
            <Button onClick={addSlide}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeiro Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Banners: {slides.length}/{MAX_BANNERS}</span>
            <span>•</span>
            <span>Ativos: {activeBannersCount}</span>
          </div>

          {slides.map((slide, index) => (
            <Card key={slide.id} className={!slide.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSlide(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveSlide(index, 'down')}
                        disabled={index === slides.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">Banner {index + 1}</CardTitle>
                      <CardDescription>
                        {slide.image_url ? 'Imagem configurada' : 'Sem imagem'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${slide.id}`} className="text-sm">Ativo</Label>
                      <Switch
                        id={`active-${slide.id}`}
                        checked={slide.is_active}
                        onCheckedChange={(checked) => updateSlide(slide.id, { is_active: checked })}
                        disabled={!slide.image_url}
                      />
                    </div>
                    <Button 
                      variant="destructive" 
                      size="icon"
                      onClick={() => deleteSlide(slide.id)}
                      disabled={slides.length <= MIN_BANNERS}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Section */}
                <div className="space-y-2">
                  <Label>Imagem do Banner</Label>
                  <div className="flex gap-2">
                    <Input
                      value={slide.image_url}
                      onChange={(e) => {
                        setSlides(slides.map(s => s.id === slide.id ? { ...s, image_url: e.target.value } : s));
                      }}
                      onBlur={() => {
                        const currentSlide = slides.find(s => s.id === slide.id);
                        if (currentSlide && currentSlide.image_url !== slide.image_url) {
                          updateSlide(slide.id, { image_url: slide.image_url });
                        }
                      }}
                      placeholder="https://exemplo.com/banner.jpg"
                      className="flex-1"
                    />
                    <input
                      ref={(el) => { fileInputRefs.current[slide.id] = el; }}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(slide.id, file);
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRefs.current[slide.id]?.click()}
                      disabled={uploading === slide.id}
                    >
                      {uploading === slide.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Link URL */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Link (opcional)
                  </Label>
                  <Input
                    value={slide.link_url || ''}
                    onChange={(e) => {
                      setSlides(slides.map(s => s.id === slide.id ? { ...s, link_url: e.target.value } : s));
                    }}
                    onBlur={() => updateSlide(slide.id, { link_url: slide.link_url || null })}
                    placeholder="https://exemplo.com/promo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link abrirá em nova aba ao clicar no banner
                  </p>
                </div>

                {/* Alt Text */}
                <div className="space-y-2">
                  <Label>Texto Alternativo (acessibilidade)</Label>
                  <Input
                    value={slide.alt_text || ''}
                    onChange={(e) => {
                      setSlides(slides.map(s => s.id === slide.id ? { ...s, alt_text: e.target.value } : s));
                    }}
                    onBlur={() => updateSlide(slide.id, { alt_text: slide.alt_text || null })}
                    placeholder="Descrição da imagem para acessibilidade"
                  />
                </div>

                {/* Preview */}
                {slide.image_url && (
                  <div className="mt-4">
                    <Label className="mb-2 block">Preview</Label>
                    <div 
                      className="relative overflow-hidden rounded-xl bg-muted"
                      style={{ aspectRatio: `${ASPECT_RATIO}` }}
                    >
                      <img 
                        src={slide.image_url} 
                        alt={slide.alt_text || 'Preview do banner'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}

                {!slide.image_url && (
                  <Alert variant="destructive" className="bg-destructive/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Adicione uma imagem para ativar este banner
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarouselManager;
