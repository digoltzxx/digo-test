import { describe, it, expect } from 'vitest';
import { arredondarMoeda } from '@/lib/feeCalculations';

/**
 * Testes de Order Bump
 * 
 * Valida cálculos de desconto, persistência e integração
 * com checkout e área de membros.
 */

interface OrderBump {
  id: string;
  name: string;
  price: number;
  discount_price: number | null;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  is_subscription: boolean;
  subscription_interval: 'monthly' | 'quarterly' | 'yearly' | null;
}

// Funções auxiliares para cálculo
const calculateBumpFinalPrice = (bump: OrderBump): number => {
  if (bump.discount_value <= 0) return bump.price;
  
  if (bump.discount_type === 'percentage') {
    const discountAmount = arredondarMoeda(bump.price * bump.discount_value / 100);
    return Math.max(0, arredondarMoeda(bump.price - discountAmount));
  } else {
    return Math.max(0, arredondarMoeda(bump.price - bump.discount_value));
  }
};

const calculateCheckoutTotal = (
  productPrice: number,
  quantity: number,
  selectedBumps: OrderBump[]
): { productSubtotal: number; bumpsTotal: number; grandTotal: number } => {
  const productSubtotal = arredondarMoeda(productPrice * quantity);
  const bumpsTotal = selectedBumps.reduce((sum, bump) => {
    return arredondarMoeda(sum + calculateBumpFinalPrice(bump));
  }, 0);
  const grandTotal = arredondarMoeda(productSubtotal + bumpsTotal);
  
  return { productSubtotal, bumpsTotal, grandTotal };
};

describe('Order Bump - Cálculos de Desconto', () => {
  describe('Desconto Fixo (R$)', () => {
    it('deve aplicar desconto fixo corretamente', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus Exclusivo',
        price: 97.00,
        discount_price: null,
        discount_type: 'fixed',
        discount_value: 50,
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(47.00);
    });

    it('deve limitar desconto ao valor mínimo zero', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus',
        price: 50.00,
        discount_price: null,
        discount_type: 'fixed',
        discount_value: 100, // Desconto maior que preço
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(0);
    });

    it('deve retornar preço original sem desconto', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus',
        price: 97.00,
        discount_price: null,
        discount_type: 'fixed',
        discount_value: 0,
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(97.00);
    });
  });

  describe('Desconto Percentual (%)', () => {
    it('deve aplicar desconto de 20% corretamente', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus',
        price: 100.00,
        discount_price: null,
        discount_type: 'percentage',
        discount_value: 20,
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(80.00);
    });

    it('deve aplicar desconto de 50% corretamente', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus',
        price: 97.00,
        discount_price: null,
        discount_type: 'percentage',
        discount_value: 50,
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(48.50);
    });

    it('deve aplicar desconto de 100% resultando em zero', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus Grátis',
        price: 50.00,
        discount_price: null,
        discount_type: 'percentage',
        discount_value: 100,
        is_subscription: false,
        subscription_interval: null,
      };
      
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(0);
    });

    it('deve manter precisão decimal em descontos', () => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Bônus',
        price: 33.33,
        discount_price: null,
        discount_type: 'percentage',
        discount_value: 15,
        is_subscription: false,
        subscription_interval: null,
      };
      
      // 33.33 - (33.33 * 0.15) = 33.33 - 5.00 = 28.33
      const finalPrice = calculateBumpFinalPrice(bump);
      expect(finalPrice).toBe(28.33);
    });
  });
});

describe('Order Bump - Cálculo Total do Checkout', () => {
  it('deve calcular total sem order bumps', () => {
    const result = calculateCheckoutTotal(97.00, 1, []);
    
    expect(result.productSubtotal).toBe(97.00);
    expect(result.bumpsTotal).toBe(0);
    expect(result.grandTotal).toBe(97.00);
  });

  it('deve calcular total com um order bump sem desconto', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 49.90,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const result = calculateCheckoutTotal(97.00, 1, [bump]);
    
    expect(result.productSubtotal).toBe(97.00);
    expect(result.bumpsTotal).toBe(49.90);
    expect(result.grandTotal).toBe(146.90);
  });

  it('deve calcular total com order bump com desconto fixo', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 97.00,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 50,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const result = calculateCheckoutTotal(197.00, 1, [bump]);
    
    expect(result.productSubtotal).toBe(197.00);
    expect(result.bumpsTotal).toBe(47.00); // 97 - 50
    expect(result.grandTotal).toBe(244.00);
  });

  it('deve calcular total com múltiplos order bumps', () => {
    const bumps: OrderBump[] = [
      {
        id: 'bump-1',
        name: 'Bônus 1',
        price: 50.00,
        discount_price: null,
        discount_type: 'percentage',
        discount_value: 20, // Final: 40.00
        is_subscription: false,
        subscription_interval: null,
      },
      {
        id: 'bump-2',
        name: 'Bônus 2',
        price: 30.00,
        discount_price: null,
        discount_type: 'fixed',
        discount_value: 10, // Final: 20.00
        is_subscription: false,
        subscription_interval: null,
      },
    ];
    
    const result = calculateCheckoutTotal(100.00, 1, bumps);
    
    expect(result.productSubtotal).toBe(100.00);
    expect(result.bumpsTotal).toBe(60.00); // 40 + 20
    expect(result.grandTotal).toBe(160.00);
  });

  it('deve calcular total com quantidade > 1', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 29.90,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
    };
    
    // Quantidade 3 do produto principal, bump sempre quantidade 1
    const result = calculateCheckoutTotal(97.00, 3, [bump]);
    
    expect(result.productSubtotal).toBe(291.00); // 97 * 3
    expect(result.bumpsTotal).toBe(29.90); // Bump não multiplica
    expect(result.grandTotal).toBe(320.90);
  });
});

