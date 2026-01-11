import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/validation";
import CheckoutPreviewDialog from "@/components/checkout/CheckoutPreviewDialog";
import CheckoutPreview from "./CheckoutPreview";
import CheckoutDesktopPreview from "./CheckoutDesktopPreview";
import {
  CreditCard,
  Save,
  RefreshCw,
  Eye,
  Smartphone,
  Upload,
  Trash2,
  Timer,
  Tag,
  FileText,
  Palette,
  Globe,
  Shield,
  ShieldCheck,
  Type,
  Bell,
  MessageSquare,
  MessageCircle,
  Image as ImageIcon,
  Check,
  Sun,
  Moon,
  LayoutGrid,
  Receipt,
  Monitor,
  Phone,
  Clock,
  Lock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Package,
} from "lucide-react";

interface CheckoutSettings {
  id?: string;
  product_id: string;
  logo_url: string | null;
  banner_url: string | null;
  show_banner: boolean;
  primary_color: string;
  background_color: string;
  button_text: string;
  show_product_image: boolean;
  show_product_description: boolean;
  show_testimonials: boolean;
  show_guarantee: boolean;
  guarantee_days: number;
  require_phone: boolean;
  require_document: boolean;
  require_address: boolean;
  pix_enabled: boolean;
  credit_card_enabled: boolean;
  boleto_enabled: boolean;
  max_installments: number;
  show_timer: boolean;
  timer_minutes: number;
  timer_text: string;
  timer_color: string;
  timer_text_color: string;
  timer_expired_text: string;
  headline: string | null;
  subheadline: string | null;
  footer_text: string | null;
  success_url: string | null;
  cancel_url: string | null;
  layout_type: string;
  form_layout: string;
  invert_columns: boolean;
  require_email: boolean;
  show_min_shipping_price: boolean;
  allow_item_removal: boolean;
  show_store_info: boolean;
  column_scroll_type: string;
  cart_display_type: string;
  button_status: string;
  document_type_accepted: string;
  order_bump_enabled: boolean;
  coupon_enabled: boolean;
  marquee_enabled: boolean;
  marquee_text: string | null;
  theme_mode: string;
  border_style: string;
  favicon_url: string | null;
  show_logo: boolean;
  // Social Proof Notifications
  social_proof_enabled: boolean;
  social_proof_notification_1_enabled: boolean;
  social_proof_notification_1_text: string;
  social_proof_notification_2_enabled: boolean;
  social_proof_notification_2_text: string;
  social_proof_notification_3_enabled: boolean;
  social_proof_notification_3_text: string;
  social_proof_notification_4_enabled: boolean;
  social_proof_notification_4_text: string;
  social_proof_min_people: number;
  social_proof_max_people: number;
  social_proof_initial_delay: number;
  social_proof_interval_min: number;
  social_proof_interval_max: number;
  social_proof_duration: number;
  // Security Seals
  security_seals_enabled: boolean;
  security_seal_secure_site: boolean;
  security_seal_secure_purchase: boolean;
  security_seal_guarantee: boolean;
  security_seal_secure_site_text: string;
  security_seal_secure_purchase_text: string;
  security_seal_guarantee_text: string;
  // Animations
  checkout_animation_enabled: boolean;
  // Button Colors
  button_background_color: string;
  button_text_color: string;
  // Total Value Color
  total_value_color: string;
  // WhatsApp Button
  whatsapp_button_enabled: boolean;
  whatsapp_support_phone: string | null;
  // Back Redirect
  back_redirect_enabled: boolean;
  back_redirect_url: string | null;
  // Quantity Selector
  quantity_selector_enabled: boolean;
}

const defaultSettings: Omit<CheckoutSettings, 'product_id'> = {
  logo_url: null,
  banner_url: null,
  show_banner: false,
  primary_color: '#3b82f6',
  background_color: '#0f172a',
  button_text: 'COMPRAR',
  show_product_image: true,
  show_product_description: true,
  show_testimonials: false,
  show_guarantee: true,
  guarantee_days: 7,
  require_phone: false,
  require_document: false,
  require_address: false,
  pix_enabled: true,
  credit_card_enabled: true,
  boleto_enabled: false,
  max_installments: 12,
  show_timer: true,
  timer_minutes: 15,
  timer_text: 'Oferta expira em:',
  timer_color: '#ef4444',
  timer_text_color: '#ffffff',
  timer_expired_text: 'OFERTA ACABOU',
  headline: null,
  subheadline: null,
  footer_text: null,
  success_url: null,
  cancel_url: null,
  layout_type: 'moderno',
  form_layout: 'direct',
  invert_columns: false,
  require_email: true,
  show_min_shipping_price: false,
  allow_item_removal: false,
  show_store_info: false,
  column_scroll_type: 'independent',
  cart_display_type: 'desktop',
  button_status: '',
  document_type_accepted: 'cpf',
  order_bump_enabled: true,
  coupon_enabled: false,
  marquee_enabled: false,
  marquee_text: null,
  theme_mode: 'dark',
  border_style: 'rounded',
  favicon_url: null,
  show_logo: true,
  // Social Proof Notifications
  social_proof_enabled: false,
  social_proof_notification_1_enabled: false,
  social_proof_notification_1_text: '{quantidadePessoas} pessoas estão comprando {nomeProduto} **AGORA**.',
  social_proof_notification_2_enabled: false,
  social_proof_notification_2_text: '{quantidadePessoas} pessoas compraram {nomeProduto} **HOJE**.',
  social_proof_notification_3_enabled: false,
  social_proof_notification_3_text: '{nomeHomem} comprou {nomeProduto} **AGORA**.',
  social_proof_notification_4_enabled: false,
  social_proof_notification_4_text: '{nomeMulher} comprou {nomeProduto} **AGORA**.',
  social_proof_min_people: 2,
  social_proof_max_people: 15,
  social_proof_initial_delay: 3,
  social_proof_interval_min: 8,
  social_proof_interval_max: 15,
  social_proof_duration: 5,
  // Security Seals
  security_seals_enabled: true,
  security_seal_secure_site: true,
  security_seal_secure_purchase: true,
  security_seal_guarantee: true,
  security_seal_secure_site_text: 'Site Protegido com Criptografia',
  security_seal_secure_purchase_text: 'Compra 100% Segura',
  security_seal_guarantee_text: 'Garantia Total de Satisfação',
  // Animations
  checkout_animation_enabled: false,
  // Button Colors
  button_background_color: '#3b82f6',
  button_text_color: '#ffffff',
  // Total Value Color
  total_value_color: '#22c55e',
  // WhatsApp Button
  whatsapp_button_enabled: false,
  whatsapp_support_phone: null,
  // Back Redirect
  back_redirect_enabled: false,
  back_redirect_url: null,
  // Quantity Selector
  quantity_selector_enabled: false,
};

