import { memo, useCallback, useMemo } from "react";

// ============================================================
// ISOLATED ORDER BUMP COMPONENT
// - All styles are inline (no CSS classes that could leak)
// - No global selectors, no inherit, no currentColor
// - Scoped to .ob-root container
// - Communicates via controlled callback only
// ============================================================

interface OrderBump {
  id: string;
  product_id: string;
  bump_product_id?: string | null;
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
  auxiliary_phrase: string | null;
  highlight_color?: string | null;
}

interface OrderBumpCardProps {
  bump: OrderBump;
  isSelected: boolean;
  onToggle: (bumpId: string) => void;
  primaryColor: string;
  formatCurrency: (value: number) => string;
  borderRadius?: string;
  isLightTheme?: boolean;
}

// Isolated color palette - no CSS variables, no inheritance
const COLORS = {
  // Light theme
  light: {
    background: '#ffffff',
    backgroundSelected: '#f0fdf4',
    border: '#e2e8f0',
    borderSelected: '#22c55e',
    text: '#0f172a',
    textMuted: '#64748b',
    textSuccess: '#16a34a',
    checkboxBg: '#f1f5f9',
    checkboxBorder: '#cbd5e1',
    checkboxChecked: '#22c55e',
    badgeBg: '#dcfce7',
    badgeText: '#166534',
    subscriptionBg: '#f3e8ff',
    subscriptionText: '#7c3aed',
    discountBg: '#fef2f2',
    discountText: '#dc2626',
    ctaBg: '#f8fafc',
    ctaText: '#64748b',
  },
  // Dark theme
  dark: {
    background: '#1e293b',
    backgroundSelected: '#14532d20',
    border: '#334155',
    borderSelected: '#22c55e',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textSuccess: '#4ade80',
    checkboxBg: '#334155',
    checkboxBorder: '#475569',
    checkboxChecked: '#22c55e',
    badgeBg: '#16a34a20',
    badgeText: '#4ade80',
    subscriptionBg: '#7c3aed20',
    subscriptionText: '#a78bfa',
    discountBg: '#dc262620',
    discountText: '#f87171',
    ctaBg: '#1e293b80',
    ctaText: '#94a3b8',
  },
};