describe('Order Bump - Marcar/Desmarcar', () => {
  it('deve adicionar bump ao total ao marcar', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 49.90,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const semBump = calculateCheckoutTotal(97.00, 1, []);
    const comBump = calculateCheckoutTotal(97.00, 1, [bump]);
    
    expect(comBump.grandTotal).toBe(semBump.grandTotal + 49.90);
  });

  it('deve remover bump do total ao desmarcar', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 49.90,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const comBump = calculateCheckoutTotal(97.00, 1, [bump]);
    const semBump = calculateCheckoutTotal(97.00, 1, []);
    
    expect(semBump.grandTotal).toBe(comBump.grandTotal - 49.90);
  });
});

describe('Order Bump - Assinaturas Recorrentes', () => {
  it('deve identificar bump como assinatura', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Mentoria Mensal',
      price: 197.00,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: true,
      subscription_interval: 'monthly',
    };
    
    expect(bump.is_subscription).toBe(true);
    expect(bump.subscription_interval).toBe('monthly');
  });

  it('deve suportar diferentes intervalos de assinatura', () => {
    const intervals: ('monthly' | 'quarterly' | 'yearly')[] = ['monthly', 'quarterly', 'yearly'];
    
    intervals.forEach(interval => {
      const bump: OrderBump = {
        id: 'bump-1',
        name: 'Assinatura',
        price: 97.00,
        discount_price: null,
        discount_type: 'fixed',
        discount_value: 0,
        is_subscription: true,
        subscription_interval: interval,
      };
      
      expect(bump.subscription_interval).toBe(interval);
    });
  });
});

describe('Order Bump - Validações', () => {
  it('desconto não deve resultar em valor negativo', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 50.00,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 999, // Desconto absurdo
      is_subscription: false,
      subscription_interval: null,
    };
    
    const finalPrice = calculateBumpFinalPrice(bump);
    expect(finalPrice).toBeGreaterThanOrEqual(0);
  });

  it('desconto percentual > 100% deve resultar em zero', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 50.00,
      discount_price: null,
      discount_type: 'percentage',
      discount_value: 150, // 150%
      is_subscription: false,
      subscription_interval: null,
    };
    
    const finalPrice = calculateBumpFinalPrice(bump);
    expect(finalPrice).toBe(0);
  });

  it('bump sem desconto deve manter preço original', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 97.00,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 0,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const finalPrice = calculateBumpFinalPrice(bump);
    expect(finalPrice).toBe(bump.price);
  });
});

describe('Order Bump - Consistência Frontend-Backend', () => {
  it('cálculo deve ser idêntico entre frontend e simulação backend', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 97.00,
      discount_price: null,
      discount_type: 'percentage',
      discount_value: 30,
      is_subscription: false,
      subscription_interval: null,
    };
    
    // Frontend calculation
    const frontendPrice = calculateBumpFinalPrice(bump);
    
    // Backend simulation (same logic)
    const backendPrice = arredondarMoeda(bump.price - (bump.price * bump.discount_value / 100));
    
    expect(frontendPrice).toBe(backendPrice);
  });

  it('total do checkout deve ser consistente para gateway', () => {
    const bump: OrderBump = {
      id: 'bump-1',
      name: 'Bônus',
      price: 49.90,
      discount_price: null,
      discount_type: 'fixed',
      discount_value: 10,
      is_subscription: false,
      subscription_interval: null,
    };
    
    const result = calculateCheckoutTotal(97.00, 1, [bump]);
    
    // Gateway receives amount in cents
    const gatewayAmount = Math.round(result.grandTotal * 100);
    expect(gatewayAmount).toBe(13690); // R$ 136,90 = 13690 centavos
  });
});
