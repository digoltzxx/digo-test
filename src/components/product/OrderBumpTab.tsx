import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, Package, Sparkles, DollarSign, Tag, ToggleLeft, Upload, Image, X, ShoppingBag, Percent, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderBump {
  id: string;
  product_id: string;
  bump_product_id: string | null;
  name: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  is_active: boolean;
  is_subscription: boolean;
  subscription_interval: 'monthly' | 'quarterly' | 'yearly' | null;
  position: number;
  image_url: string | null;
  sales_phrase: string | null;
  auxiliary_phrase: string | null;
  highlight_color: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ProductOffer {
  id: string;
  product_id: string;
  name: string;
  final_price: number;
}

interface OrderBumpTabProps {
  productId: string;
}

const OrderBumpTab = ({ productId }: OrderBumpTabProps) => {
  const [orderBumps, setOrderBumps] = useState<OrderBump[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBump, setEditingBump] = useState<OrderBump | null>(null);
  
  // Products and offers for dropdown
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductOffer, setSelectedProductOffer] = useState<ProductOffer | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingOffer, setLoadingOffer] = useState(false);
  
  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    bump_product_id: "",
    description: "",
    sales_phrase: "",
    auxiliary_phrase: "",
    is_active: true,
    discount_type: "fixed" as 'fixed' | 'percentage',
    discount_value: 0,
    is_subscription: false,
    subscription_interval: null as 'monthly' | 'quarterly' | 'yearly' | null,
    highlight_color: "#3b82f6",
  });

  useEffect(() => {
    fetchOrderBumps();
    fetchAvailableProducts();
  }, [productId]);

  const fetchOrderBumps = async () => {
    try {
      const { data, error } = await supabase
        .from("order_bumps")
        .select("*")
        .eq("product_id", productId)
        .order("position");

      if (error) throw error;
      setOrderBumps((data || []).map(item => ({
        ...item,
        discount_type: (item.discount_type as 'fixed' | 'percentage') || 'fixed',
        discount_value: item.discount_value || 0,
        is_subscription: item.is_subscription || false,
        subscription_interval: item.subscription_interval as 'monthly' | 'quarterly' | 'yearly' | null,
        highlight_color: (item as any).highlight_color || '#3b82f6',
      })));
    } catch (error) {
      console.error("Error fetching order bumps:", error);
      toast.error("Erro ao carregar order bumps");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("user_id", user.id)
        .eq("status", "active")
        .neq("id", productId);

      if (error) throw error;
      setAvailableProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchProductOffer = async (selectedProductId: string) => {
    setLoadingOffer(true);
    setSelectedProductOffer(null);
    try {
      const { data, error } = await supabase
        .from("product_offers")
        .select("id, product_id, name, final_price")
        .eq("product_id", selectedProductId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setSelectedProductOffer(data);
      } else {
        // If no offer, use product price
        const product = availableProducts.find(p => p.id === selectedProductId);
        if (product) {
          setSelectedProductOffer({
            id: "",
            product_id: selectedProductId,
            name: "Oferta Padrão",
            final_price: product.price
          });
        }
      }
    } catch (error) {
      console.error("Error fetching product offer:", error);
    } finally {
      setLoadingOffer(false);
    }
  };

  const handleProductChange = (productId: string) => {
    setFormData(prev => ({ ...prev, bump_product_id: productId }));
    if (productId) {
      fetchProductOffer(productId);
    } else {
      setSelectedProductOffer(null);
    }
  };

  // Image handling
  const handleImageChange = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageChange(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imagePreview; // Return existing URL if no new file
    
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return null;
      }

      const fileExt = imageFile.name.split('.').pop();
      const fileName = `order-bump-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/order-bumps/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload da imagem");
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isFormValid = () => {
    const hasName = formData.name.trim().length > 0;
    const hasProduct = formData.bump_product_id !== "";
    const hasImage = imageFile !== null || imagePreview !== null;
    const hasValidDiscount = validateDiscount();
    return hasName && hasProduct && hasImage && hasValidDiscount;
  };

  // Validate discount value
  const validateDiscount = (): boolean => {
    if (formData.discount_value <= 0) return true; // No discount is valid
    if (!selectedProductOffer) return true; // Can't validate without price
    
    const originalPrice = selectedProductOffer.final_price;
    
    if (formData.discount_type === 'percentage') {
      return formData.discount_value > 0 && formData.discount_value <= 100;
    } else {
      return formData.discount_value > 0 && formData.discount_value < originalPrice;
    }
  };

  // Get discount validation error message
  const getDiscountError = (): string | null => {
    if (formData.discount_value <= 0) return null;
    if (!selectedProductOffer) return null;
    
    const originalPrice = selectedProductOffer.final_price;
    
    if (formData.discount_type === 'percentage') {
      if (formData.discount_value > 100) {
        return "Desconto percentual não pode ser maior que 100%";
      }
    } else {
      if (formData.discount_value >= originalPrice) {
        return "Desconto fixo não pode ser maior ou igual ao preço do produto";
      }
    }
    
    if (formData.discount_value < 0) {
      return "Desconto não pode ser negativo";
    }
    
    return null;
  };

  const handleSave = async () => {
    // Validate name
    if (!formData.name.trim()) {
      toast.error("Nome do Order Bump é obrigatório");
      return;
    }

    if (formData.name.trim().length < 2) {
      toast.error("Nome do Order Bump deve ter pelo menos 2 caracteres");
      return;
    }

    // Validate product selection
    if (!formData.bump_product_id) {
      toast.error("Selecione um produto para o Order Bump");
      return;
    }

    // Verify product exists
    const selectedProduct = availableProducts.find(p => p.id === formData.bump_product_id);
    if (!selectedProduct) {
      toast.error("Produto selecionado não está mais disponível");
      return;
    }

    // Validate image
    if (!imageFile && !imagePreview) {
      toast.error("Imagem do produto é obrigatória");
      return;
    }

    // Validate discount
    const discountError = getDiscountError();
    if (discountError) {
      toast.error(discountError);
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      
      const originalPrice = selectedProductOffer?.final_price || 0;
      const finalPrice = formData.discount_value > 0 
        ? (formData.discount_type === 'percentage' 
            ? Math.max(0, originalPrice - (originalPrice * formData.discount_value / 100))
            : Math.max(0, originalPrice - formData.discount_value))
        : null;

      const bumpData = {
        product_id: productId,
        bump_product_id: formData.bump_product_id,
        name: formData.name,
        description: formData.description || null,
        price: originalPrice,
        discount_price: finalPrice,
        discount_type: formData.discount_type,
        discount_value: formData.discount_value,
        is_active: formData.is_active,
        is_subscription: formData.is_subscription,
        subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
        image_url: imageUrl,
        sales_phrase: formData.sales_phrase || null,
        auxiliary_phrase: formData.auxiliary_phrase || null,
        highlight_color: formData.highlight_color || '#3b82f6',
      };

      if (editingBump) {
        const { error } = await supabase
          .from("order_bumps")
          .update(bumpData)
          .eq("id", editingBump.id);

        if (error) throw error;
        toast.success("Order Bump atualizado!");
      } else {
        const { error } = await supabase
          .from("order_bumps")
          .insert({
            ...bumpData,
            position: orderBumps.length,
          });

        if (error) throw error;
        toast.success("Order Bump criado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchOrderBumps();
    } catch (error) {
      console.error("Error saving order bump:", error);
      toast.error("Erro ao salvar order bump");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este order bump?")) return;

    try {
      const { error } = await supabase
        .from("order_bumps")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Order Bump excluído!");
      fetchOrderBumps();
    } catch (error) {
      console.error("Error deleting order bump:", error);
      toast.error("Erro ao excluir order bump");
    }
  };

  const handleToggleActive = async (bump: OrderBump) => {
    try {
      const { error } = await supabase
        .from("order_bumps")
        .update({ is_active: !bump.is_active })
        .eq("id", bump.id);

      if (error) throw error;
      fetchOrderBumps();
      toast.success(bump.is_active ? "Order Bump desativado" : "Order Bump ativado");
    } catch (error) {
      console.error("Error toggling order bump:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const openEditDialog = (bump: OrderBump) => {
    setEditingBump(bump);
    setFormData({
      name: bump.name,
      bump_product_id: bump.bump_product_id || "",
      description: bump.description || "",
      sales_phrase: bump.sales_phrase || "",
      auxiliary_phrase: bump.auxiliary_phrase || "",
      is_active: bump.is_active,
      discount_type: bump.discount_type || 'fixed',
      discount_value: bump.discount_value || 0,
      is_subscription: bump.is_subscription || false,
      subscription_interval: bump.subscription_interval || null,
      highlight_color: bump.highlight_color || "#3b82f6",
    });
    setImagePreview(bump.image_url);
    setImageFile(null);
    if (bump.bump_product_id) {
      fetchProductOffer(bump.bump_product_id);
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingBump(null);
    setFormData({
      name: "",
      bump_product_id: "",
      description: "",
      sales_phrase: "",
      auxiliary_phrase: "",
      is_active: true,
      discount_type: "fixed",
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
      highlight_color: "#3b82f6",
    });
    setImageFile(null);
    setImagePreview(null);
    setSelectedProductOffer(null);
  };

  // Calculate final price with discount - ensures no negative prices
  const calculateFinalPrice = () => {
    if (!selectedProductOffer) return 0;
    const originalPrice = selectedProductOffer.final_price;
    if (formData.discount_value <= 0) return originalPrice;
    
    let finalPrice: number;
    if (formData.discount_type === 'percentage') {
      // Cap percentage at 100%
      const safePercentage = Math.min(100, Math.max(0, formData.discount_value));
      const discountAmount = (originalPrice * safePercentage) / 100;
      finalPrice = originalPrice - discountAmount;
    } else {
      // Cap fixed discount at original price
      const safeDiscount = Math.min(originalPrice, Math.max(0, formData.discount_value));
      finalPrice = originalPrice - safeDiscount;
    }
    
    // Ensure minimum price of 0.01 (1 centavo)
    return Math.max(0.01, finalPrice);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // Handle discount value change with validation
  const handleDiscountValueChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    // Prevent negative values
    const safeValue = Math.max(0, numValue);
    setFormData(prev => ({ ...prev, discount_value: safeValue }));
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-[#0f1419] to-[#161b22] border border-white/5 rounded-2xl shadow-2xl">
        <CardContent className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
              <div className="absolute inset-0 w-16 h-16 rounded-full bg-blue-500/10 animate-ping" />
            </div>
            <p className="text-gray-400 text-sm">Carregando order bumps...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-[#0f1419] to-[#161b22] border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-blue-500/10 blur-3xl pointer-events-none" />
      
      <CardContent className="p-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">Order Bumps</h3>
              <p className="text-sm text-gray-400 mt-0.5">Ofereça produtos adicionais no checkout</p>
            </div>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 hover:scale-[1.02]">
                <Plus className="w-5 h-5 mr-2" />
                Novo Order Bump
              </Button>
            </DialogTrigger>
            
            <DialogContent className="bg-gradient-to-br from-[#0f1419] to-[#1a1f26] border border-white/10 rounded-2xl shadow-2xl max-w-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
              {/* Modal glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-blue-500/15 blur-3xl pointer-events-none" />
              
              <DialogHeader className="px-8 pt-8 pb-2 relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-blue-400" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-white">
                    {editingBump ? "Editar Order Bump" : "Adicionar Produto ao Order Bump"}
                  </DialogTitle>
                </div>
                <p className="text-sm text-gray-400 ml-13">
                  {editingBump ? "Atualize as informações do order bump" : "Selecione um produto para adicionar como order bump"}
                </p>
              </DialogHeader>
              
              <div className="px-8 pb-8 pt-4 space-y-6 relative">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Image Upload */}
                  <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Image className="w-4 h-4 text-blue-400" />
                        Imagem do Produto <span className="text-red-400">*</span>
                      </Label>
                      
                      <div
                        className={`relative border-2 border-dashed rounded-xl transition-all duration-300 ${
                          isDragging 
                            ? "border-blue-500 bg-blue-500/10" 
                            : imagePreview 
                              ? "border-green-500/50 bg-green-500/5" 
                              : "border-white/10 hover:border-blue-500/50 bg-[#0d1117]/50"
                        }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
                          className="hidden"
                        />
                        
                        {imagePreview ? (
                          <div className="relative p-4">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <button
                              onClick={removeImage}
                              className="absolute top-6 right-6 w-8 h-8 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex flex-col items-center justify-center p-8 cursor-pointer min-h-[200px]"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center mb-4">
                              <Upload className="w-7 h-7 text-blue-400" />
                            </div>
                            <p className="text-gray-300 font-medium mb-1">
                              Escolha uma imagem para o produto
                            </p>
                            <p className="text-gray-500 text-sm text-center">
                              Arraste e solte uma imagem, ou clique para procurar
                            </p>
                            <p className="text-gray-600 text-xs mt-2">
                              Medida recomendada: 250×256 px
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Form Fields */}
                  <div className="space-y-4">
                    {/* Select Product */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-400" />
                        Selecionar Produto <span className="text-red-400">*</span>
                      </Label>
                      <Select
                        value={formData.bump_product_id}
                        onValueChange={handleProductChange}
                        disabled={loadingProducts}
                      >
                        <SelectTrigger className="bg-[#0d1117]/80 border-white/10 text-white rounded-xl h-12 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20">
                          <SelectValue placeholder="Selecione um produto..." />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1f26] border-white/10">
                          {availableProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id} className="text-white hover:bg-white/10">
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Order Bump Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-400" />
                        Nome do Order Bump <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12 px-4 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                        placeholder="Ex: Bônus exclusivo"
                      />
                    </div>

                    {/* Offer (Read-only) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        Oferta
                      </Label>
                      <div className="bg-[#0d1117]/50 border border-white/10 rounded-xl h-12 px-4 flex items-center">
                        {loadingOffer ? (
                          <div className="flex items-center gap-2 text-gray-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Carregando oferta...</span>
                          </div>
                        ) : selectedProductOffer ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-white">{selectedProductOffer.name}</span>
                            <span className="text-green-400 font-semibold">
                              {formatCurrency(selectedProductOffer.final_price)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">Selecione um produto para ver a oferta</span>
                        )}
                      </div>
                    </div>

                    {/* Discount Configuration */}
                    <div className="space-y-3 p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
                      <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-yellow-400" />
                        Desconto <span className="text-gray-500">(opcional)</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={formData.discount_type}
                          onValueChange={(value: 'fixed' | 'percentage') => setFormData(prev => ({ ...prev, discount_type: value }))}
                        >
                          <SelectTrigger className="bg-[#0d1117]/80 border-white/10 text-white rounded-xl h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1f26] border-white/10">
                            <SelectItem value="fixed" className="text-white hover:bg-white/10">Valor fixo (R$)</SelectItem>
                            <SelectItem value="percentage" className="text-white hover:bg-white/10">Percentual (%)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max={formData.discount_type === 'percentage' ? 100 : undefined}
                          step="0.01"
                          value={formData.discount_value || ""}
                          onChange={(e) => handleDiscountValueChange(e.target.value)}
                          placeholder={formData.discount_type === 'percentage' ? "Ex: 20" : "Ex: 50"}
                          className={`bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-11 px-4 ${
                            getDiscountError() ? 'border-red-500/50 focus:border-red-500' : ''
                          }`}
                        />
                      </div>
                      {/* Discount validation error */}
                      {getDiscountError() && (
                        <p className="text-red-400 text-xs mt-1">{getDiscountError()}</p>
                      )}
                      {/* Final price display */}
                      {formData.discount_value > 0 && selectedProductOffer && !getDiscountError() && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Preço final:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-red-400 line-through text-xs">{formatCurrency(selectedProductOffer.final_price)}</span>
                            <span className="text-green-400 font-bold">{formatCurrency(calculateFinalPrice())}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subscription Toggle */}
                    <div className="space-y-3 p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <RefreshCw className="w-5 h-5 text-purple-400" />
                          <div>
                            <Label className="text-sm font-medium text-white">Order Bump Recorrente</Label>
                            <p className="text-xs text-gray-500 mt-0.5">Cria uma assinatura separada</p>
                          </div>
                        </div>
                        <Switch
                          checked={formData.is_subscription}
                          onCheckedChange={(checked) => setFormData(prev => ({ 
                            ...prev, 
                            is_subscription: checked,
                            subscription_interval: checked ? 'monthly' : null 
                          }))}
                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-600 data-[state=checked]:to-pink-600"
                        />
                      </div>
                      {formData.is_subscription && (
                        <Select
                          value={formData.subscription_interval || 'monthly'}
                          onValueChange={(value: 'monthly' | 'quarterly' | 'yearly') => setFormData(prev => ({ ...prev, subscription_interval: value }))}
                        >
                          <SelectTrigger className="bg-[#0d1117]/80 border-white/10 text-white rounded-xl h-11">
                            <SelectValue placeholder="Intervalo de cobrança" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1f26] border-white/10">
                            <SelectItem value="monthly" className="text-white hover:bg-white/10">Mensal</SelectItem>
                            <SelectItem value="quarterly" className="text-white hover:bg-white/10">Trimestral</SelectItem>
                            <SelectItem value="yearly" className="text-white hover:bg-white/10">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Sales Phrase */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300">
                        Frase de venda <span className="text-gray-500">(opcional)</span>
                      </Label>
                      <Input
                        value={formData.sales_phrase}
                        onChange={(e) => setFormData(prev => ({ ...prev, sales_phrase: e.target.value }))}
                        className="bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12 px-4 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                        placeholder="Ex: Aproveite esta oferta única!"
                      />
                    </div>

                    {/* Auxiliary Phrase */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300">
                        Frase auxiliar <span className="text-gray-500">(opcional)</span>
                      </Label>
                      <Input
                        value={formData.auxiliary_phrase}
                        onChange={(e) => setFormData(prev => ({ ...prev, auxiliary_phrase: e.target.value }))}
                        className="bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12 px-4 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                        placeholder="Ex: Disponível apenas nesta compra"
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300">
                        Descrição <span className="text-gray-500">(opcional)</span>
                      </Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl px-4 py-3 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 min-h-[80px] resize-none"
                        placeholder="Descreva o produto ou benefício adicional..."
                      />
                    </div>

                    {/* Highlight Color */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-300">
                        Cor de destaque
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          value={formData.highlight_color}
                          onChange={(e) => setFormData(prev => ({ ...prev, highlight_color: e.target.value }))}
                          className="bg-[#0d1117]/80 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12 px-4 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 flex-1"
                          placeholder="#3b82f6"
                        />
                        <input
                          type="color"
                          value={formData.highlight_color}
                          onChange={(e) => setFormData(prev => ({ ...prev, highlight_color: e.target.value }))}
                          className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white/10 hover:border-white/20 transition-all"
                          style={{ backgroundColor: formData.highlight_color }}
                        />
                      </div>
                    </div>

                    {/* Toggle Ativo */}
                    <div className="flex items-center justify-between p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
                      <div className="flex items-center gap-3">
                        <ToggleLeft className="w-5 h-5 text-blue-400" />
                        <div>
                          <Label className="text-sm font-medium text-white">Status do Order Bump</Label>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formData.is_active ? "Visível no checkout" : "Oculto do checkout"}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-blue-600 data-[state=checked]:to-cyan-600"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Footer Buttons */}
                <DialogFooter className="flex gap-3 pt-4 border-t border-white/5">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    className="flex-1 bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white rounded-xl h-12"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || uploadingImage || !isFormValid()}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold h-12 rounded-xl shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving || uploadingImage ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        {uploadingImage ? "Enviando imagem..." : "Salvando..."}
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        {editingBump ? "Salvar Alterações" : "Adicionar Produto"}
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Empty State */}
        {orderBumps.length === 0 ? (
          <div className="bg-gradient-to-br from-[#0d1117]/80 to-[#161b22]/80 border border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-blue-400/60" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Nenhum order bump criado</h4>
            <p className="text-sm text-gray-400 text-center max-w-sm">
              Crie ofertas adicionais para aumentar seu ticket médio e maximizar suas vendas
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orderBumps.map((bump, index) => (
              <div
                key={bump.id}
                className="group bg-gradient-to-r from-[#0d1117]/80 to-[#161b22]/80 border border-white/5 rounded-2xl p-5 flex items-center justify-between backdrop-blur-sm hover:border-blue-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5"
              >
                <div className="flex items-center gap-5">
                  {/* Image or Number */}
                  {bump.image_url ? (
                    <img
                      src={bump.image_url}
                      alt={bump.name}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-400">
                      {index + 1}
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1">
                    <h4 className="text-white font-semibold text-lg group-hover:text-blue-300 transition-colors duration-200">
                      {bump.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-green-400 font-semibold bg-green-500/10 px-2.5 py-0.5 rounded-lg text-sm">
                        {formatCurrency(bump.price)}
                      </span>
                      {bump.sales_phrase && (
                        <span className="text-gray-400 text-sm truncate max-w-[200px]">
                          {bump.sales_phrase}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleActive(bump)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      bump.is_active 
                        ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30" 
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20"
                    }`}
                  >
                    {bump.is_active ? "Ativo" : "Inativo"}
                  </button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(bump)}
                    className="w-10 h-10 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 transition-all duration-200 hover:scale-105"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(bump)}
                    className="w-10 h-10 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/20 transition-all duration-200 hover:scale-105"
                  >
                    <ToggleLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(bump.id)}
                    className="w-10 h-10 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 transition-all duration-200 hover:scale-105"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderBumpTab;
