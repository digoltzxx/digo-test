import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  X, 
  TrendingDown, 
  Timer,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  payment_type: string;
}

interface DownsellFormData {
  downsell_product_id: string;
  name: string;
  description: string;
  original_price: number;
  offer_price: number;
  headline: string;
  subheadline: string;
  cta_text: string;
  decline_text: string;
  timer_enabled: boolean;
  timer_minutes: number;
  is_subscription: boolean;
  subscription_interval: string;
  is_active: boolean;
}

interface DownsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: DownsellFormData) => Promise<void>;
  products: Product[];
  initialData?: Partial<DownsellFormData>;
  isEditing?: boolean;
}

const DownsellModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  products, 
  initialData,
  isEditing = false 
}: DownsellModalProps) => {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<DownsellFormData>({
    downsell_product_id: "",
    name: "",
    description: "",
    original_price: 0,
    offer_price: 0,
    headline: "Espere! Temos uma oferta especial",
    subheadline: "Uma opção mais acessível para você",
    cta_text: "Sim, quero essa oferta!",
    decline_text: "Não, continuar",
    timer_enabled: true,
    timer_minutes: 10,
    is_subscription: false,
    subscription_interval: "monthly",
    is_active: true,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          downsell_product_id: initialData.downsell_product_id || "",
          name: initialData.name || "",
          description: initialData.description || "",
          original_price: initialData.original_price || 0,
          offer_price: initialData.offer_price || 0,
          headline: initialData.headline || "Espere! Temos uma oferta especial",
          subheadline: initialData.subheadline || "Uma opção mais acessível para você",
          cta_text: initialData.cta_text || "Sim, quero essa oferta!",
          decline_text: initialData.decline_text || "Não, continuar",
          timer_enabled: initialData.timer_enabled ?? true,
          timer_minutes: initialData.timer_minutes || 10,
          is_subscription: initialData.is_subscription ?? false,
          subscription_interval: initialData.subscription_interval || "monthly",
          is_active: initialData.is_active ?? true,
        });
      } else {
        // Reset to default for new downsell
        setFormData({
          downsell_product_id: "",
          name: "",
          description: "",
          original_price: 0,
          offer_price: 0,
          headline: "Espere! Temos uma oferta especial",
          subheadline: "Uma opção mais acessível para você",
          cta_text: "Sim, quero essa oferta!",
          decline_text: "Não, continuar",
          timer_enabled: true,
          timer_minutes: 10,
          is_subscription: false,
          subscription_interval: "monthly",
          is_active: true,
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setFormData(prev => ({
        ...prev,
        downsell_product_id: productId,
        name: prev.name || product.name,
        original_price: product.price,
        offer_price: product.price * 0.7,
        is_subscription: product.payment_type === "subscription",
      }));
      setErrors(prev => ({ ...prev, downsell_product_id: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.downsell_product_id) {
      newErrors.downsell_product_id = "Selecione um produto";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Nome da oferta é obrigatório";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Nome deve ter no mínimo 3 caracteres";
    }

    if (formData.description && formData.description.length > 120) {
      newErrors.description = "Descrição deve ter no máximo 120 caracteres";
    }

    if (formData.original_price <= 0) {
      newErrors.original_price = "Preço original deve ser maior que zero";
    }

    if (formData.offer_price <= 0) {
      newErrors.offer_price = "Preço com desconto deve ser maior que zero";
    } else if (formData.offer_price >= formData.original_price) {
      newErrors.offer_price = "Preço com desconto deve ser menor que o original";
    }

    if (!formData.headline.trim()) {
      newErrors.headline = "Título da oferta é obrigatório";
    }

    if (!formData.cta_text.trim()) {
      newErrors.cta_text = "Texto do botão é obrigatório";
    }

    if (!formData.decline_text.trim()) {
      newErrors.decline_text = "Texto de recusa é obrigatório";
    }

    if (formData.timer_enabled && (formData.timer_minutes < 1 || formData.timer_minutes > 60)) {
      newErrors.timer_minutes = "Tempo deve ser entre 1 e 60 minutos";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Error saving downsell:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const discountPercentage = formData.original_price > 0 
    ? Math.round((1 - formData.offer_price / formData.original_price) * 100)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-gradient-to-b from-[#0d1117] to-[#161b22] border border-white/10 rounded-2xl shadow-2xl shadow-black/50">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isEditing ? "Editar Downsell" : "Novo Downsell"}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Configure sua oferta alternativa para o funil
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Product Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              Produto do Downsell <span className="text-red-400">*</span>
            </Label>
            <Select
              value={formData.downsell_product_id}
              onValueChange={handleProductSelect}
            >
              <SelectTrigger className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.downsell_product_id ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10">
                {products.map((product) => (
                  <SelectItem 
                    key={product.id} 
                    value={product.id}
                    className="text-white hover:bg-white/10 focus:bg-white/10"
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span>{product.name}</span>
                      <span className="text-blue-400 text-sm">{formatCurrency(product.price)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">Escolha um produto com valor menor que o upsell</p>
            {errors.downsell_product_id && (
              <p className="text-red-400 text-xs flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.downsell_product_id}
              </p>
            )}
          </div>

          {/* Name and Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Nome da Oferta <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  setErrors(prev => ({ ...prev, name: "" }));
                }}
                placeholder="Nome exibido ao cliente"
                className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.name ? 'border-red-500' : ''}`}
              />
              {errors.name && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-300">
                Descrição <span className="text-gray-500">(opcional - máx. 120 caracteres)</span>
              </Label>
              <Input
                value={formData.description}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, description: e.target.value }));
                  setErrors(prev => ({ ...prev, description: "" }));
                }}
                placeholder="Descrição breve"
                maxLength={120}
                className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.description ? 'border-red-500' : ''}`}
              />
              {formData.description && (
                <p className={`text-xs ${formData.description.length > 100 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {formData.description.length}/120 caracteres
                </p>
              )}
              {errors.description && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* Prices */}
          <div className="p-4 bg-gradient-to-r from-orange-500/5 to-red-500/5 border border-white/5 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              💰 Configuração de Preço
              {discountPercentage > 0 && (
                <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                  -{discountPercentage}% OFF
                </span>
              )}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Preço Original <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.original_price}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, original_price: parseFloat(e.target.value) || 0 }));
                      setErrors(prev => ({ ...prev, original_price: "" }));
                    }}
                    className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.original_price ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.original_price && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.original_price}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Preço com Desconto <span className="text-red-400">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.offer_price}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, offer_price: parseFloat(e.target.value) || 0 }));
                      setErrors(prev => ({ ...prev, offer_price: "" }));
                    }}
                    className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.offer_price ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.offer_price && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.offer_price}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Offer Texts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">✨ Texto da Oferta</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Título da Oferta <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={formData.headline}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, headline: e.target.value }));
                    setErrors(prev => ({ ...prev, headline: "" }));
                  }}
                  placeholder="Espere! Temos uma oferta especial"
                  className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.headline ? 'border-red-500' : ''}`}
                />
                {errors.headline && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.headline}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Subtítulo <span className="text-gray-500">(opcional)</span>
                </Label>
                <Input
                  value={formData.subheadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, subheadline: e.target.value }))}
                  placeholder="Uma opção mais acessível para você"
                  className="bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Action Texts */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">🎯 Textos de Ação</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Texto do Botão (Aceitar) <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={formData.cta_text}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, cta_text: e.target.value }));
                    setErrors(prev => ({ ...prev, cta_text: "" }));
                  }}
                  placeholder="Sim, quero essa oferta!"
                  className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.cta_text ? 'border-red-500' : ''}`}
                />
                {errors.cta_text && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.cta_text}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">
                  Texto do Link (Recusar) <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={formData.decline_text}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, decline_text: e.target.value }));
                    setErrors(prev => ({ ...prev, decline_text: "" }));
                  }}
                  placeholder="Não, continuar"
                  className={`bg-[#0d1117] border-white/10 text-white h-12 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${errors.decline_text ? 'border-red-500' : ''}`}
                />
                {errors.decline_text && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.decline_text}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Timer Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Temporizador</p>
                  <p className="text-xs text-gray-400">Tempo para decisão</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {formData.timer_enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={formData.timer_minutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, timer_minutes: parseInt(e.target.value) || 10 }))}
                      className="w-16 h-9 bg-[#0d1117] border-white/10 text-white text-center rounded-lg text-sm"
                    />
                    <span className="text-xs text-gray-400">min</span>
                  </div>
                )}
                <Switch
                  checked={formData.timer_enabled}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, timer_enabled: checked }))}
                  className="data-[state=checked]:bg-orange-500"
                />
              </div>
            </div>

            {/* Subscription Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Produto de Assinatura</p>
                  <p className="text-xs text-gray-400">Cobrança recorrente automática</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {formData.is_subscription && (
                  <Select
                    value={formData.subscription_interval}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, subscription_interval: value }))}
                  >
                    <SelectTrigger className="w-28 h-9 bg-[#0d1117] border-white/10 text-white text-sm rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f2e] border-white/10">
                      <SelectItem value="monthly" className="text-white">Mensal</SelectItem>
                      <SelectItem value="quarterly" className="text-white">Trimestral</SelectItem>
                      <SelectItem value="yearly" className="text-white">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Switch
                  checked={formData.is_subscription}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_subscription: checked }))}
                  className="data-[state=checked]:bg-purple-500"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-4 bg-[#0d1117]/50 border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${formData.is_active ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                  <div className={`w-3 h-3 rounded-full ${formData.is_active ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Ativo</p>
                  <p className="text-xs text-gray-400">Exibir esta oferta no funil</p>
                </div>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/5">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/20"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 mr-2" />
                {isEditing ? "Salvar Alterações" : "Criar Downsell"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DownsellModal;
