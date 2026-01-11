import React from 'react';
import logoWebhooks from '@/assets/logo-webhooks.png';
import logoUtmify from '@/assets/logo-utmify.png';
import logoUtmiize from '@/assets/logo-utmiize.png';
import logoTracky from '@/assets/logo-tracky.png';
import logoXtracky from '@/assets/logo-xtracky.png';
import logoEnotas from '@/assets/logo-enotas.png';
import logoMemberkit from '@/assets/logo-memberkit.png';
import logoNotazz from '@/assets/logo-notazz.png';
import logoAstron from '@/assets/logo-astron.png';
import logoBotconversa from '@/assets/logo-botconversa.png';
import logoCademi from '@/assets/logo-cademi.png';
import logoVoxuy from '@/assets/logo-voxuy.png';
import logoPushcut from '@/assets/logo-pushcut.png';

// ═══════════════════════════════════════
// LOGOS SVG PARA INTEGRAÇÕES
// Baseados nos logos reais dos serviços
// ═══════════════════════════════════════

interface LogoProps {
  className?: string;
}

// Webhook - Logo com imagem real
export const WebhookLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoWebhooks} alt="Webhooks" className={`${className} rounded-xl object-cover`} />
);

// Telegram - Logo oficial azul
export const TelegramLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#229ED9" />
    <path d="M28 12L10 19L16 21L18 28L22 24L26 27L28 12Z" fill="white" />
    <path d="M16 21L25 15" stroke="#229ED9" strokeWidth="1" />
  </svg>
);

// UTMify - Logo com imagem real
export const UTMifyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoUtmify} alt="UTMify" className={`${className} rounded-xl object-cover`} />
);

// UTMiize - Logo com imagem real
export const UTMiizeLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoUtmiize} alt="UTMiize" className={`${className} rounded-xl object-cover`} />
);

// Tracky - Logo com imagem real
export const TrackyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoTracky} alt="Tracky" className={`${className} rounded-xl object-cover`} />
);

// XTracky - Logo com imagem real
export const XTrackyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoXtracky} alt="XTracky" className={`${className} rounded-xl object-cover`} />
);

// eNotas - Logo com imagem real
export const ENotasLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoEnotas} alt="eNotas" className={`${className} rounded-xl object-cover`} />
);

// Notazz - Logo com imagem real
export const NotazzLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoNotazz} alt="Notazz" className={`${className} rounded-xl object-cover`} />
);

// Checkoutfy - Logo quadrado geométrico roxo/azul escuro
export const CheckoutfyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#1E1B4B" />
    <rect x="10" y="10" width="8" height="8" rx="2" fill="#6366F1" />
    <rect x="22" y="10" width="8" height="8" rx="2" fill="#8B5CF6" />
    <rect x="10" y="22" width="8" height="8" rx="2" fill="#A78BFA" />
    <rect x="22" y="22" width="8" height="8" rx="2" fill="#C4B5FD" />
  </svg>
);

// Memberkit - Logo com imagem real
export const MemberkitLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoMemberkit} alt="Memberkit" className={`${className} rounded-xl object-cover`} />
);

// Astron Members - Logo com imagem real
export const AstronMembersLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoAstron} alt="Astron Members" className={`${className} rounded-xl object-cover`} />
);

// BotConversa - Logo com imagem real
export const BotConversaLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoBotconversa} alt="BotConversa" className={`${className} rounded-xl object-cover`} />
);

// Hotzapp - Logo rosa/magenta com cruz/flor
export const HotzappLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="url(#hotzappGrad)" />
    <path 
      d="M20 10V30M10 20H30" 
      stroke="white" 
      strokeWidth="4" 
      strokeLinecap="round"
    />
    <circle cx="20" cy="20" r="4" fill="white" />
    <defs>
      <linearGradient id="hotzappGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EC4899" />
        <stop offset="1" stopColor="#DB2777" />
      </linearGradient>
    </defs>
  </svg>
);

// Spedy - Logo verde com S em quadrados
export const SpedyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#111827" />
    <rect x="8" y="8" width="10" height="10" rx="2" fill="#22C55E" />
    <rect x="22" y="8" width="10" height="10" rx="2" fill="#16A34A" />
    <rect x="8" y="22" width="10" height="10" rx="2" fill="#16A34A" />
    <rect x="22" y="22" width="10" height="10" rx="2" fill="#22C55E" />
    <text x="14" y="27" fontSize="14" fontWeight="bold" fontFamily="Arial" fill="white">S</text>
  </svg>
);

