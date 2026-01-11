import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import UpsellModal from "./UpsellModal";
import DownsellModal from "./DownsellModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowUp, 
  ArrowDown, 
  TrendingUp, 
  TrendingDown,
  Timer,
  Percent,
  DollarSign,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
} from "lucide-react";

interface Upsell {
  id: string;
  product_id: string;
  upsell_product_id: string;
  name: string;
  description: string | null;
  original_price: number;
  offer_price: number;
  discount_type: string;
  discount_value: number;
  headline: string | null;
  subheadline: string | null;
  cta_text: string;
  decline_text: string;
  timer_enabled: boolean;
  timer_minutes: number;
  is_subscription: boolean;
  subscription_interval: string | null;
  is_active: boolean;
  position: number;
}

interface Downsell {
  id: string;
  upsell_id: string;
  product_id: string;
  downsell_product_id: string;
  name: string;
  description: string | null;
  original_price: number;
  offer_price: number;
  discount_type: string;
  discount_value: number;
  headline: string | null;
  subheadline: string | null;
  cta_text: string;
  decline_text: string;
  timer_enabled: boolean;
  timer_minutes: number;
  is_subscription: boolean;
  subscription_interval: string | null;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  payment_type: string;
}

interface UpsellDownsellTabProps {
  productId: string;
}

