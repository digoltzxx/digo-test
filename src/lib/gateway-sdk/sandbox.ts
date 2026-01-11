/**
 * Royal Pay Sandbox Utilities
 * 
 * Utilitários para testes no ambiente sandbox.
 * 
 * @example
 * ```typescript
 * import { SandboxHelper, SANDBOX_CARDS } from '@/lib/gateway-sdk/sandbox';
 * 
 * // Usar cartão de teste
 * const card = SANDBOX_CARDS.SUCCESS;
 * 
 * // Gerar dados de teste
 * const customer = SandboxHelper.generateCustomer();
 * const transaction = SandboxHelper.generateTransaction();
 * ```
 */

import type { Customer, Transaction, PaymentMethod, TransactionStatus, Card } from './index';

// ==================== TEST CARDS ====================

/**
 * Cartões de teste para o ambiente sandbox.
 * Cada cartão simula um comportamento diferente.
 */
export const SANDBOX_CARDS = {
  /** Cartão que sempre aprova */
  SUCCESS: {
    number: '4111111111111111',
    holderName: 'TESTE APROVADO',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'visa',
  },
  /** Cartão que sempre recusa por saldo insuficiente */
  INSUFFICIENT_FUNDS: {
    number: '4000000000000002',
    holderName: 'TESTE RECUSADO',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'visa',
  },
  /** Cartão que sempre recusa por cartão expirado */
  EXPIRED: {
    number: '4000000000000069',
    holderName: 'TESTE EXPIRADO',
    expMonth: '12',
    expYear: '2020',
    cvv: '123',
    brand: 'visa',
  },
  /** Cartão que sempre recusa por CVV inválido */
  INVALID_CVV: {
    number: '4000000000000127',
    holderName: 'TESTE CVV',
    expMonth: '12',
    expYear: '2030',
    cvv: '999',
    brand: 'visa',
  },
  /** Cartão que simula fraude */
  FRAUD: {
    number: '4000000000000119',
    holderName: 'TESTE FRAUDE',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'visa',
  },
  /** Cartão Mastercard de teste */
  MASTERCARD_SUCCESS: {
    number: '5555555555554444',
    holderName: 'TESTE MASTERCARD',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'mastercard',
  },
  /** Cartão Elo de teste */
  ELO_SUCCESS: {
    number: '6362970000457013',
    holderName: 'TESTE ELO',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'elo',
  },
  /** Cartão que simula timeout */
  TIMEOUT: {
    number: '4000000000000044',
    holderName: 'TESTE TIMEOUT',
    expMonth: '12',
    expYear: '2030',
    cvv: '123',
    brand: 'visa',
  },
} as const;

// ==================== TEST DOCUMENTS ====================

/**
 * Documentos válidos para testes (CPFs e CNPJs fictícios válidos)
 */
export const SANDBOX_DOCUMENTS = {
  CPF: {
    VALID_1: '11144477735',
    VALID_2: '22233344456',
    VALID_3: '98765432100',
  },
  CNPJ: {
    VALID_1: '11222333000181',
    VALID_2: '22333444000145',
  },
} as const;

// ==================== WEBHOOK EVENTS ====================

/**
 * Exemplos de payloads de webhook para testes
 */
export const WEBHOOK_PAYLOADS = {
  'transaction.paid': {
    id: 'evt_test_123',
    type: 'transaction.paid',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'tx_test_123',
        status: 'paid',
        amount: 10000,
        payment_method: 'pix',
        paid_at: new Date().toISOString(),
      },
    },
  },
  'transaction.failed': {
    id: 'evt_test_456',
    type: 'transaction.failed',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'tx_test_123',
        status: 'failed',
        amount: 10000,
        payment_method: 'credit_card',
        failure_reason: 'insufficient_funds',
      },
    },
  },
  'transaction.refunded': {
    id: 'evt_test_789',
    type: 'transaction.refunded',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'tx_test_123',
        status: 'refunded',
        amount: 10000,
        refund: {
          id: 'ref_test_123',
          amount: 10000,
          status: 'completed',
        },
      },
    },
  },
  'subscription.created': {
    id: 'evt_test_sub_1',
    type: 'subscription.created',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'sub_test_123',
        status: 'active',
        plan_id: 'plan_test_123',
        customer_id: 'cus_test_123',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  },
  'subscription.cancelled': {
    id: 'evt_test_sub_2',
    type: 'subscription.cancelled',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'sub_test_123',
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      },
    },
  },
  'withdrawal.completed': {
    id: 'evt_test_wd_1',
    type: 'withdrawal.completed',
    created_at: new Date().toISOString(),
    data: {
      object: {
        id: 'wd_test_123',
        status: 'completed',
        amount: 50000,
        fee: 350,
        net_amount: 49650,
        completed_at: new Date().toISOString(),
      },
    },
  },
} as const;

// ==================== SANDBOX HELPER ====================

/**
 * Classe utilitária para gerar dados de teste
 */
export class SandboxHelper {
  private static counter = 0;

  /**
   * Gera um ID único para testes
   */
  static generateId(prefix: string = 'test'): string {
    return `${prefix}_${Date.now()}_${++this.counter}`;
  }

  /**
   * Gera um cliente fictício para testes
   */
  static generateCustomer(overrides: Partial<Customer> = {}): Customer {
    const names = ['João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Souza'];
    const name = names[Math.floor(Math.random() * names.length)];
    const email = `${name.toLowerCase().replace(' ', '.')}@teste.com`;

    return {
      name,
      email,
      document: SANDBOX_DOCUMENTS.CPF.VALID_1,
      phone: '11999999999',
      address: {
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01310100',
        country: 'BR',
      },
      ...overrides,
    };
  }

