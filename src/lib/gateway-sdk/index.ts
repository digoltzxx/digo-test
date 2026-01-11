/**
 * Royal Pay Gateway SDK
 * 
 * SDK oficial para integração com o gateway de pagamentos Royal Pay.
 * 
 * @example
 * ```typescript
 * import { RoyalPayGateway } from '@/lib/gateway-sdk';
 * 
 * const gateway = new RoyalPayGateway({
 *   apiKey: 'sk_live_abc123',
 *   environment: 'production'
 * });
 * 
 * // Criar checkout
 * const session = await gateway.checkout.create({
 *   productId: 'prod_abc123',
 *   successUrl: 'https://seusite.com/sucesso'
 * });
 * 
 * // Criar transação PIX
 * const transaction = await gateway.transactions.create({
 *   amount: 10000,
 *   paymentMethod: 'pix',
 *   customer: { name: 'João', email: 'joao@email.com', document: '12345678900' }
 * });
 * ```
 */

// ==================== TYPES ====================

export type Environment = 'production' | 'sandbox';
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';
export type TransactionStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'chargeback';
export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type DiscountType = 'percentage' | 'fixed';
export type PixelType = 'facebook' | 'google_analytics' | 'google_ads' | 'tiktok';

export interface GatewayConfig {
  apiKey: string;
  apiSecret?: string;
  environment?: Environment;
  timeout?: number;
}

export interface Customer {
  name: string;
  email: string;
  document: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Card {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface CardSummary {
  brand: string;
  lastDigits: string;
  holderName: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
}

export interface Split {
  recipientId: string;
  type: 'percentage' | 'fixed';
  value: number;
}

// ==================== REQUEST TYPES ====================

export interface CreateCheckoutRequest {
  productId: string;
  successUrl: string;
  cancelUrl?: string;
  customer?: Partial<Customer>;
  couponCode?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateTransactionRequest {
  amount: number;
  paymentMethod: PaymentMethod;
  customer: Customer;
  productId?: string;
  installments?: number;
  card?: Card;
  couponCode?: string;
  split?: Split[];
  metadata?: Record<string, unknown>;
}

export interface CreateCouponRequest {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUses?: number;
  maxUsesPerUser?: number;
  minOrderValue?: number;
  maxDiscountValue?: number;
  startsAt?: string;
  endsAt?: string;
  productIds?: string[];
}

export interface CreateWithdrawalRequest {
  amount: number;
  bankAccountId: string;
}

export interface CreateAnticipationRequest {
  commissionIds: string[];
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface CreatePixelRequest {
  productId: string;
  pixelType: PixelType;
  pixelId: string;
  accessToken?: string;
  measurementId?: string;
  conversionId?: string;
  conversionLabel?: string;
  events?: string[];
}

export interface SandboxSimulateRequest {
  transactionId: string;
  event: 'payment.approved' | 'payment.failed' | 'payment.refunded' | 'payment.chargeback';
  failureReason?: string;
}

// ==================== RESPONSE TYPES ====================

export interface CheckoutSession {
  id: string;
  url: string;
  status: 'open' | 'complete' | 'expired';
  amount: number;
  currency: string;
  product: Product;
  customer?: Customer;
  expiresAt: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  amount: number;
  netAmount: number;
  feeAmount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  installments?: number;
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  boletoDueDate?: string;
  card?: CardSummary;
  customer: Customer;
  product?: Product;
  refunds?: Refund[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  paidAt?: string;
}

export interface Refund {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  currentUses: number;
  maxUses?: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
}

export interface CouponValidation {
  valid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  finalAmount: number;
  error?: string;
}

export interface Commission {
  id: string;
  saleId: string;
  amount: number;
  status: 'pending' | 'available' | 'anticipated' | 'withdrawn';
  recipientId: string;
  recipientName: string;
  availableAt: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: WithdrawalStatus;
  bankAccount: {
    bankName: string;
    agency: string;
    accountNumber: string;
  };
  createdAt: string;
  completedAt?: string;
}

export interface Anticipation {
  id: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  originalAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  commissions: Commission[];
  createdAt: string;
  completedAt?: string;
}

export interface AnticipationSimulation {
  originalAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  availableAt: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Pixel {
  id: string;
  productId: string;
  pixelType: PixelType;
  pixelId: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  actionType: string;
  userId?: string;
  ipAddress?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface GatewayError {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

// ==================== SDK IMPLEMENTATION ====================

class GatewayHttpClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: GatewayConfig) {
    this.baseUrl = config.environment === 'sandbox' 
      ? 'https://sandbox.royalpay.com.br/v1'
      : 'https://api.royalpay.com.br/v1';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-SDK-Version': '1.0.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error = data.error as GatewayError;
        throw new RoyalPayError(error.code, error.message, error.details);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof RoyalPayError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RoyalPayError('timeout', 'Request timeout');
      }
      
      throw new RoyalPayError('network_error', 'Network error occurred');
    }
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }
}

export class RoyalPayError extends Error {
  code: string;
  details?: Array<{ field: string; message: string }>;

  constructor(code: string, message: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'RoyalPayError';
    this.code = code;
    this.details = details;
  }
}

// ==================== RESOURCE CLASSES ====================

class CheckoutResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateCheckoutRequest): Promise<CheckoutSession> {
    return this.client.post<CheckoutSession>('/checkout/sessions', {
      product_id: data.productId,
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      customer: data.customer,
      coupon_code: data.couponCode,
      quantity: data.quantity,
      metadata: data.metadata,
    });
  }

  async retrieve(sessionId: string): Promise<CheckoutSession> {
    return this.client.get<CheckoutSession>(`/checkout/sessions/${sessionId}`);
  }

  async expire(sessionId: string): Promise<void> {
    await this.client.post(`/checkout/sessions/${sessionId}/expire`);
  }
}

class TransactionsResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateTransactionRequest): Promise<Transaction> {
    return this.client.post<Transaction>('/transactions', {
      amount: data.amount,
      payment_method: data.paymentMethod,
      customer: data.customer,
      product_id: data.productId,
      installments: data.installments,
      card: data.card ? {
        number: data.card.number,
        holder_name: data.card.holderName,
        exp_month: data.card.expMonth,
        exp_year: data.card.expYear,
        cvv: data.card.cvv,
      } : undefined,
      coupon_code: data.couponCode,
      split: data.split?.map(s => ({
        recipient_id: s.recipientId,
        type: s.type,
        value: s.value,
      })),
      metadata: data.metadata,
    });
  }

