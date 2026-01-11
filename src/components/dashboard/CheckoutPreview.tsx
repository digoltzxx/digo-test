import { CreditCard, Shield, Clock, Smartphone, ShoppingBag, Mail, Phone, FileText, Check, Lock, CheckCircle, ShieldCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderBump {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  discount_price?: number | null;
  image_url?: string | null;
  sales_phrase?: string | null;
  auxiliary_phrase?: string | null;
  is_active?: boolean;
}

interface CheckoutPreviewProps {
  settings: {
    layout_type: string;
    primary_color: string;
    background_color: string;
    theme_mode: string;
    button_text: string;
    button_background_color?: string;
    button_text_color?: string;
    show_timer: boolean;
    timer_text: string;
    timer_minutes: number;
    timer_color?: string;
    timer_text_color?: string;
    pix_enabled: boolean;
    credit_card_enabled: boolean;
    boleto_enabled?: boolean;
    show_guarantee: boolean;
    guarantee_days: number;
    border_style: string;
    form_layout: string;
    show_logo: boolean;
    logo_url: string | null;
    banner_url: string | null;
    marquee_enabled: boolean;
    marquee_text: string | null;
    headline: string | null;
    invert_columns?: boolean;
    require_email?: boolean;
    require_phone?: boolean;
    require_document?: boolean;
    document_type_accepted?: string;
    // Security Seals
    security_seals_enabled?: boolean;
    security_seal_secure_site?: boolean;
    security_seal_secure_purchase?: boolean;
    security_seal_guarantee?: boolean;
    security_seal_secure_site_text?: string;
    security_seal_secure_purchase_text?: string;
    security_seal_guarantee_text?: string;
    // Total Value Color
    total_value_color?: string;
    // Order bumps
    order_bump_enabled?: boolean;
    // Coupon
    coupon_enabled?: boolean;
  };
  productName: string;
  productPrice?: number;
  productImage?: string | null;
  orderBumps?: OrderBump[];
  isSubscription?: boolean;
}

const CheckoutPreview = ({ 
  settings, 
  productName, 
  productPrice = 297, 
  productImage,
  orderBumps = [],
  isSubscription = false,
}: CheckoutPreviewProps) => {
  const isDark = settings.theme_mode === 'dark';
  const bgMain = isDark ? '#0f172a' : '#f3f4f6';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textPrimary = isDark ? '#f8fafc' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e5e7eb';
  const primaryColor = settings.primary_color || '#3b82f6';
  const timerColor = settings.timer_color || '#000000';
  const timerTextColor = settings.timer_text_color || '#ffffff';
  const totalValueColor = settings.total_value_color || (isDark ? '#f8fafc' : '#000000');
  const buttonBgColor = settings.button_background_color || '#22c55e';
  const buttonTextColor = settings.button_text_color || '#ffffff';

  // Calculate order bumps total
  const orderBumpsTotal = orderBumps
    .filter(b => b.is_active !== false)
    .reduce((sum, bump) => sum + (bump.discount_price ?? bump.price), 0);

  const totalPrice = productPrice + orderBumpsTotal;

  // Border radius based on border_style setting
  const getBorderRadius = () => {
    switch (settings.border_style) {
      case 'rounded': return { card: 'rounded-xl', input: 'rounded-lg', button: 'rounded-lg' };
      case 'semi': return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-md' };
      case 'square': return { card: 'rounded-none', input: 'rounded-none', button: 'rounded-none' };
      default: return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-md' };
    }
  };
  const borderRadius = getBorderRadius();

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  return (
    <div 
      className="w-full aspect-[9/18] overflow-hidden flex flex-col"
      style={{ backgroundColor: bgMain }}
    >
      {/* Timer Bar */}
      {settings.show_timer && (
        <div 
          className="px-3 py-1.5 flex items-center justify-center gap-1"
          style={{ backgroundColor: timerColor, color: timerTextColor }}
        >
          <Clock className="w-2.5 h-2.5" />
          <span className="text-[7px] font-medium">{settings.timer_text}</span>
          <span className="text-[8px] font-bold">{settings.timer_minutes}:00</span>
        </div>
      )}

      {/* Header with secure badge */}
      <div 
        className="px-3 py-1.5 flex items-center justify-end border-b"
        style={{ borderColor: borderCol, backgroundColor: cardBg }}
      >
        <div className="flex items-center gap-1 text-[6px]" style={{ color: textSecondary }}>
          <CheckCircle className="w-2.5 h-2.5 text-green-500" />
          <span>Pagamento seguro</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin-blue">
        {/* Order Summary Section */}
        <div 
          className={cn("m-2 p-3", borderRadius.card)}
          style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}
        >
          <h2 className="text-[9px] font-bold mb-2" style={{ color: textPrimary }}>
            Resumo do pedido
          </h2>

          {/* Product */}
          <div className="flex items-start gap-2 mb-2">
            <div 
              className={cn("w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden bg-gray-900", borderRadius.input)}
            >
              {productImage ? (
                <img src={productImage} alt={productName} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[8px] leading-tight" style={{ color: textPrimary }}>
                {productName}
              </h3>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-1 text-[7px] border-t pt-2" style={{ borderColor: borderCol }}>
            <div className="flex justify-between">
              <span style={{ color: textSecondary }}>{isSubscription ? 'Assinatura' : 'Produto'}</span>
              <span style={{ color: textPrimary }}>{formatCurrency(productPrice)}</span>
            </div>
            {orderBumps.length > 0 && orderBumpsTotal > 0 && (
              <div className="flex justify-between">
                <span style={{ color: textSecondary }}>Adicionais ({orderBumps.filter(b => b.is_active !== false).length})</span>
                <span style={{ color: '#22c55e' }}>+{formatCurrency(orderBumpsTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: borderCol }}>
              <span style={{ color: textPrimary }}>{isSubscription ? 'Total Recorrente' : 'Total'}</span>
              <div className="text-right">
                <span className="text-[9px]" style={{ color: totalValueColor }}>{formatCurrency(totalPrice)}</span>
                {isSubscription && <span className="text-[6px] ml-0.5" style={{ color: textSecondary }}>/mês</span>}
              </div>
            </div>
          </div>

          {/* Coupon Field */}
          {settings.coupon_enabled && (
            <div className="pt-2 mt-2 border-t" style={{ borderColor: borderCol }}>
              <div className="flex gap-1">
                <div 
                  className={cn("flex-1 px-2 py-1.5 text-[6px] flex items-center gap-1", borderRadius.input)}
                  style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${borderCol}`, color: textSecondary }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>Cupom de desconto</span>
                </div>
                <button 
                  className={cn("px-2 py-1.5 text-[6px] font-medium", borderRadius.input)}
                  style={{ backgroundColor: primaryColor, color: '#ffffff' }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payment Form Section */}
        <div 
          className={cn("m-2 mt-0 p-3", borderRadius.card)}
          style={{ backgroundColor: cardBg, border: `1px solid ${borderCol}` }}
        >
          <h2 className="text-[9px] font-bold mb-2" style={{ color: textPrimary }}>
            Dados de pagamento
          </h2>

          {/* Form Fields */}
          <div className="space-y-2 mb-2">
            {/* Name field with error */}
            <div>
              <label className="text-[6px] font-medium mb-0.5 block" style={{ color: textPrimary }}>
                Nome completo *
              </label>
              <div 
                className={cn("px-2 py-1.5 text-[6px] border-red-500 border", borderRadius.input)}
                style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', color: textSecondary }}
              >
                Seu nome completo
              </div>
              <p className="text-[5px] text-red-500 mt-0.5">Nome deve ter pelo menos 3 caracteres</p>
            </div>

            {settings.require_email !== false && (
              <div>
                <label className="text-[6px] font-medium mb-0.5 block" style={{ color: textPrimary }}>
                  E-mail
                </label>
                <div 
                  className={cn("px-2 py-1.5 text-[6px]", borderRadius.input)}
                  style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${borderCol}`, color: textSecondary }}
                >
                  seu@email.com (opcional)
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[6px] font-medium mb-0.5 block" style={{ color: textPrimary }}>
                  {settings.document_type_accepted === 'cnpj' ? 'CNPJ' : 'CPF'} *
                </label>
                <div 
                  className={cn("px-2 py-1.5 text-[6px]", borderRadius.input)}
                  style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${borderCol}`, color: textSecondary }}
                >
                  {settings.document_type_accepted === 'cnpj' ? '00.000.000/0001-' : '000.000.000-00'}
                </div>
              </div>
              {settings.require_phone && (
                <div>
                  <label className="text-[6px] font-medium mb-0.5 block" style={{ color: textPrimary }}>
                    Telefone *
                  </label>
                  <div 
                    className={cn("px-2 py-1.5 text-[6px]", borderRadius.input)}
                    style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${borderCol}`, color: textSecondary }}
                  >
                    (00) 00000-0000
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-2">
            <label className="text-[6px] font-medium mb-1 block" style={{ color: textPrimary }}>
              Forma de pagamento
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {settings.pix_enabled && (
                <div 
                  className={cn("p-2 flex flex-col items-center gap-0.5", borderRadius.input)}
                  style={{ 
                    backgroundColor: '#1e293b',
                    border: '2px solid #1e293b',
                  }}
                >
                  <Smartphone className="w-3 h-3 text-white" />
                  <span className="text-[6px] font-semibold text-white">PIX</span>
                  <span className="text-[4px] text-gray-300">Aprovação imediata</span>
                </div>
              )}
              {settings.credit_card_enabled && (
                <div 
                  className={cn("p-2 flex flex-col items-center gap-0.5 opacity-60", borderRadius.input)}
                  style={{ 
                    backgroundColor: 'transparent', 
                    border: `1px solid ${borderCol}`,
                  }}
                >
                  <CreditCard className="w-3 h-3" style={{ color: textSecondary }} />
                  <span className="text-[6px] font-medium" style={{ color: textSecondary }}>Cartão</span>
                </div>
              )}
            </div>
          </div>

          {/* Order Bump - Mini version */}
          {settings.order_bump_enabled && orderBumps.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {orderBumps.filter(b => b.is_active !== false).slice(0, 1).map((bump) => {
                const hasDiscount = bump.discount_price !== null && bump.discount_price !== undefined && bump.discount_price < bump.price;
                const finalPrice = bump.discount_price ?? bump.price;
                
                return (
                  <div 
                    key={bump.id}
                    className={cn("overflow-hidden border-2 border-green-500", borderRadius.input)}
                  >
                    {/* Header */}
                    <div className="py-0.5 px-1.5 bg-green-500 text-white text-center">
                      <span className="text-[5px] font-semibold uppercase">
                        ⚡ {bump.sales_phrase || 'NÃO PERCA ESSA OPORTUNIDADE'}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="p-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                        {bump.image_url && (
                          <img 
                            src={bump.image_url} 
                            alt={bump.name}
                            className="w-6 h-6 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[6px] truncate" style={{ color: textPrimary }}>{bump.name}</p>
                          <div className="flex items-center gap-0.5 text-[5px]">
                            {hasDiscount && (
                              <>
                                <span style={{ color: textSecondary }}>De</span>
                                <span className="line-through text-red-500">{formatCurrency(bump.price)}</span>
                                <span style={{ color: textSecondary }}>por</span>
                              </>
                            )}
                            <span className="font-semibold text-green-600">{formatCurrency(finalPrice)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Buy Button */}
          <button 
            className={cn("w-full py-2 font-bold text-[8px] text-white", borderRadius.button)}
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            {settings.button_text || 'COMPRAR'}
          </button>

          {/* Security Seals */}
          {settings.security_seals_enabled && (
            <div 
              className={cn("flex items-center justify-center gap-3 mt-2 p-1.5", borderRadius.card)}
              style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', border: `1px solid ${borderCol}` }}
            >
              {settings.security_seal_secure_purchase && (
                <div className="flex items-center gap-0.5">
                  <Lock className="w-2 h-2" style={{ color: textSecondary }} />
                  <span className="text-[4px]" style={{ color: textSecondary }}>Compra Segura</span>
                </div>
              )}
              {settings.security_seal_secure_site && (
                <div className="flex items-center gap-0.5">
                  <CheckCircle className="w-2 h-2 text-green-500" />
                  <span className="text-[4px]" style={{ color: textSecondary }}>Site Protegido</span>
                </div>
              )}
              {settings.security_seal_guarantee && (
                <div className="flex items-center gap-0.5">
                  <Shield className="w-2 h-2" style={{ color: textSecondary }} />
                  <span className="text-[4px]" style={{ color: textSecondary }}>Garantia</span>
                </div>
              )}
            </div>
          )}

          {/* Terms */}
          <p className="text-[4px] text-center mt-1.5" style={{ color: textSecondary }}>
            Ao clicar em pagar, você concorda com os termos de uso e política de privacidade.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPreview;