import { CreditCard, Clock, Smartphone, ShoppingBag, ShoppingCart, Check, CheckCircle, Minus, Plus, Tag } from "lucide-react";
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

interface CheckoutDesktopPreviewProps {
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
    show_banner?: boolean;
    banner_url: string | null;
    marquee_enabled: boolean;
    marquee_text: string | null;
    headline: string | null;
    invert_columns?: boolean;
    require_email?: boolean;
    require_phone?: boolean;
    require_document?: boolean;
    document_type_accepted?: string;
    security_seals_enabled?: boolean;
    security_seal_secure_site?: boolean;
    security_seal_secure_purchase?: boolean;
    security_seal_guarantee?: boolean;
    security_seal_secure_site_text?: string;
    security_seal_secure_purchase_text?: string;
    security_seal_guarantee_text?: string;
    total_value_color?: string;
    order_bump_enabled?: boolean;
    coupon_enabled?: boolean;
    quantity_selector_enabled?: boolean;
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
  };
  productName: string;
  productPrice?: number;
  productImage?: string | null;
  orderBumps?: OrderBump[];
  isSubscription?: boolean;
}

const CheckoutDesktopPreview = ({ 
  settings, 
  productName, 
  productPrice = 297, 
  productImage,
  orderBumps = [],
  isSubscription = false,
}: CheckoutDesktopPreviewProps) => {
  const isDark = settings.theme_mode === 'dark';
  const timerColor = settings.timer_color || '#000000';
  const timerTextColor = settings.timer_text_color || '#ffffff';
  const totalValueColor = settings.total_value_color || '#22c55e';
  const buttonBgColor = settings.button_background_color || '#22c55e';
  const buttonTextColor = settings.button_text_color || '#ffffff';

  // Theme colors
  const theme = {
    bg: isDark ? '#0f172a' : '#f3f4f6',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    cardBorder: isDark ? '#334155' : '#e5e7eb',
    text: isDark ? '#f8fafc' : '#111827',
    textMuted: isDark ? '#94a3b8' : '#6b7280',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    inputBorder: isDark ? '#334155' : '#e5e7eb',
    divider: isDark ? '#334155' : '#f3f4f6',
  };

  // Calculate order bumps total
  const orderBumpsTotal = orderBumps
    .filter(b => b.is_active !== false)
    .reduce((sum, bump) => sum + (bump.discount_price ?? bump.price), 0);

  const totalPrice = productPrice + orderBumpsTotal;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Border radius based on border_style
  const getBorderRadius = () => {
    switch (settings.border_style) {
      case 'rounded': return { card: 'rounded-xl', input: 'rounded-lg', button: 'rounded-lg' };
      case 'semi': return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-md' };
      case 'square': return { card: 'rounded-none', input: 'rounded-none', button: 'rounded-none' };
      default: return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-md' };
    }
  };
  const borderRadius = getBorderRadius();

  // Get active notification text for preview
  const getActiveNotificationText = () => {
    if (!settings.social_proof_enabled) return null;
    
    const notifications = [
      { enabled: settings.social_proof_notification_1_enabled, text: settings.social_proof_notification_1_text },
      { enabled: settings.social_proof_notification_2_enabled, text: settings.social_proof_notification_2_text },
      { enabled: settings.social_proof_notification_3_enabled, text: settings.social_proof_notification_3_text },
      { enabled: settings.social_proof_notification_4_enabled, text: settings.social_proof_notification_4_text },
    ];
    
    const activeNotification = notifications.find(n => n.enabled && n.text);
    if (!activeNotification) return null;
    
    // Replace variables with sample values
    return activeNotification.text
      ?.replace('{quantidadePessoas}', '8')
      .replace('{nomeProduto}', productName)
      .replace('{nomeHomem}', 'Carlos')
      .replace('{nomeMulher}', 'Maria')
      .replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers for preview
  };

  const notificationText = getActiveNotificationText();

  return (
    <div className="w-full min-h-[600px] flex flex-col overflow-hidden relative" style={{ backgroundColor: theme.bg, color: theme.text }}>
      {/* Social Proof Notification Preview */}
      {notificationText && (
        <div 
          className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5 px-3 py-2.5 rounded-xl shadow-lg max-w-[260px]"
          style={{ 
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)'}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-4 h-4 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
              <span className={`text-[9px] font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                Compra verificada
              </span>
            </div>
            <p className="text-[10px] leading-snug" style={{ color: theme.text }}>
              {notificationText}
            </p>
          </div>
        </div>
      )}
      {/* Timer Bar */}
      {settings.show_timer && (
        <div 
          className="px-4 py-2.5 flex items-center justify-center gap-2"
          style={{ backgroundColor: timerColor, color: timerTextColor }}
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{settings.timer_text}</span>
          <span className="text-base font-bold">{settings.timer_minutes}:00</span>
        </div>
      )}

      {/* Banner */}
      {settings.show_banner && settings.banner_url && (
        <div className="w-full">
          <img 
            src={settings.banner_url} 
            alt="Banner" 
            className="w-full h-auto object-cover max-h-32"
          />
        </div>
      )}

      {/* Header with secure badge */}
      <div className="flex justify-end px-6 py-2" style={{ backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.divider}` }}>
        <div className="flex items-center gap-1.5 text-sm" style={{ color: theme.textMuted }}>
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>Pagamento seguro</span>
        </div>
      </div>

      {/* Main Content - Single Column */}
      <div className="flex-1 p-4" style={{ backgroundColor: theme.bg }}>
        <div className="max-w-md mx-auto space-y-4">
          {/* Order Summary Card */}
          <div className={cn("p-4", borderRadius.card)} style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
            <h2 className="text-base font-bold mb-4" style={{ color: theme.text }}>Resumo do pedido</h2>
            
            {/* Product */}
            <div className="flex items-start gap-3 mb-4">
              <div className={cn("w-12 h-12 flex-shrink-0 flex items-center justify-center overflow-hidden", borderRadius.input)} style={{ backgroundColor: isDark ? '#334155' : '#111827' }}>
                {productImage ? (
                  <img src={productImage} alt={productName} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-sm leading-tight" style={{ color: theme.text }}>{productName}</h3>
              </div>
            </div>

            {/* Quantity Selector */}
            {settings.quantity_selector_enabled && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm" style={{ color: theme.textMuted }}>Quantidade</span>
                <div className="flex items-center gap-2">
                  <button className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1px solid ${theme.cardBorder}`, color: theme.textMuted }}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-medium w-4 text-center" style={{ color: theme.text }}>1</span>
                  <button className="w-6 h-6 rounded-full flex items-center justify-center" style={{ border: `1px solid ${theme.cardBorder}`, color: theme.textMuted }}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Pricing Lines */}
            <div className="space-y-1.5 text-sm pt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
              <div className="flex items-center justify-between">
                <span style={{ color: theme.textMuted }}>{isSubscription ? 'Assinatura' : 'Produto'}</span>
                <span className="font-medium" style={{ color: theme.text }}>{formatCurrency(productPrice)}</span>
              </div>
              
              {orderBumps.length > 0 && orderBumpsTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span style={{ color: theme.textMuted }}>Adicionais ({orderBumps.filter(b => b.is_active !== false).length})</span>
                  <span className="text-green-500 font-medium">+{formatCurrency(orderBumpsTotal)}</span>
                </div>
              )}
            </div>

            <div className="my-3" style={{ borderTop: `1px solid ${theme.divider}` }} />

            <div className="flex items-center justify-between">
              <span className="font-medium text-sm" style={{ color: theme.textMuted }}>
                {isSubscription ? 'Total Recorrente' : 'Total'}
              </span>
              <div className="text-right">
                <span className="text-xl font-bold" style={{ color: theme.text }}>
                  {formatCurrency(totalPrice)}
                </span>
                {isSubscription && <span className="text-xs ml-1" style={{ color: theme.textMuted }}>/mês</span>}
              </div>
            </div>

            {/* Coupon Field */}
            {settings.coupon_enabled && (
              <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${theme.divider}` }}>
                <div className="flex gap-2">
                  <div 
                    className={cn("flex-1 px-3 py-2 text-sm flex items-center gap-2", borderRadius.input)}
                    style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted }}
                  >
                    <Tag className="w-4 h-4" />
                    <span>Cupom de desconto</span>
                  </div>
                  <button 
                    className={cn("px-4 py-2 text-sm font-medium", borderRadius.input)}
                    style={{ backgroundColor: settings.primary_color, color: '#ffffff' }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Payment Form Card */}
          <div className={cn("p-4", borderRadius.card)} style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
            <h2 className="text-base font-bold mb-4" style={{ color: theme.text }}>Dados de pagamento</h2>

            {/* Form Fields */}
            <div className="space-y-3">
              {/* Nome completo */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: theme.text }}>Nome completo *</label>
                <input 
                  type="text" 
                  placeholder="Seu nome completo"
                  className={cn("w-full px-3 py-2.5 text-sm", borderRadius.input)}
                  style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted }}
                  disabled
                />
              </div>

              {/* Email */}
              {settings.require_email !== false && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: theme.text }}>E-mail</label>
                  <input 
                    type="email" 
                    placeholder="seu@email.com (opcional)"
                    className={cn("w-full px-3 py-2.5 text-sm", borderRadius.input)}
                    style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted }}
                    disabled
                  />
                </div>
              )}

              {/* CPF and Phone in row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block" style={{ color: theme.text }}>
                    {settings.document_type_accepted === 'cnpj' ? 'CNPJ' : 'CPF'} *
                  </label>
                  <input 
                    type="text" 
                    placeholder={settings.document_type_accepted === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                    className={cn("w-full px-3 py-2.5 text-sm", borderRadius.input)}
                    style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted }}
                    disabled
                  />
                </div>

                {settings.require_phone && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block" style={{ color: theme.text }}>Telefone *</label>
                    <input 
                      type="text" 
                      placeholder="(00) 00000-0000"
                      className={cn("w-full px-3 py-2.5 text-sm", borderRadius.input)}
                      style={{ backgroundColor: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMuted }}
                      disabled
                    />
                  </div>
                )}
              </div>

              <div className="my-2" style={{ borderTop: `1px solid ${theme.divider}` }} />

              {/* Payment Method */}
              <div>
                <label className="text-sm font-medium mb-3 block" style={{ color: theme.text }}>Forma de pagamento</label>
                <div className="flex gap-3">
                  {settings.pix_enabled && (
                    <div className={cn("p-3 flex flex-col items-center gap-1.5", borderRadius.card)} style={{ border: `2px solid ${theme.text}`, backgroundColor: theme.cardBg, minWidth: '90px' }}>
                      <Smartphone className="w-5 h-5" style={{ color: theme.text }} />
                      <span className="text-xs font-semibold" style={{ color: theme.text }}>PIX</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: theme.text, color: theme.cardBg }}>
                        Aprovação Imediata
                      </span>
                    </div>
                  )}
                  {settings.credit_card_enabled && (
                    <div className={cn("p-3 flex flex-col items-center gap-1.5 opacity-60", borderRadius.card)} style={{ border: `1px solid ${theme.cardBorder}`, backgroundColor: theme.cardBg, minWidth: '90px' }}>
                      <CreditCard className="w-5 h-5" style={{ color: theme.textMuted }} />
                      <span className="text-xs font-medium" style={{ color: theme.textMuted }}>Cartão</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Bump Section */}
              {settings.order_bump_enabled && orderBumps.length > 0 && (
                <div className="space-y-3 mt-3">
                  {orderBumps.filter(b => b.is_active !== false).map((bump) => {
                    const hasDiscount = bump.discount_price !== null && bump.discount_price !== undefined && bump.discount_price < bump.price;
                    const finalPrice = bump.discount_price ?? bump.price;
                    
                    return (
                      <div 
                        key={bump.id}
                        className={cn("relative overflow-hidden", borderRadius.card)}
                        style={{ border: `1px solid ${theme.cardBorder}` }}
                      >
                        {/* Header */}
                        <div className="py-1.5 px-3 bg-blue-600 text-white">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide">
                              ⚡ {bump.sales_phrase || 'NÃO PERCA ESSA OPORTUNIDADE'}
                            </span>
                          </div>
                          {bump.auxiliary_phrase && (
                            <p className="text-center text-[10px] text-white/90 mt-0.5">{bump.auxiliary_phrase}</p>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="p-3" style={{ backgroundColor: isDark ? '#1e293b' : '#f9fafb' }}>
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0">
                              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            </div>
                            
                            {bump.image_url && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={bump.image_url} 
                                  alt={bump.name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-xs" style={{ color: theme.text }}>{bump.name}</p>
                              {bump.description && (
                                <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: theme.textMuted }}>{bump.description}</p>
                              )}
                              <div className="flex items-center gap-1 mt-1 text-xs">
                                {hasDiscount ? (
                                  <>
                                    <span style={{ color: theme.textMuted }}>De</span>
                                    <span className="line-through text-red-500">{formatCurrency(bump.price)}</span>
                                    <span style={{ color: theme.textMuted }}>por</span>
                                  </>
                                ) : (
                                  <span style={{ color: theme.textMuted }}>Por</span>
                                )}
                                <span className="font-bold text-green-500">{formatCurrency(finalPrice)}</span>
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
                className={cn("w-full py-3 font-bold text-sm uppercase tracking-wide mt-3", borderRadius.button)}
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              >
                {settings.button_text || 'COMPRAR'}
              </button>

              {/* Security Seals */}
              {settings.security_seals_enabled && (
                <div className={cn("flex items-center justify-around mt-3 p-2", borderRadius.card)} style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
                  {settings.security_seal_secure_purchase && (
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.textMuted }}>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-medium" style={{ color: theme.text }}>Compra</div>
                        <div>100% Segura</div>
                      </div>
                    </div>
                  )}
                  {settings.security_seal_secure_site && (
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.textMuted }}>
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <div className="text-left">
                        <div className="font-medium" style={{ color: theme.text }}>Site Protegido</div>
                        <div>com Criptografia</div>
                      </div>
                    </div>
                  )}
                  {settings.security_seal_guarantee && (
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.textMuted }}>
                      <div className="w-4 h-4 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div className="text-left">
                        <div className="font-medium" style={{ color: theme.text }}>Garantia</div>
                        <div>Total de Satisfação</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer text */}
              <p className="text-[10px] text-center mt-3" style={{ color: theme.textMuted }}>
                Ao clicar em pagar, você concorda com os termos de uso e política de privacidade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutDesktopPreview;
