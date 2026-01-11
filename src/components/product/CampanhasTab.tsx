import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Loader2, Megaphone, Calendar as CalendarIcon, Tag, AlertCircle, CheckCircle, Filter, ArrowUpDown, Eye, Search, Package, X, ChevronRight, Shield, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PixelValidationChecklist } from "./PixelValidationChecklist";
import { PixelMonitoringDashboard } from "./PixelMonitoringDashboard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
interface Campaign {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  coupon_code: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
}

interface CampanhasTabProps {
  productId: string;
}

interface FormErrors {
  name?: string;
  discount_value?: string;
  coupon_code?: string;
  dates?: string;
}

type StatusFilter = "all" | "active" | "inactive" | "expired" | "scheduled" | "exhausted";
type SortOption = "created_at" | "starts_at" | "current_uses";

const CampanhasTab = ({ productId }: CampanhasTabProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [couponAvailable, setCouponAvailable] = useState<boolean | null>(null);
  
  // Filters and sorting
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 10,
    coupon_code: "",
    is_active: false,
    starts_at: "",
    ends_at: "",
    max_uses: 0,
    selected_product_id: productId,
    pixels: [] as { 
      type: string; 
      id: string; 
      title: string;
      conversionLabel?: string;
      events: {
        beginCheckout: boolean;
        addPaymentInfo: boolean;
        conversion: boolean;
        conversionOnPix: boolean;
        conversionOnBoleto: boolean;
      };
    }[],
  });

  const pixelTypes = [
    { value: "google_ads", label: "Google Ads", color: "bg-blue-500", iconColor: "text-white", placeholder: "Ex: AW-XXXXXXXXXX", hasConversionLabel: true },
    { value: "google_analytics_4", label: "Google Analytics 4", color: "bg-orange-500", iconColor: "text-white", placeholder: "Ex: G-XXXXXXXXXX", hasConversionLabel: false },
    { value: "google_analytics", label: "Google Analytics", color: "bg-yellow-500", iconColor: "text-white", placeholder: "Ex: UA-XXXXXXXXX-X", hasConversionLabel: false },
    { value: "facebook", label: "Facebook", color: "bg-blue-600", iconColor: "text-white", placeholder: "Ex: 123456789012345", hasConversionLabel: false },
    { value: "tiktok", label: "TikTok", color: "bg-pink-500", iconColor: "text-white", placeholder: "Ex: XXXXXXXXXXXXXXXXXX", hasConversionLabel: false },
    { value: "kwai", label: "Kwai", color: "bg-orange-600", iconColor: "text-white", placeholder: "Ex: XXXXXXXXXX", hasConversionLabel: false },
    { value: "google_tag_manager", label: "Google Tag Manager", color: "bg-yellow-400", iconColor: "text-gray-900", placeholder: "Ex: GTM-XXXXXXX", hasConversionLabel: false },
  ];

  const getPixelIcon = (type: string) => {
    switch (type) {
      case "google_ads":
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#4285F4" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
            </svg>
          </div>
        );
      case "google_analytics_4":
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#F9AB00" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/>
              <path fill="#E37400" d="M12 4.5v15l7.5-7.5L12 4.5z"/>
              <rect fill="#FFFFFF" x="6" y="8" width="3" height="8" rx="1"/>
              <rect fill="#FFFFFF" x="10.5" y="6" width="3" height="10" rx="1"/>
              <rect fill="#FFFFFF" x="15" y="10" width="3" height="6" rx="1"/>
            </svg>
          </div>
        );
      case "google_analytics":
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#F9AB00" d="M22.84 2.998v17.958c0 1.636-1.326 2.962-2.962 2.962H4.122c-1.636 0-2.962-1.326-2.962-2.962V2.998c0-1.636 1.326-2.962 2.962-2.962h15.756c1.636 0 2.962 1.326 2.962 2.962z"/>
              <rect fill="#FFFFFF" x="5" y="10" width="4" height="9" rx="1"/>
              <rect fill="#FFFFFF" x="10" y="7" width="4" height="12" rx="1"/>
              <rect fill="#FFFFFF" x="15" y="4" width="4" height="15" rx="1"/>
            </svg>
          </div>
        );
      case "facebook":
        return (
          <div className="w-8 h-8 bg-[#1877F2] rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
        );
      case "tiktok":
        return (
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path fill="#25F4EE" d="M9.37 23.5v-9.93h-.02V8.56h4.17v14.94c-1.37 0-2.76 0-4.15 0z"/>
              <path fill="#FE2C55" d="M13.52 8.56v5.01a5.97 5.97 0 0 0 4.17 1.7V11.1a5.97 5.97 0 0 1-4.17-2.54z"/>
              <path fill="#FFFFFF" d="M13.52 8.56a5.97 5.97 0 0 0 4.17 2.54v4.17a9.97 9.97 0 0 1-4.17-.93v9.16H9.37V8.56h4.15z"/>
            </svg>
          </div>
        );
      case "kwai":
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-lg">K</span>
          </div>
        );
      case "google_tag_manager":
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6">
              <path fill="#8AB4F8" d="M12.003 0L4.5 7.503l2.999 2.999L12 6.004l4.5 4.498 3-2.999z"/>
              <path fill="#4285F4" d="M19.5 7.503L12.003 0v6.004l4.5 4.498z"/>
              <path fill="#8AB4F8" d="M12.003 24l7.497-7.503-2.999-2.999-4.498 4.498-4.5-4.498-3 2.999z"/>
              <path fill="#246FDB" d="M4.5 16.497L12.003 24v-6.004l-4.5-4.498z"/>
              <path fill="#FBBC04" d="M12.003 9.002L7.505 13.5l4.498 4.498 4.5-4.498z"/>
            </svg>
          </div>
        );
      default:
        return <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center"><span className="text-white font-bold text-xs">?</span></div>;
    }
  };

  const [showPixelForm, setShowPixelForm] = useState(false);
  const [pixelDialogOpen, setPixelDialogOpen] = useState(false);
  const [selectedPixelType, setSelectedPixelType] = useState<string | null>(null);
  const [newPixel, setNewPixel] = useState({ 
    type: "facebook", 
    id: "", 
    title: "",
    conversionLabel: "",
    events: {
      beginCheckout: true,
      addPaymentInfo: false,
      conversion: true,
      conversionOnPix: false,
      conversionOnBoleto: false,
    }
  });

  useEffect(() => {
    fetchCampaigns();
    fetchProducts();
  }, [productId]);

  // Check coupon uniqueness with debounce
  useEffect(() => {
    const checkCouponCode = async () => {
      const code = formData.coupon_code.trim().toUpperCase();
      if (!code || code.length < 3) {
        setCouponAvailable(null);
        return;
      }

      setCheckingCoupon(true);
      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select("id")
          .eq("coupon_code", code)
          .neq("id", editingCampaign?.id || "00000000-0000-0000-0000-000000000000")
          .maybeSingle();

        if (error) throw error;
        setCouponAvailable(!data);
      } catch (error) {
        console.error("Error checking coupon:", error);
        setCouponAvailable(null);
      } finally {
        setCheckingCoupon(false);
      }
    };

    const timeoutId = setTimeout(checkCouponCode, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.coupon_code, editingCampaign?.id]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, product:products(name)")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const getCampaignStatus = (campaign: Campaign): { label: string; color: string; key: StatusFilter } => {
    const now = new Date();
    
    // Check exhausted first (even if active)
    if (campaign.max_uses && campaign.current_uses >= campaign.max_uses) {
      return { label: "Esgotada", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", key: "exhausted" };
    }
    
    // Check expired
    if (campaign.ends_at && new Date(campaign.ends_at) < now) {
      return { label: "Expirada", color: "bg-red-500/20 text-red-400 border-red-500/30", key: "expired" };
    }
    
    // Check inactive
    if (!campaign.is_active) {
      return { label: "Inativa", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", key: "inactive" };
    }
    
    // Check scheduled (future)
    if (campaign.starts_at && new Date(campaign.starts_at) > now) {
      return { label: "Agendada", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", key: "scheduled" };
    }
    
    // Active
    return { label: "Ativa", color: "bg-green-500/20 text-green-400 border-green-500/30", key: "active" };
  };

  // Filtered and sorted campaigns
  const filteredCampaigns = useMemo(() => {
    let filtered = [...campaigns];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) || 
        (c.coupon_code && c.coupon_code.toLowerCase().includes(query)) ||
        (c.description && c.description.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(c => getCampaignStatus(c).key === statusFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "starts_at":
          const aStart = a.starts_at ? new Date(a.starts_at).getTime() : 0;
          const bStart = b.starts_at ? new Date(b.starts_at).getTime() : 0;
          comparison = aStart - bStart;
          break;
        case "current_uses":
          comparison = a.current_uses - b.current_uses;
          break;
      }
      
      return sortDesc ? -comparison : comparison;
    });
    
    return filtered;
  }, [campaigns, statusFilter, sortBy, sortDesc, searchQuery]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      errors.name = "Nome da campanha é obrigatório";
    }

    // Discount value validation
    if (formData.discount_value <= 0) {
      errors.discount_value = "Valor do desconto deve ser maior que zero";
    } else if (formData.discount_type === "percentage" && formData.discount_value > 100) {
      errors.discount_value = "Desconto percentual não pode ser maior que 100%";
    }

    // Coupon code uniqueness
    if (formData.coupon_code.trim() && couponAvailable === false) {
      errors.coupon_code = "Este código de cupom já está em uso";
    }

    // Date validation
    if (formData.starts_at && formData.ends_at) {
      const startDate = new Date(formData.starts_at);
      const endDate = new Date(formData.ends_at);
      if (endDate < startDate) {
        errors.dates = "Data de término não pode ser anterior à data de início";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      const firstError = Object.values(formErrors)[0];
      if (firstError) toast.error(firstError);
      return;
    }

    setSaving(true);
    try {
      // Prepare payload with proper date formatting (UTC)
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        coupon_code: formData.coupon_code.trim().toUpperCase() || null,
        is_active: formData.is_active,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
        ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
        max_uses: formData.max_uses > 0 ? formData.max_uses : null,
        updated_at: new Date().toISOString(),
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from("campaigns")
          .update(payload)
          .eq("id", editingCampaign.id);

        if (error) {
          if (error.code === "23505") {
            toast.error("Este código de cupom já está em uso");
            return;
          }
          throw error;
        }
        toast.success("Campanha atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("campaigns")
          .insert({ ...payload, product_id: formData.selected_product_id });

        if (error) {
          if (error.code === "23505") {
            toast.error("Este código de cupom já está em uso");
            return;
          }
          throw error;
        }
        toast.success("Campanha criada com sucesso!");
      }

      setDialogOpen(false);
      resetForm();
      fetchCampaigns();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;

    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", selectedCampaign.id);

      if (error) throw error;
      toast.success("Campanha excluída com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erro ao excluir campanha");
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ 
          is_active: !campaign.is_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaign.id);

      if (error) throw error;
      fetchCampaigns();
      toast.success(campaign.is_active ? "Campanha desativada" : "Campanha ativada");
    } catch (error) {
      console.error("Error toggling campaign:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openEditDialog = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || "",
      discount_type: campaign.discount_type,
      discount_value: campaign.discount_value,
      coupon_code: campaign.coupon_code || "",
      is_active: campaign.is_active,
      starts_at: campaign.starts_at ? new Date(campaign.starts_at).toISOString().slice(0, 16) : "",
      ends_at: campaign.ends_at ? new Date(campaign.ends_at).toISOString().slice(0, 16) : "",
      max_uses: campaign.max_uses || 0,
      selected_product_id: campaign.product_id,
      pixels: [],
    });
    setCouponAvailable(null);
    setFormErrors({});
    setShowPixelForm(false);
    setDialogOpen(true);
  };

  const openDeleteDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDeleteDialogOpen(true);
  };

  const openDetailsDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDetailsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCampaign(null);
    setFormData({
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 10,
      coupon_code: "",
      is_active: false,
      starts_at: "",
      ends_at: "",
      max_uses: 0,
      selected_product_id: productId,
      pixels: [],
    });
    setFormErrors({});
    setCouponAvailable(null);
    setShowPixelForm(false);
    setNewPixel({ 
      type: "facebook", 
      id: "", 
      title: "",
      conversionLabel: "",
      events: {
        beginCheckout: true,
        addPaymentInfo: false,
        conversion: true,
        conversionOnPix: false,
        conversionOnBoleto: false,
      }
    });
  };

  const handleAddPixel = async () => {
    if (!newPixel.title.trim()) {
      toast.error("Informe o título do pixel");
      return;
    }
    if (!newPixel.id.trim()) {
      toast.error("Informe o ID do pixel");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Save pixel to database
      const { error } = await supabase.from('checkout_pixels').insert({
        product_id: productId,
        user_id: user.id,
        pixel_type: newPixel.type,
        title: newPixel.title.trim(),
        pixel_id: newPixel.id.trim(),
        conversion_label: newPixel.conversionLabel?.trim() || null,
        events_config: {
          pageView: true,
          viewContent: true,
          initiateCheckout: newPixel.events?.beginCheckout ?? true,
          addPaymentInfo: newPixel.events?.addPaymentInfo ?? false,
          purchase: newPixel.events?.conversion ?? true,
        },
        conversion_on_pix: newPixel.events?.conversionOnPix ?? false,
        conversion_on_boleto: newPixel.events?.conversionOnBoleto ?? false,
        is_active: true,
      });

      if (error) throw error;

      // Also add to local form state for display
      setFormData(prev => ({
        ...prev,
        pixels: [...prev.pixels, { 
          type: newPixel.type, 
          id: newPixel.id.trim(),
          title: newPixel.title.trim(),
          conversionLabel: newPixel.conversionLabel?.trim(),
          events: { ...(newPixel.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }) }
        }]
      }));

      setNewPixel({ 
        type: "facebook", 
        id: "", 
        title: "",
        conversionLabel: "",
        events: {
          beginCheckout: true,
          addPaymentInfo: false,
          conversion: true,
          conversionOnPix: false,
          conversionOnBoleto: false,
        }
      });
      setShowPixelForm(false);
      setSelectedPixelType(null);
      setPixelDialogOpen(false);
      toast.success("Pixel adicionado com sucesso!");
    } catch (error) {
      console.error("Error saving pixel:", error);
      toast.error("Erro ao salvar pixel");
    }
  };

  const handleRemovePixel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pixels: prev.pixels.filter((_, i) => i !== index)
    }));
  };

  const formatDiscount = (type: string, value: number) => {
    return type === "percentage" ? `${value}%` : `R$ ${value.toFixed(2)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  };

  // Stats
  const stats = useMemo(() => {
    const active = campaigns.filter(c => getCampaignStatus(c).key === "active").length;
    const scheduled = campaigns.filter(c => getCampaignStatus(c).key === "scheduled").length;
    const expired = campaigns.filter(c => getCampaignStatus(c).key === "expired").length;
    const totalUses = campaigns.reduce((sum, c) => sum + c.current_uses, 0);
    return { active, scheduled, expired, totalUses, total: campaigns.length };
  }, [campaigns]);

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
    <Tabs defaultValue="campanhas" className="space-y-6">
      <TabsList className="bg-[#0d1117] border border-gray-700">
        <TabsTrigger value="campanhas" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <Megaphone className="w-4 h-4 mr-2" />
          Campanhas & Pixels
        </TabsTrigger>
        <TabsTrigger value="validacao" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <Shield className="w-4 h-4 mr-2" />
          Validação
        </TabsTrigger>
        <TabsTrigger value="monitoramento" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <CheckCircle className="w-4 h-4 mr-2" />
          Monitoramento
        </TabsTrigger>
      </TabsList>

      <TabsContent value="campanhas" className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-blue-500/10 via-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Megaphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Campanhas</h3>
                <p className="text-sm text-gray-400">Crie campanhas promocionais e cupons de desconto</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Dialog de Adicionar Pixel */}
              <Dialog open={pixelDialogOpen} onOpenChange={(open) => {
                setPixelDialogOpen(open);
                if (!open) {
                  setSelectedPixelType(null);
                  setNewPixel({ 
                    type: "facebook", 
                    id: "", 
                    title: "",
                    conversionLabel: "",
                    events: {
                      beginCheckout: true,
                      addPaymentInfo: false,
                      conversion: true,
                      conversionOnPix: false,
                      conversionOnBoleto: false,
                    }
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline"
                    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Pixel
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#1a1f2e] border-gray-700/50 max-w-sm p-0 max-h-[90vh] overflow-y-auto rounded-xl">
                  <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
                    <DialogTitle className="text-white text-base font-medium">
                      {selectedPixelType ? `Adicionar ${pixelTypes.find(p => p.value === selectedPixelType)?.label}` : "Adicionar Pixel"}
                    </DialogTitle>
                  </DialogHeader>
                  
                  {!selectedPixelType ? (
                    <div className="px-3 pb-4 space-y-1.5">
                      {pixelTypes.map((pixel) => (
                        <button
                          key={pixel.value}
                          onClick={() => {
                            setSelectedPixelType(pixel.value);
                            setNewPixel(prev => ({ 
                              ...prev, 
                              type: pixel.value, 
                              id: "",
                              title: "",
                              conversionLabel: "",
                            }));
                          }}
                          className="w-full flex items-center justify-between px-3 py-3 bg-[#242938] hover:bg-[#2d3344] transition-colors rounded-lg group"
                        >
                          <div className="flex items-center gap-3">
                            {getPixelIcon(pixel.value)}
                            <span className="text-white text-sm font-medium">{pixel.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {/* Título */}
                      <div>
                        <Label className="text-gray-400">Título *</Label>
                        <Input
                          value={newPixel.title}
                          onChange={(e) => setNewPixel(prev => ({ ...prev, title: e.target.value }))}
                          className="bg-[#0d1117] border-red-500 text-white mt-1"
                          placeholder="Digite o título da campanha"
                        />
                        <p className="text-xs text-red-400 mt-1">Digite o título</p>
                      </div>

                      {/* ID do Pixel */}
                      <div>
                        <Label className="text-gray-400">ID do pixel *</Label>
                        <Input
                          value={newPixel.id}
                          onChange={(e) => setNewPixel(prev => ({ ...prev, id: e.target.value }))}
                          className="bg-[#0d1117] border-red-500 text-white mt-1"
                          placeholder={pixelTypes.find(p => p.value === selectedPixelType)?.placeholder || "Ex: 123456789"}
                        />
                        <p className="text-xs text-red-400 mt-1">Digite o ID do pixel</p>
                      </div>

                      {/* Rótulo de conversão (apenas para Google Ads) */}
                      {pixelTypes.find(p => p.value === selectedPixelType)?.hasConversionLabel && (
                        <div>
                          <Label className="text-gray-400">Rótulo de conversão</Label>
                          <Input
                            value={newPixel.conversionLabel}
                            onChange={(e) => setNewPixel(prev => ({ ...prev, conversionLabel: e.target.value }))}
                            className="bg-[#0d1117] border-gray-700 text-white mt-1"
                            placeholder="Ex: UMvTCLHc_N8ZENCwmoMD"
                          />
                        </div>
                      )}

                      {/* Configurar eventos */}
                      <div className="space-y-3">
                        <Label className="text-gray-400">Configurar eventos do {pixelTypes.find(p => p.value === selectedPixelType)?.label} Pixel</Label>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Iniciar finalização de compra (begin_checkout)</span>
                            <Switch
                              checked={newPixel.events?.beginCheckout ?? true}
                              onCheckedChange={(checked) => setNewPixel(prev => ({ 
                                ...prev, 
                                events: { ...(prev.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }), beginCheckout: checked }
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Adicionar dados de pagamento (add_payment_info)</span>
                            <Switch
                              checked={newPixel.events?.addPaymentInfo ?? false}
                              onCheckedChange={(checked) => setNewPixel(prev => ({ 
                                ...prev, 
                                events: { ...(prev.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }), addPaymentInfo: checked }
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Compra (conversion)</span>
                            <Switch
                              checked={newPixel.events?.conversion ?? true}
                              onCheckedChange={(checked) => setNewPixel(prev => ({ 
                                ...prev, 
                                events: { ...(prev.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }), conversion: checked }
                              }))}
                            />
                          </div>
                        </div>

                        <div className="pt-2 space-y-3 border-t border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Disparar evento personalizado "conversion" ao gerar um Pix</span>
                            <Switch
                              checked={newPixel.events?.conversionOnPix ?? false}
                              onCheckedChange={(checked) => setNewPixel(prev => ({ 
                                ...prev, 
                                events: { ...(prev.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }), conversionOnPix: checked }
                              }))}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-300">Disparar evento personalizado "conversion" ao gerar um Boleto</span>
                            <Switch
                              checked={newPixel.events?.conversionOnBoleto ?? false}
                              onCheckedChange={(checked) => setNewPixel(prev => ({ 
                                ...prev, 
                                events: { ...(prev.events || { beginCheckout: true, addPaymentInfo: false, conversion: true, conversionOnPix: false, conversionOnBoleto: false }), conversionOnBoleto: checked }
                              }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Botões */}
                      <div className="flex gap-2 justify-end pt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedPixelType(null)}
                          className="text-gray-400 hover:text-white"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          onClick={handleAddPixel}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Adicionar {pixelTypes.find(p => p.value === selectedPixelType)?.label} Pixel
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/20">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Campanha
                  </Button>
                </DialogTrigger>
              <DialogContent className="bg-[#161b22] border-gray-700 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editingCampaign ? "Editar Campanha" : "Nova Campanha"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Produto */}
                  <div>
                    <Label className="text-gray-400">Produto *</Label>
                    <Select
                      value={formData.selected_product_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, selected_product_id: value }))}
                      disabled={!!editingCampaign}
                    >
                      <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                        <Package className="w-4 h-4 mr-2 text-gray-400" />
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161b22] border-gray-700 max-h-60">
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editingCampaign && (
                      <p className="text-xs text-gray-500 mt-1">O produto não pode ser alterado após a criação</p>
                    )}
                  </div>

                  {/* Nome da Campanha */}
                  <div>
                    <Label className="text-gray-400">Nome da Campanha *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, name: e.target.value }));
                        if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                      }}
                      className={`bg-[#0d1117] border-gray-700 text-white ${formErrors.name ? 'border-red-500' : ''}`}
                      placeholder="Ex: Black Friday 2024"
                    />
                    {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
                  </div>

                  {/* Descrição */}
                  <div>
                    <Label className="text-gray-400">Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="bg-[#0d1117] border-gray-700 text-white"
                      placeholder="Descrição da campanha"
                      rows={3}
                    />
                  </div>

                  {/* Tipo e Valor do Desconto */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400">Tipo de Desconto</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, discount_type: value }))}
                      >
                        <SelectTrigger className="bg-[#0d1117] border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161b22] border-gray-700">
                          <SelectItem value="percentage">Percentual (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-gray-400">Valor do Desconto *</Label>
                      <Input
                        type="number"
                        min="0"
                        step={formData.discount_type === "percentage" ? "1" : "0.01"}
                        value={formData.discount_value}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }));
                          if (formErrors.discount_value) setFormErrors(prev => ({ ...prev, discount_value: undefined }));
                        }}
                        className={`bg-[#0d1117] border-gray-700 text-white ${formErrors.discount_value ? 'border-red-500' : ''}`}
                      />
                      {formErrors.discount_value && <p className="text-xs text-red-400 mt-1">{formErrors.discount_value}</p>}
                    </div>
                  </div>

                  {/* Código do Cupom */}
                  <div>
                    <Label className="text-gray-400">Código do Cupom</Label>
                    <div className="relative">
                      <Input
                        value={formData.coupon_code}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                          setFormData(prev => ({ ...prev, coupon_code: value }));
                          if (formErrors.coupon_code) setFormErrors(prev => ({ ...prev, coupon_code: undefined }));
                        }}
                        className={`bg-[#0d1117] border-gray-700 text-white uppercase pr-10 ${formErrors.coupon_code ? 'border-red-500' : couponAvailable === true ? 'border-green-500' : ''}`}
                        placeholder="EX: BLACKFRIDAY"
                        maxLength={20}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {checkingCoupon && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                        {!checkingCoupon && couponAvailable === true && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {!checkingCoupon && couponAvailable === false && <AlertCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                    {formErrors.coupon_code && <p className="text-xs text-red-400 mt-1">{formErrors.coupon_code}</p>}
                    {!formErrors.coupon_code && couponAvailable === true && (
                      <p className="text-xs text-green-400 mt-1">Código disponível</p>
                    )}
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400">Data de Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-[#0d1117] border-gray-700 hover:bg-[#161b22]",
                              !formData.starts_at && "text-gray-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.starts_at ? (
                              format(new Date(formData.starts_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            ) : (
                              <span>Selecionar data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#161b22] border-gray-700" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.starts_at ? new Date(formData.starts_at) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Preserve existing time or set default 00:00
                                const existingDate = formData.starts_at ? new Date(formData.starts_at) : null;
                                const hours = existingDate ? existingDate.getHours() : 0;
                                const minutes = existingDate ? existingDate.getMinutes() : 0;
                                date.setHours(hours, minutes, 0, 0);
                                setFormData(prev => ({ ...prev, starts_at: date.toISOString().slice(0, 16) }));
                              } else {
                                setFormData(prev => ({ ...prev, starts_at: "" }));
                              }
                              if (formErrors.dates) setFormErrors(prev => ({ ...prev, dates: undefined }));
                            }}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                          <div className="p-3 border-t border-gray-700">
                            <Label className="text-gray-400 text-xs mb-2 block">Horário</Label>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <Input
                                type="time"
                                value={formData.starts_at ? formData.starts_at.slice(11, 16) : "00:00"}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(":").map(Number);
                                  const date = formData.starts_at ? new Date(formData.starts_at) : new Date();
                                  date.setHours(hours, minutes, 0, 0);
                                  setFormData(prev => ({ ...prev, starts_at: date.toISOString().slice(0, 16) }));
                                }}
                                className="bg-[#0d1117] border-gray-700 text-white flex-1"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400">Data de Término</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal bg-[#0d1117] border-gray-700 hover:bg-[#161b22]",
                              !formData.ends_at && "text-gray-500"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.ends_at ? (
                              format(new Date(formData.ends_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            ) : (
                              <span>Selecionar data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-[#161b22] border-gray-700" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.ends_at ? new Date(formData.ends_at) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // Preserve existing time or set default 23:59
                                const existingDate = formData.ends_at ? new Date(formData.ends_at) : null;
                                const hours = existingDate ? existingDate.getHours() : 23;
                                const minutes = existingDate ? existingDate.getMinutes() : 59;
                                date.setHours(hours, minutes, 0, 0);
                                setFormData(prev => ({ ...prev, ends_at: date.toISOString().slice(0, 16) }));
                              } else {
                                setFormData(prev => ({ ...prev, ends_at: "" }));
                              }
                              if (formErrors.dates) setFormErrors(prev => ({ ...prev, dates: undefined }));
                            }}
                            locale={ptBR}
                            className="pointer-events-auto"
                          />
                          <div className="p-3 border-t border-gray-700">
                            <Label className="text-gray-400 text-xs mb-2 block">Horário</Label>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <Input
                                type="time"
                                value={formData.ends_at ? formData.ends_at.slice(11, 16) : "23:59"}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(":").map(Number);
                                  const date = formData.ends_at ? new Date(formData.ends_at) : new Date();
                                  date.setHours(hours, minutes, 0, 0);
                                  setFormData(prev => ({ ...prev, ends_at: date.toISOString().slice(0, 16) }));
                                }}
                                className="bg-[#0d1117] border-gray-700 text-white flex-1"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {formErrors.dates && <p className="text-xs text-red-400 -mt-2">{formErrors.dates}</p>}

                  {/* Limite de Usos */}
                  <div>
                    <Label className="text-gray-400">Limite de Usos (0 = ilimitado)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.max_uses}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 0 }))}
                      className="bg-[#0d1117] border-gray-700 text-white"
                    />
                  </div>

                  {/* Pixels de Rastreamento */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-400">Pixels de Rastreamento</Label>
                    </div>

                    {/* Lista de pixels adicionados */}
                    {formData.pixels.length > 0 && (
                      <div className="space-y-2">
                        {formData.pixels.map((pixel, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-2">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                                  {pixelTypes.find(p => p.value === pixel.type)?.label || pixel.type}
                                </Badge>
                                <span className="text-sm text-white font-medium">{pixel.title}</span>
                              </div>
                              <span className="text-xs text-gray-400 font-mono">{pixel.id}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemovePixel(index)}
                              className="h-6 w-6 text-gray-400 hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.pixels.length === 0 && (
                      <p className="text-xs text-gray-500">Nenhum pixel adicionado. Use o botão "Adicionar Pixel" no topo da página.</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between py-2">
                    <Label className="text-gray-400">Campanha Ativa</Label>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                  </div>

                  {/* Botão Salvar */}
                  <Button
                    onClick={handleSave}
                    disabled={saving || (formData.coupon_code.trim() && couponAvailable === false)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {editingCampaign ? "Salvar Alterações" : "Criar Campanha"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-[#0d1117] border-gray-700/50 hover:border-gray-600 transition-colors">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-white">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-1">Total de Campanhas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 transition-colors">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{stats.active}</p>
              <p className="text-xs text-gray-400 mt-1">Ativas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{stats.scheduled}</p>
              <p className="text-xs text-gray-400 mt-1">Agendadas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/40 transition-colors">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{stats.expired}</p>
              <p className="text-xs text-gray-400 mt-1">Expiradas</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-colors">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{stats.totalUses}</p>
              <p className="text-xs text-gray-400 mt-1">Usos Totais</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Campaign List Card */}
      <Card className="bg-[#161b22] border-gray-800">
        <CardContent className="p-6">
          {/* Filters and Search */}
          {campaigns.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0d1117] border-gray-700 text-white pl-10"
                />
              </div>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-full md:w-40 bg-[#0d1117] border-gray-700 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#161b22] border-gray-700">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="expired">Expiradas</SelectItem>
                  <SelectItem value="exhausted">Esgotadas</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full md:w-44 bg-[#0d1117] border-gray-700 text-white">
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent className="bg-[#161b22] border-gray-700">
                  <SelectItem value="created_at">Data de criação</SelectItem>
                  <SelectItem value="starts_at">Data de início</SelectItem>
                  <SelectItem value="current_uses">Maior usos</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortDesc(!sortDesc)}
                className="bg-[#0d1117] border-gray-700 text-white hover:bg-gray-800"
              >
                <ArrowUpDown className={`w-4 h-4 transition-transform ${sortDesc ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          )}

          {/* Campaign List */}
          {campaigns.length === 0 ? (
            <div className="bg-gradient-to-b from-[#0d1117] to-[#0d1117]/50 border-2 border-dashed border-gray-700/50 rounded-2xl p-12 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Megaphone className="w-10 h-10 text-gray-500" />
              </div>
              <h4 className="text-lg font-semibold text-gray-400 mb-2">Nenhuma campanha criada</h4>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Crie campanhas promocionais com cupons de desconto para aumentar suas vendas e engajar seus clientes
              </p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-gradient-to-b from-[#0d1117] to-[#0d1117]/50 border-2 border-dashed border-gray-700/50 rounded-2xl p-12 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Filter className="w-10 h-10 text-gray-500" />
              </div>
              <h4 className="text-lg font-semibold text-gray-400 mb-2">Nenhuma campanha encontrada</h4>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                Tente ajustar os filtros de busca ou criar uma nova campanha
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCampaigns.map((campaign) => {
                const status = getCampaignStatus(campaign);
                return (
                  <div
                    key={campaign.id}
                    className="bg-[#0d1117] border border-gray-700/50 rounded-xl p-4 hover:border-gray-500/50 transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-500/20 to-gray-400/20 rounded-xl flex items-center justify-center shrink-0 group-hover:from-gray-500/30 group-hover:to-gray-400/30 transition-colors">
                          <Megaphone className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-semibold truncate text-base">{campaign.name}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-400 flex-wrap mt-1.5">
                            <span className="flex items-center gap-1.5 bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium">
                              <Tag className="w-3 h-3" />
                              {formatDiscount(campaign.discount_type, campaign.discount_value)}
                            </span>
                            {campaign.coupon_code && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs font-mono px-2 py-0.5">
                                {campaign.coupon_code}
                              </Badge>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                              <CalendarIcon className="w-3 h-3" />
                              {formatDateShort(campaign.starts_at)} - {formatDateShort(campaign.ends_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 bg-[#1a1f2e] rounded-full px-4 py-2.5">
                        <div className="text-center hidden sm:block">
                          <span className="text-sm font-semibold text-white">
                            {campaign.current_uses}{campaign.max_uses ? `/${campaign.max_uses}` : ""}
                          </span>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">usos</p>
                        </div>
                        <Badge variant="outline" className={`text-xs px-3 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </Badge>
                        <div className="flex items-center gap-1 border-l border-gray-600 pl-3">
                          <Switch
                            checked={campaign.is_active}
                            onCheckedChange={() => handleToggleActive(campaign)}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10" 
                            onClick={() => openDetailsDialog(campaign)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10" 
                            onClick={() => openEditDialog(campaign)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-gray-400 hover:text-red-400 hover:bg-red-500/10" 
                            onClick={() => openDeleteDialog(campaign)}
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Exclusão</DialogTitle>
            <DialogDescription className="text-gray-400">
              Tem certeza que deseja excluir a campanha <strong className="text-white">{selectedCampaign?.name}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-gray-600 text-gray-300">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir Campanha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="bg-[#161b22] border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Megaphone className="w-4 h-4 text-white" />
              </div>
              {selectedCampaign?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getCampaignStatus(selectedCampaign).color}>
                  {getCampaignStatus(selectedCampaign).label}
                </Badge>
                {selectedCampaign.coupon_code && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">
                    {selectedCampaign.coupon_code}
                  </Badge>
                )}
              </div>
              
              {selectedCampaign.description && (
                <p className="text-gray-400 text-sm bg-[#0d1117] p-3 rounded-lg">{selectedCampaign.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Desconto</p>
                  <p className="text-white font-bold text-lg">
                    {formatDiscount(selectedCampaign.discount_type, selectedCampaign.discount_value)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Usos</p>
                  <p className="text-white font-bold text-lg">
                    {selectedCampaign.current_uses}
                    <span className="text-sm font-normal text-gray-400">
                      {selectedCampaign.max_uses ? ` / ${selectedCampaign.max_uses}` : " (ilimitado)"}
                    </span>
                  </p>
                </div>
                <div className="bg-[#0d1117] rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Início</p>
                  <p className="text-white text-sm">{formatDate(selectedCampaign.starts_at)}</p>
                </div>
                <div className="bg-[#0d1117] rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1">Término</p>
                  <p className="text-white text-sm">{formatDate(selectedCampaign.ends_at)}</p>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 pt-3 border-t border-gray-700/50">
                <p>Criado em: {formatDate(selectedCampaign.created_at)}</p>
                <p>Atualizado em: {formatDate(selectedCampaign.updated_at)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </TabsContent>

      <TabsContent value="validacao">
        <PixelValidationChecklist productId={productId} />
      </TabsContent>

      <TabsContent value="monitoramento">
        <PixelMonitoringDashboard productId={productId} />
      </TabsContent>
    </Tabs>
  );
};

export default CampanhasTab;
