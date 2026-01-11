import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CheckoutEditor from "@/components/dashboard/CheckoutEditor";

import OrderBumpTab from "@/components/product/OrderBumpTab";
import UpsellDownsellTab from "@/components/product/UpsellDownsellTab";

import LinksTab from "@/components/product/LinksTab";
import CampanhasTab from "@/components/product/CampanhasTab";
import AvaliacoesTab from "@/components/product/AvaliacoesTab";
import ProvasSociaisTab from "@/components/product/ProvasSociaisTab";
import ConfiguracoesTab from "@/components/product/ConfiguracoesTab";
import EntregaveisTab from "@/components/product/EntregaveisTab";
import DeliveryMethodSelector, { DeliveryMethod } from "@/components/product/DeliveryMethodSelector";
import MemberAreaManager from "@/components/product/MemberAreaManager";
import { ensureCourseExists } from "@/lib/enrollmentService";
import { validateLogisticsData, getFieldError, type LogisticsValidationError } from "@/lib/logisticsValidation";
import { 
  ArrowLeft, 
  Loader2,
  Upload,
  Info,
  Save,
  AlertCircle,
  Package,
  DollarSign,
  CreditCard,
  Headphones,
  CheckCircle2,
  Image as ImageIcon,
  MessageSquare,
  Mail,
  Smartphone,
  GraduationCap,
  Check,
  Truck,
  Ruler,
  Scale,
  MoreVertical,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  product_type: string;
  category: string;
  payment_type: string;
  delivery_method: string | null;
  marketplace_enabled: boolean | null;
  sales_page_url: string | null;
  sac_name: string | null;
  sac_phone: string | null;
  sac_email: string | null;
  weight: number | null;
  stock: number | null;
  status: string;
  created_at: string;
  image_url: string | null;
  user_id: string;
  slug: string | null;
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_grams: number | null;
}

const productTypes = [
  { value: "digital", label: "Curso" },
  { value: "ebook", label: "E-book" },
  { value: "membership", label: "Área de Membros" },
  { value: "physical", label: "Produto Físico" },
  { value: "service", label: "Serviço" },
];

const categories = [
  { value: "desenvolvimento-pessoal", label: "Desenvolvimento Pessoal" },
  { value: "negocios", label: "Negócios e Carreiras" },
  { value: "financas", label: "Finanças e Investimentos" },
  { value: "saude", label: "Saúde e Esportes" },
  { value: "relacionamentos", label: "Relacionamentos" },
  { value: "tecnologia", label: "Tecnologia e Programação" },
  { value: "educacao", label: "Educação e Idiomas" },
  { value: "marketing", label: "Marketing Digital" },
  { value: "design", label: "Design e Criatividade" },
  { value: "beleza", label: "Beleza e Estética" },
  { value: "culinaria", label: "Culinária e Gastronomia" },
  { value: "musica", label: "Música e Artes" },
  { value: "espiritualidade", label: "Espiritualidade" },
  { value: "direito", label: "Direito e Concursos" },
  { value: "games", label: "Games e E-sports" },
  { value: "fotografia", label: "Fotografia e Vídeo" },
  { value: "pets", label: "Animais e Pets" },
  { value: "moda", label: "Moda e Estilo" },
  { value: "outros", label: "Outros" },
];

// Delivery methods now use the new simplified 3-option system
// payment_only | email | member_area

const paymentTypes = [
  { value: "one_time", label: "Pagamento único" },
  { value: "subscription", label: "Assinatura" },
];

// Validação de telefone brasileiro
const validateBrazilianPhone = (phone: string): boolean => {
  if (!phone || phone.trim() === '') return true; // Campo opcional
  // Remove tudo que não é número
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length === 0) return true; // Campo só com máscara é tratado como vazio
  // Telefone brasileiro: 10-11 dígitos (com DDD)
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
};

const formatBrazilianPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