  async retrieve(transactionId: string): Promise<Transaction> {
    return this.client.get<Transaction>(`/transactions/${transactionId}`);
  }

  async list(params?: {
    status?: TransactionStatus;
    paymentMethod?: PaymentMethod;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Transaction>> {
    return this.client.get<PaginatedResponse<Transaction>>('/transactions', {
      status: params?.status,
      payment_method: params?.paymentMethod,
      date_from: params?.dateFrom,
      date_to: params?.dateTo,
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
    } as Record<string, string>);
  }

  async refund(transactionId: string, data?: { amount?: number; reason?: string }): Promise<Refund> {
    return this.client.post<Refund>(`/transactions/${transactionId}/refund`, data);
  }
}

class CouponsResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateCouponRequest): Promise<Coupon> {
    return this.client.post<Coupon>('/coupons', {
      code: data.code,
      discount_type: data.discountType,
      discount_value: data.discountValue,
      max_uses: data.maxUses,
      max_uses_per_user: data.maxUsesPerUser,
      min_order_value: data.minOrderValue,
      max_discount_value: data.maxDiscountValue,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      product_ids: data.productIds,
    });
  }

  async retrieve(couponId: string): Promise<Coupon> {
    return this.client.get<Coupon>(`/coupons/${couponId}`);
  }

  async list(): Promise<PaginatedResponse<Coupon>> {
    return this.client.get<PaginatedResponse<Coupon>>('/coupons');
  }

