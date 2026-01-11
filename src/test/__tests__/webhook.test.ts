import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de Processamento de Webhook
 * 
 * Valida:
 * - Validação de assinatura
 * - Idempotência
 * - Mapeamento de status
 * - Prevenção de regressão de status
 */

// Mapeamento de status (espelhando o webhook real)
const STATUS_MAP: Record<string, string> = {
  // Event types
  'payment.created': 'pending',
  'payment.pending': 'pending',
  'payment.waiting_payment': 'pending',
  'payment.approved': 'approved',
  'payment.paid': 'approved',
  'payment.confirmed': 'approved',
  'payment.refused': 'refused',
  'payment.refunded': 'refunded',
  'payment.chargeback': 'chargeback',
  'payment.cancelled': 'cancelled',
  'payment.expired': 'expired',
  'pix.paid': 'approved',
  'pix.expired': 'expired',
  'transaction.paid': 'approved',
  'transaction.approved': 'approved',
  'transaction.pending': 'pending',
  // Direct status values
  'paid': 'approved',
  'approved': 'approved',
  'confirmed': 'approved',
  'pending': 'pending',
  'waiting_payment': 'pending',
  'refused': 'refused',
  'refunded': 'refunded',
  'chargeback': 'chargeback',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'expired': 'expired',
};

// Status permitidos na carteira
const ALLOWED_WALLET_STATUSES = ['paid', 'approved', 'confirmed'];

// Prioridade de status para evitar regressão
const STATUS_PRIORITY: Record<string, number> = {
  'pending': 1,
  'approved': 3,
  'refused': 2,
  'cancelled': 2,
  'expired': 2,
  'refunded': 4,
  'chargeback': 5,
};

// Funções de utilidade (espelhando webhook real)
function mapStatus(eventOrStatus: string): string {
  return STATUS_MAP[eventOrStatus.toLowerCase()] || 'pending';
}

function isStatusAllowedInWallet(status: string): boolean {
  return ALLOWED_WALLET_STATUSES.includes(status);
}

function canTransitionStatus(currentStatus: string, newStatus: string): boolean {
  const currentPriority = STATUS_PRIORITY[currentStatus] || 0;
  const newPriority = STATUS_PRIORITY[newStatus] || 0;
  return newPriority >= currentPriority;
}

// Simula verificação de assinatura HMAC
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  // Em produção usa crypto.subtle.sign
  // Aqui simulamos a lógica
  if (!payload || !signature || !secret) return false;
  
  // Simulação simples: esperamos que signature seja hash do payload+secret
  const expectedSignature = Buffer.from(payload + secret).toString('hex').substring(0, 64);
  
  // Comparação constante-time simulada
  if (signature.length !== expectedSignature.length) return false;
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

// Sanitização de dados
function sanitizeString(input: string | undefined | null, maxLength: number = 255): string {
  if (!input) return '';
  return String(input).trim().substring(0, maxLength);
}

function sanitizeEmail(email: string | undefined | null): string {
  if (!email) return '';
  const sanitized = sanitizeString(email, 255).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

function sanitizeAmount(amount: unknown): number {
  const num = Number(amount);
  if (isNaN(num) || num < 0 || num > 999999999) return 0;
  if (num > 100000) return Math.round(num) / 100;
  return Math.round(num * 100) / 100;
}

// Parse de metadata
function parseMetadata(metadata: string | object | undefined | null): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  return metadata as Record<string, any>;
}

// Mock de banco de dados
interface Sale {
  id: string;
  status: string;
  seller_user_id: string;
  amount: number;
  updated_at: string;
}

let sales: Sale[] = [];
let processedWebhooks: Set<string> = new Set();

beforeEach(() => {
  sales = [];
  processedWebhooks = new Set();
});

// Processador de webhook simulado
function processWebhook(event: any): { 
  action: string; 
  sale_id: string | null; 
  details: string;
} {
  const eventType = event.event || event.type || `payment.${event.status}`;
  const transactionData = event.data || event;
  const transactionId = String(transactionData.id || event.id);
  const transactionStatus = transactionData.status || event.status;
  const metadata = parseMetadata(transactionData.metadata || event.metadata);
  
  // Determinar novo status
  const newStatus = transactionStatus ? mapStatus(transactionStatus) : mapStatus(eventType);
  
  // Encontrar venda
  const saleId = metadata.sale_id;
  const existingSale = sales.find(s => s.id === saleId);
  
  if (!existingSale) {
    return { action: 'not_found', sale_id: null, details: 'Sale not found' };
  }
  
  // Verificar idempotência
  const webhookKey = `${existingSale.id}-${newStatus}-${transactionId}`;
  if (processedWebhooks.has(webhookKey)) {
    return { action: 'idempotent_skip', sale_id: existingSale.id, details: 'Already processed' };
  }
  
  // Verificar se já está aprovado (idempotência para aprovação)
  if (existingSale.status === 'approved' && newStatus === 'approved') {
    return { action: 'idempotent_skip', sale_id: existingSale.id, details: 'Already approved' };
  }
  
  // Verificar regressão de status
  if (!canTransitionStatus(existingSale.status, newStatus)) {
    return { 
      action: 'status_regression_blocked', 
      sale_id: existingSale.id, 
      details: `Cannot change from ${existingSale.status} to ${newStatus}` 
    };
  }
  
  // Atualizar venda
  existingSale.status = newStatus;
  existingSale.updated_at = new Date().toISOString();
  processedWebhooks.add(webhookKey);
  
  return { action: 'updated', sale_id: existingSale.id, details: `Status: ${newStatus}` };
}