const UpsellDownsellTab = ({ productId }: UpsellDownsellTabProps) => {
  const { toast } = useToast();
  const [upsells, setUpsells] = useState<Upsell[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downsellDialogOpen, setDownsellDialogOpen] = useState(false);
  const [expandedUpsell, setExpandedUpsell] = useState<string | null>(null);
  const [editingUpsell, setEditingUpsell] = useState<Upsell | null>(null);
  const [editingDownsell, setEditingDownsell] = useState<Downsell | null>(null);
  const [downsells, setDownsells] = useState<Record<string, Downsell | null>>({});

  const [upsellForm, setUpsellForm] = useState({
    upsell_product_id: "",
    name: "",
    description: "",
    original_price: 0,
    offer_price: 0,
    discount_type: "fixed",
    discount_value: 0,
    headline: "Oferta exclusiva para você!",
    subheadline: "Aproveite esta oportunidade única",
    cta_text: "Sim, quero essa oferta!",
    decline_text: "Não, obrigado",
    timer_enabled: true,
    timer_minutes: 15,
    is_subscription: false,
    subscription_interval: "monthly",
    is_active: true,
  });


  const [selectedUpsellId, setSelectedUpsellId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [productId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch upsells for this product
      const { data: upsellsData, error: upsellsError } = await supabase
        .from("upsells")
        .select("*")
        .eq("product_id", productId)
        .order("position");

      if (upsellsError) throw upsellsError;
      setUpsells(upsellsData || []);

      // Fetch only products owned by the current user (excluding current product)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, payment_type")
        .eq("status", "active")
        .eq("user_id", user.id)
        .neq("id", productId);

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch downsells for each upsell
      if (upsellsData && upsellsData.length > 0) {
        const upsellIds = upsellsData.map(u => u.id);
        const { data: downsellsData } = await supabase
          .from("downsells")
          .select("*")
          .in("upsell_id", upsellIds);

        const downsellMap: Record<string, Downsell | null> = {};
        upsellIds.forEach(id => {
          downsellMap[id] = downsellsData?.find(d => d.upsell_id === id) || null;
        });
        setDownsells(downsellMap);
      }
    } catch (error) {
      console.error("Error fetching upsells:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os upsells.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productIdSelected: string) => {
    const product = products.find(p => p.id === productIdSelected);
    if (product) {
      setUpsellForm(prev => ({
        ...prev,
        upsell_product_id: productIdSelected,
        name: product.name,
        original_price: product.price,
        offer_price: product.price * 0.8, // 20% discount by default
        is_subscription: product.payment_type === "subscription",
      }));
    }
  };

  const handleSaveUpsell = async () => {
    if (!upsellForm.upsell_product_id) {
      toast({
        title: "Selecione um produto",
        description: "Escolha o produto que será oferecido como upsell.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const upsellData = {
        product_id: productId,
        upsell_product_id: upsellForm.upsell_product_id,
        name: upsellForm.name,
        description: upsellForm.description || null,
        original_price: upsellForm.original_price,
        offer_price: upsellForm.offer_price,
        discount_type: upsellForm.discount_type,
        discount_value: upsellForm.discount_value,
        headline: upsellForm.headline,
        subheadline: upsellForm.subheadline,
        cta_text: upsellForm.cta_text,
        decline_text: upsellForm.decline_text,
        timer_enabled: upsellForm.timer_enabled,
        timer_minutes: upsellForm.timer_minutes,
        is_subscription: upsellForm.is_subscription,
        subscription_interval: upsellForm.is_subscription ? upsellForm.subscription_interval : null,
        is_active: upsellForm.is_active,
        position: upsells.length,
      };

      if (editingUpsell) {
        const { error } = await supabase
          .from("upsells")
          .update(upsellData)
          .eq("id", editingUpsell.id);

        if (error) throw error;
        toast({ title: "Upsell atualizado!" });
      } else {
        const { error } = await supabase
          .from("upsells")
          .insert(upsellData);

        if (error) throw error;
        toast({ title: "Upsell criado!" });
      }

      setDialogOpen(false);
      resetUpsellForm();
      fetchData();
    } catch (error) {
      console.error("Error saving upsell:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o upsell.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteUpsell = async (upsellId: string) => {
    if (!confirm("Tem certeza que deseja excluir este upsell e seu downsell associado?")) return;

    try {
      const { error } = await supabase
        .from("upsells")
        .delete()
        .eq("id", upsellId);

      if (error) throw error;
      toast({ title: "Upsell excluído!" });
      fetchData();
    } catch (error) {
      console.error("Error deleting upsell:", error);
      toast({
        title: "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDownsell = async (downsellId: string) => {
    if (!confirm("Tem certeza que deseja excluir este downsell?")) return;

    try {
      const { error } = await supabase
        .from("downsells")
        .delete()
        .eq("id", downsellId);

      if (error) throw error;
      toast({ title: "Downsell excluído!" });
      fetchData();
    } catch (error) {
      console.error("Error deleting downsell:", error);
      toast({
        title: "Erro ao excluir",
        variant: "destructive",
      });
    }
  };

  const openEditUpsell = (upsell: Upsell) => {
    setEditingUpsell(upsell);
    setUpsellForm({
      upsell_product_id: upsell.upsell_product_id,
      name: upsell.name,
      description: upsell.description || "",
      original_price: upsell.original_price,
      offer_price: upsell.offer_price,
      discount_type: upsell.discount_type,
      discount_value: upsell.discount_value,
      headline: upsell.headline || "",
      subheadline: upsell.subheadline || "",
      cta_text: upsell.cta_text,
      decline_text: upsell.decline_text,
      timer_enabled: upsell.timer_enabled,
      timer_minutes: upsell.timer_minutes,
      is_subscription: upsell.is_subscription,
      subscription_interval: upsell.subscription_interval || "monthly",
      is_active: upsell.is_active,
    });
    setDialogOpen(true);
  };

  const openAddDownsell = (upsellId: string) => {
    setSelectedUpsellId(upsellId);
    const existing = downsells[upsellId];
    if (existing) {
      setEditingDownsell(existing);
    } else {
      setEditingDownsell(null);
    }
    setDownsellDialogOpen(true);
  };

  const resetUpsellForm = () => {
    setEditingUpsell(null);
    setUpsellForm({
      upsell_product_id: "",
      name: "",
      description: "",
      original_price: 0,
      offer_price: 0,
      discount_type: "fixed",
      discount_value: 0,
      headline: "Oferta exclusiva para você!",
      subheadline: "Aproveite esta oportunidade única",
      cta_text: "Sim, quero essa oferta!",
      decline_text: "Não, obrigado",
      timer_enabled: true,
      timer_minutes: 15,
      is_subscription: false,
      subscription_interval: "monthly",
      is_active: true,
    });
  };

  const resetDownsellForm = () => {
    setEditingDownsell(null);
    setSelectedUpsellId(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateDiscount = (original: number, offer: number) => {
    const discount = ((original - offer) / original) * 100;
    return Math.round(discount);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Funil de Vendas Pós-Compra</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure ofertas de <span className="text-green-500 font-medium">Upsell</span> (produto premium) e 
                <span className="text-amber-500 font-medium"> Downsell</span> (alternativa mais acessível) 
                que serão exibidas após a compra ser aprovada.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Upsells & Downsells</h2>
          <p className="text-sm text-muted-foreground">
            {upsells.length === 0 
              ? "Nenhum upsell configurado" 
              : `${upsells.length} upsell${upsells.length > 1 ? 's' : ''} configurado${upsells.length > 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => setDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            <Plus className="w-4 h-4" />
            Adicionar Upsell
          </Button>
          <Button 
            onClick={() => setDownsellDialogOpen(true)}
            className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
          >
            <Plus className="w-4 h-4" />
            Adicionar Downsell
          </Button>
        </div>
        
        <UpsellModal
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            resetUpsellForm();
          }}
          onSave={async (formData) => {
            setSaving(true);
            try {
              const upsellData = {
                product_id: productId,
                upsell_product_id: formData.upsell_product_id,
                name: formData.name,
                description: formData.description || null,
                original_price: formData.original_price,
                offer_price: formData.offer_price,
                discount_type: "fixed",
                discount_value: formData.original_price - formData.offer_price,
                headline: formData.headline,
                subheadline: formData.subheadline,
                cta_text: formData.cta_text,
                decline_text: formData.decline_text,
                timer_enabled: formData.timer_enabled,
                timer_minutes: formData.timer_minutes,
                is_subscription: formData.is_subscription,
                subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
                is_active: formData.is_active,
                position: upsells.length,
              };

              if (editingUpsell) {
                const { error } = await supabase
                  .from("upsells")
                  .update(upsellData)
                  .eq("id", editingUpsell.id);
                if (error) throw error;
                toast({ title: "Upsell atualizado com sucesso!" });
              } else {
                const { error } = await supabase
                  .from("upsells")
                  .insert(upsellData);
                if (error) throw error;
                toast({ title: "Upsell criado com sucesso!" });
              }
              
              await fetchData();
            } catch (error) {
              console.error("Error saving upsell:", error);
              toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar o upsell.",
                variant: "destructive",
              });
              throw error;
            } finally {
              setSaving(false);
            }
          }}
          products={products}
          initialData={editingUpsell ? {
            upsell_product_id: editingUpsell.upsell_product_id,
            name: editingUpsell.name,
            description: editingUpsell.description || "",
            original_price: editingUpsell.original_price,
            offer_price: editingUpsell.offer_price,
            headline: editingUpsell.headline || "",
            subheadline: editingUpsell.subheadline || "",
            cta_text: editingUpsell.cta_text,
            decline_text: editingUpsell.decline_text,
            timer_enabled: editingUpsell.timer_enabled,
            timer_minutes: editingUpsell.timer_minutes,
            is_subscription: editingUpsell.is_subscription,
            subscription_interval: editingUpsell.subscription_interval || "monthly",
            is_active: editingUpsell.is_active,
          } : undefined}
          isEditing={!!editingUpsell}
        />
        
        <DownsellModal
          isOpen={downsellDialogOpen}
          onClose={() => {
            setDownsellDialogOpen(false);
            setEditingDownsell(null);
          }}
          onSave={async (formData) => {
            setSaving(true);
            try {
              const downsellData = {
                product_id: productId,
                upsell_id: selectedUpsellId,
                downsell_product_id: formData.downsell_product_id,
                name: formData.name,
                description: formData.description || null,
                original_price: formData.original_price,
                offer_price: formData.offer_price,
                discount_type: "fixed",
                discount_value: formData.original_price - formData.offer_price,
                headline: formData.headline,
                subheadline: formData.subheadline,
                cta_text: formData.cta_text,
                decline_text: formData.decline_text,
                timer_enabled: formData.timer_enabled,
                timer_minutes: formData.timer_minutes,
                is_subscription: formData.is_subscription,
                subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
                is_active: formData.is_active,
              };

              if (editingDownsell) {
                const { error } = await supabase
                  .from("downsells")
                  .update(downsellData)
                  .eq("id", editingDownsell.id);
                if (error) throw error;
                toast({ title: "Downsell atualizado com sucesso!" });
              } else {
                const { error } = await supabase
                  .from("downsells")
                  .insert(downsellData);
                if (error) throw error;
                toast({ title: "Downsell criado com sucesso!" });
              }
              
              await fetchData();
            } catch (error) {
              console.error("Error saving downsell:", error);
              toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar o downsell.",
                variant: "destructive",
              });
              throw error;
            } finally {
              setSaving(false);
            }
          }}
          products={products}
          initialData={editingDownsell ? {
            downsell_product_id: editingDownsell.downsell_product_id,
            name: editingDownsell.name,
            description: editingDownsell.description || "",
            original_price: editingDownsell.original_price,
            offer_price: editingDownsell.offer_price,
            headline: editingDownsell.headline || "",
            subheadline: editingDownsell.subheadline || "",
            cta_text: editingDownsell.cta_text,
            decline_text: editingDownsell.decline_text,
            timer_enabled: editingDownsell.timer_enabled,
            timer_minutes: editingDownsell.timer_minutes,
            is_subscription: editingDownsell.is_subscription,
            subscription_interval: editingDownsell.subscription_interval || "monthly",
            is_active: editingDownsell.is_active,
          } : undefined}
          isEditing={!!editingDownsell}
        />
      </div>

      {/* Upsells List */}
      {upsells.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Nenhum upsell configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie seu primeiro upsell para aumentar o ticket médio das suas vendas.
            </p>
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Upsell
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {upsells.map((upsell, index) => (
            <Card key={upsell.id} className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden hover:border-primary/30 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  {/* Left Side - Icon + Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-xl ${upsell.is_active ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/10 ring-1 ring-emerald-500/30' : 'bg-muted/50'}`}>
                      <TrendingUp className={`w-5 h-5 ${upsell.is_active ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground truncate">{upsell.name}</h3>
                        {!upsell.is_active && (
                          <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">Inativo</span>
                        )}
                        {upsell.is_subscription && (
                          <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Assinatura
                          </span>
                        )}
                        {upsell.timer_enabled && (
                          <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded-full flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {upsell.timer_minutes}min
                          </span>
                        )}
                      </div>
                      {upsell.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{upsell.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Center - Pricing */}
                  <div className="flex items-center gap-3 px-6">
                    <span className="text-sm text-muted-foreground line-through">
                      {formatCurrency(upsell.original_price)}
                    </span>
                    <span className="text-xl font-bold text-emerald-400">
                      {formatCurrency(upsell.offer_price)}
                    </span>
                    <span className="text-xs font-medium bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full">
                      {calculateDiscount(upsell.original_price, upsell.offer_price)}% OFF
                    </span>
                  </div>

                  {/* Right Side - Actions */}
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => openEditUpsell(upsell)}
                      className="hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteUpsell(upsell.id)}
                      className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedUpsell(expandedUpsell === upsell.id ? null : upsell.id)}
                      className="hover:bg-muted transition-colors"
                    >
                      {expandedUpsell === upsell.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Downsell Section - Expanded */}
                {expandedUpsell === upsell.id && (
                  <div className="mt-5 pt-5 border-t border-border/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <TrendingDown className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="font-medium text-sm">Downsell</span>
                        <span className="text-xs text-muted-foreground">(oferta alternativa)</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAddDownsell(upsell.id)}
                        className="gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-400"
                      >
                        {downsells[upsell.id] ? (
                          <>
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Adicionar
                          </>
                        )}
                      </Button>
                    </div>

                    {downsells[upsell.id] ? (
                      <div className="bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                              <TrendingDown className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium">{downsells[upsell.id]!.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(downsells[upsell.id]!.original_price)}
                                </span>
                                <span className="text-base font-bold text-blue-400">
                                  {formatCurrency(downsells[upsell.id]!.offer_price)}
                                </span>
                                <span className="text-xs font-medium bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">
                                  {calculateDiscount(downsells[upsell.id]!.original_price, downsells[upsell.id]!.offer_price)}% OFF
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDownsell(downsells[upsell.id]!.id)}
                            className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-muted/30 border border-dashed border-border rounded-xl p-4 text-center">
                        <TrendingDown className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Quando o cliente recusar o upsell, será exibida a oferta do downsell.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};

export default UpsellDownsellTab;