// Validação de email
const validateEmail = (email: string): boolean => {
  if (!email) return true; // Campo opcional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const ProdutoGerenciar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Validation errors
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [logisticsErrors, setLogisticsErrors] = useState<LogisticsValidationError[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    product_type: "digital",
    category: "outros",
    delivery_method: "payment_only", // UI value - maps to null in database
    payment_type: "one_time",
    price: 0,
    sales_page_url: "",
    sac_name: "",
    sac_phone: "",
    sac_email: "",
    image_url: "",
    // Logistics fields for physical products
    height_cm: 0,
    width_cm: 0,
    length_cm: 0,
    weight_grams: 0,
  });
  
  // Helper to convert UI delivery method to database value
  const mapDeliveryMethodToDb = (uiValue: string): string | null => {
    if (uiValue === 'payment_only') return null;
    return uiValue; // 'email' and 'member_area' are valid DB values
  };
  
  // Helper to convert database delivery method to UI value  
  const mapDeliveryMethodFromDb = (dbValue: string | null): string => {
    if (!dbValue) return 'payment_only';
    return dbValue; // 'email' and 'member_area' are valid UI values
  };

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        product_type: product.product_type || "digital",
        category: product.category || "outros",
        delivery_method: mapDeliveryMethodFromDb(product.delivery_method),
        payment_type: product.payment_type || "one_time",
        price: product.price || 0,
        sales_page_url: product.sales_page_url || "",
        sac_name: product.sac_name || "",
        sac_phone: product.sac_phone || "",
        sac_email: product.sac_email || "",
        image_url: product.image_url || "",
        height_cm: product.height_cm || 0,
        width_cm: product.width_cm || 0,
        length_cm: product.length_cm || 0,
        weight_grams: product.weight_grams || 0,
      });
    }
  }, [product]);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!id || !product) return;
    
    // Validate before auto-save - use same logic as handleSave
    const cleanPhone = formData.sac_phone?.replace(/\D/g, "") || "";
    if (cleanPhone.length > 0 && !validateBrazilianPhone(formData.sac_phone)) return;
    if (formData.sac_email && formData.sac_email.trim() !== '' && !validateEmail(formData.sac_email)) return;

    try {
      const formattedPhone = formData.sac_phone 
        ? formatBrazilianPhone(formData.sac_phone) 
        : null;

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          product_type: formData.product_type,
          category: formData.category,
          delivery_method: mapDeliveryMethodToDb(formData.delivery_method),
          payment_type: formData.payment_type,
          price: formData.price,
          sales_page_url: formData.sales_page_url || null,
          sac_name: formData.sac_name || null,
          sac_phone: formattedPhone,
          sac_email: formData.sac_email || null,
          image_url: formData.image_url || null,
          height_cm: formData.product_type === 'physical' ? (formData.height_cm || null) : null,
          width_cm: formData.product_type === 'physical' ? (formData.width_cm || null) : null,
          length_cm: formData.product_type === 'physical' ? (formData.length_cm || null) : null,
          weight_grams: formData.product_type === 'physical' ? (formData.weight_grams || null) : null,
        })
        .eq("id", id);

      if (!error) {
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 2000);
        
        // If delivery method is member_area, ensure course exists
        if (formData.delivery_method === "member_area" && product) {
          await ensureCourseExists(id, formData.name, product.user_id);
        }
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    }
  }, [id, product, formData]);

  // Debounced auto-save on form changes
  useEffect(() => {
    if (!product) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 1500); // Auto-save after 1.5 seconds of no changes

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, performAutoSave, product]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProduct(data as Product);
    } catch (error) {
      console.error("Error fetching product:", error);
      toast({
        title: "Erro ao carregar produto",
        description: "Não foi possível carregar os dados do produto.",
        variant: "destructive",
      });
      navigate("/dashboard/produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${id}-${Date.now()}.${fileExt}`;
      const filePath = `products/${id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, image_url: publicUrl }));

      toast({
        title: "Imagem enviada!",
        description: "A imagem do produto foi atualizada.",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Erro ao enviar imagem",
        description: "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;

    // Limpa erros anteriores PRIMEIRO
    setPhoneError(null);
    setEmailError(null);
    setLogisticsErrors([]);

    // Validar campos antes de salvar
    let hasErrors = false;

    const cleanPhone = formData.sac_phone?.replace(/\D/g, "") || "";
    const cleanEmail = formData.sac_email?.trim() || "";

    // Debug log para verificar os valores
    console.log("Validação - Telefone limpo:", cleanPhone, "Tamanho:", cleanPhone.length);
    console.log("Validação - Email limpo:", cleanEmail);

    // Só valida telefone se tiver dígitos
    if (cleanPhone.length > 0 && cleanPhone.length < 10) {
      setPhoneError("Telefone inválido. Use formato: (XX) XXXXX-XXXX");
      hasErrors = true;
      console.log("Erro de telefone detectado");
    }

    // Só valida email se não estiver vazio
    if (cleanEmail.length > 0 && !validateEmail(cleanEmail)) {
      setEmailError("Email inválido");
      hasErrors = true;
      console.log("Erro de email detectado");
    }

    // Validar campos de logística para produtos físicos
    if (formData.product_type === 'physical') {
      const logisticsResult = validateLogisticsData({
        height_cm: formData.height_cm,
        width_cm: formData.width_cm,
        length_cm: formData.length_cm,
        weight_grams: formData.weight_grams,
      }, formData.product_type);

      if (!logisticsResult.valid) {
        setLogisticsErrors(logisticsResult.errors);
        hasErrors = true;
        console.log("Erro de logística detectado:", logisticsResult.errors);
      }
    }

    if (hasErrors) {
      toast({
        title: "Erro de validação",
        description: formData.product_type === 'physical' && logisticsErrors.length > 0 
          ? "Preencha todos os campos de logística corretamente."
          : "Corrija os campos inválidos antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      // Formatar telefone antes de salvar
      const formattedPhone = formData.sac_phone 
        ? formatBrazilianPhone(formData.sac_phone) 
        : null;

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          product_type: formData.product_type,
          category: formData.category,
          delivery_method: mapDeliveryMethodToDb(formData.delivery_method),
          payment_type: formData.payment_type,
          price: formData.price,
          sales_page_url: formData.sales_page_url || null,
          sac_name: formData.sac_name || null,
          sac_phone: formattedPhone,
          sac_email: formData.sac_email || null,
          image_url: formData.image_url || null,
          height_cm: formData.product_type === 'physical' ? (formData.height_cm || null) : null,
          width_cm: formData.product_type === 'physical' ? (formData.width_cm || null) : null,
          length_cm: formData.product_type === 'physical' ? (formData.length_cm || null) : null,
          weight_grams: formData.product_type === 'physical' ? (formData.weight_grams || null) : null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Produto salvo!",
        description: "As alterações foram salvas com sucesso.",
      });

      fetchProduct();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo exceto números
    const rawValue = e.target.value.replace(/\D/g, "");
    
    // Converte para centavos e depois para reais
    const numericValue = parseInt(rawValue, 10) || 0;
    const priceInReais = numericValue / 100;
    
    setFormData(prev => ({ ...prev, price: priceInReais }));
  };

  const formatPriceForInput = (price: number) => {
    return price.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!product) {
    return null;
  }

  const descriptionLength = formData.description?.length || 0;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0d1117]">
        {/* Hidden file input */}
        <input
          type="file"
          ref={imageInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleImageUpload}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard/produtos")}
              className="h-10 w-10 text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white">{formData.name || "Novo Produto"}</h1>
              {product?.status === "draft" && (
                <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium border border-yellow-500/30">
                  Rascunho
                </span>
              )}
              {product?.status === "active" && (
                <span className="px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium border border-green-500/30">
                  Ativo
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {product?.status === "draft" && (
              <Button 
                onClick={async () => {
                  // Validar campos obrigatórios antes de publicar
                  const missingFields: string[] = [];
                  
                  if (!formData.name || formData.name.trim() === "") {
                    missingFields.push("Nome do produto");
                  }
                  if (!formData.price || formData.price <= 0) {
                    missingFields.push("Preço");
                  }
                  if (!formData.sac_name || formData.sac_name.trim() === "") {
                    missingFields.push("Nome de exibição (Suporte)");
                  }
                  if (!formData.sac_phone || formData.sac_phone.trim() === "") {
                    missingFields.push("WhatsApp (Suporte)");
                  }
                  if (!formData.sac_email || formData.sac_email.trim() === "") {
                    missingFields.push("Email de suporte");
                  }
                  
                  // Validar formato do telefone
                  if (formData.sac_phone && !validateBrazilianPhone(formData.sac_phone)) {
                    toast({
                      title: "Telefone inválido",
                      description: "Use o formato: (XX) XXXXX-XXXX",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validar formato do email
                  if (formData.sac_email && !validateEmail(formData.sac_email)) {
                    toast({
                      title: "Email inválido",
                      description: "Digite um email válido para suporte.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  if (missingFields.length > 0) {
                    toast({
                      title: "Campos obrigatórios",
                      description: `Preencha os seguintes campos: ${missingFields.join(", ")}`,
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  try {
                    setSaving(true);
                    await supabase.from("products").update({ status: "active" }).eq("id", id);
                    toast({ title: "Produto publicado!", description: "Seu produto está ativo e disponível para venda." });
                    fetchProduct();
                  } catch (error) {
                    toast({ title: "Erro ao publicar", variant: "destructive" });
                  } finally {
                    setSaving(false);
                  }
                }} 
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-6"
              >
                Publicar Produto
              </Button>
            )}
            {autoSaved && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <Check className="w-4 h-4" />
                <span>Salvo automaticamente</span>
              </div>
            )}
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 hidden sm:flex"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar mudanças
            </Button>
            
            {/* Mobile 3-dots menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-white">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-secondary border-border">
                <DropdownMenuItem 
                  onClick={handleSave}
                  className="cursor-pointer"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Salvar mudanças
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    if (product?.slug) {
                      navigator.clipboard.writeText(`${window.location.origin}/checkout/${product.slug}`);
                      toast({ title: "Link copiado!", description: "O link do checkout foi copiado." });
                    }
                  }}
                  className="cursor-pointer"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar link do checkout
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    if (product?.slug) {
                      window.open(`/checkout/${product.slug}`, '_blank');
                    }
                  }}
                  className="cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ver checkout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Tabs - Modern Navigation */}
        <Tabs defaultValue="produto" className="w-full">
          <div className="bg-secondary/50 rounded-xl p-1.5 mb-6 overflow-x-auto scrollbar-hide">
            <TabsList className="bg-transparent rounded-lg w-full justify-start h-auto p-0 gap-1 flex-nowrap min-w-max">
              <TabsTrigger 
                value="produto" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Produto
              </TabsTrigger>
              <TabsTrigger 
                value="area-membros" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                <GraduationCap className="w-4 h-4 mr-1.5" />
                Área de Membros
              </TabsTrigger>
              <TabsTrigger 
                value="checkout" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Checkout
              </TabsTrigger>
              <TabsTrigger 
                value="order-bump" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Order Bump
              </TabsTrigger>
              <TabsTrigger 
                value="upsell-downsell" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Upsell / Downsell
              </TabsTrigger>
              <TabsTrigger 
                value="links" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Links
              </TabsTrigger>
              <TabsTrigger 
                value="campanhas" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Campanhas
              </TabsTrigger>
              <TabsTrigger 
                value="provas-sociais" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Provas sociais
              </TabsTrigger>
              <TabsTrigger 
                value="entregaveis" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Entregáveis
              </TabsTrigger>
              <TabsTrigger 
                value="configuracoes" 
                className="rounded-lg border-0 bg-transparent data-[state=active]:bg-accent data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-accent/25 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-4 py-2.5 text-sm font-medium transition-all duration-200"
              >
                Configurações
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Produto Tab Content */}
          <TabsContent value="produto" className="mt-0 space-y-6">
            
            {/* Section 1: Informações do Produto */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Informações do Produto</h2>
                    <p className="text-sm text-muted-foreground">Dados principais que identificam seu produto</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <div 
                      className="relative w-40 h-40 bg-muted/50 border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-all group"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {formData.image_url ? (
                        <>
                          <img 
                            src={formData.image_url} 
                            alt={formData.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="text-center text-white">
                              <ImageIcon className="w-6 h-6 mx-auto mb-1" />
                              <span className="text-xs font-medium">Alterar imagem</span>
                            </div>
                          </div>
                        </>
                      ) : uploadingImage ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                          <Upload className="w-8 h-8 mb-2" />
                          <span className="text-xs font-medium">Enviar imagem</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      Recomendado: 248×248px
                    </p>
                  </div>

                  {/* Product Info Fields */}
                  <div className="flex-1 space-y-5">
                    <div>
                      <Label className="text-foreground font-medium mb-2 block">
                        Nome do produto <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-muted/30 border-border text-foreground h-11 text-base"
                        placeholder="Ex: Curso de Marketing Digital"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-foreground font-medium">Descrição do produto</Label>
                        <span className={`text-xs ${descriptionLength > 450 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {descriptionLength}/500
                        </span>
                      </div>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => {
                          if (e.target.value.length <= 500) {
                            setFormData(prev => ({ ...prev, description: e.target.value }));
                          }
                        }}
                        className="bg-muted/30 border-border text-foreground min-h-[100px] resize-none"
                        placeholder="Descreva seu produto de forma clara e objetiva..."
                        maxLength={500}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Preço e Pagamento */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Preço e Pagamento</h2>
                    <p className="text-sm text-muted-foreground">Configure o valor e tipo de cobrança</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <Label className="text-foreground font-medium mb-2 block">Tipo de Produto</Label>
                    <Select 
                      value={formData.product_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, product_type: value }))}
                    >
                      <SelectTrigger className="bg-muted/30 border-border text-foreground h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {productTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="text-foreground">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 block">Categoria</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="bg-muted/30 border-border text-foreground h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value} className="text-foreground">
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 block">
                      Preço <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={formatPriceForInput(formData.price)}
                        onChange={handlePriceChange}
                        className="bg-muted/30 border-border text-foreground h-11 text-lg font-semibold"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 block">Página de vendas</Label>
                    <Input
                      value={formData.sales_page_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, sales_page_url: e.target.value }))}
                      className="bg-muted/30 border-border text-foreground h-11"
                      placeholder="https://seusite.com"
                    />
                  </div>
                </div>

                {/* Payment Type Section */}
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Tipo de Cobrança</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    {paymentTypes.map((type) => {
                      const isActive = formData.payment_type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, payment_type: type.value }))}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                            isActive 
                              ? 'bg-primary/10 border-primary text-primary' 
                              : 'bg-muted/20 border-border text-muted-foreground hover:border-muted-foreground/50'
                          }`}
                        >
                          {isActive && <CheckCircle2 className="w-4 h-4" />}
                          <span className="font-medium">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section: Logística (only for physical products) */}
            {formData.product_type === 'physical' && (
              <Card className="bg-card border-border overflow-hidden">
                <div className="bg-muted/30 px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Truck className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Logística</h2>
                      <p className="text-sm text-muted-foreground">Dimensões e peso do produto para cálculo de frete</p>
                    </div>
                  </div>
                </div>
                
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        Altura (cm) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={formData.height_cm || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value >= 0) {
                              setFormData(prev => ({ ...prev, height_cm: value }));
                              // Clear error for this field on change
                              setLogisticsErrors(prev => prev.filter(err => err.field !== 'height_cm'));
                            }
                          }}
                          className={`bg-muted/30 border-border text-foreground h-11 ${
                            getFieldError(logisticsErrors, 'height_cm') ? 'border-destructive' : ''
                          }`}
                          placeholder="Ex: 15"
                        />
                        {getFieldError(logisticsErrors, 'height_cm') && (
                          <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                            <AlertCircle className="w-3 h-3" />
                            {getFieldError(logisticsErrors, 'height_cm')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        Largura (cm) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={formData.width_cm || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value >= 0) {
                              setFormData(prev => ({ ...prev, width_cm: value }));
                              setLogisticsErrors(prev => prev.filter(err => err.field !== 'width_cm'));
                            }
                          }}
                          className={`bg-muted/30 border-border text-foreground h-11 ${
                            getFieldError(logisticsErrors, 'width_cm') ? 'border-destructive' : ''
                          }`}
                          placeholder="Ex: 20"
                        />
                        {getFieldError(logisticsErrors, 'width_cm') && (
                          <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                            <AlertCircle className="w-3 h-3" />
                            {getFieldError(logisticsErrors, 'width_cm')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-muted-foreground" />
                        Comprimento (cm) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={formData.length_cm || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value >= 0) {
                              setFormData(prev => ({ ...prev, length_cm: value }));
                              setLogisticsErrors(prev => prev.filter(err => err.field !== 'length_cm'));
                            }
                          }}
                          className={`bg-muted/30 border-border text-foreground h-11 ${
                            getFieldError(logisticsErrors, 'length_cm') ? 'border-destructive' : ''
                          }`}
                          placeholder="Ex: 30"
                        />
                        {getFieldError(logisticsErrors, 'length_cm') && (
                          <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                            <AlertCircle className="w-3 h-3" />
                            {getFieldError(logisticsErrors, 'length_cm')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Scale className="w-4 h-4 text-muted-foreground" />
                        Peso (gramas) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={formData.weight_grams || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value >= 0) {
                              setFormData(prev => ({ ...prev, weight_grams: value }));
                              setLogisticsErrors(prev => prev.filter(err => err.field !== 'weight_grams'));
                            }
                          }}
                          className={`bg-muted/30 border-border text-foreground h-11 ${
                            getFieldError(logisticsErrors, 'weight_grams') ? 'border-destructive' : ''
                          }`}
                          placeholder="Ex: 500"
                        />
                        {getFieldError(logisticsErrors, 'weight_grams') && (
                          <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                            <AlertCircle className="w-3 h-3" />
                            {getFieldError(logisticsErrors, 'weight_grams')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Error summary for dimensions total */}
                  {getFieldError(logisticsErrors, 'dimensions') && (
                    <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {getFieldError(logisticsErrors, 'dimensions')}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-muted/20 rounded-lg border border-border">
                    <div className="flex items-start gap-3">
                      <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        As dimensões e peso são utilizados para calcular o custo de frete do produto. 
                        Certifique-se de informar valores precisos para evitar problemas na entrega.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 3: Suporte ao Comprador */}
            <Card className="bg-card border-border overflow-hidden">
              <div className="bg-muted/30 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Headphones className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Suporte ao Comprador</h2>
                    <p className="text-sm text-muted-foreground">Informações de contato visíveis para seus clientes</p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      Nome de exibição <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.sac_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, sac_name: e.target.value }))}
                      className="bg-muted/30 border-border text-foreground h-11"
                      placeholder="Seu nome ou empresa"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-green-500" />
                      WhatsApp <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={formData.sac_phone}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData(prev => ({ ...prev, sac_phone: value }));
                          
                          if (value && !validateBrazilianPhone(value)) {
                            setPhoneError("Telefone inválido. Use formato: (XX) XXXXX-XXXX");
                          } else {
                            setPhoneError(null);
                          }
                        }}
                        onBlur={() => {
                          if (formData.sac_phone && validateBrazilianPhone(formData.sac_phone)) {
                            const formatted = formatBrazilianPhone(formData.sac_phone);
                            setFormData(prev => ({ ...prev, sac_phone: formatted }));
                          }
                        }}
                        className={`bg-muted/30 border-border text-foreground h-11 ${phoneError ? 'border-destructive' : ''}`}
                        placeholder="(11) 99999-9999"
                      />
                      {phoneError && (
                        <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                          <AlertCircle className="w-3 h-3" />
                          {phoneError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      Email de suporte <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        value={formData.sac_email}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData(prev => ({ ...prev, sac_email: value }));
                          
                          if (value && !validateEmail(value)) {
                            setEmailError("Email inválido");
                          } else {
                            setEmailError(null);
                          }
                        }}
                        className={`bg-muted/30 border-border text-foreground h-11 ${emailError ? 'border-destructive' : ''}`}
                        placeholder="suporte@exemplo.com"
                      />
                      {emailError && (
                        <div className="flex items-center gap-1 mt-2 text-destructive text-xs">
                          <AlertCircle className="w-3 h-3" />
                          {emailError}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-muted/20 rounded-lg border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Estas informações serão exibidas no checkout e nos emails enviados ao comprador.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Método de Entrega */}
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-6">
                <DeliveryMethodSelector
                  value={formData.delivery_method as DeliveryMethod}
                  onChange={(value) => setFormData(prev => ({ ...prev, delivery_method: value }))}
                  paymentType={formData.payment_type}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Área de Membros Tab Content */}
          <TabsContent value="area-membros" className="mt-0">
            <MemberAreaManager 
              productId={product.id}
              productName={formData.name}
              sellerId={product.user_id}
              deliveryMethod={formData.delivery_method}
            />
          </TabsContent>

          {/* Checkout Tab Content */}
          <TabsContent value="checkout" className="mt-0">
            <CheckoutEditor productId={product.id} />
          </TabsContent>

          {/* Order Bump Tab Content */}
          <TabsContent value="order-bump" className="mt-0">
            <OrderBumpTab productId={product.id} />
          </TabsContent>

          {/* Upsell/Downsell Tab Content */}
          <TabsContent value="upsell-downsell" className="mt-0">
            <UpsellDownsellTab productId={product.id} />
          </TabsContent>


          {/* Links Tab Content */}
          <TabsContent value="links" className="mt-0">
            <LinksTab 
              productId={product.id} 
              productPrice={formData.price} 
              productName={formData.name}
              productSlug={product.slug}
              onSlugUpdate={(newSlug) => {
                setProduct(prev => prev ? { ...prev, slug: newSlug || null } : null);
              }}
              sacName={product.sac_name}
              sacPhone={product.sac_phone}
              sacEmail={product.sac_email}
            />
          </TabsContent>

          {/* Campanhas Tab Content */}
          <TabsContent value="campanhas" className="mt-0">
            <CampanhasTab productId={product.id} />
          </TabsContent>


          {/* Provas sociais Tab Content */}
          <TabsContent value="provas-sociais" className="mt-0">
            <ProvasSociaisTab productId={product.id} />
          </TabsContent>

          {/* Entregáveis Tab Content */}
          <TabsContent value="entregaveis" className="mt-0">
            <EntregaveisTab productId={product.id} />
          </TabsContent>

          {/* Configurações gerais Tab Content */}
          <TabsContent value="configuracoes" className="mt-0">
            <ConfiguracoesTab productId={product.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProdutoGerenciar;
