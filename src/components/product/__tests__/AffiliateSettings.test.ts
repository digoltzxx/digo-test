import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MIN_COMMISSION, MAX_COMMISSION } from '../settings/AffiliateSettings';

/**
 * Testes de Configurações de Afiliados
 * 
 * Valida regras de negócio para configurações de afiliados,
 * cálculo de comissões e validações de entrada.
 */

// Simula validação de comissão
function validateCommission(
  commission: number,
  affiliatesEnabled: boolean
): { valid: boolean; error?: string } {
  if (!affiliatesEnabled) {
    return { valid: true }; // Commission is ignored when affiliates are disabled
  }

  if (isNaN(commission)) {
    return { valid: false, error: 'Informe um valor válido' };
  }

  if (commission < MIN_COMMISSION) {
    return { valid: false, error: `Comissão mínima é ${MIN_COMMISSION}%` };
  }

  if (commission > MAX_COMMISSION) {
    return { valid: false, error: `Comissão máxima é ${MAX_COMMISSION}%` };
  }

  return { valid: true };
}

// Simula cálculo de comissão
function calculateAffiliateCommission(saleValue: number, commissionPercent: number): number {
  return saleValue * (commissionPercent / 100);
}

// Simula toggle de afiliados
function handleToggleAffiliates(
  enabled: boolean,
  currentAffiliations: Array<{ id: string; status: string }>
): Array<{ id: string; status: string }> {
  if (!enabled) {
    // Desativa todas as afiliações quando afiliados são desabilitados
    return currentAffiliations.map((aff) => ({
      ...aff,
      status: 'inactive',
    }));
  }
  return currentAffiliations;
}

describe('AffiliateSettings - Validação de Comissão', () => {
  describe('Quando afiliados estão habilitados', () => {
    it('deve rejeitar comissão abaixo do mínimo', () => {
      const result = validateCommission(0, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`Comissão mínima é ${MIN_COMMISSION}%`);
    });

    it('deve rejeitar comissão acima do máximo', () => {
      const result = validateCommission(95, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain(`Comissão máxima é ${MAX_COMMISSION}%`);
    });

    it('deve aceitar comissão igual ao mínimo', () => {
      const result = validateCommission(MIN_COMMISSION, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve aceitar comissão igual ao máximo', () => {
      const result = validateCommission(MAX_COMMISSION, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve aceitar comissão dentro do intervalo', () => {
      const result = validateCommission(50, true);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar valores NaN', () => {
      const result = validateCommission(NaN, true);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Informe um valor válido');
    });

    it('deve rejeitar valores negativos', () => {
      const result = validateCommission(-10, true);
      expect(result.valid).toBe(false);
    });
  });

  describe('Quando afiliados estão desabilitados', () => {
    it('deve ignorar validação de comissão', () => {
      expect(validateCommission(0, false).valid).toBe(true);
      expect(validateCommission(100, false).valid).toBe(true);
      expect(validateCommission(-50, false).valid).toBe(true);
    });
  });
});

describe('AffiliateSettings - Cálculo de Comissão', () => {
  it('deve calcular 30% corretamente', () => {
    expect(calculateAffiliateCommission(100, 30)).toBe(30);
    expect(calculateAffiliateCommission(200, 30)).toBe(60);
    expect(calculateAffiliateCommission(1000, 30)).toBe(300);
  });

  it('deve calcular comissão mínima corretamente', () => {
    expect(calculateAffiliateCommission(100, MIN_COMMISSION)).toBe(1);
  });

  it('deve calcular comissão máxima corretamente', () => {
    expect(calculateAffiliateCommission(100, MAX_COMMISSION)).toBe(90);
  });

  it('deve lidar com valores decimais', () => {
    expect(calculateAffiliateCommission(99.9, 10)).toBeCloseTo(9.99);
    expect(calculateAffiliateCommission(197.5, 25)).toBeCloseTo(49.375);
  });

  it('deve retornar zero para venda de valor zero', () => {
    expect(calculateAffiliateCommission(0, 30)).toBe(0);
  });
});

describe('AffiliateSettings - Toggle de Afiliados', () => {
  const mockAffiliations = [
    { id: '1', status: 'active' },
    { id: '2', status: 'active' },
    { id: '3', status: 'pending' },
  ];

  it('deve desativar todas as afiliações quando toggle é desligado', () => {
    const result = handleToggleAffiliates(false, mockAffiliations);
    
    expect(result).toHaveLength(3);
    expect(result.every((aff) => aff.status === 'inactive')).toBe(true);
  });

  it('deve manter afiliações quando toggle é ligado', () => {
    const result = handleToggleAffiliates(true, mockAffiliations);
    
    expect(result).toHaveLength(3);
    expect(result[0].status).toBe('active');
    expect(result[1].status).toBe('active');
    expect(result[2].status).toBe('pending');
  });

  it('deve lidar com lista vazia', () => {
    const result = handleToggleAffiliates(false, []);
    expect(result).toHaveLength(0);
  });
});

describe('AffiliateSettings - Constantes', () => {
  it('MIN_COMMISSION deve ser 1', () => {
    expect(MIN_COMMISSION).toBe(1);
  });

  it('MAX_COMMISSION deve ser 90', () => {
    expect(MAX_COMMISSION).toBe(90);
  });

  it('intervalo de comissão deve ser válido', () => {
    expect(MIN_COMMISSION).toBeLessThan(MAX_COMMISSION);
    expect(MIN_COMMISSION).toBeGreaterThan(0);
    expect(MAX_COMMISSION).toBeLessThanOrEqual(100);
  });
});
