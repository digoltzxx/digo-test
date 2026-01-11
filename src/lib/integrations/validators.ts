// Integration validators - each function validates a specific integration

import { ValidationResult } from './types';

// Mask sensitive values for logging
export const maskCredential = (value: string): string => {
  if (!value || value.length < 8) return '***';
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
};

// Validate URL format
export const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

// Validate HTTPS URL
export const isHttpsUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Check if credential exists and has valid format
export const detectCredential = (
  value: string | undefined,
  expectedFormat?: RegExp
): ValidationResult => {
  if (!value || value.trim() === '') {
    return {
      success: false,
      message: 'Credencial não configurada'
    };
  }

  if (expectedFormat && !expectedFormat.test(value)) {
    return {
      success: false,
      message: 'Formato de credencial inválido'
    };
  }

  return {
    success: true,
    message: 'Credencial detectada',
    details: { masked: maskCredential(value) }
  };
};

// Webhook validators
export const validateWebhook = {
  detect: (url: string | undefined): ValidationResult => {
    if (!url) {
      return { success: false, message: 'URL do webhook não configurada' };
    }
    if (!isValidUrl(url)) {
      return { success: false, message: 'URL inválida' };
    }
    if (!isHttpsUrl(url)) {
      return { 
        success: true, 
        message: 'URL detectada (recomendado HTTPS)',
        details: { warning: 'Produção requer HTTPS' }
      };
    }
    return { success: true, message: 'URL HTTPS válida detectada' };
  }
};

// Brevo validators
export const validateBrevo = {
  detect: (apiKey: string | undefined): ValidationResult => {
    return detectCredential(apiKey, /^xkeysib-[a-zA-Z0-9-]+$/);
  }
};

// MailerLite validators
export const validateMailerLite = {
  detect: (apiKey: string | undefined): ValidationResult => {
    return detectCredential(apiKey, /^eyJ[a-zA-Z0-9._-]+$/);
  }
};

// Amazon SES validators
export const validateAmazonSES = {
  detect: (accessKey: string | undefined, secretKey: string | undefined, region: string | undefined): ValidationResult => {
    if (!accessKey) {
      return { success: false, message: 'SES_ACCESS_KEY não configurada' };
    }
    if (!secretKey) {
      return { success: false, message: 'SES_SECRET_KEY não configurada' };
    }
    if (!region) {
      return { success: false, message: 'SES_REGION não configurada' };
    }
    const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'ap-southeast-2'];
    if (!validRegions.includes(region)) {
      return { 
        success: false, 
        message: `Região inválida: ${region}`,
        details: { validRegions }
      };
    }
    return { success: true, message: 'Credenciais SES detectadas' };
  }
};

// WhatsApp validators
export const validateWhatsApp = {
  detect: (token: string | undefined, phoneId: string | undefined): ValidationResult => {
    if (!token) {
      return { success: false, message: 'WHATSAPP_TOKEN não configurado' };
    }
    if (!phoneId) {
      return { success: false, message: 'WHATSAPP_PHONE_ID não configurado' };
    }
    if (!/^\d+$/.test(phoneId)) {
      return { success: false, message: 'WHATSAPP_PHONE_ID deve ser numérico' };
    }
    return { success: true, message: 'Credenciais WhatsApp detectadas' };
  }
};

// Telegram validators
export const validateTelegram = {
  detect: (botToken: string | undefined, chatId: string | undefined): ValidationResult => {
    if (!botToken) {
      return { success: false, message: 'TELEGRAM_BOT_TOKEN não configurado' };
    }
    if (!chatId) {
      return { success: false, message: 'TELEGRAM_CHAT_ID não configurado' };
    }
    if (!/^\d+:[a-zA-Z0-9_-]+$/.test(botToken)) {
      return { success: false, message: 'Formato de token Telegram inválido' };
    }
    return { success: true, message: 'Credenciais Telegram detectadas' };
  }
};

// Google Analytics 4 validators
export const validateGA4 = {
  detect: (measurementId: string | undefined, apiSecret: string | undefined): ValidationResult => {
    if (!measurementId) {
      return { success: false, message: 'GA4_MEASUREMENT_ID não configurado' };
    }
    if (!apiSecret) {
      return { success: false, message: 'GA4_API_SECRET não configurado' };
    }
    if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
      return { success: false, message: 'Formato de Measurement ID inválido (esperado: G-XXXXXXXX)' };
    }
    return { success: true, message: 'Credenciais GA4 detectadas' };
  }
};

