// Integration validation types

export type IntegrationStatus = 'active' | 'inactive' | 'error' | 'validating';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

export interface IntegrationLog {
  integration: string;
  status: IntegrationStatus;
  level: LogLevel;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export interface IntegrationCheckResult {
  id: string;
  name: string;
  status: IntegrationStatus;
  lastValidated: string | null;
  checks: {
    detection: ValidationResult;
    validation: ValidationResult;
    activation: ValidationResult;
  };
  logs: IntegrationLog[];
}

export interface IntegrationConfig {
  id: string;
  name: string;
  icon: string;
  category: string;
  requiredCredentials: string[];
  optionalCredentials?: string[];
  testEndpoint?: string;
  description: string;
}

export const INTEGRATION_CONFIGS: IntegrationConfig[] = [
  {
    id: 'webhooks',
    name: 'Webhooks',
    icon: 'Webhook',
    category: 'Notificações',
    requiredCredentials: ['WEBHOOK_URL'],
    description: 'Notificações em tempo real via HTTP'
  },
  {
    id: 'brevo',
    name: 'Brevo',
    icon: 'Mail',
    category: 'Email',
    requiredCredentials: ['BREVO_API_KEY'],
    description: 'Email transacional e marketing'
  },
  {
    id: 'mailerlite',
    name: 'MailerLite',
    icon: 'Mail',
    category: 'Email',
    requiredCredentials: ['MAILERLITE_API_KEY'],
    description: 'Automação de email marketing'
  },
  {
    id: 'amazon_ses',
    name: 'Amazon SES',
    icon: 'Cloud',
    category: 'Email',
    requiredCredentials: ['SES_ACCESS_KEY', 'SES_SECRET_KEY', 'SES_REGION'],
    description: 'Email em escala via AWS'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API',
    icon: 'MessageCircle',
    category: 'Mensageria',
    requiredCredentials: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID'],
    description: 'Mensagens transacionais via WhatsApp'
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    icon: 'Send',
    category: 'Mensageria',
    requiredCredentials: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
    description: 'Notificações via Telegram'
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics 4',
    icon: 'BarChart3',
    category: 'Analytics',
    requiredCredentials: ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET'],
    description: 'Rastreamento server-side'
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    icon: 'Code',
    category: 'Analytics',
    requiredCredentials: ['GTM_CONTAINER_ID'],
    description: 'Gerenciamento de tags'
  },
  {
    id: 'utmify',
    name: 'UTMify',
    icon: 'Link',
    category: 'Analytics',
    requiredCredentials: ['UTMIFY_API_TOKEN'],
    description: 'Rastreamento de campanhas'
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    icon: 'Users',
    category: 'CRM',
    requiredCredentials: ['HUBSPOT_ACCESS_TOKEN'],
    description: 'Gestão de leads e deals'
  },
  {
    id: 'zapier',
    name: 'Zapier',
    icon: 'Zap',
    category: 'Automação',
    requiredCredentials: ['ZAPIER_WEBHOOK_URL'],
    description: 'Automação de workflows'
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    icon: 'Workflow',
    category: 'Automação',
    requiredCredentials: ['MAKE_WEBHOOK_URL'],
    description: 'Cenários de automação'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    icon: 'Bug',
    category: 'Monitoramento',
    requiredCredentials: ['SENTRY_DSN'],
    description: 'Monitoramento de erros'
  },
  {
    id: 'recaptcha',
    name: 'Google reCAPTCHA',
    icon: 'Shield',
    category: 'Segurança',
    requiredCredentials: ['RECAPTCHA_SECRET_KEY', 'RECAPTCHA_SITE_KEY'],
    description: 'Proteção contra bots'
  },
  {
    id: 'fingerprintjs',
    name: 'FingerprintJS',
    icon: 'Fingerprint',
    category: 'Segurança',
    requiredCredentials: ['FINGERPRINTJS_API_KEY'],
    description: 'Identificação de dispositivos'
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: 'Shield',
    category: 'Segurança',
    requiredCredentials: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID'],
    description: 'Proteção e CDN'
  }
];
