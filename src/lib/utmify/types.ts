/**
 * Tipos para integração com UTMify
 * Baseado na documentação oficial da API UTMify
 */

// ==================== ENUMS ====================

export type UtmifyPaymentMethod = 'credit_card' | 'boleto' | 'pix' | 'paypal' | 'free_price';

export type UtmifyOrderStatus = 'waiting_payment' | 'paid' | 'refused' | 'refunded' | 'chargedback';

export type UtmifyCurrency = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'ARS' | 'CAD';

// ==================== INTERFACES ====================

/**
 * Informações do cliente
 */
export interface UtmifyCustomer {
  /** Nome do comprador */
  name: string;
  /** E-mail do comprador */
  email: string;
  /** Telefone do comprador (apenas números) */
  phone: string;
  /** CPF ou CNPJ do comprador (apenas números) */
  document: string;
  /** País do comprador no formato ISO 3166-1 alfa-2 (ex: "BR") */
  country?: string;
  /** IP do comprador */
  ip?: string;
}

/**
 * Informações do produto
 */
export interface UtmifyProduct {
  /** Identificação do produto */
  id: string;
  /** Nome do produto */
  name: string;
  /** ID do plano (se houver) */
  planId: string | null;
  /** Nome do plano (se houver) */
  planName: string | null;
  /** Quantidade */
  quantity: number;
  /** Preço em centavos */
  priceInCents: number;
}

/**
 * Parâmetros de rastreamento (UTMs)
 */
export interface UtmifyTrackingParameters {
  /** Valor do src extraído da URL */
  src: string | null;
  /** Valor do sck extraído da URL */
  sck: string | null;
  /** utm_source */
  utm_source: string | null;
  /** utm_campaign */
  utm_campaign: string | null;
  /** utm_medium */
  utm_medium: string | null;
  /** utm_content */
  utm_content: string | null;
  /** utm_term */
  utm_term: string | null;
}

/**
 * Valores da transação
 */
export interface UtmifyCommission {
  /** Valor total da transação em centavos */
  totalPriceInCents: number;
  /** Taxa do gateway em centavos */
  gatewayFeeInCents: number;
  /** Comissão do usuário em centavos */
  userCommissionInCents: number;
  /** Moeda (opcional se BRL) */
  currency?: UtmifyCurrency;
}

/**
 * Payload completo para envio à UTMify
 */
export interface UtmifyOrderPayload {
  /** Identificação do pedido na plataforma */
  orderId: string;
  /** Nome da plataforma (formato PascalCase) */
  platform: string;
  /** Método de pagamento */
  paymentMethod: UtmifyPaymentMethod;
  /** Status do pagamento */
  status: UtmifyOrderStatus;
  /** Data de criação (UTC) - formato: YYYY-MM-DD HH:MM:SS */
  createdAt: string;
  /** Data de aprovação (UTC) - formato: YYYY-MM-DD HH:MM:SS ou null */
  approvedDate: string | null;
  /** Data de reembolso (UTC) - formato: YYYY-MM-DD HH:MM:SS ou null */
  refundedAt: string | null;
  /** Informações do cliente */
  customer: UtmifyCustomer;
  /** Lista de produtos */
  products: UtmifyProduct[];
  /** Parâmetros de rastreamento */
  trackingParameters: UtmifyTrackingParameters;
  /** Valores da transação */
  commission: UtmifyCommission;
  /** Define se é um envio de teste */
  isTest?: boolean;
}

/**
 * Resposta da API UTMify
 */
export interface UtmifyApiResponse {
  success: boolean;
  message?: string;
  orderId?: string;
  errors?: string[];
}

/**
 * Log de envio para auditoria
 */
export interface UtmifySendLog {
  id: string;
  sale_id: string;
  order_id: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  payload: UtmifyOrderPayload;
  response?: UtmifyApiResponse;
  error_message?: string;
  attempts: number;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

// ==================== HELPERS ====================

/**
 * Formata data para o formato UTMify (YYYY-MM-DD HH:MM:SS em UTC)
 */
export function formatUtmifyDate(date: Date | string | null): string | null {
  if (!date) return null;
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  // Formata em UTC
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Mapeia método de pagamento interno para UTMify
 */
export function mapPaymentMethodToUtmify(method: string): UtmifyPaymentMethod {
  const mapping: Record<string, UtmifyPaymentMethod> = {
    'pix': 'pix',
    'credit_card': 'credit_card',
    'boleto': 'boleto',
    'paypal': 'paypal',
    'free': 'free_price',
  };
  
  return mapping[method.toLowerCase()] || 'credit_card';
}

/**
 * Mapeia status interno para UTMify
 */
export function mapStatusToUtmify(status: string): UtmifyOrderStatus {
  const mapping: Record<string, UtmifyOrderStatus> = {
    'pending': 'waiting_payment',
    'waiting_payment': 'waiting_payment',
    'approved': 'paid',
    'paid': 'paid',
    'failed': 'refused',
    'refused': 'refused',
    'refunded': 'refunded',
    'chargeback': 'chargedback',
    'chargedback': 'chargedback',
  };
  
  return mapping[status.toLowerCase()] || 'waiting_payment';
}

/**
 * Valida se o payload está completo para envio
 */
export function validateUtmifyPayload(payload: Partial<UtmifyOrderPayload>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!payload.orderId) errors.push('orderId é obrigatório');
  if (!payload.platform) errors.push('platform é obrigatório');
  if (!payload.paymentMethod) errors.push('paymentMethod é obrigatório');
  if (!payload.status) errors.push('status é obrigatório');
  if (!payload.createdAt) errors.push('createdAt é obrigatório');
  
  if (!payload.customer) {
    errors.push('customer é obrigatório');
  } else {
    if (!payload.customer.name) errors.push('customer.name é obrigatório');
    if (!payload.customer.email) errors.push('customer.email é obrigatório');
    if (!payload.customer.phone) errors.push('customer.phone é obrigatório');
    if (!payload.customer.document) errors.push('customer.document é obrigatório');
  }
  
  if (!payload.products || payload.products.length === 0) {
    errors.push('products é obrigatório e deve ter ao menos um item');
  }
  
  if (!payload.commission) {
    errors.push('commission é obrigatório');
  } else {
    if (typeof payload.commission.totalPriceInCents !== 'number') {
      errors.push('commission.totalPriceInCents é obrigatório');
    }
    if (typeof payload.commission.gatewayFeeInCents !== 'number') {
      errors.push('commission.gatewayFeeInCents é obrigatório');
    }
    if (typeof payload.commission.userCommissionInCents !== 'number') {
      errors.push('commission.userCommissionInCents é obrigatório');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
