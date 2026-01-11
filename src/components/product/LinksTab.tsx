import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Link2, 
  Plus, 
  Copy, 
  ExternalLink, 
  Check, 
  Loader2,
  Pencil,
  Trash2,
  Sparkles,
  MousePointerClick,
  TrendingUp,
  Tag,
  AlertCircle,
  Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductLink {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  short_code: string | null;
  custom_price: number | null;
  is_active: boolean;
  clicks: number;
  conversions: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

interface LinksTabProps {
  productId: string;
  productPrice: number;
  productName?: string;
  productSlug?: string | null;
  onSlugUpdate?: (slug: string) => void;
  sacName?: string | null;
  sacPhone?: string | null;
  sacEmail?: string | null;
}

const LinksTab = ({ productId, productPrice, productName, productSlug, onSlugUpdate, sacName, sacPhone, sacEmail }: LinksTabProps) => {
  // Check if required support fields are filled
  const isSupportInfoComplete = Boolean(
    sacName && sacName.trim() !== "" &&
    sacPhone && sacPhone.trim() !== "" &&
    sacEmail && sacEmail.trim() !== ""
  );
  
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!sacName || sacName.trim() === "") missing.push("Nome de exibição");
    if (!sacPhone || sacPhone.trim() === "") missing.push("WhatsApp");
    if (!sacEmail || sacEmail.trim() === "") missing.push("Email de suporte");
    return missing;
  };
  const [copied, setCopied] = useState<string | null>(null);
  const [mainSlug, setMainSlug] = useState(productSlug || "");
  const [saving, setSaving] = useState(false);
  const [campaignLinks, setCampaignLinks] = useState<ProductLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ProductLink | null>(null);
  const [newLinkData, setNewLinkData] = useState({
    name: "",
    custom_price: "",
  });
  const [savingLink, setSavingLink] = useState(false);
  
  // Generate random alphanumeric short code
  const generateShortCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate slug from name (for main product slug only)
  const generateSlugFromName = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  // Auto-generate main slug
  useEffect(() => {
    const autoGenerateSlug = async () => {
      if (!productSlug && productName) {
        const generatedSlug = generateSlugFromName(productName);
        if (generatedSlug) {
          setMainSlug(generatedSlug);
          try {
            const { error } = await supabase
              .from("products")
              .update({ slug: generatedSlug })
              .eq("id", productId);
            if (!error) {
              onSlugUpdate?.(generatedSlug);
            }
          } catch (error) {
            console.error("Error auto-saving slug:", error);
          }
        }
      } else {
        setMainSlug(productSlug || "");
      }
    };
    autoGenerateSlug();
  }, [productSlug, productName, productId]);

  // Fetch campaign links
  useEffect(() => {
    const fetchLinks = async () => {
      setLoadingLinks(true);
      try {
        const { data, error } = await supabase
          .from("product_links")
          .select("*")
          .eq("product_id", productId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCampaignLinks(data || []);
      } catch (error) {
        console.error("Error fetching links:", error);
      } finally {
        setLoadingLinks(false);
      }
    };
    fetchLinks();
  }, [productId]);

  const handleSaveMainSlug = async () => {
    const slugToSave = mainSlug.trim() || null;
    
    if (slugToSave && !/^[a-z0-9-]+$/.test(slugToSave)) {
      toast.error("Slug deve conter apenas letras minúsculas, números e hífens");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ slug: slugToSave })
        .eq("id", productId);

      if (error) {
        if (error.code === "23505") {
          toast.error("Este slug já está em uso");
          return;
        }
        throw error;
      }

      toast.success("Salvo!");
      onSlugUpdate?.(slugToSave || "");
    } catch (error) {
      console.error("Error saving slug:", error);
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const getMainCheckoutUrl = () => {
    const path = mainSlug || productId.slice(0, 8);
    return `${window.location.host}/p/${path}`;
  };

  const getCampaignUrl = (link: ProductLink) => {
    // Use short_code if available, otherwise fall back to slug
    const code = link.short_code || link.slug || link.id.slice(0, 8);
    return `${window.location.host}/c/${code}`;
  };

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(`https://${url}`);
    setCopied(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const openLink = (url: string) => {
    window.open(`https://${url}`, "_blank");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleCreateLink = async () => {
    if (!newLinkData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSavingLink(true);
    try {
      // Generate a unique short code
      const shortCode = generateShortCode();
      const slugFromName = generateSlugFromName(newLinkData.name);
      
      const linkData = {
        product_id: productId,
        name: newLinkData.name.trim(),
        slug: slugFromName,
        short_code: shortCode,
        custom_price: newLinkData.custom_price ? parseFloat(newLinkData.custom_price) : null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        is_active: true,
        clicks: 0,
        conversions: 0,
      };

      if (editingLink) {
        // Don't update short_code on edit
        const { short_code, ...updateData } = linkData;
        const { error } = await supabase
          .from("product_links")
          .update({ 
            name: updateData.name,
            custom_price: updateData.custom_price,
          })
          .eq("id", editingLink.id);

        if (error) throw error;
        toast.success("Link atualizado!");
        setCampaignLinks(prev => prev.map(l => l.id === editingLink.id ? { ...l, name: updateData.name, custom_price: updateData.custom_price } : l));
      } else {
        const { data, error } = await supabase
          .from("product_links")
          .insert(linkData)
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            // Short code collision - try again with new code
            const newCode = generateShortCode();
            const retryData = { ...linkData, short_code: newCode };
            const { data: retryResult, error: retryError } = await supabase
              .from("product_links")
              .insert(retryData)
              .select()
              .single();
            
            if (retryError) throw retryError;
            toast.success("Link criado!");
            setCampaignLinks(prev => [retryResult, ...prev]);
          } else {
            throw error;
          }
        } else {
          toast.success("Link criado!");
          setCampaignLinks(prev => [data, ...prev]);
        }
      }

      setIsDialogOpen(false);
      setEditingLink(null);
      setNewLinkData({ name: "", custom_price: "" });
    } catch (error) {
      console.error("Error saving link:", error);
      toast.error("Erro ao salvar link");
    } finally {
      setSavingLink(false);
    }
  };

  const handleToggleLink = async (link: ProductLink) => {
    try {
      const { error } = await supabase
        .from("product_links")
        .update({ is_active: !link.is_active })
        .eq("id", link.id);

      if (error) throw error;
      setCampaignLinks(prev => prev.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l));
    } catch (error) {
      console.error("Error toggling link:", error);
      toast.error("Erro ao atualizar link");
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from("product_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;
      setCampaignLinks(prev => prev.filter(l => l.id !== linkId));
      toast.success("Link excluído!");
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("Erro ao excluir link");
    }
  };

  const handleEditLink = (link: ProductLink) => {
    setEditingLink(link);
    setNewLinkData({
      name: link.name,
      custom_price: link.custom_price?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const openNewLinkDialog = () => {
    setEditingLink(null);
    setNewLinkData({ name: "", custom_price: "" });
    setIsDialogOpen(true);
  };

  // If support info is not complete, show blocking message
  if (!isSupportInfoComplete) {
    const missingFields = getMissingFields();
    return (
      <div className="space-y-6">
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <Lock className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">Links bloqueados</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              Para liberar os links do seu produto, você precisa preencher as informações de suporte ao comprador na aba "Produto":
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {missingFields.map((field) => (
                <li key={field} className="text-destructive-foreground/80">{field}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Essas informações são obrigatórias e serão exibidas no checkout e nos emails enviados ao comprador.
            </p>
          </AlertDescription>
        </Alert>
        
        <Card className="bg-muted/30 border-border opacity-50 pointer-events-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Lock className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-muted-foreground">Links Personalizados</h2>
                <p className="text-sm text-muted-foreground">Preencha as informações de suporte para liberar</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-[#0A0F1C] via-[#0D1321] to-[#111827] border border-white/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center ring-1 ring-amber-500/30">
                <Link2 className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Links Personalizados</h2>
                <p className="text-sm text-muted-foreground">Crie links com preços e UTMs personalizados para suas campanhas</p>
              </div>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNewLinkDialog} variant="outline" className="gap-2 bg-white/5 border-white/10 hover:bg-white/10">
                  <Plus className="w-4 h-4" />
                  Novo Link
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingLink ? "Editar Link" : "Novo Link de Checkout"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome do link *</Label>
                    <Input
                      value={newLinkData.name}
                      onChange={(e) => setNewLinkData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Black Friday 2024"
                    />
                    <p className="text-xs text-muted-foreground">
                      O código do link será gerado automaticamente
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do checkout *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newLinkData.custom_price}
                      onChange={(e) => setNewLinkData(prev => ({ ...prev, custom_price: e.target.value }))}
                      placeholder={formatCurrency(productPrice)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para usar o preço padrão: {formatCurrency(productPrice)}
                    </p>
                  </div>
                  <Button onClick={handleCreateLink} disabled={savingLink} className="w-full">
                    {savingLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingLink ? "Salvar Alterações" : "Criar Link"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Main Checkout Link */}
          <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center ring-1 ring-amber-500/30">
                <Link2 className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Checkout Principal</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2">Ativo</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <Tag className="w-3 h-3" />
                  <span>Link padrão</span>
                  <span>•</span>
                  <span className="text-foreground/80">{formatCurrency(productPrice)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[#0A0F1C] border border-white/10 rounded-lg px-4 py-3">
                <span className="text-muted-foreground text-sm font-mono">
                  royalpaybr.com/p/
                </span>
                <Input
                  value={mainSlug}
                  onChange={(e) => setMainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  onBlur={handleSaveMainSlug}
                  className="border-0 bg-transparent text-accent text-sm font-mono font-medium focus-visible:ring-0 px-0 h-auto py-0"
                  placeholder={productId.slice(0, 8)}
                />
                {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={`h-11 w-11 rounded-lg bg-white/5 border border-white/10 ${copied === 'main' ? 'text-green-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}`}
                onClick={() => copyLink(getMainCheckoutUrl(), 'main')}
              >
                {copied === 'main' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                onClick={() => openLink(getMainCheckoutUrl())}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Links Section */}
      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Links de Campanha</h3>
            <Badge variant="secondary" className="text-xs">
              {campaignLinks.length} links
            </Badge>
          </div>

          {loadingLinks ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaignLinks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum link de campanha criado</p>
              <p className="text-xs">Clique em "Novo Link" para criar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {campaignLinks.map((link) => {
                const conversionRate = link.clicks > 0 ? ((link.conversions / link.clicks) * 100).toFixed(0) : 0;
                return (
                  <div key={link.id} className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-3">
                    {/* Link Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Link2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{link.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {formatCurrency(link.custom_price || productPrice)}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">/c/{link.short_code || link.slug || link.id.slice(0, 8)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="w-3 h-3" />
                            {link.clicks}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {conversionRate}%
                          </span>
                        </div>
                        <Badge className={link.is_active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}>
                          {link.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Switch
                          checked={link.is_active}
                          onCheckedChange={() => handleToggleLink(link)}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEditLink(link)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Link URL */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center bg-background/50 border border-border rounded-lg px-3 py-2">
                        <span className="text-muted-foreground text-sm font-mono">
                          {window.location.host}/c/
                        </span>
                        <span className="text-primary text-sm font-medium font-mono">{link.short_code || link.slug || link.id.slice(0, 8)}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-9 w-9 ${copied === link.id ? 'text-green-400' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => copyLink(getCampaignUrl(link), link.id)}
                      >
                        {copied === link.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        onClick={() => openLink(getCampaignUrl(link))}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LinksTab;