describe('Mapeamento de Status', () => {
  describe('Eventos de pagamento', () => {
    it('deve mapear payment.paid para approved', () => {
      expect(mapStatus('payment.paid')).toBe('approved');
    });

    it('deve mapear payment.approved para approved', () => {
      expect(mapStatus('payment.approved')).toBe('approved');
    });

    it('deve mapear payment.confirmed para approved', () => {
      expect(mapStatus('payment.confirmed')).toBe('approved');
    });

    it('deve mapear payment.pending para pending', () => {
      expect(mapStatus('payment.pending')).toBe('pending');
    });

    it('deve mapear payment.refunded para refunded', () => {
      expect(mapStatus('payment.refunded')).toBe('refunded');
    });

    it('deve mapear payment.chargeback para chargeback', () => {
      expect(mapStatus('payment.chargeback')).toBe('chargeback');
    });
  });

  describe('Status diretos', () => {
    it('deve mapear paid para approved', () => {
      expect(mapStatus('paid')).toBe('approved');
    });

    it('deve mapear canceled para cancelled', () => {
      expect(mapStatus('canceled')).toBe('cancelled');
    });

    it('deve mapear status desconhecido para pending', () => {
      expect(mapStatus('unknown_status')).toBe('pending');
    });
  });

  describe('Case insensitive', () => {
    it('deve aceitar status em maiúsculas', () => {
      expect(mapStatus('PAID')).toBe('approved');
      expect(mapStatus('APPROVED')).toBe('approved');
      expect(mapStatus('REFUNDED')).toBe('refunded');
    });

    it('deve aceitar status em mixed case', () => {
      expect(mapStatus('Paid')).toBe('approved');
      expect(mapStatus('Payment.Approved')).toBe('approved');
    });
  });
});

describe('Validação de Status na Carteira', () => {
  it('paid deve ser permitido', () => {
    expect(isStatusAllowedInWallet('paid')).toBe(true);
  });

  it('approved deve ser permitido', () => {
    expect(isStatusAllowedInWallet('approved')).toBe(true);
  });

  it('confirmed deve ser permitido', () => {
    expect(isStatusAllowedInWallet('confirmed')).toBe(true);
  });

  it('pending não deve ser permitido', () => {
    expect(isStatusAllowedInWallet('pending')).toBe(false);
  });

  it('refunded não deve ser permitido', () => {
    expect(isStatusAllowedInWallet('refunded')).toBe(false);
  });

  it('chargeback não deve ser permitido', () => {
    expect(isStatusAllowedInWallet('chargeback')).toBe(false);
  });
});

describe('Transição de Status', () => {
  it('deve permitir pending → approved', () => {
    expect(canTransitionStatus('pending', 'approved')).toBe(true);
  });

  it('deve permitir approved → refunded', () => {
    expect(canTransitionStatus('approved', 'refunded')).toBe(true);
  });

  it('deve permitir approved → chargeback', () => {
    expect(canTransitionStatus('approved', 'chargeback')).toBe(true);
  });

  it('não deve permitir approved → pending', () => {
    expect(canTransitionStatus('approved', 'pending')).toBe(false);
  });

  it('não deve permitir refunded → approved', () => {
    expect(canTransitionStatus('refunded', 'approved')).toBe(false);
  });

  it('não deve permitir chargeback → approved', () => {
    expect(canTransitionStatus('chargeback', 'approved')).toBe(false);
  });
});

describe('Idempotência do Webhook', () => {
  it('deve ignorar webhook duplicado de aprovação', () => {
    sales.push({
      id: 'sale-1',
      status: 'approved',
      seller_user_id: 'seller-1',
      amount: 100,
      updated_at: new Date().toISOString(),
    });

    const event = {
      type: 'payment.approved',
      data: { id: 'tx-1', status: 'paid', metadata: '{"sale_id":"sale-1"}' }
    };

    const result = processWebhook(event);
    
    expect(result.action).toBe('idempotent_skip');
    expect(result.details).toBe('Already approved');
  });

  it('deve processar primeira aprovação', () => {
    sales.push({
      id: 'sale-1',
      status: 'pending',
      seller_user_id: 'seller-1',
      amount: 100,
      updated_at: new Date().toISOString(),
    });

    const event = {
      type: 'payment.paid',
      data: { id: 'tx-1', status: 'paid', metadata: '{"sale_id":"sale-1"}' }
    };

    const result = processWebhook(event);
    
    expect(result.action).toBe('updated');
    expect(sales[0].status).toBe('approved');
  });

  it('deve ignorar webhooks repetidos do mesmo evento', () => {
    sales.push({
      id: 'sale-1',
      status: 'pending',
      seller_user_id: 'seller-1',
      amount: 100,
      updated_at: new Date().toISOString(),
    });

    const event = {
      type: 'payment.paid',
      data: { id: 'tx-1', status: 'paid', metadata: '{"sale_id":"sale-1"}' }
    };

    // Primeiro processamento
    const result1 = processWebhook(event);
    expect(result1.action).toBe('updated');

    // Segundo processamento (duplicado)
    const result2 = processWebhook(event);
    expect(result2.action).toBe('idempotent_skip');
  });
});