interface CheckoutEditorProps {
  productId: string;
}

// Section Card Header - matching product page style
const SectionCardHeader = ({ icon: Icon, title, description, iconColor = "text-blue-500", bgColor = "bg-blue-500/10" }: { 
  icon: any; 
  title: string; 
  description?: string;
  iconColor?: string;
  bgColor?: string;
}) => (
  <div className="bg-muted/30 px-6 py-4 border-b border-border">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bgColor}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  </div>
);

// Collapsible Section Card Header - with expand/collapse functionality
const CollapsibleSectionCard = ({ 
  icon: Icon, 
  title, 
  description, 
  iconColor = "text-blue-500", 
  bgColor = "bg-blue-500/10",
  defaultExpanded = true,
  children
}: { 
  icon: any; 
  title: string; 
  description?: string;
  iconColor?: string;
  bgColor?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-muted/30 px-6 py-4 border-b border-border cursor-pointer hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </button>
      {isExpanded && children}
    </div>
  );
};

// Toggle Row - horizontal layout for payment methods and options
interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  active: boolean;
  onToggle: (checked: boolean) => void;
  children?: React.ReactNode;
}

const ToggleRow = ({ icon, title, description, active, onToggle, children }: ToggleRowProps) => (
  <div className={`flex items-center justify-between py-3 px-4 rounded-lg transition-all ${
    active ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20 border border-transparent hover:bg-muted/30'
  }`}>
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
        active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {icon}
      </div>
      <div>
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
    <div className="flex items-center gap-3">
      {children}
      <Switch
        checked={active}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  </div>
);

// Feature Badge
const badgeColorsMap: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
  gray: "bg-gray-700/50 text-gray-400 border-gray-600/50",
};

const FeatureBadge = ({ label, active, color = "gray" }: { label: string; active?: boolean; color?: string }) => {
  const badgeColor = badgeColorsMap[color] || badgeColorsMap.gray;

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border", active ? badgeColor : "bg-gray-800 text-gray-500 border-gray-700")}>
      {label}
    </span>
  );
};