  async validate(data: { code: string; productId: string; amount: number }): Promise<CouponValidation> {
    return this.client.post<CouponValidation>('/coupons/validate', {
      code: data.code,
      product_id: data.productId,
      amount: data.amount,
    });
  }

  async update(couponId: string, data: { isActive?: boolean; maxUses?: number; endsAt?: string }): Promise<Coupon> {
    return this.client.patch<Coupon>(`/coupons/${couponId}`, {
      is_active: data.isActive,
      max_uses: data.maxUses,
      ends_at: data.endsAt,
    });
  }

  async deactivate(couponId: string): Promise<void> {
    await this.client.delete(`/coupons/${couponId}`);
  }
}

class CommissionsResource {
  constructor(private client: GatewayHttpClient) {}

  async list(params?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Commission>> {
    return this.client.get<PaginatedResponse<Commission>>('/commissions', {
      status: params?.status,
      date_from: params?.dateFrom,
      date_to: params?.dateTo,
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
    } as Record<string, string>);
  }
}

class WithdrawalsResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateWithdrawalRequest): Promise<Withdrawal> {
    return this.client.post<Withdrawal>('/withdrawals', {
      amount: data.amount,
      bank_account_id: data.bankAccountId,
    });
  }

  async retrieve(withdrawalId: string): Promise<Withdrawal> {
    return this.client.get<Withdrawal>(`/withdrawals/${withdrawalId}`);
  }

  async list(params?: {
    status?: WithdrawalStatus;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Withdrawal>> {
    return this.client.get<PaginatedResponse<Withdrawal>>('/withdrawals', {
      status: params?.status,
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
    } as Record<string, string>);
  }

  async cancel(withdrawalId: string): Promise<void> {
    await this.client.post(`/withdrawals/${withdrawalId}/cancel`);
  }
}

class AnticipationsResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateAnticipationRequest): Promise<Anticipation> {
    return this.client.post<Anticipation>('/anticipations', {
      commission_ids: data.commissionIds,
    });
  }

  async simulate(data: { commissionIds: string[] }): Promise<AnticipationSimulation> {
    return this.client.post<AnticipationSimulation>('/anticipations/simulate', {
      commission_ids: data.commissionIds,
    });
  }

  async list(): Promise<PaginatedResponse<Anticipation>> {
    return this.client.get<PaginatedResponse<Anticipation>>('/anticipations');
  }
}

class WebhooksResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreateWebhookRequest): Promise<Webhook> {
    return this.client.post<Webhook>('/webhooks', data);
  }

  async retrieve(webhookId: string): Promise<Webhook> {
    return this.client.get<Webhook>(`/webhooks/${webhookId}`);
  }

  async list(): Promise<PaginatedResponse<Webhook>> {
    return this.client.get<PaginatedResponse<Webhook>>('/webhooks');
  }

  async update(webhookId: string, data: { url?: string; events?: string[]; isActive?: boolean }): Promise<Webhook> {
    return this.client.patch<Webhook>(`/webhooks/${webhookId}`, {
      url: data.url,
      events: data.events,
      is_active: data.isActive,
    });
  }

  async delete(webhookId: string): Promise<void> {
    await this.client.delete(`/webhooks/${webhookId}`);
  }

  async test(webhookId: string, eventType: string): Promise<{ success: boolean; responseCode: number; responseTimeMs: number }> {
    return this.client.post(`/webhooks/${webhookId}/test`, { event_type: eventType });
  }
}

class PixelsResource {
  constructor(private client: GatewayHttpClient) {}

  async create(data: CreatePixelRequest): Promise<Pixel> {
    return this.client.post<Pixel>('/pixels', {
      product_id: data.productId,
      pixel_type: data.pixelType,
      pixel_id: data.pixelId,
      access_token: data.accessToken,
      measurement_id: data.measurementId,
      conversion_id: data.conversionId,
      conversion_label: data.conversionLabel,
      events: data.events,
    });
  }

  async list(): Promise<PaginatedResponse<Pixel>> {
    return this.client.get<PaginatedResponse<Pixel>>('/pixels');
  }

