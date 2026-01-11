import { describe, it, expect, vi } from 'vitest';

/**
 * Testes do Botão Salvar
 * 
 * Valida regras de negócio para o botão de salvar configurações,
 * estados de loading e detecção de alterações.
 */

interface SaveButtonState {
  saving: boolean;
  hasChanges: boolean;
}

// Simula lógica de habilitação do botão
function isButtonDisabled(state: SaveButtonState): boolean {
  return state.saving || !state.hasChanges;
}

// Simula texto do botão
function getButtonText(saving: boolean): string {
  return saving ? 'Salvando...' : 'Salvar Configurações';
}

// Simula detecção de alterações
function detectChanges<T extends object>(original: T, current: T): boolean {
  return JSON.stringify(original) !== JSON.stringify(current);
}

// Simula validação antes de salvar
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateBeforeSave(settings: {
  enableAffiliates: boolean;
  affiliateCommission: number;
  enableWhatsapp: boolean;
  whatsappNumber: string;
  message: string;
}): ValidationResult {
  const errors: string[] = [];

  if (settings.enableAffiliates) {
    if (settings.affiliateCommission < 1 || settings.affiliateCommission > 90) {
      errors.push('Comissão deve estar entre 1% e 90%');
    }
  }

  if (settings.enableWhatsapp && !settings.whatsappNumber) {
    errors.push('Número de WhatsApp é obrigatório');
  }

  if (settings.message.length > 500) {
    errors.push('Mensagem excede limite de caracteres');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('SaveButton - Estado do Botão', () => {
  describe('isButtonDisabled', () => {
    it('deve estar desabilitado quando não há alterações', () => {
      expect(isButtonDisabled({ saving: false, hasChanges: false })).toBe(true);
    });

    it('deve estar desabilitado quando está salvando', () => {
      expect(isButtonDisabled({ saving: true, hasChanges: true })).toBe(true);
    });

    it('deve estar habilitado quando há alterações e não está salvando', () => {
      expect(isButtonDisabled({ saving: false, hasChanges: true })).toBe(false);
    });

    it('deve estar desabilitado quando está salvando mesmo sem alterações', () => {
      expect(isButtonDisabled({ saving: true, hasChanges: false })).toBe(true);
    });
  });
});

describe('SaveButton - Texto do Botão', () => {
  it('deve mostrar "Salvando..." quando está salvando', () => {
    expect(getButtonText(true)).toBe('Salvando...');
  });

  it('deve mostrar "Salvar Configurações" quando não está salvando', () => {
    expect(getButtonText(false)).toBe('Salvar Configurações');
  });
});

describe('SaveButton - Detecção de Alterações', () => {
  const originalSettings = {
    enableAffiliates: false,
    affiliateCommission: 30,
    enableEmail: true,
    enableWhatsapp: false,
    whatsappNumber: '',
    message: '',
  };

  it('deve detectar alteração em toggle de afiliados', () => {
    const current = { ...originalSettings, enableAffiliates: true };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('deve detectar alteração em comissão', () => {
    const current = { ...originalSettings, affiliateCommission: 50 };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('deve detectar alteração em toggle de email', () => {
    const current = { ...originalSettings, enableEmail: false };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('deve detectar alteração em toggle de WhatsApp', () => {
    const current = { ...originalSettings, enableWhatsapp: true };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('deve detectar alteração em número de WhatsApp', () => {
    const current = { ...originalSettings, whatsappNumber: '11999999999' };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('deve detectar alteração em mensagem', () => {
    const current = { ...originalSettings, message: 'Nova mensagem' };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });

  it('não deve detectar alteração quando valores são iguais', () => {
    const current = { ...originalSettings };
    expect(detectChanges(originalSettings, current)).toBe(false);
  });

  it('deve detectar múltiplas alterações', () => {
    const current = {
      ...originalSettings,
      enableAffiliates: true,
      affiliateCommission: 50,
      message: 'Custom message',
    };
    expect(detectChanges(originalSettings, current)).toBe(true);
  });
});

describe('SaveButton - Validação antes de Salvar', () => {
  const validSettings = {
    enableAffiliates: true,
    affiliateCommission: 30,
    enableWhatsapp: false,
    whatsappNumber: '',
    message: '',
  };

  it('deve validar configurações corretas', () => {
    const result = validateBeforeSave(validSettings);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('deve rejeitar comissão inválida quando afiliados ativos', () => {
    const result = validateBeforeSave({
      ...validSettings,
      affiliateCommission: 95,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Comissão deve estar entre 1% e 90%');
  });

  it('deve rejeitar WhatsApp ativo sem número', () => {
    const result = validateBeforeSave({
      ...validSettings,
      enableWhatsapp: true,
      whatsappNumber: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Número de WhatsApp é obrigatório');
  });

  it('deve rejeitar mensagem muito longa', () => {
    const result = validateBeforeSave({
      ...validSettings,
      message: 'a'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Mensagem excede limite de caracteres');
  });

  it('deve coletar múltiplos erros', () => {
    const result = validateBeforeSave({
      enableAffiliates: true,
      affiliateCommission: 0,
      enableWhatsapp: true,
      whatsappNumber: '',
      message: 'a'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('deve ignorar comissão inválida quando afiliados desativos', () => {
    const result = validateBeforeSave({
      ...validSettings,
      enableAffiliates: false,
      affiliateCommission: 0,
    });
    expect(result.valid).toBe(true);
  });
});

describe('SaveButton - Fluxo de Salvamento', () => {
  it('deve seguir fluxo correto de estados', async () => {
    const states: SaveButtonState[] = [];
    
    // Estado inicial
    states.push({ saving: false, hasChanges: false });
    expect(isButtonDisabled(states[0])).toBe(true);
    
    // Após alteração
    states.push({ saving: false, hasChanges: true });
    expect(isButtonDisabled(states[1])).toBe(false);
    
    // Durante salvamento
    states.push({ saving: true, hasChanges: true });
    expect(isButtonDisabled(states[2])).toBe(true);
    expect(getButtonText(true)).toBe('Salvando...');
    
    // Após salvamento bem-sucedido
    states.push({ saving: false, hasChanges: false });
    expect(isButtonDisabled(states[3])).toBe(true);
    expect(getButtonText(false)).toBe('Salvar Configurações');
  });
});