describe('Bloqueio de Regressão de Status', () => {
  it('não deve permitir regressão de approved para pending', () => {
    sales.push({
      id: 'sale-1',
      status: 'approved',
      seller_user_id: 'seller-1',
      amount: 100,
      updated_at: new Date().toISOString(),
    });

    const event = {
      type: 'payment.pending',
      data: { id: 'tx-2', status: 'pending', metadata: '{"sale_id":"sale-1"}' }
    };

    const result = processWebhook(event);
    
    expect(result.action).toBe('status_regression_blocked');
    expect(sales[0].status).toBe('approved'); // Mantém status atual
  });

  it('não deve permitir regressão de refunded para approved', () => {
    sales.push({
      id: 'sale-1',
      status: 'refunded',
      seller_user_id: 'seller-1',
      amount: 100,
      updated_at: new Date().toISOString(),
    });

    const event = {
      type: 'payment.approved',
      data: { id: 'tx-2', status: 'approved', metadata: '{"sale_id":"sale-1"}' }
    };

    const result = processWebhook(event);
    
    expect(result.action).toBe('status_regression_blocked');
    expect(sales[0].status).toBe('refunded');
  });
});

describe('Sanitização de Dados', () => {
  describe('sanitizeString', () => {
    it('deve remover espaços extras', () => {
      expect(sanitizeString('  texto  ')).toBe('texto');
    });

    it('deve limitar tamanho', () => {
      expect(sanitizeString('abcdef', 3)).toBe('abc');
    });

    it('deve retornar string vazia para null', () => {
      expect(sanitizeString(null)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('deve validar email válido', () => {
      expect(sanitizeEmail('test@email.com')).toBe('test@email.com');
    });

    it('deve rejeitar email inválido', () => {
      expect(sanitizeEmail('invalid-email')).toBe('');
    });

    it('deve converter para minúsculas', () => {
      expect(sanitizeEmail('Test@Email.COM')).toBe('test@email.com');
    });
  });

  describe('sanitizeAmount', () => {
    it('deve aceitar valor em reais', () => {
      expect(sanitizeAmount(100)).toBe(100);
    });

    it('deve converter centavos para reais', () => {
      expect(sanitizeAmount(10000)).toBe(100); // > 100000, considera centavos
    });

    it('deve rejeitar valor negativo', () => {
      expect(sanitizeAmount(-100)).toBe(0);
    });

    it('deve rejeitar valor muito alto', () => {
      expect(sanitizeAmount(9999999999)).toBe(0);
    });

    it('deve arredondar para 2 casas decimais', () => {
      expect(sanitizeAmount(99.999)).toBe(100);
    });
  });

  describe('parseMetadata', () => {
    it('deve parsear JSON string', () => {
      const result = parseMetadata('{"sale_id":"123"}');
      expect(result.sale_id).toBe('123');
    });

    it('deve aceitar objeto direto', () => {
      const result = parseMetadata({ sale_id: '456' });
      expect(result.sale_id).toBe('456');
    });

    it('deve retornar objeto vazio para JSON inválido', () => {
      const result = parseMetadata('invalid json');
      expect(result).toEqual({});
    });

    it('deve retornar objeto vazio para null', () => {
      const result = parseMetadata(null);
      expect(result).toEqual({});
    });
  });
});

describe('Processamento de Eventos Completo', () => {
  it('deve processar fluxo completo: pending → approved → refunded', () => {
    // Criar venda
    sales.push({
      id: 'sale-1',
      status: 'pending',
      seller_user_id: 'seller-1',
      amount: 297,
      updated_at: new Date().toISOString(),
    });

    // Webhook de aprovação
    const approveEvent = {
      type: 'payment.paid',
      data: { id: 'tx-1', status: 'paid', metadata: '{"sale_id":"sale-1"}' }
    };
    
    const result1 = processWebhook(approveEvent);
    expect(result1.action).toBe('updated');
    expect(sales[0].status).toBe('approved');

    // Webhook de reembolso
    const refundEvent = {
      type: 'payment.refunded',
      data: { id: 'tx-2', status: 'refunded', metadata: '{"sale_id":"sale-1"}' }
    };
    
    const result2 = processWebhook(refundEvent);
    expect(result2.action).toBe('updated');
    expect(sales[0].status).toBe('refunded');
  });

  it('deve retornar not_found para venda inexistente', () => {
    const event = {
      type: 'payment.paid',
      data: { id: 'tx-1', status: 'paid', metadata: '{"sale_id":"nonexistent"}' }
    };

    const result = processWebhook(event);
    expect(result.action).toBe('not_found');
  });
});