// GTM validators
export const validateGTM = {
  detect: (containerId: string | undefined): ValidationResult => {
    if (!containerId) {
      return { success: false, message: 'GTM_CONTAINER_ID não configurado' };
    }
    if (!/^GTM-[A-Z0-9]+$/.test(containerId)) {
      return { success: false, message: 'Formato de Container ID inválido (esperado: GTM-XXXXXXX)' };
    }
    return { success: true, message: 'Container GTM detectado' };
  }
};

// UTMify validators
export const validateUTMify = {
  detect: (apiToken: string | undefined): ValidationResult => {
    return detectCredential(apiToken);
  }
};

// HubSpot validators
export const validateHubSpot = {
  detect: (accessToken: string | undefined): ValidationResult => {
    if (!accessToken) {
      return { success: false, message: 'HUBSPOT_ACCESS_TOKEN não configurado' };
    }
    if (!/^pat-[a-zA-Z0-9-]+$/.test(accessToken) && !/^[a-zA-Z0-9-]{30,}$/.test(accessToken)) {
      return { 
        success: true, 
        message: 'Token detectado (formato não padrão)',
        details: { warning: 'Verifique se o token está correto' }
      };
    }
    return { success: true, message: 'Token HubSpot detectado' };
  }
};

// Zapier validators
export const validateZapier = {
  detect: (webhookUrl: string | undefined): ValidationResult => {
    if (!webhookUrl) {
      return { success: false, message: 'ZAPIER_WEBHOOK_URL não configurada' };
    }
    if (!isHttpsUrl(webhookUrl)) {
      return { success: false, message: 'URL Zapier deve usar HTTPS' };
    }
    if (!webhookUrl.includes('hooks.zapier.com')) {
      return { 
        success: true, 
        message: 'URL detectada (domínio não padrão)',
        details: { warning: 'URL não é do domínio hooks.zapier.com' }
      };
    }
    return { success: true, message: 'Webhook Zapier detectado' };
  }
};

// Make validators
export const validateMake = {
  detect: (webhookUrl: string | undefined): ValidationResult => {
    if (!webhookUrl) {
      return { success: false, message: 'MAKE_WEBHOOK_URL não configurada' };
    }
    if (!isHttpsUrl(webhookUrl)) {
      return { success: false, message: 'URL Make deve usar HTTPS' };
    }
    if (!webhookUrl.includes('hook.') && !webhookUrl.includes('make.com')) {
      return { 
        success: true, 
        message: 'URL detectada (domínio não padrão)',
        details: { warning: 'URL não é do domínio make.com' }
      };
    }
    return { success: true, message: 'Webhook Make detectado' };
  }
};

// Sentry validators
export const validateSentry = {
  detect: (dsn: string | undefined): ValidationResult => {
    if (!dsn) {
      return { success: false, message: 'SENTRY_DSN não configurado' };
    }
    if (!/^https:\/\/[a-z0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+$/.test(dsn)) {
      return { 
        success: true, 
        message: 'DSN detectado (formato não padrão)',
        details: { warning: 'Verifique se o DSN está correto' }
      };
    }
    return { success: true, message: 'Sentry DSN detectado' };
  }
};

// reCAPTCHA validators
export const validateReCAPTCHA = {
  detect: (secretKey: string | undefined, siteKey: string | undefined): ValidationResult => {
    if (!secretKey) {
      return { success: false, message: 'RECAPTCHA_SECRET_KEY não configurada' };
    }
    if (!siteKey) {
      return { success: false, message: 'RECAPTCHA_SITE_KEY não configurada' };
    }
    return { success: true, message: 'Credenciais reCAPTCHA detectadas' };
  }
};

// FingerprintJS validators
export const validateFingerprintJS = {
  detect: (apiKey: string | undefined): ValidationResult => {
    return detectCredential(apiKey);
  }
};

// Cloudflare validators
export const validateCloudflare = {
  detect: (apiToken: string | undefined, zoneId: string | undefined): ValidationResult => {
    if (!apiToken) {
      return { success: false, message: 'CLOUDFLARE_API_TOKEN não configurado' };
    }
    if (!zoneId) {
      return { success: false, message: 'CLOUDFLARE_ZONE_ID não configurado' };
    }
    if (!/^[a-f0-9]{32}$/.test(zoneId)) {
      return { 
        success: true, 
        message: 'Zone ID detectado (formato não padrão)',
        details: { warning: 'Zone ID deve ter 32 caracteres hexadecimais' }
      };
    }
    return { success: true, message: 'Credenciais Cloudflare detectadas' };
  }
};
