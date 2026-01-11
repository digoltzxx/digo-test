import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import SocialProofNotifications from "@/components/checkout/SocialProofNotifications";
import SocialProofTestimonials from "@/components/checkout/SocialProofTestimonials";
import AddressSection, { AddressData } from "@/components/checkout/AddressSection";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CreditCard,
  Smartphone,
  FileText,
  ShieldCheck,
  Loader2,
  CheckCircle,
  Shield,
  Lock,
  ChevronDown,
  Plus,
  Minus,
  Check,
  Package,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { maskCPF, maskCNPJ, maskPhone } from "@/lib/validation";
import CreditCardForm from "@/components/checkout/CreditCardForm";
import { CardFormData } from "@/hooks/usePodPayCard";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  user_id: string;
  payment_type?: 'one_time' | 'subscription';
  subscription_quantity_mode?: 'single' | 'license' | 'seat';
  product_type?: string;
}

interface OrderBump {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  discount_type?: 'fixed' | 'percentage';
  discount_value?: number;
  is_active: boolean;
  is_subscription?: boolean;
  subscription_interval?: 'monthly' | 'quarterly' | 'yearly' | null;
  position: number;
  image_url: string | null;
  sales_phrase: string | null;
  auxiliary_phrase?: string | null;
  highlight_color?: string | null;
}

interface CheckoutSettings {
  primary_color: string;
  guarantee_days: number;
  require_phone: boolean;
  require_document: boolean;
  pix_enabled: boolean;
  credit_card_enabled: boolean;
  boleto_enabled: boolean;
  show_guarantee: boolean;
  require_email: boolean;
  document_type_accepted: string;
  order_bump_enabled: boolean;
  quantity_selector_enabled: boolean;
  button_text: string;
  button_status: string;
  button_background_color: string;
  button_text_color: string;
  // Theme
  theme_mode?: string;
  border_style?: string;
  background_color?: string;
  // Banner
  banner_url?: string | null;
  // Logo
  logo_url?: string | null;
  show_logo?: boolean;
  // Timer
  show_timer?: boolean;
  timer_text?: string;
  timer_color?: string;
  timer_text_color?: string;
  timer_expired_text?: string;
  // Security Seals
  security_seals_enabled?: boolean;
  security_seal_secure_site?: boolean;
  security_seal_secure_purchase?: boolean;
  security_seal_guarantee?: boolean;
  security_seal_secure_site_text?: string;
  security_seal_secure_purchase_text?: string;
  security_seal_guarantee_text?: string;
  // Social Proof
  social_proof_enabled?: boolean;
  social_proof_notification_1_enabled?: boolean;
  social_proof_notification_1_text?: string;
  social_proof_notification_2_enabled?: boolean;
  social_proof_notification_2_text?: string;
  social_proof_notification_3_enabled?: boolean;
  social_proof_notification_3_text?: string;
  social_proof_notification_4_enabled?: boolean;
  social_proof_notification_4_text?: string;
  social_proof_initial_delay?: number;
  social_proof_duration?: number;
  social_proof_interval_min?: number;
  social_proof_interval_max?: number;
  social_proof_min_people?: number;
  social_proof_max_people?: number;
}

interface MobileCheckoutLayoutProps {
  product: Product;
  settings: CheckoutSettings;
  basePrice: number;
  quantity: number;
  setQuantity: (qty: number | ((prev: number) => number)) => void;
  orderBumps: OrderBump[];
  selectedBumps: string[];
  toggleOrderBump: (id: string) => void;
  orderBumpsTotal: number;
  displayedPrice: number;
  formData: {
    name: string;
    email: string;
    emailConfirm: string;
    document: string;
    phone: string;
  };
  handleInputChange: (field: string, value: string) => void;
  formErrors: Record<string, string>;
  validateField: (field: string, value: string) => void;
  paymentMethod: "pix" | "credit_card" | "boleto";
  setPaymentMethod: (method: "pix" | "credit_card" | "boleto") => void;
  cardData: CardFormData;
  handleCardDataChange: (field: string, value: string) => void;
  cardErrors: Record<string, string>;
  processing: boolean;
  isPodPayReady: boolean;
  isTokenizing: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  threeDSSettings: any;
  getIframeId: () => string;
  selectedDocType: 'cpf' | 'cnpj';
  handleDocTypeChange: (type: 'cpf' | 'cnpj') => void;
  effectiveDocType: 'cpf' | 'cnpj';
  hasPodPayKey: boolean;
  priceAnimating: boolean;
  timeLeft: number;
  // Address props for physical products
  requiresAddress?: boolean;
  addressData?: AddressData;
  onAddressChange?: (field: keyof AddressData, value: string) => void;
  addressErrors?: Record<string, string>;
  onValidateAddressField?: (field: string, value: string) => void;
}