const CheckoutEditor = ({ productId }: CheckoutEditorProps) => {
  const [settings, setSettings] = useState<CheckoutSettings>({
    ...defaultSettings,
    product_id: productId,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [productData, setProductData] = useState<{ name: string; price: number; image_url: string | null; payment_type?: string } | null>(null);
  const [orderBumps, setOrderBumps] = useState<Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number;
    discount_price?: number | null;
    image_url?: string | null;
    sales_phrase?: string | null;
    auxiliary_phrase?: string | null;
    is_active?: boolean;
  }>>([]);
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [securitySealsExpanded, setSecuritySealsExpanded] = useState(false);
  const [timerExpanded, setTimerExpanded] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    fetchSettings();
    fetchProduct();
    fetchOrderBumps();
  }, [productId]);

  // Auto-save with debounce when settings change
  useEffect(() => {
    // Skip auto-save on initial load
    if (isInitialLoad.current || loading) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save for 1 second
    saveTimeoutRef.current = setTimeout(() => {
      autoSaveSettings();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);

  const autoSaveSettings = async () => {
    try {
      const { id, ...settingsToSave } = settings;
      console.log("Auto-saving settings, id:", id, "product_id:", settingsToSave.product_id);

      if (id) {
        const { error, count } = await supabase
          .from("checkout_settings")
          .update(settingsToSave)
          .eq("id", id)
          .select();

        if (error) {
          console.error("Update error:", error);
          throw error;
        }
        console.log("Updated rows:", count);
        toast.success("Configurações salvas automaticamente", { duration: 1500, id: "auto-save" });
      } else {
        const { data, error } = await supabase
          .from("checkout_settings")
          .insert(settingsToSave)
          .select()
          .single();

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        
        // Update local state with the new ID
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
          toast.success("Configurações criadas", { duration: 1500, id: "auto-save" });
        }
      }

      console.log("Auto-saved checkout settings");
    } catch (error) {
      console.error("Error auto-saving checkout settings:", error);
      toast.error("Erro ao salvar configurações");
    }
  };

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("name, price, image_url, payment_type")
        .eq("id", productId)
        .single();

      if (error) throw error;
      setProductData(data);
    } catch (error) {
      console.error("Error fetching product:", error);
    }
  };

  const fetchOrderBumps = async () => {
    try {
      const { data, error } = await supabase
        .from("order_bumps")
        .select("id, name, description, price, discount_price, image_url, sales_phrase, auxiliary_phrase, is_active")
        .eq("product_id", productId)
        .eq("is_active", true);

      if (error) throw error;
      setOrderBumps(data || []);
    } catch (error) {
      console.error("Error fetching order bumps:", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("checkout_settings")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...defaultSettings,
          product_id: productId,
          ...data,
        });
      } else {
        setSettings({ ...defaultSettings, product_id: productId });
      }
    } catch (error) {
      console.error("Error fetching checkout settings:", error);
    } finally {
      setLoading(false);
      // Mark initial load as complete after a short delay to prevent auto-save from triggering
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    }
  };

  const uploadImage = async (file: File, type: 'logo' | 'banner' | 'favicon') => {
    if (type === 'logo') setUploadingLogo(true);
    else if (type === 'banner') setUploadingBanner(true);
    else setUploadingFavicon(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `checkout-${type}-${productId}-${Date.now()}.${fileExt}`;
      const filePath = `checkout/${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      if (type === 'logo') {
        setSettings(prev => ({ ...prev, logo_url: publicUrl, show_logo: true }));
      } else if (type === 'banner') {
        setSettings(prev => ({ ...prev, banner_url: publicUrl, show_banner: true }));
      } else {
        setSettings(prev => ({ ...prev, favicon_url: publicUrl }));
      }

      toast.success(`${type === 'logo' ? 'Logo' : type === 'banner' ? 'Banner' : 'Favicon'} enviado!`);
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      toast.error(`Erro ao enviar ${type}`);
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else if (type === 'banner') setUploadingBanner(false);
      else setUploadingFavicon(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner' | 'favicon') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 5MB.');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas.');
        return;
      }
      uploadImage(file, type);
    }
  };

  const removeImage = (type: 'logo' | 'banner' | 'favicon') => {
    if (type === 'logo') {
      setSettings(prev => ({ ...prev, logo_url: null, show_logo: false }));
    } else if (type === 'banner') {
      setSettings(prev => ({ ...prev, banner_url: null }));
    } else {
      setSettings(prev => ({ ...prev, favicon_url: null }));
    }
    toast.success(`${type === 'logo' ? 'Logo' : type === 'banner' ? 'Banner' : 'Favicon'} removido`);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { id, ...settingsToSave } = settings;

      if (id) {
        const { error } = await supabase
          .from("checkout_settings")
          .update(settingsToSave)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("checkout_settings")
          .insert(settingsToSave)
          .select()
          .single();

        if (error) throw error;
        
        // Update local state with the new ID
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      toast.success("Configurações salvas!");
    } catch (error) {
      console.error("Error saving checkout settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const checkoutUrl = `${window.location.origin}/p/${productId.slice(0, 8)}`;

  const handlePreview = () => {
    window.open(checkoutUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Left Column - Settings */}
      <div className="flex-1 space-y-4 max-w-2xl">
        {/* Hidden file inputs */}
        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'logo')} />
        <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'banner')} />
        <input type="file" ref={faviconInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileSelect(e, 'favicon')} />

      {/* Main Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full bg-[#0d1117] border border-gray-800 p-1 grid grid-cols-3 rounded-lg gap-1 h-auto">
          {[
            { value: "resumo", label: "Resumo" },
            { value: "visual", label: "Visual" },
            { value: "pos-carrinho", label: "Pós-venda" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-md py-2 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-gray-400 hover:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Resumo Tab */}
        <TabsContent value="resumo" className="mt-4 space-y-6">
          {/* Payment Methods Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={CreditCard} 
              title="Pagamentos Aceitos" 
              description="Configure os métodos de pagamento disponíveis"
            />
            <div className="p-6 space-y-3">
              <ToggleRow
                icon={<CreditCard className="w-4 h-4" />}
                title="Cartão de crédito"
                description="Parcelamento em até 12x"
                active={settings.credit_card_enabled}
                onToggle={(checked) => setSettings(prev => ({ ...prev, credit_card_enabled: checked }))}
              />
              
              <ToggleRow
                icon={<Smartphone className="w-4 h-4" />}
                title="Pix"
                description="Aprovação instantânea"
                active={settings.pix_enabled}
                onToggle={(checked) => setSettings(prev => ({ ...prev, pix_enabled: checked }))}
              />
              
              <ToggleRow
                icon={<FileText className="w-4 h-4" />}
                title="Boleto"
                description="Até 3 dias para compensar"
                active={settings.boleto_enabled}
                onToggle={(checked) => setSettings(prev => ({ ...prev, boleto_enabled: checked }))}
              />
            </div>
          </div>

          {/* Buyer Identification Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={CreditCard} 
              title="Identificação do Comprador" 
              description="Configure os dados exigidos do cliente"
              iconColor="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <div className="p-6 space-y-4">
              <ToggleRow
                icon={<Globe className="w-4 h-4" />}
                title="Exigir e-mail"
                description="Campo obrigatório para pagamento"
                active={settings.require_email}
                onToggle={(checked) => setSettings(prev => ({ ...prev, require_email: checked }))}
              />

              <ToggleRow
                icon={<Phone className="w-4 h-4" />}
                title="Exigir telefone"
                description="Campo obrigatório para pagamento"
                active={settings.require_phone}
                onToggle={(checked) => setSettings(prev => ({ ...prev, require_phone: checked }))}
              />

              {/* Document Type Section */}
              <div className="pt-4 border-t border-border space-y-4">
                <ToggleRow
                  icon={<FileText className="w-4 h-4" />}
                  title="Exigir CPF/CNPJ"
                  description="Campo obrigatório para pagamento"
                  active={settings.require_document}
                  onToggle={(checked) => setSettings(prev => ({ ...prev, require_document: checked }))}
                />

                {/* Document Type - Only show when document is required */}
                {settings.require_document && (
                  <div className="pl-12 ml-4 border-l-2 border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Tipo de identificação</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Selecione o tipo de documento exigido do cliente
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { value: "cpf", label: "CPF", mask: "000.000.000-00" },
                        { value: "cnpj", label: "CNPJ", mask: "00.000.000/0000-00" }
                      ].map((type) => {
                        const isActive = settings.document_type_accepted === type.value;
                        return (
                          <button
                            key={type.value}
                            onClick={() => setSettings(prev => ({ ...prev, document_type_accepted: type.value }))}
                            className={`flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 transition-all min-w-[120px] ${
                              isActive 
                                ? 'bg-primary/10 border-primary' 
                                : 'bg-muted/20 border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isActive && <Check className="w-4 h-4 text-primary" />}
                              <span className={`font-semibold uppercase ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                                {type.label}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {type.mask}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checkout Options Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={LayoutGrid} 
              title="Opções do Checkout" 
              description="Personalize os campos e comportamento"
              iconColor="text-purple-500"
              bgColor="bg-purple-500/10"
            />
            <div className="p-6 space-y-4">
              {/* Fields Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground font-medium mb-2 block">Carrinho</Label>
                  <Select value={settings.cart_display_type} onValueChange={(value) => setSettings(prev => ({ ...prev, cart_display_type: value }))}>
                    <SelectTrigger className="bg-muted/30 border-border text-foreground h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="mobile" className="text-foreground">Mobile</SelectItem>
                      <SelectItem value="desktop" className="text-foreground">Desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-foreground font-medium mb-2 block">Rótulo do botão</Label>
                  <Select value={settings.button_text} onValueChange={(value) => setSettings(prev => ({ ...prev, button_text: value }))}>
                    <SelectTrigger className="bg-muted/30 border-border text-foreground h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="COMPRAR" className="text-foreground">Comprar</SelectItem>
                      <SelectItem value="COMEÇAR PEDIDO" className="text-foreground">Começar Pedido</SelectItem>
                      <SelectItem value="FINALIZAR COMPRA" className="text-foreground">Finalizar Compra</SelectItem>
                      <SelectItem value="GARANTIR MINHA VAGA" className="text-foreground">Garantir Vaga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Button Text */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Texto personalizado do botão</Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={settings.button_status}
                    onChange={(e) => setSettings(prev => ({ ...prev, button_status: e.target.value }))}
                    className="flex-1 bg-muted/30 border-border text-foreground h-11"
                    placeholder="Ex: COMPRAR AGORA"
                  />
                  <div 
                    className="px-4 py-2.5 rounded-lg text-sm font-bold min-w-[100px] text-center"
                    style={{ 
                      backgroundColor: settings.button_background_color || settings.primary_color,
                      color: settings.button_text_color || '#ffffff'
                    }}
                  >
                    {settings.button_status || settings.button_text || 'COMPRAR'}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Se preenchido, substitui o rótulo padrão do botão
                </p>
              </div>

              {/* Button Colors */}
              <div className="pt-4 border-t border-border">
                <Label className="text-foreground font-medium mb-3 block">Cores do Botão</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Cor de fundo</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={settings.button_background_color || settings.primary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, button_background_color: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer border-border"
                      />
                      <Input
                        value={settings.button_background_color || settings.primary_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, button_background_color: e.target.value }))}
                        className="flex-1 bg-muted/30 border-border text-foreground h-10 font-mono text-sm"
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Cor do texto</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={settings.button_text_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, button_text_color: e.target.value }))}
                        className="w-12 h-10 p-1 cursor-pointer border-border"
                      />
                      <Input
                        value={settings.button_text_color}
                        onChange={(e) => setSettings(prev => ({ ...prev, button_text_color: e.target.value }))}
                        className="flex-1 bg-muted/30 border-border text-foreground h-10 font-mono text-sm"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Extra Features Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={Tag} 
              title="Recursos Extras" 
              description="Aumente suas conversões"
              iconColor="text-amber-500"
              bgColor="bg-amber-500/10"
            />
            <div className="p-6 space-y-4">
              <ToggleRow
                icon={<Timer className="w-4 h-4" />}
                title="Temporizador"
                description="Cronômetro de urgência"
                active={settings.show_timer}
                onToggle={(checked) => setSettings(prev => ({ ...prev, show_timer: checked }))}
              >
                {settings.show_timer && (
                  <div className="flex items-center gap-2 mr-2">
                    <Input
                      type="number"
                      value={settings.timer_minutes}
                      onChange={(e) => setSettings(prev => ({ ...prev, timer_minutes: parseInt(e.target.value) || 15 }))}
                      className="w-16 bg-muted/30 border-border text-foreground h-9 text-center"
                      min={1}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                )}
              </ToggleRow>

              {/* Timer Customization - Only show when timer is enabled */}
              {settings.show_timer && (
                <div className="pl-4 border-l-2 border-primary/20 ml-4">
                  <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setTimerExpanded(!timerExpanded)}
                    >
                      <span className="text-sm text-muted-foreground">Configurar temporizador</span>
                      {timerExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    {timerExpanded && (
                      <div className="p-4 space-y-4 border-t border-border">
                        {/* Timer Text */}
                        <div>
                          <Label className="text-foreground font-medium mb-2 block text-sm">Texto do temporizador</Label>
                          <Input
                            value={settings.timer_text}
                            onChange={(e) => setSettings(prev => ({ ...prev, timer_text: e.target.value }))}
                            className="bg-muted/30 border-border text-foreground h-10"
                            placeholder="Ex: Oferta expira em:"
                          />
                        </div>

                        {/* Timer Color */}
                        <div>
                          <Label className="text-foreground font-medium mb-2 block text-sm">Cor do fundo</Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="color"
                              value={settings.timer_color}
                              onChange={(e) => setSettings(prev => ({ ...prev, timer_color: e.target.value }))}
                              className="w-12 h-10 p-1 cursor-pointer border-border"
                            />
                            <Input
                              value={settings.timer_color}
                              onChange={(e) => setSettings(prev => ({ ...prev, timer_color: e.target.value }))}
                              className="flex-1 bg-muted/30 border-border text-foreground h-10 font-mono text-sm"
                              placeholder="#ef4444"
                            />
                          </div>
                        </div>

                        {/* Timer Text Color */}
                        <div>
                          <Label className="text-foreground font-medium mb-2 block text-sm">Cor do texto da mensagem</Label>
                          <div className="flex items-center gap-3">
                            <Input
                              type="color"
                              value={settings.timer_text_color}
                              onChange={(e) => setSettings(prev => ({ ...prev, timer_text_color: e.target.value }))}
                              className="w-12 h-10 p-1 cursor-pointer border-border"
                            />
                            <Input
                              value={settings.timer_text_color}
                              onChange={(e) => setSettings(prev => ({ ...prev, timer_text_color: e.target.value }))}
                              className="flex-1 bg-muted/30 border-border text-foreground h-10 font-mono text-sm"
                              placeholder="#ffffff"
                            />
                          </div>
                        </div>

                        {/* Expired Text */}
                        <div className="pt-4 border-t border-border">
                          <Label className="text-foreground font-medium mb-2 block text-sm">Texto de contagem zerada</Label>
                          <Input
                            value={settings.timer_expired_text || "OFERTA ACABOU"}
                            onChange={(e) => setSettings(prev => ({ ...prev, timer_expired_text: e.target.value }))}
                            className="bg-muted/30 border-border text-foreground h-10"
                            placeholder="OFERTA ACABOU"
                          />
                        </div>

                        {/* Preview */}
                        <div>
                          <Label className="text-foreground font-medium mb-2 block text-sm">Pré-visualização</Label>
                          <div 
                            className="px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                            style={{ backgroundColor: settings.timer_color, color: settings.timer_text_color }}
                          >
                            <Clock className="w-4 h-4" />
                            {settings.timer_text} 14:59
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Security Seals Section */}
              <div className={`flex items-center justify-between py-3 px-4 rounded-lg transition-all ${
                settings.security_seals_enabled ? 'bg-primary/5 border border-primary/20' : 'bg-muted/20 border border-transparent hover:bg-muted/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    settings.security_seals_enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-foreground">Selos de segurança</span>
                </div>
                <Switch
                  checked={settings.security_seals_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, security_seals_enabled: checked }))}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Security Seals Options - Only show when enabled */}
              {settings.security_seals_enabled && (
                <div className="ml-4 border-l-2 border-primary/20 pl-4">
                  <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setSecuritySealsExpanded(!securitySealsExpanded)}
                    >
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Selecionar</span>
                        <span className="text-sm text-muted-foreground ml-2">Selecionar métodos</span>
                      </div>
                      {securitySealsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    {securitySealsExpanded && (
                      <div className="divide-y divide-border">
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            settings.security_seal_secure_site 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground/50 hover:border-primary/50'
                          }`}>
                            {settings.security_seal_secure_site && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.security_seal_secure_site}
                            onChange={(e) => setSettings(prev => ({ ...prev, security_seal_secure_site: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-foreground">Site Seguro</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            settings.security_seal_secure_purchase 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground/50 hover:border-primary/50'
                          }`}>
                            {settings.security_seal_secure_purchase && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.security_seal_secure_purchase}
                            onChange={(e) => setSettings(prev => ({ ...prev, security_seal_secure_purchase: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-foreground">Compra Segura</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            settings.security_seal_guarantee 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground/50 hover:border-primary/50'
                          }`}>
                            {settings.security_seal_guarantee && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.security_seal_guarantee}
                            onChange={(e) => setSettings(prev => ({ ...prev, security_seal_guarantee: e.target.checked }))}
                            className="sr-only"
                          />
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-foreground">Garantia</span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Notifications Section */}
              <ToggleRow
                icon={<Bell className="w-4 h-4" />}
                title="Notificações"
                description="Prova social para conversões"
                active={settings.social_proof_enabled}
                onToggle={(checked) => setSettings(prev => ({ ...prev, social_proof_enabled: checked }))}
              />

              {/* Notifications Customization - Only show when enabled */}
              {settings.social_proof_enabled && (
                <div className="pl-4 border-l-2 border-primary/20 ml-4">
                  <div className="bg-muted/30 border border-border rounded-lg overflow-hidden">
                    <div 
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setNotificationsExpanded(!notificationsExpanded)}
                    >
                      <span className="text-sm text-muted-foreground">Configurar notificações</span>
                      {notificationsExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    {notificationsExpanded && (
                      <div className="p-4 space-y-4 border-t border-border">
                        {/* Notification 1 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-foreground font-medium">Notificação 1</Label>
                            <Switch
                              checked={settings.social_proof_notification_1_enabled}
                              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, social_proof_notification_1_enabled: checked }))}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          <Input
                            value={settings.social_proof_notification_1_text}
                            onChange={(e) => setSettings(prev => ({ ...prev, social_proof_notification_1_text: e.target.value }))}
                            placeholder="{quantidadePessoas} pessoas estão comprando {nomeProduto} **AGORA**."
                            className="bg-muted/30 border-border text-foreground h-11 text-sm"
                            disabled={!settings.social_proof_notification_1_enabled}
                          />
                        </div>

                        {/* Notification 2 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-foreground font-medium">Notificação 2</Label>
                            <Switch
                              checked={settings.social_proof_notification_2_enabled}
                              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, social_proof_notification_2_enabled: checked }))}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          <Input
                            value={settings.social_proof_notification_2_text}
                            onChange={(e) => setSettings(prev => ({ ...prev, social_proof_notification_2_text: e.target.value }))}
                            placeholder="{quantidadePessoas} pessoas compraram {nomeProduto} **HOJE**."
                            className="bg-muted/30 border-border text-foreground h-11 text-sm"
                            disabled={!settings.social_proof_notification_2_enabled}
                          />
                        </div>

                        {/* Notification 3 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-foreground font-medium">Notificação 3</Label>
                            <Switch
                              checked={settings.social_proof_notification_3_enabled}
                              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, social_proof_notification_3_enabled: checked }))}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          <Input
                            value={settings.social_proof_notification_3_text}
                            onChange={(e) => setSettings(prev => ({ ...prev, social_proof_notification_3_text: e.target.value }))}
                            placeholder="{nomeHomem} comprou {nomeProduto} **AGORA**."
                            className="bg-muted/30 border-border text-foreground h-11 text-sm"
                            disabled={!settings.social_proof_notification_3_enabled}
                          />
                        </div>

                        {/* Notification 4 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-foreground font-medium">Notificação 4</Label>
                            <Switch
                              checked={settings.social_proof_notification_4_enabled}
                              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, social_proof_notification_4_enabled: checked }))}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                          <Input
                            value={settings.social_proof_notification_4_text}
                            onChange={(e) => setSettings(prev => ({ ...prev, social_proof_notification_4_text: e.target.value }))}
                            placeholder="{nomeMulher} comprou {nomeProduto} **AGORA**."
                            className="bg-muted/30 border-border text-foreground h-11 text-sm"
                            disabled={!settings.social_proof_notification_4_enabled}
                          />
                        </div>

                        {/* Timing Configuration */}
                        <div className="pt-3 border-t border-border space-y-4">
                          <p className="text-xs text-muted-foreground font-medium">
                            Configurações de Tempo
                          </p>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Delay inicial (s)</Label>
                              <Input
                                type="number"
                                min={0}
                                max={30}
                                step={0.5}
                                value={settings.social_proof_initial_delay}
                                onChange={(e) => setSettings(prev => ({ ...prev, social_proof_initial_delay: parseFloat(e.target.value) || 0 }))}
                                className="bg-muted/30 border-border text-foreground h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Duração (s)</Label>
                              <Input
                                type="number"
                                min={1}
                                max={15}
                                step={0.5}
                                value={settings.social_proof_duration}
                                onChange={(e) => setSettings(prev => ({ ...prev, social_proof_duration: parseFloat(e.target.value) || 3 }))}
                                className="bg-muted/30 border-border text-foreground h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Intervalo mín (s)</Label>
                              <Input
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                value={settings.social_proof_interval_min}
                                onChange={(e) => setSettings(prev => ({ ...prev, social_proof_interval_min: parseInt(e.target.value) || 2 }))}
                                className="bg-muted/30 border-border text-foreground h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Intervalo máx (s)</Label>
                              <Input
                                type="number"
                                min={1}
                                max={120}
                                step={1}
                                value={settings.social_proof_interval_max}
                                onChange={(e) => setSettings(prev => ({ ...prev, social_proof_interval_max: parseInt(e.target.value) || 5 }))}
                                className="bg-muted/30 border-border text-foreground h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Variables Info */}
                        <div className="pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">
                            <MessageSquare className="w-3 h-3 inline mr-1" />
                            Variáveis disponíveis:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {['{quantidadePessoas}', '{nomeProduto}', '{nomeHomem}', '{nomeMulher}', '**texto**'].map((v) => (
                              <code key={v} className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                                {v}
                              </code>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity Selector Section */}
              <div className={`flex items-center justify-between py-3 px-4 rounded-lg transition-all ${
                settings.quantity_selector_enabled ? 'bg-muted/30 border border-border' : 'bg-muted/20 border border-transparent hover:bg-muted/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    settings.quantity_selector_enabled ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Seletor de quantidade</span>
                    <p className="text-xs text-muted-foreground">{settings.quantity_selector_enabled ? 'Ativado' : 'Desativado'}</p>
                  </div>
                </div>
                <Switch
                  checked={settings.quantity_selector_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, quantity_selector_enabled: checked }))}
                  className="data-[state=checked]:bg-foreground"
                />
              </div>

              {/* Coupon Section */}
              <div className={`flex items-center justify-between py-3 px-4 rounded-lg transition-all ${
                settings.coupon_enabled ? 'bg-muted/30 border border-border' : 'bg-muted/20 border border-transparent hover:bg-muted/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    settings.coupon_enabled ? 'bg-foreground/10 text-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Campo de cupom</span>
                    <p className="text-xs text-muted-foreground">
                      {settings.coupon_enabled ? 'Exibir campo para código de desconto' : 'Campo de cupom desativado'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.coupon_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, coupon_enabled: checked }))}
                  className="data-[state=checked]:bg-foreground"
                />
              </div>

              {/* Coupon Info Panel - Only show when enabled */}
              {settings.coupon_enabled && (
                <div className="pl-4 border-l-2 border-border ml-4">
                  <div className="bg-muted/30 border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Como gerenciar cupons?</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Para criar, editar ou desativar cupons de desconto, acesse a aba <strong className="text-muted-foreground">Campanhas</strong> no menu do produto. 
                          Lá você pode definir o código do cupom, tipo de desconto (percentual ou fixo), validade e limite de usos.
                        </p>
                        <div className="pt-1">
                          <span className="text-xs text-muted-foreground">
                            💡 Dica: Os cupons criados em Campanhas aparecerão automaticamente no checkout quando o cliente inserir o código.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Visual Tab */}
        <TabsContent value="visual" className="mt-4 space-y-6">
          {/* Logo & Branding Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={ImageIcon} 
              title="Logo e Identidade" 
              description="Configure a identidade visual do checkout"
              iconColor="text-purple-500"
              bgColor="bg-purple-500/10"
            />
            <div className="p-6 space-y-4">
              <ToggleRow
                icon={<Eye className="w-4 h-4" />}
                title="Exibir logotipo"
                active={settings.show_logo}
                onToggle={(checked) => {
                  setSettings(prev => ({ ...prev, show_logo: checked }));
                  if (!checked) removeImage('logo');
                }}
              />
              
              {settings.show_logo && (
                <div className="mt-2">
                  {settings.logo_url ? (
                    <div className="relative group bg-muted/30 border border-border rounded-lg p-4">
                      <img src={settings.logo_url} alt="Logo" className="h-12 object-contain mx-auto" />
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button size="sm" onClick={() => logoInputRef.current?.click()} className="bg-primary hover:bg-primary/90 text-xs h-7">
                          <Upload className="w-3 h-3 mr-1" />Trocar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => removeImage('logo')} className="text-xs h-7">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full h-16 border border-dashed border-border bg-muted/20 hover:bg-muted/30 text-muted-foreground rounded-lg text-sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      {uploadingLogo ? 'Enviando...' : 'Enviar logo'}
                    </Button>
                  )}
                </div>
              )}

              {/* Banner Upload */}
              <div className="pt-4 border-t border-border space-y-3">
                <ToggleRow
                  icon={<ImageIcon className="w-4 h-4" />}
                  title="Exibir banner"
                  active={settings.show_banner}
                  onToggle={(checked) => {
                    setSettings(prev => ({ ...prev, show_banner: checked }));
                    if (checked && !settings.banner_url) {
                      bannerInputRef.current?.click();
                    }
                  }}
                />
                
                {settings.show_banner && (
                  <div className="space-y-3">
                    {settings.banner_url ? (
                      <div className="relative group bg-muted/30 border border-border rounded-lg p-4">
                        <img src={settings.banner_url} alt="Banner" className="w-full h-24 object-cover rounded-lg" />
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="sm" onClick={() => bannerInputRef.current?.click()} className="bg-primary hover:bg-primary/90 text-xs h-7">
                            <Upload className="w-3 h-3 mr-1" />Trocar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => removeImage('banner')} className="text-xs h-7">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-20 border-dashed border-2"
                        onClick={() => bannerInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Carregar imagem do banner
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Theme Card */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <SectionCardHeader 
              icon={Palette} 
              title="Tema e Cores" 
              description="Personalize as cores do checkout"
              iconColor="text-pink-500"
              bgColor="bg-pink-500/10"
            />
            <div className="p-6 space-y-4">
              {/* Theme Mode */}
              <div>
                <Label className="text-foreground font-medium mb-3 block">Modo do tema</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, theme_mode: 'light', background_color: '#ffffff' }))}
                    className={cn(
                      "py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      settings.theme_mode === "light"
                        ? "bg-white text-gray-900 border-2 border-primary"
                        : "bg-muted/20 text-muted-foreground border border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <Sun className="w-4 h-4" /> Claro
                  </button>
                  <button
                    onClick={() => setSettings(prev => ({ ...prev, theme_mode: 'dark', background_color: '#0f172a' }))}
                    className={cn(
                      "py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      settings.theme_mode === "dark"
                        ? "bg-primary text-white border-2 border-primary"
                        : "bg-muted/20 text-muted-foreground border border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <Moon className="w-4 h-4" /> Escuro
                  </button>
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <Label className="text-foreground font-medium mb-2 block">Cor de destaque</Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="flex-1 font-mono bg-muted/30 border-border text-foreground h-11"
                  />
                  <button 
                    className="w-11 h-11 rounded-lg border border-border cursor-pointer shadow-sm"
                    style={{ backgroundColor: settings.primary_color }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = settings.primary_color;
                      input.onchange = (e) => setSettings(prev => ({ ...prev, primary_color: (e.target as HTMLInputElement).value }));
                      input.click();
                    }}
                  />
                </div>
              </div>

              {/* Border Style */}
              <div className="pt-4 border-t border-border">
                <Label className="text-foreground font-medium mb-3 block">Estilo de borda</Label>
                <div className="flex gap-4 justify-center">
                  {[
                    { id: "rounded", style: "rounded-xl", label: "Arredondado" },
                    { id: "semi-rounded", style: "rounded-md", label: "Semi" },
                    { id: "square", style: "rounded-none", label: "Quadrado" },
                  ].map((border) => (
                    <button
                      key={border.id}
                      onClick={() => setSettings(prev => ({ ...prev, border_style: border.id }))}
                      className="flex flex-col items-center gap-2 p-2"
                    >
                      <div 
                        className={cn(
                          "w-16 h-14 bg-muted/30 transition-all",
                          border.style,
                          settings.border_style === border.id ? "border-2 border-primary" : "border border-border"
                        )}
                      />
                      <span className={cn("text-xs font-medium", settings.border_style === border.id ? 'text-primary' : 'text-muted-foreground')}>
                        {border.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Pós-venda Tab */}
        <TabsContent value="pos-carrinho" className="mt-4 space-y-6">
          {/* Redirects Card */}
          <CollapsibleSectionCard 
            icon={Globe} 
            title="Redirecionamento" 
            description="Configure URLs de destino após a compra"
          >
            <div className="p-6">
              <Label className="text-foreground font-medium mb-2 block">URL de sucesso</Label>
              <Input
                value={settings.success_url || ""}
                onChange={(e) => setSettings(prev => ({ ...prev, success_url: e.target.value || null }))}
                placeholder="https://seusite.com/obrigado"
                className="bg-muted/30 border-border text-foreground h-11"
              />
            </div>
          </CollapsibleSectionCard>

          {/* WhatsApp Support Card */}
          <CollapsibleSectionCard 
            icon={MessageCircle} 
            title="Botão do WhatsApp" 
            description="Botão flutuante do WhatsApp para suporte"
            iconColor="text-green-500"
            bgColor="bg-green-500/10"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    settings.whatsapp_button_enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Ativar botão do WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Exibir botão flutuante para suporte</p>
                  </div>
                </div>
                <Switch
                  checked={settings.whatsapp_button_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, whatsapp_button_enabled: checked }))}
                />
              </div>
              
              {settings.whatsapp_button_enabled && (
                <div>
                  <Label className="text-foreground font-medium mb-2 block">Telefone do suporte</Label>
                  <Input
                    value={settings.whatsapp_support_phone || ""}
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      setSettings(prev => ({ ...prev, whatsapp_support_phone: masked || null }));
                    }}
                    placeholder="(11) 99999-9999"
                    className="bg-muted/30 border-border text-foreground h-11"
                    maxLength={15}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Digite apenas números de telefone brasileiros</p>
                </div>
              )}
            </div>
          </CollapsibleSectionCard>

          {/* Back Redirect Card */}
          <CollapsibleSectionCard 
            icon={ExternalLink} 
            title="Back Redirect" 
            description="Redirecionar ao clicar no botão voltar"
            iconColor="text-orange-500"
            bgColor="bg-orange-500/10"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    settings.back_redirect_enabled ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'
                  }`}>
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Back Redirect</p>
                    <p className="text-xs text-muted-foreground">Redireciona ao tentar voltar</p>
                  </div>
                </div>
                <Switch
                  checked={settings.back_redirect_enabled}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, back_redirect_enabled: checked }))}
                />
              </div>
              
              {settings.back_redirect_enabled && (
                <div>
                  <Label className="text-foreground font-medium mb-2 block">Url da página</Label>
                  <Input
                    value={settings.back_redirect_url || ""}
                    onChange={(e) => setSettings(prev => ({ ...prev, back_redirect_url: e.target.value || null }))}
                    placeholder="https://seusite.com/pagina"
                    className="bg-muted/30 border-border text-foreground h-11"
                  />
                </div>
              )}
            </div>
          </CollapsibleSectionCard>

          {/* Custom Texts Card */}
          <CollapsibleSectionCard 
            icon={Type} 
            title="Textos Personalizados" 
            description="Customize mensagens do checkout"
          >
            <div className="p-6 space-y-4">
              <div>
                <Label className="text-foreground font-medium mb-2 block">Título principal</Label>
                <Input
                  value={settings.headline || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, headline: e.target.value || null }))}
                  placeholder="Aproveite esta oferta exclusiva!"
                  className="bg-muted/30 border-border text-foreground h-11"
                />
              </div>
              
              <div>
                <Label className="text-foreground font-medium mb-2 block">Subtítulo</Label>
                <Input
                  value={settings.subheadline || ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, subheadline: e.target.value || null }))}
                  placeholder="Acesso imediato após confirmação"
                  className="bg-muted/30 border-border text-foreground h-11"
                />
              </div>
            </div>
          </CollapsibleSectionCard>
        </TabsContent>

      </Tabs>

      {/* Preview Dialog */}
      <CheckoutPreviewDialog
        productId={productId}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
      />
      </div>

      {/* Right Column - Preview */}
      <div className={cn(
        "flex-shrink-0 sticky top-4 self-start flex justify-center",
        settings.cart_display_type === 'desktop' ? 'w-[600px]' : 'w-96'
      )}>
        {settings.cart_display_type === 'desktop' ? (
          // Desktop Preview
          <div className="relative w-full">
            {/* Subtle Glow */}
            <div 
              className="absolute -inset-4 blur-2xl opacity-10"
              style={{ background: `radial-gradient(ellipse at center, ${settings.primary_color}, transparent 60%)` }}
            />
            
            {/* Desktop Browser Frame */}
            <div 
              className="relative overflow-hidden shadow-2xl rounded-lg"
              style={{
                background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #0a0a0c 100%)',
                padding: '4px',
              }}
            >
              {/* Browser Top Bar */}
              <div className="bg-[#2a2a2e] px-3 py-2 flex items-center gap-2 rounded-t-lg">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-700/50 rounded-full px-3 py-1 flex items-center gap-2">
                    <Lock className="w-2.5 h-2.5 text-green-400" />
                    <span className="text-[10px] text-gray-400">royalpaybr.com/checkout</span>
                  </div>
                </div>
              </div>
              
              {/* Screen Content */}
              <div 
                className="overflow-hidden [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-500 [&::-webkit-scrollbar-thumb]:rounded-full" 
                style={{ maxHeight: '600px', overflowY: 'auto' }}
              >
                <CheckoutDesktopPreview
                  settings={{
                    layout_type: settings.layout_type,
                    primary_color: settings.primary_color,
                    background_color: settings.background_color,
                    theme_mode: settings.theme_mode,
                    button_text: settings.button_text,
                    button_background_color: settings.button_background_color,
                    button_text_color: settings.button_text_color,
                    show_timer: settings.show_timer,
                    timer_text: settings.timer_text,
                    timer_minutes: settings.timer_minutes,
                    timer_color: settings.timer_color,
                    timer_text_color: settings.timer_text_color,
                    pix_enabled: settings.pix_enabled,
                    credit_card_enabled: settings.credit_card_enabled,
                    boleto_enabled: settings.boleto_enabled,
                    show_guarantee: settings.show_guarantee,
                    guarantee_days: settings.guarantee_days,
                    border_style: settings.border_style,
                    form_layout: settings.form_layout,
                    show_logo: settings.show_logo,
                    logo_url: settings.logo_url,
                    show_banner: settings.show_banner,
                    banner_url: settings.banner_url,
                    marquee_enabled: settings.marquee_enabled,
                    marquee_text: settings.marquee_text,
                    headline: settings.headline,
                    invert_columns: settings.invert_columns,
                    require_email: settings.require_email,
                    require_phone: settings.require_phone,
                    require_document: settings.require_document,
                    document_type_accepted: settings.document_type_accepted,
                    security_seals_enabled: settings.security_seals_enabled,
                    security_seal_secure_site: settings.security_seal_secure_site,
                    security_seal_secure_purchase: settings.security_seal_secure_purchase,
                    security_seal_guarantee: settings.security_seal_guarantee,
                    security_seal_secure_site_text: settings.security_seal_secure_site_text,
                    security_seal_secure_purchase_text: settings.security_seal_secure_purchase_text,
                    security_seal_guarantee_text: settings.security_seal_guarantee_text,
                    total_value_color: settings.total_value_color,
                    order_bump_enabled: settings.order_bump_enabled,
                    coupon_enabled: settings.coupon_enabled,
                    quantity_selector_enabled: settings.quantity_selector_enabled,
                    social_proof_enabled: settings.social_proof_enabled,
                    social_proof_notification_1_enabled: settings.social_proof_notification_1_enabled,
                    social_proof_notification_1_text: settings.social_proof_notification_1_text,
                    social_proof_notification_2_enabled: settings.social_proof_notification_2_enabled,
                    social_proof_notification_2_text: settings.social_proof_notification_2_text,
                    social_proof_notification_3_enabled: settings.social_proof_notification_3_enabled,
                    social_proof_notification_3_text: settings.social_proof_notification_3_text,
                    social_proof_notification_4_enabled: settings.social_proof_notification_4_enabled,
                    social_proof_notification_4_text: settings.social_proof_notification_4_text,
                  }}
                  productName={productData?.name || "Produto"}
                  productPrice={productData?.price ?? 0}
                  productImage={productData?.image_url}
                  orderBumps={orderBumps}
                  isSubscription={productData?.payment_type === 'subscription'}
                />
              </div>
            </div>
          </div>
        ) : (
          // Mobile Preview - Phone Frame
          <div className="relative" style={{ maxWidth: '340px' }}>
            {/* Subtle Glow */}
            <div 
              className="absolute -inset-8 blur-3xl opacity-20"
              style={{ background: `radial-gradient(ellipse at center, ${settings.primary_color}, transparent 60%)` }}
            />
            
            {/* Phone Frame - iPhone Style */}
            <div 
              className="relative overflow-hidden shadow-2xl"
              style={{
                borderRadius: '44px',
                background: 'linear-gradient(145deg, #2a2a2e 0%, #1a1a1e 50%, #0a0a0c 100%)',
                padding: '8px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.3)'
              }}
            >
              {/* Inner bezel */}
              <div 
                className="relative overflow-hidden"
                style={{
                  borderRadius: '36px',
                  background: '#000',
                }}
              >
                {/* Dynamic Island */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                  <div 
                    className="flex items-center justify-center px-4 py-1.5 rounded-full"
                    style={{ background: '#000', minWidth: '80px' }}
                  >
                    <div className="w-2 h-2 rounded-full bg-gray-800 mr-2" />
                    <div className="w-8 h-2 rounded-full bg-gray-800" />
                  </div>
                </div>
                
                {/* Screen Content */}
                <CheckoutPreview
                  settings={{
                    layout_type: settings.layout_type,
                    primary_color: settings.primary_color,
                    background_color: settings.background_color,
                    theme_mode: settings.theme_mode,
                    button_text: settings.button_text,
                    button_background_color: settings.button_background_color,
                    button_text_color: settings.button_text_color,
                    show_timer: settings.show_timer,
                    timer_text: settings.timer_text,
                    timer_minutes: settings.timer_minutes,
                    timer_color: settings.timer_color,
                    timer_text_color: settings.timer_text_color,
                    pix_enabled: settings.pix_enabled,
                    credit_card_enabled: settings.credit_card_enabled,
                    boleto_enabled: settings.boleto_enabled,
                    show_guarantee: settings.show_guarantee,
                    guarantee_days: settings.guarantee_days,
                    border_style: settings.border_style,
                    form_layout: settings.form_layout,
                    show_logo: settings.show_logo,
                    logo_url: settings.logo_url,
                    banner_url: settings.banner_url,
                    marquee_enabled: settings.marquee_enabled,
                    marquee_text: settings.marquee_text,
                    headline: settings.headline,
                    invert_columns: settings.invert_columns,
                    require_email: settings.require_email,
                    require_phone: settings.require_phone,
                    require_document: settings.require_document,
                    document_type_accepted: settings.document_type_accepted,
                    security_seals_enabled: settings.security_seals_enabled,
                    security_seal_secure_site: settings.security_seal_secure_site,
                    security_seal_secure_purchase: settings.security_seal_secure_purchase,
                    security_seal_guarantee: settings.security_seal_guarantee,
                    total_value_color: settings.total_value_color,
                    order_bump_enabled: settings.order_bump_enabled,
                    coupon_enabled: settings.coupon_enabled,
                  }}
                  productName={productData?.name || "Produto"}
                  productPrice={productData?.price ?? 0}
                  productImage={productData?.image_url}
                  orderBumps={orderBumps}
                  isSubscription={productData?.payment_type === 'subscription'}
                />
                
                {/* Phone Side Buttons */}
                <div 
                  className="absolute left-0 top-20 w-[3px] h-6 rounded-l-sm"
                  style={{ background: 'linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 50%, #1a1a1e 100%)' }}
                />
                <div 
                  className="absolute left-0 top-32 w-[3px] h-10 rounded-l-sm"
                  style={{ background: 'linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 50%, #1a1a1e 100%)' }}
                />
                <div 
                  className="absolute left-0 top-44 w-[3px] h-10 rounded-l-sm"
                  style={{ background: 'linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 50%, #1a1a1e 100%)' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutEditor;
