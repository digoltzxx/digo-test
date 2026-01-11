import { describe, it, expect, vi } from 'vitest';
import {
  formatWhatsAppDisplay,
  validateWhatsAppNumber,
} from '../settings/NotificationSettings';

/**
 * Testes de Configurações de Notificações
 * 
 * Valida regras de negócio para notificações por email e WhatsApp,
 * formatação de números e validações.
 */

// Simula validação de email
function canEnableEmailNotifications(userEmail: string | null): boolean {
  return userEmail !== null && userEmail.trim().length > 0;
}

// Simula validação de WhatsApp
function canEnableWhatsAppNotifications(
  whatsappNumber: string,
  currentlyEnabled: boolean
): { canEnable: boolean; error?: string } {
  if (!whatsappNumber) {
    return { canEnable: false, error: 'Informe o número de WhatsApp primeiro' };
  }

  if (!validateWhatsAppNumber(whatsappNumber)) {
    return { canEnable: false, error: 'Número de WhatsApp inválido (10-13 dígitos)' };
  }

  return { canEnable: true };
}

// Simula dados de notificação de venda
interface SaleNotificationData {
  productName: string;
  saleValue: number;
  dateTime: string;
  transactionId: string;
  paymentStatus: string;
}

function formatEmailNotification(data: SaleNotificationData): string {
  return `Nova venda: ${data.productName} - R$ ${data.saleValue.toFixed(2)} - ${data.transactionId}`;
}

function formatWhatsAppNotification(data: SaleNotificationData): string {
  return `🎉 Nova venda!\n\nProduto: ${data.productName}\nValor: R$ ${data.saleValue.toFixed(2)}\nStatus: ${data.paymentStatus}`;
}

describe('NotificationSettings - Formatação de WhatsApp', () => {
  describe('formatWhatsAppDisplay', () => {
    it('deve retornar string vazia para entrada vazia', () => {
      expect(formatWhatsAppDisplay('')).toBe('');
    });

    it('deve formatar números curtos (2 dígitos)', () => {
      expect(formatWhatsAppDisplay('11')).toBe('11');
    });

    it('deve formatar números parciais (4-7 dígitos)', () => {
      expect(formatWhatsAppDisplay('1199')).toBe('(11) 99');
      expect(formatWhatsAppDisplay('1199999')).toBe('(11) 99999');
    });

    it('deve formatar números de 10 dígitos corretamente', () => {
      expect(formatWhatsAppDisplay('1199999999')).toBe('(11) 99999-999');
    });

    it('deve formatar números de 11 dígitos corretamente', () => {
      expect(formatWhatsAppDisplay('11999999999')).toBe('(11) 99999-9999');
    });

    it('deve formatar números internacionais (13 dígitos)', () => {
      expect(formatWhatsAppDisplay('5511999999999')).toBe('+55 (11) 99999-9999');
    });

    it('deve remover caracteres não numéricos', () => {
      expect(formatWhatsAppDisplay('(11) 99999-9999')).toBe('(11) 99999-9999');
    });
  });

  describe('validateWhatsAppNumber', () => {
    it('deve rejeitar string vazia', () => {
      expect(validateWhatsAppNumber('')).toBe(false);
    });

    it('deve rejeitar números com menos de 10 dígitos', () => {
      expect(validateWhatsAppNumber('119999999')).toBe(false);
      expect(validateWhatsAppNumber('12345')).toBe(false);
    });

    it('deve aceitar números de 10 dígitos', () => {
      expect(validateWhatsAppNumber('1199999999')).toBe(true);
    });

    it('deve aceitar números de 11 dígitos', () => {
      expect(validateWhatsAppNumber('11999999999')).toBe(true);
    });

    it('deve aceitar números de 12 dígitos', () => {
      expect(validateWhatsAppNumber('551199999999')).toBe(true);
    });

    it('deve aceitar números de 13 dígitos', () => {
      expect(validateWhatsAppNumber('5511999999999')).toBe(true);
    });

    it('deve rejeitar números com mais de 13 dígitos', () => {
      expect(validateWhatsAppNumber('55119999999999')).toBe(false);
    });

    it('deve lidar com entrada formatada', () => {
      expect(validateWhatsAppNumber('(11) 99999-9999')).toBe(true);
      expect(validateWhatsAppNumber('+55 (11) 99999-9999')).toBe(true);
    });
  });
});

describe('NotificationSettings - Validação de Email', () => {
  it('deve rejeitar email nulo', () => {
    expect(canEnableEmailNotifications(null)).toBe(false);
  });

  it('deve rejeitar email vazio', () => {
    expect(canEnableEmailNotifications('')).toBe(false);
    expect(canEnableEmailNotifications('   ')).toBe(false);
  });

  it('deve aceitar email válido', () => {
    expect(canEnableEmailNotifications('user@email.com')).toBe(true);
    expect(canEnableEmailNotifications('test@domain.org')).toBe(true);
  });
});

describe('NotificationSettings - Validação de WhatsApp', () => {
  it('deve rejeitar número vazio', () => {
    const result = canEnableWhatsAppNotifications('', false);
    expect(result.canEnable).toBe(false);
    expect(result.error).toContain('Informe');
  });

  it('deve rejeitar número inválido', () => {
    const result = canEnableWhatsAppNotifications('12345', false);
    expect(result.canEnable).toBe(false);
    expect(result.error).toContain('inválido');
  });

  it('deve aceitar número válido', () => {
    const result = canEnableWhatsAppNotifications('11999999999', false);
    expect(result.canEnable).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

describe('NotificationSettings - Formatação de Mensagens', () => {
  const mockSaleData: SaleNotificationData = {
    productName: 'Curso de Marketing',
    saleValue: 197.5,
    dateTime: '2024-01-15T10:30:00Z',
    transactionId: 'TXN-12345',
    paymentStatus: 'Aprovado',
  };

  describe('Email', () => {
    it('deve formatar notificação de email corretamente', () => {
      const result = formatEmailNotification(mockSaleData);
      expect(result).toContain('Curso de Marketing');
      expect(result).toContain('R$ 197.50');
      expect(result).toContain('TXN-12345');
    });
  });

  describe('WhatsApp', () => {
    it('deve formatar notificação de WhatsApp corretamente', () => {
      const result = formatWhatsAppNotification(mockSaleData);
      expect(result).toContain('🎉');
      expect(result).toContain('Curso de Marketing');
      expect(result).toContain('R$ 197.50');
      expect(result).toContain('Aprovado');
    });

    it('deve incluir quebras de linha', () => {
      const result = formatWhatsAppNotification(mockSaleData);
      expect(result).toContain('\n');
    });
  });
});

describe('NotificationSettings - Regras de Toggle', () => {
  it('não deve permitir ativar WhatsApp sem número', () => {
    const result = canEnableWhatsAppNotifications('', false);
    expect(result.canEnable).toBe(false);
  });

  it('deve permitir ativar WhatsApp com número válido', () => {
    const result = canEnableWhatsAppNotifications('11999999999', false);
    expect(result.canEnable).toBe(true);
  });
});