// SVG Icons as inline components (no external dependencies)
const CheckIcon = ({ color = '#ffffff', size = 16 }: { color?: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="3" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ZapIcon = ({ color = '#ffffff', size = 16 }: { color?: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const RefreshIcon = ({ color = '#a78bfa', size = 12 }: { color?: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const GiftIcon = ({ color = '#64748b', size = 12 }: { color?: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </svg>
);

const OrderBumpCard = memo(({
  bump,
  isSelected,
  onToggle,
  primaryColor,
  formatCurrency,
  isLightTheme = false,
}: OrderBumpCardProps) => {
  // Get theme colors
  const theme = isLightTheme ? COLORS.light : COLORS.dark;
  
  // Always use blue (#3b82f6) as default
  const highlightColor = '#3b82f6';

  // Memoized calculations
  const hasDiscount = useMemo(() => {
    return bump.discount_price !== null && bump.discount_price < bump.price;
  }, [bump.discount_price, bump.price]);

  const finalPrice = useMemo(() => {
    const price = bump.discount_price ?? bump.price;
    return Math.max(0.01, price);
  }, [bump.discount_price, bump.price]);

  const savingsPercentage = useMemo(() => {
    if (!hasDiscount || bump.price === 0) return 0;
    return Math.round(((bump.price - finalPrice) / bump.price) * 100);
  }, [hasDiscount, bump.price, finalPrice]);

  const subscriptionLabel = useMemo(() => {
    if (!bump.is_subscription) return null;
    switch (bump.subscription_interval) {
      case 'monthly': return 'Cobrança mensal';
      case 'quarterly': return 'Cobrança trimestral';
      case 'yearly': return 'Cobrança anual';
      default: return 'Assinatura';
    }
  }, [bump.is_subscription, bump.subscription_interval]);

  // Handlers - scoped to this component only
  const handleClick = useCallback(() => {
    onToggle(bump.id);
  }, [onToggle, bump.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onToggle(bump.id);
    }
  }, [onToggle, bump.id]);

  // Validate data
  if (!bump.id || !bump.name) {
    return null;
  }

  // ============================================================
  // INLINE STYLES - Complete isolation, no CSS classes
  // ============================================================
  
  const rootStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: isSelected ? theme.backgroundSelected : theme.background,
    border: `2px solid ${isSelected ? theme.borderSelected : highlightColor}`,
    boxShadow: isSelected 
      ? `0 4px 20px ${theme.borderSelected}30` 
      : '0 1px 3px rgba(0,0,0,0.1)',
    isolation: 'isolate', // CSS isolation
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: isSelected ? '#22c55e' : highlightColor,
    transition: 'background-color 0.2s ease',
  };

  const headerTextStyle: React.CSSProperties = {
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    margin: 0,
    padding: 0,
  };

  const badgeStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
  };

  const contentStyle: React.CSSProperties = {
    padding: '16px',
  };

  const contentRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  };

  const checkboxContainerStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSelected ? theme.checkboxChecked : theme.checkboxBg,
    border: isSelected ? 'none' : `2px solid ${theme.checkboxBorder}`,
    transition: 'all 0.2s ease',
    boxShadow: isSelected ? `0 2px 8px ${theme.checkboxChecked}40` : 'none',
  };

  const imageContainerStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '64px',
    height: '64px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: isSelected ? `2px solid ${theme.borderSelected}50` : 'none',
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  };

  const discountBadgeStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '9px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
  };

  const textContainerStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const auxiliaryTextStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: theme.textMuted,
    marginBottom: '4px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: theme.text,
    lineHeight: 1.3,
    margin: 0,
    padding: 0,
  };

  const subscriptionBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    backgroundColor: theme.subscriptionBg,
    color: theme.subscriptionText,
    fontSize: '11px',
    fontWeight: 500,
  };

  const priceContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap' as const,
  };

  const originalPriceStyle: React.CSSProperties = {
    fontSize: '13px',
    color: '#ef4444',
    textDecoration: 'line-through',
  };

  const finalPriceStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#22c55e',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: theme.textMuted,
    marginTop: '6px',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };

  const confirmationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: `1px solid ${theme.borderSelected}40`,
  };

  const confirmationDotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: theme.textSuccess,
    animation: 'ob-pulse 2s ease-in-out infinite',
  };

  const confirmationTextStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.textSuccess,
  };

  const ctaStyle: React.CSSProperties = {
    marginTop: '12px',
    padding: '8px',
    borderRadius: '8px',
    backgroundColor: theme.ctaBg,
    textAlign: 'center' as const,
  };

  const ctaTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: theme.ctaText,
  };

  return (
    <>
      {/* Scoped keyframe animation */}
      <style>
        {`
          @keyframes ob-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }
        `}
      </style>
      
      {/* Isolated root container */}
      <div
        className="ob-root"
        data-ob-id={bump.id}
        data-ob-selected={isSelected}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? 'Remover' : 'Adicionar'} ${bump.name} por ${formatCurrency(finalPrice)}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={rootStyle}
      >
        {/* Header */}
        <div className="ob-header" style={headerStyle}>
          {isSelected ? (
            <>
              <CheckIcon color="#ffffff" size={16} />
              <span style={headerTextStyle}>Adicionado ao pedido!</span>
            </>
          ) : (
            <>
              <ZapIcon color="#ffffff" size={16} />
              <span style={headerTextStyle}>Oferta Especial</span>
              {savingsPercentage > 0 && (
                <span style={badgeStyle}>-{savingsPercentage}%</span>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="ob-content" style={contentStyle}>
          <div className="ob-row" style={contentRowStyle}>
            {/* Checkbox */}
            <div 
              className="ob-checkbox" 
              style={checkboxContainerStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {isSelected && <CheckIcon color="#ffffff" size={16} />}
            </div>

            {/* Image */}
            {bump.image_url && (
              <div className="ob-image" style={imageContainerStyle}>
                <img
                  src={bump.image_url}
                  alt={bump.name}
                  style={imageStyle}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {hasDiscount && !isSelected && (
                  <span style={discountBadgeStyle}>-{savingsPercentage}%</span>
                )}
              </div>
            )}

            {/* Text */}
            <div className="ob-text" style={textContainerStyle}>
              {bump.auxiliary_phrase && (
                <div style={auxiliaryTextStyle}>
                  <GiftIcon color={theme.textMuted} size={12} />
                  <span>{bump.auxiliary_phrase}</span>
                </div>
              )}

              <h4 className="ob-title" style={titleStyle}>
                {bump.name}
              </h4>

              {bump.is_subscription && subscriptionLabel && (
                <div style={subscriptionBadgeStyle}>
                  <RefreshIcon color={theme.subscriptionText} size={12} />
                  <span>{subscriptionLabel}</span>
                </div>
              )}

              <div className="ob-price" style={priceContainerStyle}>
                {hasDiscount && (
                  <>
                    <span style={{ fontSize: '13px', color: theme.textMuted }}>De</span>
                    <span style={originalPriceStyle}>{formatCurrency(bump.price)}</span>
                    <span style={{ fontSize: '13px', color: theme.textMuted }}>por apenas</span>
                  </>
                )}
                {!hasDiscount && (
                  <span style={{ fontSize: '13px', color: theme.textMuted }}>Por</span>
                )}
                <span style={finalPriceStyle}>{formatCurrency(finalPrice)}</span>
              </div>

              {bump.description && (
                <p className="ob-description" style={descriptionStyle}>
                  {bump.description}
                </p>
              )}
            </div>
          </div>

          {/* Selected confirmation */}
          {isSelected && (
            <div className="ob-confirmation" style={confirmationStyle}>
              <div style={confirmationDotStyle} />
              <span style={confirmationTextStyle}>Incluído no total do pedido</span>
            </div>
          )}

          {/* CTA when not selected */}
          {!isSelected && (
            <div className="ob-cta" style={ctaStyle}>
              <span style={ctaTextStyle}>Toque para adicionar ao pedido</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

OrderBumpCard.displayName = 'OrderBumpCard';

export default OrderBumpCard;