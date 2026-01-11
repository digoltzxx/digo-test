import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THANK_YOU_MESSAGE,
  MAX_MESSAGE_LENGTH,
} from '../settings/ThankYouMessage';

/**
 * Testes de Mensagem de Agradecimento
 * 
 * Valida regras de negócio para mensagem personalizada,
 * limites de caracteres e fallback para mensagem padrão.
 */

// Simula validação de mensagem
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Máximo de ${MAX_MESSAGE_LENGTH} caracteres` };
  }
  return { valid: true };
}

// Simula obtenção da mensagem para exibição
function getDisplayMessage(customMessage: string): string {
  return customMessage.trim() || DEFAULT_THANK_YOU_MESSAGE;
}

// Simula contagem de caracteres
function getCharacterCount(message: string): { count: number; remaining: number; isNearLimit: boolean } {
  const count = message.length;
  const remaining = MAX_MESSAGE_LENGTH - count;
  const isNearLimit = count > MAX_MESSAGE_LENGTH * 0.9;
  
  return { count, remaining, isNearLimit };
}

describe('ThankYouMessage - Validação', () => {
  describe('Limite de caracteres', () => {
    it('deve aceitar mensagem vazia', () => {
      const result = validateMessage('');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar mensagem curta', () => {
      const result = validateMessage('Obrigado!');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar mensagem no limite exato', () => {
      const message = 'a'.repeat(MAX_MESSAGE_LENGTH);
      const result = validateMessage(message);
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar mensagem acima do limite', () => {
      const message = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
      const result = validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`${MAX_MESSAGE_LENGTH}`);
    });

    it('deve rejeitar mensagem muito longa', () => {
      const message = 'a'.repeat(1000);
      const result = validateMessage(message);
      expect(result.valid).toBe(false);
    });
  });

  describe('Suporte a caracteres especiais', () => {
    it('deve aceitar emojis', () => {
      const result = validateMessage('Obrigado! 🎉🎊💰');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar quebras de linha', () => {
      const message = 'Linha 1\nLinha 2\nLinha 3';
      const result = validateMessage(message);
      expect(result.valid).toBe(true);
    });

    it('deve aceitar caracteres acentuados', () => {
      const result = validateMessage('Parabéns! Você concluiu a compra com sucesso.');
      expect(result.valid).toBe(true);
    });

    it('deve aceitar caracteres especiais variados', () => {
      const result = validateMessage('Olá! R$ 100,00 - 50% OFF! @#$%');
      expect(result.valid).toBe(true);
    });
  });
});

describe('ThankYouMessage - Mensagem Padrão', () => {
  it('deve retornar mensagem padrão quando customizada está vazia', () => {
    expect(getDisplayMessage('')).toBe(DEFAULT_THANK_YOU_MESSAGE);
  });

  it('deve retornar mensagem padrão quando customizada é só espaços', () => {
    expect(getDisplayMessage('   ')).toBe(DEFAULT_THANK_YOU_MESSAGE);
    expect(getDisplayMessage('\t\n  ')).toBe(DEFAULT_THANK_YOU_MESSAGE);
  });

  it('deve retornar mensagem customizada quando fornecida', () => {
    expect(getDisplayMessage('Minha mensagem!')).toBe('Minha mensagem!');
  });

  it('deve manter a mensagem customizada com trim', () => {
    expect(getDisplayMessage('  Mensagem com espaços  ')).toBe('Mensagem com espaços');
  });
});

describe('ThankYouMessage - Contagem de Caracteres', () => {
  it('deve contar corretamente mensagem vazia', () => {
    const result = getCharacterCount('');
    expect(result.count).toBe(0);
    expect(result.remaining).toBe(MAX_MESSAGE_LENGTH);
    expect(result.isNearLimit).toBe(false);
  });

  it('deve contar corretamente mensagem curta', () => {
    const result = getCharacterCount('Hello');
    expect(result.count).toBe(5);
    expect(result.remaining).toBe(MAX_MESSAGE_LENGTH - 5);
    expect(result.isNearLimit).toBe(false);
  });

  it('deve indicar quando está próximo do limite (>90%)', () => {
    const nearLimitMessage = 'a'.repeat(Math.ceil(MAX_MESSAGE_LENGTH * 0.91));
    const result = getCharacterCount(nearLimitMessage);
    expect(result.isNearLimit).toBe(true);
  });

  it('não deve indicar limite quando está abaixo de 90%', () => {
    const underLimitMessage = 'a'.repeat(Math.floor(MAX_MESSAGE_LENGTH * 0.89));
    const result = getCharacterCount(underLimitMessage);
    expect(result.isNearLimit).toBe(false);
  });

  it('deve contar emojis corretamente', () => {
    const result = getCharacterCount('🎉🎊');
    expect(result.count).toBe(2);
  });
});

describe('ThankYouMessage - Constantes', () => {
  it('DEFAULT_THANK_YOU_MESSAGE deve ter valor correto', () => {
    expect(DEFAULT_THANK_YOU_MESSAGE).toBe(
      'Obrigado pela sua compra! Em breve você receberá o acesso.'
    );
  });

  it('MAX_MESSAGE_LENGTH deve ser 500', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(500);
  });

  it('mensagem padrão deve estar dentro do limite', () => {
    expect(DEFAULT_THANK_YOU_MESSAGE.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });
});

describe('ThankYouMessage - Casos de Uso', () => {
  it('deve suportar mensagem com múltiplas linhas formatada', () => {
    const message = `Olá!

Obrigado pela sua compra!

Em breve você receberá:
- Acesso à plataforma
- E-book exclusivo
- Suporte prioritário

Qualquer dúvida, entre em contato!

Abraços,
Equipe`;

    const result = validateMessage(message);
    expect(result.valid).toBe(true);
  });

  it('deve suportar mensagem com emojis e formatação', () => {
    const message = `🎉 Parabéns pela compra!

✅ Seu pagamento foi confirmado
📚 Acesso liberado em 5 minutos
💬 Suporte via WhatsApp

Obrigado! 💙`;

    const result = validateMessage(message);
    expect(result.valid).toBe(true);
    expect(getDisplayMessage(message)).toBe(message);
  });
});
