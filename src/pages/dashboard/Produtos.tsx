import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Plus, Search, Monitor, Box, ChevronRight, Loader2, MoreVertical, Edit, Trash2, Eye, Users, Tag, ShoppingBag, Link, Copy, ExternalLink, Calendar, MousePointerClick, TrendingUp, Check, XCircle, CreditCard, QrCode, Receipt, DollarSign, Store, CheckCircle2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const productCategories = {
  digital: [
    "Curso Online",
    "E-book",
    "Software",
    "Template",
    "Música",
    "Arte Digital",
    "Mentoria",
    "Assinatura",
    "Podcast",
    "Webinar",
    "Planilha",
    "Plugin",
    "Aplicativo",
    "Comunidade",
    "Consultoria",
    "Treinamento",
  ],
  physical: [
    "Eletrônicos",
    "Roupas",
    "Acessórios",
    "Livros",
    "Casa e Decoração",
    "Esportes",
    "Beleza",
    "Saúde",
    "Alimentos",
    "Bebidas",
    "Brinquedos",
    "Artesanato",
    "Joias",
    "Calçados",
    "Pet",
    "Outros",
  ],
};

const paymentTypes = [
  { value: "one_time", label: "Pagamento Único" },
  { value: "subscription", label: "Assinatura Recorrente" },
];

const deliveryMethods = {
  digital: [
    { value: "member_area", label: "Área de Membros da Plataforma" },
    { value: "email", label: "Envio por E-mail" },
    { value: "download", label: "Download Direto" },
  ],
  physical: [
    { value: "shipping", label: "Envio pelos Correios" },
  ],
};

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
  sac_email: string | null;
  weight: number | null;
  stock: number | null;
  status: string;
  created_at: string;
  image_url: string | null;
  commission_percentage?: number | null;
  affiliate_auto_approve?: boolean | null;
  sales_count?: number;
}

interface AffiliatedProduct extends Product {
  affiliation_id: string;
  affiliation_status: string;
  affiliation_created_at: string;
  producer_name?: string;
  clicks_count?: number;
  total_sales?: number;
  total_commission?: number;
  sales_count?: number;
}

interface CoProducerProduct extends Product {
  coproducer_id: string;
  coproducer_commission: number;
  coproducer_status: string;
  producer_name?: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  paymentType: string;
  deliveryMethod: string;
  marketplaceEnabled: boolean;
  salesPageUrl: string;
  sacName: string;
  sacEmail: string;
  weight: string;
  stock: string;
  commissionPercentage: string;
  affiliateAutoApprove: boolean;
}

const initialFormData: ProductFormData = {
  name: "",
  description: "",
  price: "",
  category: "",
  paymentType: "one_time",
  deliveryMethod: "",
  marketplaceEnabled: false,
  salesPageUrl: "",
  sacName: "",
  sacEmail: "",
  weight: "",
  stock: "",
  commissionPercentage: "30",
  affiliateAutoApprove: true,
};