// Voozy - Logo circular cyan/teal
export const VoozyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="url(#voozyGrad)" />
    <circle cx="20" cy="20" r="10" fill="none" stroke="white" strokeWidth="3" />
    <circle cx="20" cy="20" r="4" fill="white" />
    <defs>
      <linearGradient id="voozyGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#06B6D4" />
        <stop offset="1" stopColor="#0891B2" />
      </linearGradient>
    </defs>
  </svg>
);

// SellFlux - Logo pessoa/usuário branco
export const SellFluxLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#111827" />
    <circle cx="20" cy="14" r="6" fill="white" />
    <path d="M10 32C10 26.4772 14.4772 22 20 22C25.5228 22 30 26.4772 30 32" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
);

// Cademi - Logo com imagem real
export const CademiLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoCademi} alt="Cademi" className={`${className} rounded-xl object-cover`} />
);

// OneFunnel - Logo F roxo
export const OneFunnelLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#111827" />
    <text x="14" y="28" fontSize="22" fontWeight="bold" fontFamily="Arial" fill="#8B5CF6">F</text>
  </svg>
);

// SMS Funnel - Logo V laranja/rosa gradiente
export const SMSFunnelLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="url(#smsfunnelGrad)" />
    <path d="M12 14L20 26L28 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <defs>
      <linearGradient id="smsfunnelGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F97316" />
        <stop offset="1" stopColor="#EC4899" />
      </linearGradient>
    </defs>
  </svg>
);

// Flash Checkout - Logo X azul
export const FlashCheckoutLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#1E3A8A" />
    <path 
      d="M12 12L28 28M28 12L12 28" 
      stroke="#3B82F6" 
      strokeWidth="5" 
      strokeLinecap="round"
    />
  </svg>
);

// SunizeAPI - Logo S rosa/magenta circular
export const SunizeAPILogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="url(#sunizeGrad)" />
    <path 
      d="M26 14C26 14 24 12 20 12C16 12 14 14 14 17C14 20 16 21 20 22C24 23 26 24 26 27C26 30 24 32 20 32C16 32 14 30 14 30" 
      stroke="white" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
    />
    <defs>
      <linearGradient id="sunizeGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#EC4899" />
        <stop offset="1" stopColor="#DB2777" />
      </linearGradient>
    </defs>
  </svg>
);

// Voxuy - Logo com imagem real
export const VoxuyLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoVoxuy} alt="Voxuy" className={`${className} rounded-xl object-cover`} />
);

// Pushcut - Logo com imagem real
export const PushcutLogo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => (
  <img src={logoPushcut} alt="Pushcut" className={`${className} rounded-xl object-cover`} />
);

// Mapeamento de logos por ID de integração
export const IntegrationLogoMap: Record<string, React.FC<LogoProps>> = {
  webhooks: WebhookLogo,
  telegram: TelegramLogo,
  utmify: UTMifyLogo,
  utmiize: UTMiizeLogo,
  tracky: TrackyLogo,
  xtracky: XTrackyLogo,
  enotas: ENotasLogo,
  notazz: NotazzLogo,
  checkoutfy: CheckoutfyLogo,
  memberkit: MemberkitLogo,
  astron: AstronMembersLogo,
  botconversa: BotConversaLogo,
  hotzapp: HotzappLogo,
  spedy: SpedyLogo,
  voozy: VoozyLogo,
  sellflux: SellFluxLogo,
  cademi: CademiLogo,
  onefunnel: OneFunnelLogo,
  smsfunnel: SMSFunnelLogo,
  flashcheckout: FlashCheckoutLogo,
  sunizeapi: SunizeAPILogo,
  voxuy: VoxuyLogo,
  pushcut: PushcutLogo,
};

// Componente helper para renderizar logo por ID
export const IntegrationLogo: React.FC<{ integrationId: string; className?: string }> = ({ 
  integrationId, 
  className = "w-10 h-10" 
}) => {
  const LogoComponent = IntegrationLogoMap[integrationId];
  
  if (!LogoComponent) {
    // Fallback genérico
    return (
      <div className={`${className} rounded-xl bg-muted flex items-center justify-center`}>
        <span className="text-sm font-bold text-muted-foreground">
          {integrationId.slice(0, 2).toUpperCase()}
        </span>
      </div>
    );
  }
  
  return <LogoComponent className={className} />;
};