  async fire(data: { productId: string; eventName: string; eventData?: Record<string, unknown>; transactionId?: string }): Promise<void> {
    await this.client.post('/pixels/fire', {
      product_id: data.productId,
      event_name: data.eventName,
      event_data: data.eventData,
      transaction_id: data.transactionId,
    });
  }
}

class AuditResource {
  constructor(private client: GatewayHttpClient) {}

  async listLogs(params?: {
    entityType?: string;
    actionType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AuditLog>> {
    return this.client.get<PaginatedResponse<AuditLog>>('/audit/logs', {
      entity_type: params?.entityType,
      action_type: params?.actionType,
      date_from: params?.dateFrom,
      date_to: params?.dateTo,
      page: params?.page?.toString(),
      limit: params?.limit?.toString(),
    } as Record<string, string>);
  }

  async retrieveLog(logId: string): Promise<AuditLog> {
    return this.client.get<AuditLog>(`/audit/logs/${logId}`);
  }

  async generateReport(params: {
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    dateFrom: string;
    dateTo: string;
    format?: 'json' | 'csv' | 'pdf';
  }): Promise<unknown> {
    return this.client.get('/audit/financial-report', {
      period: params.period,
      date_from: params.dateFrom,
      date_to: params.dateTo,
      format: params.format || 'json',
    });
  }
}

class SandboxResource {
  constructor(private client: GatewayHttpClient) {}

  async simulate(data: SandboxSimulateRequest): Promise<{ success: boolean; event: string; transaction: Transaction }> {
    return this.client.post('/sandbox/simulate', {
      transaction_id: data.transactionId,
      event: data.event,
      failure_reason: data.failureReason,
    });
  }

  async reset(): Promise<void> {
    await this.client.post('/sandbox/reset');
  }

  async listWebhooks(limit?: number): Promise<PaginatedResponse<unknown>> {
    return this.client.get('/sandbox/webhooks', {
      limit: limit?.toString(),
    } as Record<string, string>);
  }
}

// ==================== MAIN SDK CLASS ====================

export class RoyalPayGateway {
  private client: GatewayHttpClient;

  checkout: CheckoutResource;
  transactions: TransactionsResource;
  coupons: CouponsResource;
  commissions: CommissionsResource;
  withdrawals: WithdrawalsResource;
  anticipations: AnticipationsResource;
  webhooks: WebhooksResource;
  pixels: PixelsResource;
  audit: AuditResource;
  sandbox: SandboxResource;

  constructor(config: GatewayConfig) {
    this.client = new GatewayHttpClient(config);

    this.checkout = new CheckoutResource(this.client);
    this.transactions = new TransactionsResource(this.client);
    this.coupons = new CouponsResource(this.client);
    this.commissions = new CommissionsResource(this.client);
    this.withdrawals = new WithdrawalsResource(this.client);
    this.anticipations = new AnticipationsResource(this.client);
    this.webhooks = new WebhooksResource(this.client);
    this.pixels = new PixelsResource(this.client);
    this.audit = new AuditResource(this.client);
    this.sandbox = new SandboxResource(this.client);
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Formata valor em centavos para reais
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Converte reais para centavos
 */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Converte centavos para reais
 */
export function toReais(cents: number): number {
  return cents / 100;
}

/**
 * Valida CPF
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit > 9) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit > 9) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

/**
 * Valida CNPJ
 */
export function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights1[i];
  }
  let digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;
  if (digit !== parseInt(cleaned.charAt(12))) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights2[i];
  }
  digit = sum % 11;
  digit = digit < 2 ? 0 : 11 - digit;
  if (digit !== parseInt(cleaned.charAt(13))) return false;
  
  return true;
}

/**
 * Valida documento (CPF ou CNPJ)
 */
export function isValidDocument(document: string): boolean {
  const cleaned = document.replace(/\D/g, '');
  return cleaned.length === 11 ? isValidCPF(cleaned) : isValidCNPJ(cleaned);
}

// Default export
export default RoyalPayGateway;