const Produtos = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const action = searchParams.get("action");
  const [isNewProductOpen, setIsNewProductOpen] = useState(action === "new-digital");
  const [searchQuery, setSearchQuery] = useState("");
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState("all");
  const [productType, setProductType] = useState<"digital" | "physical" | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [affiliatedProducts, setAffiliatedProducts] = useState<AffiliatedProduct[]>([]);
  const [coProducerProducts, setCoProducerProducts] = useState<CoProducerProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingAffiliated, setLoadingAffiliated] = useState(true);
  const [loadingCoProducer, setLoadingCoProducer] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<{
    pix_enabled: boolean;
    credit_card_enabled: boolean;
    boleto_enabled: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Get current user ID securely (removed insecure impersonation)
  const getEffectiveUserId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  };

  useEffect(() => {
    fetchProducts();
    fetchAffiliatedProducts();
    fetchCoProducerProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) {
        setLoadingProducts(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch sales count for each product (includes pending and approved sales)
      const productIds = data?.map(p => p.id) || [];
      const { data: salesData } = await supabase
        .from("sales")
        .select("product_id, status")
        .in("product_id", productIds)
        .in("status", ["completed", "approved", "paid", "pending", "waiting_payment", "in_analysis", "authorized"]);

      const productsWithSales = data?.map(p => ({
        ...p,
        sales_count: salesData?.filter(s => s.product_id === p.id).length || 0,
      })) || [];

      setProducts(productsWithSales as Product[]);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchAffiliatedProducts = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) {
        setLoadingAffiliated(false);
        return;
      }

      // Fetch user's affiliations
      const { data: affiliations, error: affError } = await supabase
        .from("affiliations")
        .select("id, product_id, status, created_at")
        .eq("user_id", userId);

      if (affError) throw affError;

      if (affiliations && affiliations.length > 0) {
        // Fetch product details for each affiliation
        const productIds = affiliations.map(a => a.product_id);
        const { data: productsData, error: prodError } = await supabase
          .from("products")
          .select("*, user_id")
          .in("id", productIds);

        if (prodError) throw prodError;

        // Fetch producer profiles
        const producerIds = [...new Set(productsData?.map(p => p.user_id) || [])];
        const { data: producerProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", producerIds);

        // Fetch clicks and sales for each affiliation
        const affiliatedWithDetails = await Promise.all(
          affiliations.map(async (aff) => {
            const product = productsData?.find(p => p.id === aff.product_id);
            if (!product) return null;

            const producerProfile = producerProfiles?.find(p => p.user_id === product.user_id);

            // Fetch clicks count
            const { count: clicksCount } = await supabase
              .from("affiliate_clicks")
              .select("*", { count: "exact", head: true })
              .eq("affiliation_id", aff.id);

            // Fetch sales data
            const { data: salesData } = await supabase
              .from("affiliate_sales")
              .select("sale_amount, commission_amount")
              .eq("affiliation_id", aff.id);

            const totalSales = salesData?.reduce((sum, s) => sum + Number(s.sale_amount), 0) || 0;
            const totalCommission = salesData?.reduce((sum, s) => sum + Number(s.commission_amount), 0) || 0;
            const salesCount = salesData?.length || 0;

            return {
              ...product,
              affiliation_id: aff.id,
              affiliation_status: aff.status,
              affiliation_created_at: aff.created_at,
              producer_name: producerProfile?.full_name || "Produtor",
              clicks_count: clicksCount || 0,
              total_sales: totalSales,
              total_commission: totalCommission,
              sales_count: salesCount,
            } as AffiliatedProduct;
          })
        );

        setAffiliatedProducts(affiliatedWithDetails.filter(Boolean) as AffiliatedProduct[]);
      }
    } catch (error) {
      console.error("Error fetching affiliated products:", error);
    } finally {
      setLoadingAffiliated(false);
    }
  };

  const fetchCoProducerProducts = async () => {
    try {
      const userId = await getEffectiveUserId();
      if (!userId) {
        setLoadingCoProducer(false);
        return;
      }

      // Fetch user's co-productions
      const { data: coProductions, error: cpError } = await supabase
        .from("co_producers")
        .select("id, product_id, commission_percentage, status")
        .eq("user_id", userId);

      if (cpError) throw cpError;

      if (coProductions && coProductions.length > 0) {
        const productIds = coProductions.map(cp => cp.product_id);
        const { data: productsData, error: prodError } = await supabase
          .from("products")
          .select("*, user_id")
          .in("id", productIds);

        if (prodError) throw prodError;

        // Fetch producer profiles
        const producerIds = [...new Set(productsData?.map(p => p.user_id) || [])];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", producerIds);

        const coProducerWithDetails = coProductions.map(cp => {
          const product = productsData?.find(p => p.id === cp.product_id);
          const producerProfile = profiles?.find(pr => pr.user_id === product?.user_id);
          return product ? {
            ...product,
            coproducer_id: cp.id,
            coproducer_commission: cp.commission_percentage,
            coproducer_status: cp.status,
            producer_name: producerProfile?.full_name || "Produtor",
          } as CoProducerProduct : null;
        }).filter(Boolean) as CoProducerProduct[];

        setCoProducerProducts(coProducerWithDetails);
      } else {
        setCoProducerProducts([]);
      }
    } catch (error) {
      console.error("Error fetching co-producer products:", error);
    } finally {
      setLoadingCoProducer(false);
    }
  };

  const handleAcceptCoproduction = async (coproducerId: string) => {
    try {
      const { error } = await supabase
        .from("co_producers")
        .update({ status: "active" })
        .eq("id", coproducerId);

      if (error) throw error;
      toast({ title: "Convite aceito!", description: "Você agora é coprodutor deste produto." });
      fetchCoProducerProducts();
    } catch (error) {
      console.error("Error accepting coproduction:", error);
      toast({ title: "Erro", description: "Não foi possível aceitar o convite.", variant: "destructive" });
    }
  };

  const handleRejectCoproduction = async (coproducerId: string) => {
    try {
      const { error } = await supabase
        .from("co_producers")
        .delete()
        .eq("id", coproducerId);

      if (error) throw error;
      toast({ title: "Convite recusado", description: "O convite de coprodução foi recusado." });
      fetchCoProducerProducts();
    } catch (error) {
      console.error("Error rejecting coproduction:", error);
      toast({ title: "Erro", description: "Não foi possível recusar o convite.", variant: "destructive" });
    }
  };

  const uploadImage = async (file: File, userId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // New simplified product creation - creates product immediately and redirects
  const handleQuickCreateProduct = async (type: "digital" | "physical") => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para criar um produto.",
          variant: "destructive",
        });
        return;
      }

      // Create minimal product in draft state
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          name: type === "digital" ? "Novo Produto Digital" : "Novo Produto Físico",
          description: null,
          price: 0,
          product_type: type,
          category: type === "digital" ? "Curso Online" : "Outros",
          payment_type: "one_time",
          delivery_method: null,
          marketplace_enabled: false,
          status: "draft", // Start as draft
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Produto criado!",
        description: "Complete as informações do seu produto.",
      });
      
      setIsNewProductOpen(false);
      
      // Redirect to product edit page
      navigate(`/dashboard/produtos/${newProduct.id}`);
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast({
        title: "Erro ao criar produto",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string, salesCount: number, productName: string) => {
    // Block deletion if product has sales
    if (salesCount > 0) {
      // Log the deletion attempt
      try {
        const userId = await getEffectiveUserId();
        if (userId) {
          await supabase.from("product_deletion_logs").insert({
            product_id: id,
            user_id: userId,
            product_name: productName,
            sales_count: salesCount,
            blocked_reason: "Produto possui vendas registradas ou pendentes",
          });
        }
      } catch (logError) {
        console.error("Error logging deletion attempt:", logError);
      }

      toast({
        title: "Exclusão bloqueada",
        description: "Este produto não pode ser excluído porque possui vendas registradas ou pendentes. Para preservar a integridade dos dados e o histórico de compradores, apenas edição é permitida.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      
      toast({
        title: "Produto excluído",
        description: "O produto foi removido com sucesso.",
      });
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleOpenDialog = () => {
    setProductType(null);
    setFormData(initialFormData);
    setImageFile(null);
    setImagePreview(null);
    setIsNewProductOpen(true);
  };

  const handleViewProduct = async (product: Product) => {
    setSelectedProduct(product);
    setCheckoutSettings(null);
    setIsViewDialogOpen(true);
    
    // Fetch checkout settings for this product
    try {
      const { data, error } = await supabase
        .from("checkout_settings")
        .select("pix_enabled, credit_card_enabled, boleto_enabled")
        .eq("product_id", product.id)
        .maybeSingle();
      
      if (!error && data) {
        setCheckoutSettings({
          pix_enabled: data.pix_enabled ?? true,
          credit_card_enabled: data.credit_card_enabled ?? true,
          boleto_enabled: data.boleto_enabled ?? false,
        });
      } else {
        // Default settings if no checkout_settings exist
        setCheckoutSettings({
          pix_enabled: true,
          credit_card_enabled: true,
          boleto_enabled: false,
        });
      }
    } catch (error) {
      console.error("Error fetching checkout settings:", error);
      setCheckoutSettings({
        pix_enabled: true,
        credit_card_enabled: true,
        boleto_enabled: false,
      });
    }
  };

  const handleEditProduct = (product: Product) => {
    navigate(`/dashboard/produtos/${product.id}`);
  };

  const updateFormData = (field: keyof ProductFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus Produtos</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie seus produtos digitais e físicos
            </p>
          </div>
          
          <Button onClick={handleOpenDialog} className="gap-2 bg-accent hover:bg-accent/90">
            <Plus className="w-4 h-4" />
            CRIAR PRODUTO
          </Button>
        </div>

        {/* Create Product Dialog - Simplified */}
        <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
          <DialogContent className="max-w-md bg-card border-border/50">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Escolha o tipo de produto
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Selecione uma opção para criar seu produto
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <button
                onClick={() => handleQuickCreateProduct("digital")}
                disabled={isLoading}
                className="group relative p-6 rounded-xl border-2 border-border/50 bg-gradient-to-br from-accent/5 to-transparent hover:border-accent/50 hover:from-accent/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-4 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    ) : (
                      <Monitor className="w-8 h-8 text-accent" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Produto Digital</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cursos, e-books, software, templates
                    </p>
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => handleQuickCreateProduct("physical")}
                disabled={isLoading}
                className="group relative p-6 rounded-xl border-2 border-border/50 bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/50 hover:from-purple-500/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-4 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    ) : (
                      <Box className="w-8 h-8 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Produto Físico</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Eletrônicos, roupas, acessórios
                    </p>
                  </div>
                </div>
                <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Product Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-xl bg-card border-border/50">
            <DialogHeader className="pb-0">
              <DialogTitle className="text-lg font-semibold text-muted-foreground">Detalhes do Produto</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-5">
                {/* Product Header with Image */}
                <div className="flex gap-4">
                  {selectedProduct.image_url ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border/50">
                      <img 
                        src={selectedProduct.image_url} 
                        alt={selectedProduct.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`w-20 h-20 rounded-xl flex-shrink-0 flex items-center justify-center ${selectedProduct.product_type === "digital" ? "bg-accent/10" : "bg-purple-500/10"}`}>
                      {selectedProduct.product_type === "digital" ? (
                        <Monitor className="w-8 h-8 text-accent" />
                      ) : (
                        <Box className="w-8 h-8 text-purple-500" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground truncate">{selectedProduct.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge className="bg-accent/20 text-accent border-0 text-xs font-medium">
                        {selectedProduct.category}
                      </Badge>
                      <Badge 
                        className={`text-xs font-medium ${
                          selectedProduct.status === "active" 
                            ? "bg-green-500/15 text-green-400 border-green-500/30" 
                            : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {selectedProduct.status === "active" ? "Ativo" : "Rascunho"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>
                )}

                {/* Price Card */}
                <div className="bg-gradient-to-r from-accent/10 to-accent/5 rounded-xl p-4 border border-accent/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-accent/20">
                        <DollarSign className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Preço de venda</span>
                        <span className="text-2xl font-bold text-accent">{formatCurrency(Number(selectedProduct.price))}</span>
                      </div>
                    </div>
                    <Badge className="bg-accent/20 text-accent border-accent/30 text-xs">
                      {selectedProduct.product_type === "digital" ? "Digital" : "Físico"}
                    </Badge>
                  </div>
                </div>

                {/* Payment Method Section */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Meio de Pagamento</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Payment Type - Always active */}
                    <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Receipt className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">
                          {paymentTypes.find(p => p.value === selectedProduct.payment_type)?.label || "Pagamento Único"}
                        </span>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    
                    {/* PIX */}
                    {checkoutSettings?.pix_enabled ? (
                      <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <QrCode className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">PIX</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3 border border-border/30 opacity-60">
                        <div className="p-2 rounded-lg bg-muted">
                          <QrCode className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">PIX</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Inativo</span>
                      </div>
                    )}
                    
                    {/* Credit Card */}
                    {checkoutSettings?.credit_card_enabled ? (
                      <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <CreditCard className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">Cartão de Crédito</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3 border border-border/30 opacity-60">
                        <div className="p-2 rounded-lg bg-muted">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">Cartão de Crédito</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Inativo</span>
                      </div>
                    )}
                    
                    {/* Boleto */}
                    {checkoutSettings?.boleto_enabled ? (
                      <div className="flex items-center gap-3 bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <Receipt className="w-4 h-4 text-green-400" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-foreground">Boleto</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3 border border-border/30 opacity-60">
                        <div className="p-2 rounded-lg bg-muted">
                          <Receipt className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm text-muted-foreground">Boleto</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Inativo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Marketplace</span>
                    </div>
                    <span className={`text-sm font-semibold ${selectedProduct.marketplace_enabled ? "text-green-400" : "text-muted-foreground"}`}>
                      {selectedProduct.marketplace_enabled ? "Habilitado" : "Desabilitado"}
                    </span>
                  </div>
                  
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Afiliados</span>
                    </div>
                    <span className={`text-sm font-semibold ${selectedProduct.commission_percentage ? "text-accent" : "text-muted-foreground"}`}>
                      {selectedProduct.commission_percentage 
                        ? `${selectedProduct.commission_percentage}% comissão` 
                        : "Não habilitado"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>


        {/* Tabs */}
        <Tabs defaultValue="meus-produtos" className="w-full">
          <TabsList className="bg-transparent border-b border-border/30 rounded-none w-full justify-start h-auto p-0 gap-0">
            <TabsTrigger 
              value="meus-produtos" 
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent px-4 py-3 text-sm font-medium"
            >
              MEUS PRODUTOS
              {products.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground text-xs">
                  {products.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="co-produtor" 
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent px-4 py-3 text-sm font-medium"
            >
              COMO CO-PRODUTOR
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${coProducerProducts.length > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {coProducerProducts.length}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="afiliado" 
              className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-accent px-4 py-3 text-sm font-medium"
            >
              COMO AFILIADO
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${affiliatedProducts.length > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                {affiliatedProducts.length}
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <div className="flex gap-3 mt-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Pesquisar por: título ou id do produto" 
                className="bg-secondary/30 border-border/30 pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <Button 
              className="bg-accent hover:bg-accent/90 px-6"
              onClick={() => {
                // A pesquisa já é feita em tempo real via filteredProducts
                // Este botão reforça a ação visualmente
                toast({
                  title: searchQuery ? `Buscando: "${searchQuery}"` : "Digite algo para pesquisar",
                  description: searchQuery ? `${filteredProducts.length} produto(s) encontrado(s)` : "",
                });
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              PESQUISAR
            </Button>
          </div>

          <TabsContent value="meus-produtos" className="mt-6">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="bg-card border-border/30 hover:border-accent/30 transition-all overflow-hidden">
                    <CardContent className="p-0">
                      {/* Header with image and title */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start gap-3">
                          {product.image_url ? (
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className={`p-3 rounded-xl flex-shrink-0 ${product.product_type === "digital" ? "bg-accent/10" : "bg-purple-500/10"}`}>
                              {product.product_type === "digital" ? (
                                <Monitor className="w-7 h-7 text-accent" />
                              ) : (
                                <Box className="w-7 h-7 text-purple-500" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <h3 className="font-semibold text-foreground truncate max-w-[150px] sm:max-w-none">{product.name}</h3>
                                <Badge 
                                  variant="secondary" 
                                  className="mt-1.5 bg-accent/20 text-accent border-0 text-[10px] font-medium"
                                >
                                  {paymentTypes.find(p => p.value === product.payment_type)?.label || "Pagamento Único"}
                                </Badge>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-card border-border/50">
                                  <DropdownMenuItem 
                                    className="gap-2"
                                    onClick={() => handleViewProduct(product)}
                                  >
                                    <Eye className="w-4 h-4" />
                                    Visualizar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="gap-2"
                                    onClick={() => handleEditProduct(product)}
                                  >
                                    <Edit className="w-4 h-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  {(product.sales_count || 0) > 0 ? (
                                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed opacity-50" title="Este produto não pode ser excluído porque possui vendas registradas ou pendentes. Para preservar a integridade dos dados e o histórico de compradores, apenas edição é permitida.">
                                      <AlertCircle className="w-4 h-4" />
                                      Excluir
                                    </div>
                                  ) : (
                                    <DropdownMenuItem 
                                      className="gap-2 text-red-500 focus:text-red-500"
                                      onClick={() => handleDeleteProduct(product.id, product.sales_count || 0, product.name)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Excluir
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Stats Section */}
                      <div className="border-t border-border/30 bg-secondary/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-muted-foreground">Estatísticas gerais deste produto</span>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] font-medium ${
                              product.status === "active" 
                                ? "border-green-500/50 text-green-500 bg-green-500/10" 
                                : "border-yellow-500/50 text-yellow-500 bg-yellow-500/10"
                            }`}
                          >
                            {product.status === "active" ? "Ativo" : "Rascunho"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Users className="w-4 h-4" />
                              <span>Afiliados</span>
                            </div>
                            <span className="font-medium">0</span>
                          </div>
                          <div className="flex items-center justify-between text-sm border-t border-border/20 pt-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Tag className="w-4 h-4" />
                              <span>Ofertas</span>
                            </div>
                            <span className="font-medium">1</span>
                          </div>
                          <div className="flex items-center justify-between text-sm border-t border-border/20 pt-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <ShoppingBag className="w-4 h-4" />
                              <span>Orderbumps</span>
                            </div>
                            <span className="font-medium">0</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-accent/10 mb-4">
                    <Package className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
                    Comece criando seu primeiro produto para vender na plataforma Royal Pay.
                  </p>
                  <Button onClick={handleOpenDialog} className="gap-2 bg-accent hover:bg-accent/90">
                    <Plus className="w-4 h-4" />
                    Criar Primeiro Produto
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="co-produtor" className="mt-6">
            {loadingCoProducer ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : coProducerProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coProducerProducts.map((product) => (
                  <Card key={product.id} className="bg-gradient-to-br from-card/80 via-card/60 to-card/40 border-border/30 hover:border-purple-500/30 transition-all overflow-hidden backdrop-blur-sm">
                    <CardContent className="p-0">
                      {/* Pending Header */}
                      {product.coproducer_status === "pending" && (
                        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          <span className="text-xs text-yellow-500 font-medium">Convite pendente de confirmação</span>
                        </div>
                      )}
                      
                      <div className="p-4 pb-3">
                        <div className="flex items-start gap-3">
                          {product.image_url ? (
                            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className={`p-3 rounded-xl flex-shrink-0 ${product.product_type === "digital" ? "bg-accent/10" : "bg-purple-500/10"}`}>
                              {product.product_type === "digital" ? (
                                <Monitor className="w-7 h-7 text-accent" />
                              ) : (
                                <Box className="w-7 h-7 text-purple-500" />
                              )}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Por: {product.producer_name}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-0 text-[10px] font-medium">
                                Co-produtor
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-border/50 text-muted-foreground">
                                {product.product_type === "digital" ? "Digital" : "Físico"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{product.description}</p>
                        )}
                      </div>
                      
                      <div className="border-t border-border/30 bg-secondary/20 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-muted-foreground">Minha comissão</span>
                            <p className="font-semibold text-purple-400">{product.coproducer_commission}%</p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] font-medium ${
                            product.coproducer_status === "active" 
                              ? "border-green-500/50 text-green-500 bg-green-500/10" 
                              : "border-yellow-500/50 text-yellow-500 bg-yellow-500/10"
                          }`}>
                            {product.coproducer_status === "active" ? "Ativo" : "Pendente"}
                          </Badge>
                        </div>
                        
                        {/* Accept/Reject buttons for pending invites */}
                        {product.coproducer_status === "pending" && (
                          <div className="flex gap-2 mt-4 pt-3 border-t border-border/30">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleAcceptCoproduction(product.coproducer_id)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                              onClick={() => handleRejectCoproduction(product.coproducer_id)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-muted/30 mb-4">
                    <Users className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma coprodução</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md">
                    Você ainda não é coprodutor de nenhum produto. Quando um produtor convidar você, o convite aparecerá aqui.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="afiliado" className="mt-6 space-y-6">
            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Pesquisar produto..." 
                  className="pl-10 bg-card/50 border-border/30"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={affiliateStatusFilter} onValueChange={setAffiliateStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px] bg-card/50 border-border/30">
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loadingAffiliated ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : affiliatedProducts.length > 0 ? (
              <div className="space-y-4">
                {affiliatedProducts
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .filter(p => affiliateStatusFilter === "all" || p.affiliation_status === affiliateStatusFilter)
                  .map((product) => {
                    const commissionValue = (Number(product.price) * (product.commission_percentage || 0)) / 100;
                    const affiliateLink = `${window.location.origin}/p/${product.id.substring(0, 8)}?ref=${product.affiliation_id.substring(0, 8)}`;
                    const isPending = product.affiliation_status === "pending";
                  
                  return (
                    <Card key={product.id} className="bg-gradient-to-br from-card/80 via-card/60 to-card/40 border-border/30 overflow-hidden backdrop-blur-sm shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 transition-all duration-300">
                      {/* Pending Header Bar */}
                      {isPending && (
                        <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                          <span className="text-xs text-yellow-500 font-medium">Aguardando aprovação do produtor</span>
                        </div>
                      )}
                      
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Product Info */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {product.image_url ? (
                              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/30">
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${product.product_type === "digital" ? "bg-accent/10" : "bg-purple-500/10"}`}>
                                {product.product_type === "digital" ? (
                                  <Monitor className="w-6 h-6 text-accent" />
                                ) : (
                                  <Box className="w-6 h-6 text-purple-500" />
                                )}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground">{product.name}</h3>
                                <Badge variant={isPending ? "secondary" : "default"} className={isPending ? "bg-yellow-500/20 text-yellow-500 border-0" : "bg-green-500/20 text-green-500 border-0"}>
                                  {isPending ? "Pendente" : "Ativo"}
                                </Badge>
                                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                                  {product.product_type === "digital" ? "Digital" : "Físico"}
                                </Badge>
                                <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">
                                  {product.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">Por: {product.producer_name || "Produtor"}</p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Badge variant="outline" className="bg-accent/10 border-accent/30 text-accent font-semibold">
                                  {formatCurrency(Number(product.price))}
                                </Badge>
                                <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-500">
                                  {product.commission_percentage || 0}% comissão
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  = {formatCurrency(commissionValue)} por venda
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Afiliado desde: {new Date(product.affiliation_created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 lg:gap-6 text-center flex-wrap">
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-1 justify-center mb-1">
                                <MousePointerClick className="w-3 h-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Cliques</p>
                              </div>
                              <p className="text-lg font-semibold">{product.clicks_count || 0}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-1 justify-center mb-1">
                                <ShoppingBag className="w-3 h-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Vendas</p>
                              </div>
                              <p className="text-lg font-semibold">{product.sales_count || 0}</p>
                            </div>
                            <div className="bg-muted/30 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-1 justify-center mb-1">
                                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                                <p className="text-xs text-muted-foreground">Volume</p>
                              </div>
                              <p className="text-lg font-semibold">{formatCurrency(product.total_sales || 0)}</p>
                            </div>
                            <div className="bg-green-500/10 rounded-lg px-3 py-2">
                              <p className="text-xs text-green-500/80 mb-1">Minha comissão</p>
                              <p className="text-lg font-bold text-green-500">{formatCurrency(product.total_commission || 0)}</p>
                            </div>
                            {product.clicks_count && product.clicks_count > 0 && (
                              <div className="bg-purple-500/10 rounded-lg px-3 py-2">
                                <p className="text-xs text-purple-400/80 mb-1">Conversão</p>
                                <p className="text-lg font-semibold text-purple-400">
                                  {((product.sales_count || 0) / product.clicks_count * 100).toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isPending ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2"
                                onClick={() => window.open(affiliateLink, "_blank")}
                              >
                                Testar link
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="gap-2"
                                  onClick={() => {
                                    navigator.clipboard.writeText(affiliateLink);
                                    toast({
                                      title: "Link copiado!",
                                      description: "Compartilhe com seus seguidores para ganhar comissões.",
                                    });
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                  Copiar link
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9"
                                  onClick={() => window.open(affiliateLink, "_blank")}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-card/50 border-border/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 rounded-full bg-muted/30 mb-4">
                    <Tag className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhuma afiliação</h3>
                  <p className="text-muted-foreground text-sm text-center max-w-md">
                    Você ainda não é afiliado de nenhum produto. Acesse o marketplace para encontrar produtos.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Produtos;