const MobileCheckoutLayout = ({
  product,
  settings,
  basePrice,
  quantity,
  setQuantity,
  orderBumps,
  selectedBumps,
  toggleOrderBump,
  orderBumpsTotal,
  displayedPrice,
  formData,
  handleInputChange,
  formErrors,
  validateField,
  paymentMethod,
  setPaymentMethod,
  cardData,
  handleCardDataChange,
  cardErrors,
  processing,
  isPodPayReady,
  isTokenizing,
  handleSubmit,
  threeDSSettings,
  getIframeId,
  selectedDocType,
  handleDocTypeChange,
  effectiveDocType,
  hasPodPayKey,
  priceAnimating,
  timeLeft,
  requiresAddress,
  addressData,
  onAddressChange,
  addressErrors,
  onValidateAddressField,
}: MobileCheckoutLayoutProps) => {
  const [paymentExpanded, setPaymentExpanded] = useState(true);

  const isLightTheme = settings.theme_mode === 'light';
  const textColor = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedTextColor = isLightTheme ? 'text-slate-600' : 'text-gray-400';
  const cardBg = isLightTheme ? 'bg-white/90 border-slate-200' : 'bg-card/50 border-border/50';
  const inputBg = isLightTheme ? 'bg-white border-slate-300' : 'bg-background/50 border-border/50';

  const getBorderRadius = () => {
    switch (settings.border_style) {
      case 'square': return 'rounded-none';
      case 'semi': return 'rounded-lg';
      case 'rounded':
      default: return 'rounded-xl';
    }
  };

  const borderRadius = getBorderRadius();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getMaskedValue = (field: string, value: string) => {
    if (field === 'document') {
      return effectiveDocType === 'cnpj' ? maskCNPJ(value) : maskCPF(value);
    }
    if (field === 'phone') {
      return maskPhone(value);
    }
    return value;
  };

  const handleFieldChange = (field: string, value: string) => {
    const maskedValue = getMaskedValue(field, value);
    handleInputChange(field, maskedValue);
  };

  return (
    <div 
      className="min-h-screen" 
      style={{ backgroundColor: settings.background_color || (isLightTheme ? '#f8fafc' : '#0f172a') }}
    >
      {/* Timer */}
      {settings.show_timer && timeLeft > 0 && (
        <div 
          className="py-3 text-center" 
          style={{ 
            backgroundColor: settings.timer_color || settings.primary_color,
            color: settings.timer_text_color || '#ffffff'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{settings.timer_text || 'Oferta expira em:'}</span>
            <span className="font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>
      )}

      {/* Timer Expired Message */}
      {settings.show_timer && timeLeft === 0 && settings.timer_expired_text && (
        <div 
          className="py-3 text-center" 
          style={{ 
            backgroundColor: settings.timer_color || settings.primary_color,
            color: settings.timer_text_color || '#ffffff'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-bold text-lg">{settings.timer_expired_text}</span>
          </div>
        </div>
      )}

      {/* Mobile Container */}
      <div className="max-w-md mx-auto pb-safe">
        {/* Header with Logo and Secure Badge */}
        <header className={`border-b ${isLightTheme ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-black/20'} backdrop-blur-sm`}>
          <div className="px-4 py-2 flex items-center justify-between">
            {settings.show_logo !== false && settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8 object-contain" />
            ) : <div />}
            <div className={`flex items-center gap-1.5 text-xs ${mutedTextColor}`}>
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              Pagamento seguro
            </div>
          </div>
        </header>

        {/* Banner */}
        {settings.banner_url && (
          <div className="w-full">
            <img
              src={settings.banner_url}
              alt="Banner"
              className="w-full h-auto object-contain"
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-4">
          {/* Order Summary Card */}
          <Card className={`${cardBg} overflow-hidden ${borderRadius}`}>
            <CardContent className="p-4 space-y-4">
              <h2 className={`text-lg font-semibold ${textColor}`}>Resumo do pedido</h2>
              
              {/* Product Info */}
              <div className="flex gap-3 items-start">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-border/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className={`w-6 h-6 ${mutedTextColor}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium text-sm leading-tight ${textColor}`}>
                    {product.name}
                  </h3>
                  <Badge 
                    variant="secondary" 
                    className={`mt-1 text-xs ${isLightTheme ? 'bg-slate-200 text-slate-700' : 'bg-secondary/50'}`}
                  >
                    Acesso digital
                  </Badge>
                </div>
              </div>

              {/* Quantity Selector */}
              {settings.quantity_selector_enabled && product?.payment_type !== 'subscription' && (
              <div className="flex items-center justify-between py-2">
                  <span className={`text-sm ${mutedTextColor}`}>Quantidade</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((prev: number) => Math.max(1, prev - 1))}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-50 ${
                        isLightTheme 
                          ? 'border-slate-300 hover:bg-slate-100 text-slate-700' 
                          : 'border-border/50 hover:bg-secondary/50'
                      }`}
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className={`w-8 text-center font-medium ${textColor}`}>{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((prev: number) => Math.min(100, prev + 1))}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        isLightTheme 
                          ? 'border-slate-300 hover:bg-slate-100 text-slate-700' 
                          : 'border-border/50 hover:bg-secondary/50'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <Separator className={isLightTheme ? 'bg-slate-200' : 'bg-border/30'} />

              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={mutedTextColor}>Produto</span>
                  <span className={textColor}>{formatCurrency(basePrice * quantity)}</span>
                </div>
                
                {orderBumpsTotal > 0 && (
                  <div className={`flex items-center justify-between text-sm transition-all duration-300 ${priceAnimating ? 'scale-105' : ''}`}>
                    <span className={mutedTextColor}>Adicionais</span>
                    <span className="text-green-500">+{formatCurrency(orderBumpsTotal)}</span>
                  </div>
                )}

                <Separator className={isLightTheme ? 'bg-slate-200' : 'bg-border/30'} />
                
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${textColor}`}>Total</span>
                  <span 
                    className={`text-xl font-bold transition-all duration-300 ${priceAnimating ? 'scale-110' : ''}`}
                    style={{ color: settings.primary_color }}
                  >
                    {formatCurrency(displayedPrice)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Guarantee Badge */}
          {settings.show_guarantee && (
            <div 
              className="flex items-center gap-3 p-4 rounded-xl border-2"
              style={{ 
                borderColor: `${settings.primary_color}40`,
                background: `linear-gradient(135deg, ${settings.primary_color}10 0%, ${settings.primary_color}05 100%)`
              }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${settings.primary_color}20` }}
              >
                <ShieldCheck className="w-5 h-5" style={{ color: settings.primary_color }} />
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm ${textColor}`}>
                  Garantia de {settings.guarantee_days} dias
                </p>
                <p className={`text-xs ${mutedTextColor}`}>
                  Satisfação garantida ou seu dinheiro de volta
                </p>
              </div>
            </div>
          )}

          {/* Address Section for Physical Products */}
          {requiresAddress && addressData && onAddressChange && onValidateAddressField && (
            <AddressSection
              addressData={addressData}
              onAddressChange={onAddressChange}
              errors={addressErrors || {}}
              onValidateField={onValidateAddressField}
              isLightTheme={isLightTheme}
              primaryColor={settings.primary_color}
              borderRadius={borderRadius}
              stepNumber={2}
            />
          )}

          {/* Payment Data Section */}
          <Card className={`${cardBg} ${borderRadius}`}>
            <CardContent className="p-4 space-y-4">
              <h2 className={`text-lg font-semibold ${textColor}`}>Dados de pagamento</h2>

              {/* Personal Data Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={`text-sm ${textColor}`}>
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={(e) => validateField('name', e.target.value)}
                    className={`${inputBg} h-12 ${borderRadius} ${
                      formErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                    required
                  />
                  {formErrors.name && (
                    <p className="text-xs text-destructive animate-in fade-in">{formErrors.name}</p>
                  )}
                </div>

                {settings.require_email !== false ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email" className={`text-sm ${textColor}`}>
                        E-mail <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seuemail@email.com"
                        value={formData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        onBlur={(e) => validateField('email', e.target.value)}
                        className={`${inputBg} h-12 ${borderRadius} ${
                          formErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                        required
                      />
                      {formErrors.email && (
                        <p className="text-xs text-destructive animate-in fade-in">{formErrors.email}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailConfirm" className={`text-sm ${textColor}`}>
                        Confirmar E-mail <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="emailConfirm"
                        type="email"
                        placeholder="Confirme seu e-mail"
                        value={formData.emailConfirm}
                        onChange={(e) => handleFieldChange('emailConfirm', e.target.value)}
                        onBlur={(e) => validateField('emailConfirm', e.target.value)}
                        className={`${inputBg} h-12 ${borderRadius} ${
                          formErrors.emailConfirm ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                        required
                      />
                      {formErrors.emailConfirm && (
                        <p className="text-xs text-destructive animate-in fade-in">{formErrors.emailConfirm}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email" className={`text-sm ${textColor}`}>
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com (opcional)"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      onBlur={(e) => validateField('email', e.target.value)}
                      className={`${inputBg} h-12 ${borderRadius} ${
                        formErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-destructive animate-in fade-in">{formErrors.email}</p>
                    )}
                  </div>
                )}

                {settings.require_document && (
                  <div className="space-y-2">
                    <Label htmlFor="document" className={`text-sm ${textColor}`}>
                      {settings.document_type_accepted === 'both' ? (
                        <div className="flex items-center gap-2">
                          <span>CPF *</span>
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              type="button"
                              onClick={() => handleDocTypeChange('cpf')}
                              className={`px-2 py-0.5 rounded ${selectedDocType === 'cpf' ? 'bg-secondary' : mutedTextColor}`}
                            >
                              CPF
                            </button>
                            <span className={mutedTextColor}>/</span>
                            <button
                              type="button"
                              onClick={() => handleDocTypeChange('cnpj')}
                              className={`px-2 py-0.5 rounded ${selectedDocType === 'cnpj' ? 'bg-secondary' : mutedTextColor}`}
                            >
                              CNPJ
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {settings.document_type_accepted === 'cnpj' ? 'CNPJ' : 'CPF'}{' '}
                          <span className="text-destructive">*</span>
                        </>
                      )}
                    </Label>
                    <Input
                      id="document"
                      placeholder={effectiveDocType === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                      value={formData.document}
                      onChange={(e) => handleFieldChange('document', e.target.value)}
                      onBlur={(e) => validateField('document', e.target.value)}
                      className={`${inputBg} h-12 ${borderRadius} ${
                        formErrors.document ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      required
                    />
                    {formErrors.document && (
                      <p className="text-xs text-destructive animate-in fade-in">{formErrors.document}</p>
                    )}
                  </div>
                )}

                {settings.require_phone && (
                  <div className="space-y-2">
                    <Label htmlFor="phone" className={`text-sm ${textColor}`}>
                      Telefone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="phone"
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      onBlur={(e) => validateField('phone', e.target.value)}
                      className={`${inputBg} h-12 ${borderRadius} ${
                        formErrors.phone ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                      required
                    />
                    {formErrors.phone && (
                      <p className="text-xs text-destructive animate-in fade-in">{formErrors.phone}</p>
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Order Bumps - After payment data */}
          {orderBumps.length > 0 && (
            <>
              {/* Scoped animations */}
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes ob-glow {
                  0%, 100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                  50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
                }
                @keyframes ob-check-pop {
                  0% { transform: scale(0); }
                  50% { transform: scale(1.2); }
                  100% { transform: scale(1); }
                }
                .ob-root, .ob-root * {
                  box-sizing: border-box !important;
                }
                .ob-add-btn:hover {
                  background: #4a4a5c !important;
                  transform: scale(1.05);
                }
              `}} />
              
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px', 
                  isolation: 'isolate',
                  contain: 'layout style paint',
                }}
              >
                {orderBumps
                  .filter(bump => bump.is_active)
                  .map((bump) => {
                    const hasDiscount = bump.discount_price !== null && bump.discount_price < bump.price;
                    const finalPrice = Math.max(0.01, bump.discount_price ?? bump.price);
                    const isSelected = selectedBumps.includes(bump.id);
                    const highlightColor = '#3b82f6'; // Always use blue as default

                    // PREMIUM DARK THEME COLORS with dynamic highlight
                    const OB = {
                      bgCard: '#2d2d3a',
                      bgCardSelected: '#1f2937',
                      borderDefault: highlightColor,
                      borderSelected: '#22c55e',
                      textGold: highlightColor,
                      textWhite: '#ffffff',
                      textGray: '#9ca3af',
                      textPurple: highlightColor,
                      btnBg: '#3d3d4d',
                      btnBgSelected: '#22c55e',
                    };

                    return (
                      <div
                        key={bump.id}
                        className="ob-root"
                        data-ob-id={bump.id}
                        data-ob-selected={isSelected ? 'true' : 'false'}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? 'Remover' : 'Adicionar'} ${bump.name}`}
                        onClick={() => toggleOrderBump(bump.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleOrderBump(bump.id);
                          }
                        }}
                        style={{
                          backgroundColor: isSelected ? OB.bgCardSelected : OB.bgCard,
                          borderRadius: '12px',
                          border: `2px dashed ${isSelected ? OB.borderSelected : OB.borderDefault}`,
                          padding: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                          isolation: 'isolate',
                          contain: 'layout style',
                          animation: isSelected ? 'ob-glow 2s ease-in-out infinite' : 'none',
                        }}
                      >
                        {/* Header - Sales Phrase or Default */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          marginBottom: '14px',
                        }}>
                          <span style={{ fontSize: '16px' }}>⚡</span>
                          <span style={{ 
                            color: OB.textGold, 
                            fontWeight: 700, 
                            fontSize: '14px',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                          }}>
                            {bump.sales_phrase || 'Oferta Especial'}
                          </span>
                        </div>

                        {/* Auxiliary Phrase */}
                        {bump.auxiliary_phrase && (
                          <p style={{
                            color: OB.textGray,
                            fontSize: '12px',
                            marginBottom: '12px',
                            marginTop: '-8px',
                          }}>
                            {bump.auxiliary_phrase}
                          </p>
                        )}

                        {/* Content Row */}
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '14px',
                        }}>
                          {/* Product Image */}
                          <div style={{ 
                            flexShrink: 0,
                            width: '64px',
                            height: '64px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            backgroundColor: '#1a1a24',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {bump.image_url ? (
                              <img 
                                src={bump.image_url} 
                                alt={bump.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package style={{ width: '28px', height: '28px', color: OB.textGray }} />
                            )}
                          </div>

                          {/* Text Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ 
                              color: OB.textWhite, 
                              fontWeight: 600, 
                              fontSize: '15px', 
                              lineHeight: 1.3,
                              marginBottom: '6px',
                            }}>
                              {bump.name}
                            </h4>
                            
                            {/* Pricing */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {hasDiscount && (
                                <span style={{ 
                                  color: '#ef4444', 
                                  textDecoration: 'line-through', 
                                  fontSize: '12px',
                                }}>
                                  De {formatCurrency(bump.price)}
                                </span>
                              )}
                              <span style={{ color: OB.textGray, fontSize: '12px' }}>por apenas</span>
                              <span style={{ 
                                color: '#22c55e', 
                                fontWeight: 600, 
                                fontSize: '13px',
                              }}>
                                {formatCurrency(finalPrice)}
                              </span>
                            </div>

                            {/* Description */}
                            {bump.description && (
                              <p style={{
                                color: OB.textGray,
                                fontSize: '12px',
                                lineHeight: 1.4,
                                marginTop: '6px',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}>
                                {bump.description}
                              </p>
                            )}

                            {/* Subscription badge */}
                            {bump.is_subscription && (
                              <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                marginTop: '6px', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                                color: '#93c5fd', 
                                fontSize: '10px', 
                                fontWeight: 500,
                              }}>
                                <RefreshCw style={{ width: '10px', height: '10px' }} />
                                <span>
                                  {bump.subscription_interval === 'monthly' ? 'Mensal' : 
                                   bump.subscription_interval === 'quarterly' ? 'Trimestral' : 
                                   bump.subscription_interval === 'yearly' ? 'Anual' : 'Assinatura'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Add/Check Button */}
                          <div 
                            className={isSelected ? '' : 'ob-add-btn'}
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              width: '44px', 
                              height: '44px', 
                              borderRadius: '10px', 
                              backgroundColor: isSelected ? OB.btnBgSelected : OB.btnBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                            }}
                          >
                            {isSelected ? (
                              <Check style={{ 
                                width: '22px', 
                                height: '22px', 
                                color: OB.textWhite,
                                animation: 'ob-check-pop 0.3s ease-out',
                              }} />
                            ) : (
                              <Plus style={{ 
                                width: '22px', 
                                height: '22px', 
                                color: OB.textGray,
                              }} />
                            )}
                          </div>
                        </div>

                        {/* Selected confirmation */}
                        {isSelected && (
                          <div style={{ 
                            marginTop: '12px', 
                            paddingTop: '10px', 
                            borderTop: `1px solid ${OB.borderSelected}40`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '6px',
                          }}>
                            <Check style={{ width: '14px', height: '14px', color: OB.textPurple }} />
                            <span style={{ 
                              fontSize: '12px', 
                              fontWeight: 500, 
                              color: OB.textPurple,
                            }}>
                              Adicionado ao pedido
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* Payment Method Selection - After Order Bumps */}
          <Card className={`${cardBg} ${borderRadius}`}>
            <CardContent className="p-4 space-y-4">
              <Collapsible open={paymentExpanded} onOpenChange={setPaymentExpanded}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between py-2">
                    <Label className={`text-sm ${textColor} cursor-pointer`}>Forma de pagamento</Label>
                    <ChevronDown className={`w-4 h-4 ${mutedTextColor} transition-transform ${paymentExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {settings.pix_enabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("pix")}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                          paymentMethod === "pix"
                            ? "border-accent bg-accent/10"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <Smartphone className={`w-5 h-5 ${paymentMethod === "pix" ? "text-accent" : textColor}`} />
                        <span className={`text-xs font-medium ${textColor}`}>PIX</span>
                        {paymentMethod === "pix" && (
                          <Check className="w-3 h-3 text-accent" />
                        )}
                      </button>
                    )}
                    
                    {settings.credit_card_enabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("credit_card")}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                          paymentMethod === "credit_card"
                            ? "border-accent bg-accent/10"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <CreditCard className={`w-5 h-5 ${paymentMethod === "credit_card" ? "text-accent" : textColor}`} />
                        <span className={`text-xs font-medium ${textColor}`}>Cartão</span>
                        {paymentMethod === "credit_card" && (
                          <Check className="w-3 h-3 text-accent" />
                        )}
                      </button>
                    )}
                    
                    {settings.boleto_enabled && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("boleto")}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                          paymentMethod === "boleto"
                            ? "border-accent bg-accent/10"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <FileText className={`w-5 h-5 ${paymentMethod === "boleto" ? "text-accent" : textColor}`} />
                        <span className={`text-xs font-medium ${textColor}`}>Boleto</span>
                        {paymentMethod === "boleto" && (
                          <Check className="w-3 h-3 text-accent" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Credit Card Form */}
                  {paymentMethod === "credit_card" && (
                    <div className="pt-2">
                      <CreditCardForm
                        cardData={cardData}
                        onCardDataChange={handleCardDataChange}
                        errors={cardErrors}
                        disabled={processing}
                        threeDSSettings={threeDSSettings}
                        iframeId={getIframeId()}
                      />
                      {!isPodPayReady && hasPodPayKey && (
                        <p className="text-xs text-yellow-500 text-center mt-2">
                          Carregando sistema de pagamento seguro...
                        </p>
                      )}
                    </div>
                  )}

                  {paymentMethod === "pix" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <p className="text-xs text-green-400">Aprovação imediata após pagamento</p>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Social Proof Testimonials */}
          <SocialProofTestimonials
            productId={product.id}
            isDarkTheme={!isLightTheme}
            primaryColor={settings.primary_color}
            className="px-4"
          />

          {/* Submit Button Card */}
          <Card className={`${cardBg} ${borderRadius}`}>
            <CardContent className="p-4 space-y-4">
              <Button
                type="submit"
                className={`w-full h-14 text-base font-semibold ${borderRadius} shadow-lg`}
                disabled={processing || (paymentMethod === "credit_card" && hasPodPayKey && !isPodPayReady)}
                style={{
                  backgroundColor: settings.button_background_color || settings.primary_color,
                  color: settings.button_text_color || '#ffffff'
                }}
              >
                {processing || isTokenizing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isTokenizing ? "Processando..." : "Finalizando..."}
                  </>
                ) : (
                  <>{settings.button_status || settings.button_text || "Finalizar Compra"}</>
                )}
              </Button>

              {/* Security Footer - Configurable Seals */}
              {settings.security_seals_enabled !== false && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  {settings.security_seal_secure_purchase !== false && (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Lock className="w-4 h-4 text-green-500" />
                      <span className={`text-[10px] ${mutedTextColor} leading-tight whitespace-pre-line`}>
                        {settings.security_seal_secure_purchase_text?.split(' ').join('\n') || "Compra\n100%\nSegura"}
                      </span>
                    </div>
                  )}
                  {settings.security_seal_secure_site !== false && (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <span className={`text-[10px] ${mutedTextColor} leading-tight whitespace-pre-line`}>
                        {settings.security_seal_secure_site_text?.split(' ').join('\n') || "Site Protegido\ncom\nCriptografia"}
                      </span>
                    </div>
                  )}
                  {settings.security_seal_guarantee !== false && (
                    <div className="flex flex-col items-center gap-1 text-center">
                      <Shield className={`w-4 h-4 ${mutedTextColor}`} />
                      <span className={`text-[10px] ${mutedTextColor} leading-tight whitespace-pre-line`}>
                        {settings.security_seal_guarantee_text?.split(' ').join('\n') || "Garantia\nTotal de\nSatisfação"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </div>

      {/* Social Proof Notifications */}
      <SocialProofNotifications
        settings={{
          social_proof_enabled: settings.social_proof_enabled || false,
          social_proof_notification_1_enabled: settings.social_proof_notification_1_enabled || false,
          social_proof_notification_1_text: settings.social_proof_notification_1_text || '',
          social_proof_notification_2_enabled: settings.social_proof_notification_2_enabled || false,
          social_proof_notification_2_text: settings.social_proof_notification_2_text || '',
          social_proof_notification_3_enabled: settings.social_proof_notification_3_enabled || false,
          social_proof_notification_3_text: settings.social_proof_notification_3_text || '',
          social_proof_notification_4_enabled: settings.social_proof_notification_4_enabled || false,
          social_proof_notification_4_text: settings.social_proof_notification_4_text || '',
          social_proof_initial_delay: settings.social_proof_initial_delay,
          social_proof_duration: settings.social_proof_duration,
          social_proof_interval_min: settings.social_proof_interval_min,
          social_proof_interval_max: settings.social_proof_interval_max,
          social_proof_min_people: settings.social_proof_min_people,
          social_proof_max_people: settings.social_proof_max_people,
        }}
        productName={product.name}
        primaryColor={settings.primary_color}
        isDarkTheme={!isLightTheme}
      />
    </div>
  );
};

export default MobileCheckoutLayout;