  /**
   * Gera uma transação fictícia para testes
   */
  static generateTransaction(overrides: Partial<{
    status: TransactionStatus;
    paymentMethod: PaymentMethod;
    amount: number;
  }> = {}): Transaction {
    const amount = overrides.amount || Math.floor(Math.random() * 50000) + 1000;
    const fee = Math.round(amount * 0.0399);

    return {
      id: this.generateId('tx'),
      status: overrides.status || 'paid',
      amount,
      netAmount: amount - fee,
      feeAmount: fee,
      currency: 'BRL',
      paymentMethod: overrides.paymentMethod || 'pix',
      customer: this.generateCustomer(),
      createdAt: new Date().toISOString(),
      paidAt: overrides.status === 'paid' ? new Date().toISOString() : undefined,
    };
  }

  /**
   * Gera um QR Code PIX fictício
   */
  static generatePixQrCode(): string {
    return '00020126580014br.gov.bcb.pix0136' + this.generateId('pix') + '5204000053039865802BR5913TESTE SANDBOX6009SAO PAULO62070503***6304';
  }

  /**
   * Gera um código de barras de boleto fictício
   */
  static generateBoletoBarcode(): string {
    return '23793.38128 60800.000003 00000.000405 1 84340000010000';
  }

  /**
   * Simula um delay para testes assíncronos
   */
  static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Valida assinatura de webhook (simulado)
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    // Em sandbox, sempre retorna true para facilitar testes
    // Em produção, usar HMAC-SHA256 real
    console.log('[Sandbox] Validating webhook signature (always true in sandbox)');
    return true;
  }

  /**
   * Gera um payload de webhook para testes
   */
  static generateWebhookPayload(
    eventType: keyof typeof WEBHOOK_PAYLOADS,
    overrides: Record<string, unknown> = {}
  ): unknown {
    const base = WEBHOOK_PAYLOADS[eventType];
    return {
      ...base,
      id: this.generateId('evt'),
      created_at: new Date().toISOString(),
      data: {
        ...base.data,
        object: {
          ...base.data.object,
          ...overrides,
        },
      },
    };
  }

  /**
   * Retorna um cartão de teste com base no cenário
   */
  static getTestCard(scenario: keyof typeof SANDBOX_CARDS): Card {
    const card = SANDBOX_CARDS[scenario];
    return {
      number: card.number,
      holderName: card.holderName,
      expMonth: card.expMonth,
      expYear: card.expYear,
      cvv: card.cvv,
    };
  }

  /**
   * Simula resposta do gateway para testes unitários
   */
  static mockGatewayResponse<T>(data: T, delay: number = 100): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(data), delay));
  }

  /**
   * Simula erro do gateway para testes unitários
   */
  static mockGatewayError(code: string, message: string, delay: number = 100): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject({ code, message }), delay)
    );
  }
}

// ==================== MOCK SERVER ====================

/**
 * Mock server para testes locais (opcional)
 */
export class MockGatewayServer {
  private transactions: Map<string, Transaction> = new Map();
  private webhookCallbacks: ((event: unknown) => void)[] = [];

  /**
   * Registra callback para receber webhooks simulados
   */
  onWebhook(callback: (event: unknown) => void): void {
    this.webhookCallbacks.push(callback);
  }

  /**
   * Simula criação de transação
   */
  async createTransaction(request: {
    amount: number;
    paymentMethod: PaymentMethod;
    customer: Customer;
  }): Promise<Transaction> {
    await SandboxHelper.delay(200);

    const transaction = SandboxHelper.generateTransaction({
      amount: request.amount,
      paymentMethod: request.paymentMethod,
      status: request.paymentMethod === 'pix' ? 'pending' : 'paid',
    });

    this.transactions.set(transaction.id, transaction);

    // Simular webhook de pagamento aprovado para cartão
    if (request.paymentMethod === 'credit_card') {
      setTimeout(() => this.triggerWebhook('transaction.paid', { id: transaction.id }), 1000);
    }

    return transaction;
  }

  /**
   * Simula confirmação de pagamento PIX
   */
  async confirmPixPayment(transactionId: string): Promise<Transaction> {
    await SandboxHelper.delay(100);

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = 'paid';
    transaction.paidAt = new Date().toISOString();
    
    this.triggerWebhook('transaction.paid', { id: transactionId });

    return transaction;
  }

  /**
   * Simula estorno
   */
  async refundTransaction(transactionId: string): Promise<Transaction> {
    await SandboxHelper.delay(200);

    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    transaction.status = 'refunded';
    transaction.refunds = [{
      id: SandboxHelper.generateId('ref'),
      amount: transaction.amount,
      status: 'completed',
      createdAt: new Date().toISOString(),
    }];

    this.triggerWebhook('transaction.refunded', { id: transactionId });

    return transaction;
  }

  private triggerWebhook(eventType: keyof typeof WEBHOOK_PAYLOADS, data: Record<string, unknown>): void {
    const payload = SandboxHelper.generateWebhookPayload(eventType, data);
    this.webhookCallbacks.forEach(cb => cb(payload));
  }

  /**
   * Limpa todos os dados do mock
   */
  reset(): void {
    this.transactions.clear();
    this.webhookCallbacks = [];
  }
}

export default SandboxHelper;
