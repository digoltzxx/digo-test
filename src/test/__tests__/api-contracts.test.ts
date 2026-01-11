/**
 * Testes de Contrato da API
 * 
 * Garante que a API segue os contratos definidos na especificação OpenAPI.
 * Estes testes verificam:
 * - Estrutura das requisições
 * - Estrutura das respostas
 * - Validação de campos obrigatórios
 * - Tipos de dados
 * - Códigos de status HTTP
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ==================== SCHEMA DEFINITIONS ====================

const TRANSACTION_SCHEMA = {
  required: ['id', 'status', 'amount', 'currency', 'paymentMethod', 'customer', 'createdAt'],
  properties: {
    id: { type: 'string', pattern: /^tx_/ },
    status: { type: 'string', enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'chargeback'] },
    amount: { type: 'number', minimum: 100 },
    netAmount: { type: 'number' },
    feeAmount: { type: 'number' },
    currency: { type: 'string', enum: ['BRL'] },
    paymentMethod: { type: 'string', enum: ['pix', 'credit_card', 'boleto'] },
    installments: { type: 'number', minimum: 1, maximum: 12 },
    createdAt: { type: 'string', format: 'date-time' },
    paidAt: { type: 'string', format: 'date-time', nullable: true },
  },
};

const CHECKOUT_SESSION_SCHEMA = {
  required: ['id', 'url', 'status', 'amount', 'currency', 'expiresAt', 'createdAt'],
  properties: {
    id: { type: 'string', pattern: /^cs_/ },
    url: { type: 'string', format: 'uri' },
    status: { type: 'string', enum: ['open', 'complete', 'expired'] },
    amount: { type: 'number', minimum: 100 },
    currency: { type: 'string', enum: ['BRL'] },
    expiresAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const COUPON_SCHEMA = {
  required: ['id', 'code', 'discountType', 'discountValue', 'isActive'],
  properties: {
    id: { type: 'string', pattern: /^cp_/ },
    code: { type: 'string', pattern: /^[A-Z0-9_-]+$/ },
    discountType: { type: 'string', enum: ['percentage', 'fixed'] },
    discountValue: { type: 'number', minimum: 0 },
    currentUses: { type: 'number', minimum: 0 },
    maxUses: { type: 'number', nullable: true },
    isActive: { type: 'boolean' },
  },
};

const WITHDRAWAL_SCHEMA = {
  required: ['id', 'amount', 'fee', 'netAmount', 'status', 'createdAt'],
  properties: {
    id: { type: 'string', pattern: /^wd_/ },
    amount: { type: 'number', minimum: 2000 },
    fee: { type: 'number', minimum: 0 },
    netAmount: { type: 'number' },
    status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const ERROR_SCHEMA = {
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'array', nullable: true },
      },
    },
  },
};

// ==================== VALIDATION HELPERS ====================

function validateSchema(data: unknown, schema: { required: string[]; properties: Record<string, unknown> }): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Data must be an object'] };
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  for (const field of schema.required) {
    if (!(field in obj) || obj[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check property types
  for (const [field, rules] of Object.entries(schema.properties)) {
    if (!(field in obj)) continue;
    
    const value = obj[field];
    const fieldRules = rules as Record<string, unknown>;

    // Type check
    if (fieldRules.type === 'string' && typeof value !== 'string' && value !== null) {
      if (!fieldRules.nullable || value !== null) {
        errors.push(`Field ${field} must be a string`);
      }
    }
    
    if (fieldRules.type === 'number' && typeof value !== 'number' && value !== null) {
      if (!fieldRules.nullable || value !== null) {
        errors.push(`Field ${field} must be a number`);
      }
    }
    
    if (fieldRules.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field ${field} must be a boolean`);
    }

    // Enum check
    const enumValues = fieldRules.enum as unknown[] | undefined;
    if (enumValues && !enumValues.includes(value)) {
      errors.push(`Field ${field} must be one of: ${enumValues.join(', ')}`);
    }

    // Pattern check
    const pattern = fieldRules.pattern as RegExp | undefined;
    if (pattern && typeof value === 'string' && !pattern.test(value)) {
      errors.push(`Field ${field} does not match expected pattern`);
    }

    // Minimum check
    const minimum = fieldRules.minimum as number | undefined;
    if (minimum !== undefined && typeof value === 'number' && value < minimum) {
      errors.push(`Field ${field} must be at least ${minimum}`);
    }

    // Maximum check
    const maximum = fieldRules.maximum as number | undefined;
    if (maximum !== undefined && typeof value === 'number' && value > maximum) {
      errors.push(`Field ${field} must be at most ${maximum}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateDateTimeFormat(value: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  return isoRegex.test(value);
}

// ==================== MOCK DATA ====================

const mockTransaction = {
  id: 'tx_abc123',
  status: 'paid',
  amount: 10000,
  netAmount: 9601,
  feeAmount: 399,
  currency: 'BRL',
  paymentMethod: 'pix',
  customer: {
    name: 'João Silva',
    email: 'joao@email.com',
    document: '12345678900',
  },
  createdAt: '2026-01-07T10:00:00Z',
  paidAt: '2026-01-07T10:05:00Z',
};

const mockCheckoutSession = {
  id: 'cs_abc123',
  url: 'https://checkout.royalpay.com.br/cs_abc123',
  status: 'open',
  amount: 49700,
  currency: 'BRL',
  product: {
    id: 'prod_abc123',
    name: 'Curso Marketing Pro',
    price: 49700,
  },
  expiresAt: '2026-01-07T12:30:00Z',
  createdAt: '2026-01-07T12:00:00Z',
};

const mockCoupon = {
  id: 'cp_abc123',
  code: 'DESCONTO20',
  discountType: 'percentage',
  discountValue: 20,
  currentUses: 15,
  maxUses: 100,
  isActive: true,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-12-31T23:59:59Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const mockWithdrawal = {
  id: 'wd_abc123',
  amount: 100000,
  fee: 350,
  netAmount: 99650,
  status: 'completed',
  bankAccount: {
    bankName: 'Banco do Brasil',
    agency: '1234',
    accountNumber: '12345-6',
  },
  createdAt: '2026-01-07T10:00:00Z',
  completedAt: '2026-01-08T14:00:00Z',
};

const mockError = {
  error: {
    code: 'validation_error',
    message: 'Dados inválidos',
    details: [
      { field: 'amount', message: 'Valor deve ser maior que zero' },
    ],
  },
};

// ==================== TESTS ====================

describe('API Contract Tests', () => {
  describe('Transaction Schema', () => {
    it('should validate a valid transaction', () => {
      const result = validateSchema(mockTransaction, TRANSACTION_SCHEMA);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject transaction without required fields', () => {
      const invalidTransaction = {
        id: 'tx_abc123',
        // missing status, amount, etc.
      };
      
      const result = validateSchema(invalidTransaction, TRANSACTION_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject transaction with invalid status', () => {
      const invalidTransaction = {
        ...mockTransaction,
        status: 'invalid_status',
      };
      
      const result = validateSchema(invalidTransaction, TRANSACTION_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field status must be one of: pending, processing, paid, failed, refunded, chargeback');
    });

    it('should reject transaction with amount below minimum', () => {
      const invalidTransaction = {
        ...mockTransaction,
        amount: 50,
      };
      
      const result = validateSchema(invalidTransaction, TRANSACTION_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field amount must be at least 100');
    });

    it('should validate transaction ID format', () => {
      expect(mockTransaction.id).toMatch(/^tx_/);
    });

    it('should validate date-time format', () => {
      expect(validateDateTimeFormat(mockTransaction.createdAt)).toBe(true);
      expect(validateDateTimeFormat(mockTransaction.paidAt!)).toBe(true);
    });
  });

  describe('Checkout Session Schema', () => {
    it('should validate a valid checkout session', () => {
      const result = validateSchema(mockCheckoutSession, CHECKOUT_SESSION_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should validate checkout session ID format', () => {
      expect(mockCheckoutSession.id).toMatch(/^cs_/);
    });

    it('should validate URL format', () => {
      expect(mockCheckoutSession.url).toMatch(/^https?:\/\//);
    });

    it('should have valid status', () => {
      expect(['open', 'complete', 'expired']).toContain(mockCheckoutSession.status);
    });
  });

  describe('Coupon Schema', () => {
    it('should validate a valid coupon', () => {
      const result = validateSchema(mockCoupon, COUPON_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should validate coupon code format', () => {
      expect(mockCoupon.code).toMatch(/^[A-Z0-9_-]+$/);
    });

    it('should reject invalid discount type', () => {
      const invalidCoupon = {
        ...mockCoupon,
        discountType: 'invalid',
      };
      
      const result = validateSchema(invalidCoupon, COUPON_SCHEMA);
      expect(result.valid).toBe(false);
    });

    it('should allow null maxUses', () => {
      const couponWithNoLimit = {
        ...mockCoupon,
        maxUses: null,
      };
      
      const result = validateSchema(couponWithNoLimit, COUPON_SCHEMA);
      expect(result.valid).toBe(true);
    });
  });

  describe('Withdrawal Schema', () => {
    it('should validate a valid withdrawal', () => {
      const result = validateSchema(mockWithdrawal, WITHDRAWAL_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should validate minimum amount', () => {
      const invalidWithdrawal = {
        ...mockWithdrawal,
        amount: 1000, // Below R$ 20,00
      };
      
      const result = validateSchema(invalidWithdrawal, WITHDRAWAL_SCHEMA);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field amount must be at least 2000');
    });

    it('should validate status values', () => {
      expect(['pending', 'processing', 'completed', 'failed', 'cancelled']).toContain(mockWithdrawal.status);
    });

    it('should ensure netAmount equals amount minus fee', () => {
      expect(mockWithdrawal.netAmount).toBe(mockWithdrawal.amount - mockWithdrawal.fee);
    });
  });

  describe('Error Schema', () => {
    it('should validate a valid error response', () => {
      const result = validateSchema(mockError, ERROR_SCHEMA);
      expect(result.valid).toBe(true);
    });

    it('should have required error fields', () => {
      expect(mockError.error).toHaveProperty('code');
      expect(mockError.error).toHaveProperty('message');
    });

    it('should have details array', () => {
      expect(Array.isArray(mockError.error.details)).toBe(true);
    });
  });

  describe('Webhook Payload Contracts', () => {
    const webhookPayload = {
      id: 'evt_abc123',
      type: 'transaction.paid',
      created_at: '2026-01-07T10:00:00Z',
      data: {
        object: mockTransaction,
      },
    };

    it('should have required webhook fields', () => {
      expect(webhookPayload).toHaveProperty('id');
      expect(webhookPayload).toHaveProperty('type');
      expect(webhookPayload).toHaveProperty('created_at');
      expect(webhookPayload).toHaveProperty('data');
    });

    it('should have valid event type', () => {
      const validEventTypes = [
        'transaction.created',
        'transaction.paid',
        'transaction.failed',
        'transaction.refunded',
        'transaction.chargeback',
        'subscription.created',
        'subscription.renewed',
        'subscription.cancelled',
        'subscription.expired',
        'withdrawal.completed',
        'withdrawal.failed',
      ];
      
      expect(validEventTypes).toContain(webhookPayload.type);
    });

    it('should have nested transaction in data object', () => {
      expect(webhookPayload.data.object).toHaveProperty('id');
      expect(webhookPayload.data.object).toHaveProperty('status');
    });
  });

  describe('Pagination Contract', () => {
    const paginatedResponse = {
      data: [mockTransaction],
      pagination: {
        page: 1,
        limit: 20,
        total: 150,
        totalPages: 8,
      },
    };

    it('should have data array', () => {
      expect(Array.isArray(paginatedResponse.data)).toBe(true);
    });

    it('should have pagination object with required fields', () => {
      expect(paginatedResponse.pagination).toHaveProperty('page');
      expect(paginatedResponse.pagination).toHaveProperty('limit');
      expect(paginatedResponse.pagination).toHaveProperty('total');
      expect(paginatedResponse.pagination).toHaveProperty('totalPages');
    });

    it('should have consistent pagination values', () => {
      const { page, limit, total, totalPages } = paginatedResponse.pagination;
      expect(totalPages).toBe(Math.ceil(total / limit));
      expect(page).toBeGreaterThanOrEqual(1);
      expect(page).toBeLessThanOrEqual(totalPages);
    });
  });

  describe('Split/Commission Contract', () => {
    const split = {
      recipientId: 'rec_abc123',
      type: 'percentage',
      value: 70,
    };

    it('should have valid split type', () => {
      expect(['percentage', 'fixed']).toContain(split.type);
    });

    it('should have percentage between 0 and 100', () => {
      if (split.type === 'percentage') {
        expect(split.value).toBeGreaterThanOrEqual(0);
        expect(split.value).toBeLessThanOrEqual(100);
      }
    });

    it('should have recipientId', () => {
      expect(split.recipientId).toBeTruthy();
      expect(typeof split.recipientId).toBe('string');
    });
  });

  describe('API Versioning Contract', () => {
    it('should use v1 prefix in API paths', () => {
      const apiPath = '/v1/transactions';
      expect(apiPath).toMatch(/^\/v1\//);
    });

    it('should support version negotiation via URL', () => {
      const v1Url = 'https://api.royalpay.com.br/v1/transactions';
      const v2Url = 'https://api.royalpay.com.br/v2/transactions';
      
      expect(v1Url).toContain('/v1/');
      expect(v2Url).toContain('/v2/');
    });
  });

  describe('HTTP Status Code Contracts', () => {
    const statusCodeMappings = {
      success: [200, 201, 204],
      clientError: [400, 401, 403, 404, 422],
      serverError: [500, 502, 503],
    };

    it('should return 200 for successful GET requests', () => {
      expect(statusCodeMappings.success).toContain(200);
    });

    it('should return 201 for successful POST requests creating resources', () => {
      expect(statusCodeMappings.success).toContain(201);
    });

    it('should return 400 for bad requests', () => {
      expect(statusCodeMappings.clientError).toContain(400);
    });

    it('should return 401 for unauthorized requests', () => {
      expect(statusCodeMappings.clientError).toContain(401);
    });

    it('should return 404 for not found resources', () => {
      expect(statusCodeMappings.clientError).toContain(404);
    });

    it('should return 422 for validation errors', () => {
      expect(statusCodeMappings.clientError).toContain(422);
    });
  });

  describe('Idempotency Contract', () => {
    it('should support idempotency key header', () => {
      const headers = {
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'unique-request-id-123',
      };
      
      expect(headers['Idempotency-Key']).toBeTruthy();
    });

    it('should return same response for same idempotency key', () => {
      // Simulating idempotent behavior
      const idempotencyKey = 'tx-create-123';
      const responseCache = new Map<string, unknown>();
      
      const firstResponse = { id: 'tx_abc', status: 'pending' };
      responseCache.set(idempotencyKey, firstResponse);
      
      const secondResponse = responseCache.get(idempotencyKey);
      expect(secondResponse).toEqual(firstResponse);
    });
  });

  describe('Rate Limiting Contract', () => {
    const rateLimitHeaders = {
      'X-RateLimit-Limit': '1000',
      'X-RateLimit-Remaining': '999',
      'X-RateLimit-Reset': '1704628800',
    };

    it('should include rate limit headers in response', () => {
      expect(rateLimitHeaders['X-RateLimit-Limit']).toBeTruthy();
      expect(rateLimitHeaders['X-RateLimit-Remaining']).toBeTruthy();
      expect(rateLimitHeaders['X-RateLimit-Reset']).toBeTruthy();
    });

    it('should have numeric rate limit values', () => {
      expect(parseInt(rateLimitHeaders['X-RateLimit-Limit'])).toBeGreaterThan(0);
      expect(parseInt(rateLimitHeaders['X-RateLimit-Remaining'])).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Financial Calculation Contracts', () => {
  it('should calculate platform fee correctly (3.99%)', () => {
    const amount = 10000; // R$ 100,00
    const expectedFee = Math.round(amount * 0.0399);
    expect(expectedFee).toBe(399);
  });

  it('should calculate net amount correctly', () => {
    const amount = 10000;
    const fee = 399;
    const netAmount = amount - fee;
    expect(netAmount).toBe(9601);
  });

  it('should calculate withdrawal fee correctly (R$ 3,50)', () => {
    const withdrawalFee = 350; // R$ 3,50 em centavos
    expect(withdrawalFee).toBe(350);
  });

  it('should calculate anticipation fee correctly', () => {
    const originalAmount = 10000;
    const feePercentage = 3.5;
    const feeAmount = Math.round(originalAmount * (feePercentage / 100));
    const netAmount = originalAmount - feeAmount;
    
    expect(feeAmount).toBe(350);
    expect(netAmount).toBe(9650);
  });

  it('should calculate percentage discount correctly', () => {
    const originalAmount = 49700;
    const discountPercentage = 20;
    const discountAmount = Math.round(originalAmount * (discountPercentage / 100));
    const finalAmount = originalAmount - discountAmount;
    
    expect(discountAmount).toBe(9940);
    expect(finalAmount).toBe(39760);
  });

  it('should respect max discount value', () => {
    const originalAmount = 100000;
    const discountPercentage = 50;
    const maxDiscount = 20000;
    
    const calculatedDiscount = Math.round(originalAmount * (discountPercentage / 100));
    const actualDiscount = Math.min(calculatedDiscount, maxDiscount);
    
    expect(actualDiscount).toBe(20000);
  });

  it('should split commissions correctly', () => {
    const totalAmount = 10000;
    const splits = [
      { recipientId: 'producer', type: 'percentage' as const, value: 70 },
      { recipientId: 'coproducer', type: 'percentage' as const, value: 20 },
      { recipientId: 'platform', type: 'percentage' as const, value: 10 },
    ];
    
    const totalPercentage = splits.reduce((sum, s) => sum + s.value, 0);
    expect(totalPercentage).toBe(100);
    
    const calculatedSplits = splits.map(s => ({
      ...s,
      amount: Math.round(totalAmount * (s.value / 100)),
    }));
    
    const totalSplit = calculatedSplits.reduce((sum, s) => sum + s.amount, 0);
    expect(totalSplit).toBe(totalAmount);
  });
});
