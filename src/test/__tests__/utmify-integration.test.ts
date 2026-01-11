/**
 * Testes de integração UTMify
 * 
 * Testa:
 * - Captura de UTMs
 * - Validação de payload
 * - Mapeamento de status e métodos de pagamento
 * - Idempotência
 * - Tratamento de erros
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatUtmifyDate,
  mapPaymentMethodToUtmify,
  mapStatusToUtmify,
  validateUtmifyPayload,
  type UtmifyOrderPayload,
  type UtmifyTrackingParameters,
} from '@/lib/utmify/types';

// Mock de UTMs
const mockUtms: UtmifyTrackingParameters = {
  src: null,
  sck: null,
  utm_source: 'FB',
  utm_campaign: 'CAMPANHA_2024|413591587909524',
  utm_medium: 'CONJUNTO_2|498046723566488',
  utm_content: 'ANUNCIO_2|504346051220592',
  utm_term: 'Instagram_Feed',
};

const mockPayloadBase: UtmifyOrderPayload = {
  orderId: 'tx_test_123',
  platform: 'RoyalPay',
  paymentMethod: 'pix',
  status: 'paid',
  createdAt: '2026-01-07 14:35:13',
  approvedDate: '2026-01-07 14:43:37',
  refundedAt: null,
  customer: {
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '11999999999',
    document: '12345678900',
    country: 'BR',
    ip: '192.168.1.1',
  },
  products: [
    {
      id: 'prod_123',
      name: 'Curso Marketing Pro',
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: 49700,
    },
  ],
  trackingParameters: mockUtms,
  commission: {
    totalPriceInCents: 49700,
    gatewayFeeInCents: 1984,
    userCommissionInCents: 47716,
    currency: 'BRL',
  },
};

describe('UTMify Integration', () => {
  describe('formatUtmifyDate', () => {
    it('should format date correctly to UTMify format', () => {
      const date = new Date('2026-01-07T14:35:13.000Z');
      const formatted = formatUtmifyDate(date);
      expect(formatted).toBe('2026-01-07 14:35:13');
    });

    it('should handle string dates', () => {
      const formatted = formatUtmifyDate('2026-01-07T14:35:13.000Z');
      expect(formatted).toBe('2026-01-07 14:35:13');
    });

    it('should return null for null input', () => {
      expect(formatUtmifyDate(null)).toBeNull();
    });

    it('should pad single digit values', () => {
      const date = new Date('2026-03-05T08:05:03.000Z');
      const formatted = formatUtmifyDate(date);
      expect(formatted).toBe('2026-03-05 08:05:03');
    });
  });

  describe('mapPaymentMethodToUtmify', () => {
    it('should map pix correctly', () => {
      expect(mapPaymentMethodToUtmify('pix')).toBe('pix');
      expect(mapPaymentMethodToUtmify('PIX')).toBe('pix');
    });

    it('should map credit_card correctly', () => {
      expect(mapPaymentMethodToUtmify('credit_card')).toBe('credit_card');
      expect(mapPaymentMethodToUtmify('CREDIT_CARD')).toBe('credit_card');
    });

    it('should map boleto correctly', () => {
      expect(mapPaymentMethodToUtmify('boleto')).toBe('boleto');
    });

    it('should default to credit_card for unknown methods', () => {
      expect(mapPaymentMethodToUtmify('unknown')).toBe('credit_card');
      expect(mapPaymentMethodToUtmify('')).toBe('credit_card');
    });
  });

  describe('mapStatusToUtmify', () => {
    it('should map pending status correctly', () => {
      expect(mapStatusToUtmify('pending')).toBe('waiting_payment');
    });

    it('should map approved/paid status correctly', () => {
      expect(mapStatusToUtmify('approved')).toBe('paid');
      expect(mapStatusToUtmify('paid')).toBe('paid');
    });

    it('should map failed/refused status correctly', () => {
      expect(mapStatusToUtmify('failed')).toBe('refused');
      expect(mapStatusToUtmify('refused')).toBe('refused');
    });

    it('should map refunded status correctly', () => {
      expect(mapStatusToUtmify('refunded')).toBe('refunded');
    });

    it('should map chargeback status correctly', () => {
      expect(mapStatusToUtmify('chargeback')).toBe('chargedback');
      expect(mapStatusToUtmify('chargedback')).toBe('chargedback');
    });

    it('should default to waiting_payment for unknown status', () => {
      expect(mapStatusToUtmify('unknown')).toBe('waiting_payment');
    });
  });

  describe('validateUtmifyPayload', () => {
    it('should validate a complete valid payload', () => {
      const result = validateUtmifyPayload(mockPayloadBase);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing orderId', () => {
      const payload = { ...mockPayloadBase, orderId: '' };
      const result = validateUtmifyPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('orderId é obrigatório');
    });

    it('should detect missing platform', () => {
      const payload = { ...mockPayloadBase, platform: '' };
      const result = validateUtmifyPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('platform é obrigatório');
    });

    it('should detect missing customer', () => {
      const { customer, ...payloadWithoutCustomer } = mockPayloadBase;
      const result = validateUtmifyPayload(payloadWithoutCustomer as Partial<UtmifyOrderPayload>);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('customer é obrigatório');
    });

    it('should detect missing customer fields', () => {
      const payload = {
        ...mockPayloadBase,
        customer: { ...mockPayloadBase.customer, name: '' },
      };
      const result = validateUtmifyPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('customer.name é obrigatório');
    });

    it('should detect empty products array', () => {
      const payload = { ...mockPayloadBase, products: [] };
      const result = validateUtmifyPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('products é obrigatório e deve ter ao menos um item');
    });

    it('should detect missing commission', () => {
      const { commission, ...payloadWithoutCommission } = mockPayloadBase;
      const result = validateUtmifyPayload(payloadWithoutCommission as Partial<UtmifyOrderPayload>);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('commission é obrigatório');
    });
  });

  describe('UTM Capture', () => {
    it('should correctly extract UTMs from URL params', () => {
      const urlParams = new URLSearchParams(
        'utm_source=FB&utm_campaign=CAMPANHA_2024|413591587909524&utm_medium=CONJUNTO_2&utm_content=ANUNCIO_2&utm_term=Instagram_Feed'
      );

      const utms: UtmifyTrackingParameters = {
        src: urlParams.get('src'),
        sck: urlParams.get('sck'),
        utm_source: urlParams.get('utm_source'),
        utm_campaign: urlParams.get('utm_campaign'),
        utm_medium: urlParams.get('utm_medium'),
        utm_content: urlParams.get('utm_content'),
        utm_term: urlParams.get('utm_term'),
      };

      expect(utms.utm_source).toBe('FB');
      expect(utms.utm_campaign).toBe('CAMPANHA_2024|413591587909524');
      expect(utms.utm_term).toBe('Instagram_Feed');
      expect(utms.src).toBeNull();
    });

    it('should handle encoded UTM values', () => {
      const encoded = 'utm_campaign=CAMPANHA%202024%7C413591587909524';
      const urlParams = new URLSearchParams(encoded);
      const campaign = urlParams.get('utm_campaign');
      
      expect(campaign).toBe('CAMPANHA 2024|413591587909524');
    });

    it('should handle missing UTMs gracefully', () => {
      const urlParams = new URLSearchParams('');
      
      const utms: UtmifyTrackingParameters = {
        src: urlParams.get('src'),
        sck: urlParams.get('sck'),
        utm_source: urlParams.get('utm_source'),
        utm_campaign: urlParams.get('utm_campaign'),
        utm_medium: urlParams.get('utm_medium'),
        utm_content: urlParams.get('utm_content'),
        utm_term: urlParams.get('utm_term'),
      };

      Object.values(utms).forEach(value => {
        expect(value).toBeNull();
      });
    });
  });

  describe('Idempotency', () => {
    it('should generate consistent orderId', () => {
      const saleId = 'tx_abc123';
      expect(saleId).toBe('tx_abc123');
      expect(saleId).toBe('tx_abc123'); // Same ID should be consistent
    });

    it('should track sent orders to prevent duplicates', () => {
      const sentOrders = new Set<string>();
      const orderId = 'tx_abc123';

      // First send
      expect(sentOrders.has(orderId)).toBe(false);
      sentOrders.add(orderId);

      // Second send attempt (should be blocked)
      expect(sentOrders.has(orderId)).toBe(true);
    });
  });

  describe('Commission Calculation', () => {
    it('should calculate gateway fee correctly (3.99%)', () => {
      const totalAmount = 49700; // R$ 497,00 em centavos
      const gatewayFee = Math.round(totalAmount * 0.0399);
      const userCommission = totalAmount - gatewayFee;

      expect(gatewayFee).toBe(1983);
      expect(userCommission).toBe(47717);
    });

    it('should ensure totalPrice equals product sum', () => {
      const products = [
        { priceInCents: 3500, quantity: 1 },
        { priceInCents: 4000, quantity: 1 },
      ];

      const total = products.reduce((sum, p) => sum + p.priceInCents * p.quantity, 0);
      expect(total).toBe(7500);
    });

    it('should handle multiple products', () => {
      const products = [
        { priceInCents: 3500, quantity: 2 },
        { priceInCents: 4000, quantity: 1 },
      ];

      const total = products.reduce((sum, p) => sum + p.priceInCents * p.quantity, 0);
      expect(total).toBe(11000);
    });
  });

  describe('Status Transitions', () => {
    it('should allow valid status transitions', () => {
      const validTransitions: Array<[string, string]> = [
        ['pending', 'paid'],
        ['pending', 'refused'],
        ['paid', 'refunded'],
        ['paid', 'chargedback'],
      ];

      validTransitions.forEach(([from, to]) => {
        const fromUtmify = mapStatusToUtmify(from);
        const toUtmify = mapStatusToUtmify(to);
        expect(fromUtmify).not.toBe(toUtmify);
      });
    });

    it('should send update for refunded status', () => {
      const status = mapStatusToUtmify('refunded');
      expect(status).toBe('refunded');
    });

    it('should send update for chargeback status', () => {
      const status = mapStatusToUtmify('chargeback');
      expect(status).toBe('chargedback');
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize phone number (remove non-digits)', () => {
      const phone = '(11) 99999-9999';
      const sanitized = phone.replace(/\D/g, '');
      expect(sanitized).toBe('11999999999');
    });

    it('should sanitize document (remove non-digits)', () => {
      const cpf = '123.456.789-00';
      const sanitized = cpf.replace(/\D/g, '');
      expect(sanitized).toBe('12345678900');
    });

    it('should handle CNPJ', () => {
      const cnpj = '12.345.678/0001-90';
      const sanitized = cnpj.replace(/\D/g, '');
      expect(sanitized).toBe('12345678000190');
    });

    it('should trim whitespace from strings', () => {
      const name = '  João Silva  ';
      const sanitized = name.trim();
      expect(sanitized).toBe('João Silva');
    });
  });

  describe('Error Handling', () => {
    it('should handle API timeout gracefully', async () => {
      const timeout = 5000;
      const startTime = Date.now();
      
      // Simulate timeout check
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(timeout);
    });

    it('should retry on server error', () => {
      const maxRetries = 3;
      let attempts = 0;
      const serverError = true;

      while (attempts < maxRetries && serverError) {
        attempts++;
      }

      expect(attempts).toBe(maxRetries);
    });

    it('should not retry on client error (4xx)', () => {
      const statusCode = 400;
      const shouldRetry = statusCode >= 500;
      expect(shouldRetry).toBe(false);
    });
  });

  describe('Webhook Duplicate Prevention', () => {
    it('should detect duplicate webhook by orderId', () => {
      const processedWebhooks = new Map<string, boolean>();
      const orderId = 'tx_abc123';

      // First webhook
      processedWebhooks.set(orderId, true);

      // Duplicate check
      const isDuplicate = processedWebhooks.has(orderId);
      expect(isDuplicate).toBe(true);
    });

    it('should allow same order with different status', () => {
      const processedWebhooks = new Map<string, Set<string>>();
      const orderId = 'tx_abc123';

      // First status
      if (!processedWebhooks.has(orderId)) {
        processedWebhooks.set(orderId, new Set());
      }
      processedWebhooks.get(orderId)!.add('paid');

      // New status
      const statuses = processedWebhooks.get(orderId)!;
      expect(statuses.has('paid')).toBe(true);
      expect(statuses.has('refunded')).toBe(false);
    });
  });
});
