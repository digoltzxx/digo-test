import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, GripVertical, Image, Loader2 } from "lucide-react";

interface BannerSlide {
  id: string;
  image_url: string;
  title_1: string | null;
  title_2: string | null;
  date_text: string | null;
  gradient_from: string;
  gradient_via: string;
  gradient_to: string;
  accent_color: string;
  highlight_color: string;
  position: number;
  is_active: boolean;
}

const AdminBanners = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slides, setSlides] = useState<BannerSlide[]>([]);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('banner_slides')
        .select('*')
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
    const newPosition = slides.length;
    
    try {
      const { data, error } = await supabase
        .from('banner_slides')
        .insert({
          image_url: '',
          position: newPosition,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      setSlides([...slides, data]);
      toast.success('Novo slide adicionado');
    } catch (error) {
      console.error('Error adding slide:', error);
      toast.error('Erro ao adicionar slide');
    }
  };

  const updateSlide = async (id: string, updates: Partial<BannerSlide>) => {
    try {
      const { error } = await supabase
        .from('banner_slides')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setSlides(slides.map(s => s.id === id ? { ...s, ...updates } : s));
    } catch (error) {
      console.error('Error updating slide:', error);
      toast.error('Erro ao atualizar slide');
    }
  };

  const deleteSlide = async (id: string) => {
    try {
      const { error } = await supabase
        .from('banner_slides')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setSlides(slides.filter(s => s.id !== id));
      toast.success('Slide removido');
    } catch (error) {
      console.error('Error deleting slide:', error);
      toast.error('Erro ao remover slide');
    }
  };

  const saveAllPositions = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < slides.length; i++) {
        await supabase
          .from('banner_slides')
          .update({ position: i })
          .eq('id', slides[i].id);
      }
      toast.success('Posições salvas');
    } catch (error) {
      console.error('Error saving positions:', error);
      toast.error('Erro ao salvar posições');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Banners do Carrossel</h1>
            <p className="text-muted-foreground">
              Gerencie os banners exibidos na tela inicial do dashboard
            </p>
          </div>
          <Button onClick={addSlide}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Banner
          </Button>
        </div>

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
            {slides.map((slide, index) => (
              <Card key={slide.id}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-move" />
                      <CardTitle className="text-lg">Banner {index + 1}</CardTitle>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${slide.id}`}>Ativo</Label>
                        <Switch
                          id={`active-${slide.id}`}
                          checked={slide.is_active}
                          onCheckedChange={(checked) => updateSlide(slide.id, { is_active: checked })}
                        />
                      </div>
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => deleteSlide(slide.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL da Imagem do Banner</Label>
                    <Input
                      value={slide.image_url}
                      onChange={(e) => updateSlide(slide.id, { image_url: e.target.value })}
                      placeholder="https://exemplo.com/imagem.jpg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole a URL de uma imagem para exibir no carrossel da dashboard
                    </p>
                  </div>

                  {/* Preview */}
                  {slide.image_url && (
                    <div className="mt-4">
                      <Label className="mb-2 block">Preview</Label>
                      <div 
                        className="relative overflow-hidden rounded-xl aspect-[21/6]"
                      >
                        <img 
                          src={slide.image_url} 
                          alt="Preview do banner"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminBanners;