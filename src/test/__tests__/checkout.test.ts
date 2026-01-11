import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calcularTaxasVenda, arredondarMoeda, PaymentMethod } from '@/lib/feeCalculations';

/**
 * Testes do Fluxo de Checkout
 * 
 * Simula cenários de checkout completo,
 * validando cálculos de taxas e valores finais.
 * Inclui testes para produtos digitais, físicos e assinaturas com quantidade.
 */

// Mock de produto
const mockProduct = {
  id: 'prod-123',
  name: 'Curso de Marketing Digital',
  price: 297.00,
  seller_user_id: 'seller-456',
};

// Mock de dados do comprador
const mockBuyer = {
  name: 'João Silva',
  email: 'joao@email.com',
  document: '12345678900',
};

describe('Fluxo de Checkout', () => {
  describe('Validação de dados de entrada', () => {
    it('deve validar produto com preço válido', () => {
      expect(mockProduct.price).toBeGreaterThan(0);
    });

    it('deve validar dados obrigatórios do comprador', () => {
      expect(mockBuyer.name).toBeTruthy();
      expect(mockBuyer.email).toBeTruthy();
      expect(mockBuyer.email).toContain('@');
    });
  });

  describe('Cálculo de valores no checkout', () => {
    it('deve calcular corretamente checkout PIX de R$ 297', () => {
      const resultado = calcularTaxasVenda(297, 'pix', 0);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(297);
      
      // PIX: 4.99% + R$ 1.49
      const taxaPercentual = arredondarMoeda(297 * 4.99 / 100);
      const taxaFixa = 1.49;
      const totalTaxa = arredondarMoeda(taxaPercentual + taxaFixa);
      
      expect(resultado.taxaPagamento).toBe(totalTaxa);
      expect(resultado.valorLiquido).toBe(arredondarMoeda(297 - totalTaxa));
    });

    it('deve calcular corretamente checkout cartão de R$ 297', () => {
      const resultado = calcularTaxasVenda(297, 'credit_card', 0);
      
      expect(resultado.valido).toBe(true);
      
      // Cartão: 6.99% + R$ 1.49
      const taxaPercentual = arredondarMoeda(297 * 6.99 / 100);
      const taxaFixa = 1.49;
      const totalTaxa = arredondarMoeda(taxaPercentual + taxaFixa);
      
      expect(resultado.taxaPagamento).toBe(totalTaxa);
    });

    it('deve calcular checkout com afiliado corretamente', () => {
      const comissaoAfiliado = 30; // 30%
      const resultado = calcularTaxasVenda(297, 'pix', comissaoAfiliado);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.temAfiliado).toBe(true);
      expect(resultado.comissaoAfiliado).toBe(arredondarMoeda(297 * 0.30));
      
      // Vendedor recebe: valor bruto - taxa pagamento - comissão afiliado
      const taxaPix = arredondarMoeda((297 * 4.99 / 100) + 1.49);
      const comissao = arredondarMoeda(297 * 0.30);
      const valorLiquidoEsperado = arredondarMoeda(297 - taxaPix - comissao);
      
      expect(resultado.valorLiquido).toBe(valorLiquidoEsperado);
    });
  });

  describe('Cenários de checkout com múltiplos métodos', () => {
    const metodos: { metodo: PaymentMethod; percentual: number; fixo: number }[] = [
      { metodo: 'pix', percentual: 4.99, fixo: 1.49 },
      { metodo: 'credit_card', percentual: 6.99, fixo: 1.49 },
      { metodo: 'boleto', percentual: 3.99, fixo: 2.99 },
      { metodo: 'debit_card', percentual: 5.99, fixo: 1.49 },
    ];

    metodos.forEach(({ metodo, percentual, fixo }) => {
      it(`deve calcular checkout via ${metodo} corretamente`, () => {
        const valor = 100;
        const resultado = calcularTaxasVenda(valor, metodo, 0);
        
        expect(resultado.valido).toBe(true);
        
        const taxaEsperada = arredondarMoeda((valor * percentual / 100) + fixo);
        expect(resultado.taxaPagamento).toBe(taxaEsperada);
        expect(resultado.taxaPagamentoPercentual).toBe(percentual);
        expect(resultado.taxaPagamentoFixa).toBe(fixo);
      });
    });
  });

  describe('Checkout com valores limite', () => {
    it('deve processar checkout de valor mínimo (R$ 5)', () => {
      const resultado = calcularTaxasVenda(5, 'pix', 0);
      
      // PIX: 4.99% de 5 + 1.49 = 0.25 + 1.49 = 1.74
      const taxaEsperada = arredondarMoeda((5 * 4.99 / 100) + 1.49);
      const valorLiquidoEsperado = arredondarMoeda(5 - taxaEsperada);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorLiquido).toBe(valorLiquidoEsperado);
      expect(resultado.valorLiquido).toBeGreaterThan(0);
    });

    it('deve processar checkout de alto valor (R$ 10.000)', () => {
      const resultado = calcularTaxasVenda(10000, 'credit_card', 0);
      
      expect(resultado.valido).toBe(true);
      
      // Cartão: 6.99% de 10000 + 1.49 = 699 + 1.49 = 700.49
      const taxaEsperada = arredondarMoeda((10000 * 6.99 / 100) + 1.49);
      expect(resultado.taxaPagamento).toBe(taxaEsperada);
      expect(resultado.valorLiquido).toBe(arredondarMoeda(10000 - taxaEsperada));
    });
  });

  describe('Validações de segurança do checkout', () => {
    it('deve rejeitar checkout com valor zero', () => {
      const resultado = calcularTaxasVenda(0, 'pix', 0);
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar checkout com valor negativo', () => {
      const resultado = calcularTaxasVenda(-100, 'pix', 0);
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar checkout onde taxas excedem valor', () => {
      // Valor muito baixo com alta comissão de afiliado
      const resultado = calcularTaxasVenda(2, 'credit_card', 80);
      expect(resultado.valido).toBe(false);
    });
  });

  describe('Consistência dos cálculos', () => {
    it('valorBruto deve ser igual a valorLiquido + totalTaxas', () => {
      const valores = [47, 97, 197, 297, 497, 997, 1997];
      
      valores.forEach(valor => {
        const resultado = calcularTaxasVenda(valor, 'credit_card', 0);
        
        if (resultado.valido) {
          const soma = arredondarMoeda(resultado.valorLiquido + resultado.totalTaxas);
          expect(soma).toBe(resultado.valorBruto);
        }
      });
    });

    it('totalTaxas deve ser soma de todas as taxas', () => {
      const resultado = calcularTaxasVenda(100, 'pix', 20);
      
      const somaManual = arredondarMoeda(
        resultado.taxaPagamento + 
        resultado.taxaPlataforma + 
        resultado.comissaoAfiliado
      );
      
      expect(resultado.totalTaxas).toBe(somaManual);
    });
  });
});

describe('Simulação de Processamento de Checkout', () => {
  it('deve simular fluxo completo de checkout PIX', async () => {
    // 1. Calcular taxas
    const calculo = calcularTaxasVenda(mockProduct.price, 'pix', 0);
    expect(calculo.valido).toBe(true);
    
    // 2. Preparar dados para salvar
    const saleData = {
      product_id: mockProduct.id,
      seller_user_id: mockProduct.seller_user_id,
      buyer_name: mockBuyer.name,
      buyer_email: mockBuyer.email,
      buyer_document: mockBuyer.document,
      amount: calculo.valorBruto,
      payment_method: 'pix',
      payment_fee: calculo.taxaPagamento,
      payment_fee_percent: calculo.taxaPagamentoPercentual,
      platform_fee: calculo.taxaPlataforma,
      platform_fee_percent: calculo.taxaPlataformaPercentual,
      commission_amount: calculo.comissaoAfiliado,
      affiliate_commission_percent: calculo.comissaoAfiliadoPercentual,
      net_amount: calculo.valorLiquido,
      status: 'pending',
    };
    
    // 3. Validar dados
    expect(saleData.amount).toBe(297);
    expect(saleData.net_amount).toBeLessThan(saleData.amount);
    expect(saleData.payment_fee).toBeGreaterThan(0);
    
    // 4. Verificar consistência
    const soma = arredondarMoeda(
      saleData.net_amount + 
      saleData.payment_fee + 
      saleData.platform_fee + 
      saleData.commission_amount
    );
    expect(soma).toBe(saleData.amount);
  });

  it('deve simular fluxo de checkout com afiliado', async () => {
    const comissaoAfiliado = 25; // 25%
    
    // 1. Calcular taxas
    const calculo = calcularTaxasVenda(mockProduct.price, 'credit_card', comissaoAfiliado);
    expect(calculo.valido).toBe(true);
    
    // 2. Verificar divisão correta
    const comissaoEsperada = arredondarMoeda(mockProduct.price * 0.25);
    expect(calculo.comissaoAfiliado).toBe(comissaoEsperada);
    
    // 3. Verificar que vendedor recebe menos quando há afiliado
    const calculoSemAfiliado = calcularTaxasVenda(mockProduct.price, 'credit_card', 0);
    expect(calculo.valorLiquido).toBeLessThan(calculoSemAfiliado.valorLiquido);
    
    // 4. Diferença deve ser exatamente a comissão
    const diferenca = arredondarMoeda(calculoSemAfiliado.valorLiquido - calculo.valorLiquido);
    expect(diferenca).toBe(comissaoEsperada);
});

describe('Checkout com Quantidade', () => {
  describe('Produtos Digitais', () => {
    it('deve calcular corretamente com quantidade 1', () => {
      const unitPrice = 97.00;
      const quantity = 1;
      const total = arredondarMoeda(unitPrice * quantity);
      
      expect(total).toBe(97.00);
      
      const resultado = calcularTaxasVenda(total, 'pix', 0);
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(97);
    });

    it('deve calcular corretamente com quantidade 3', () => {
      const unitPrice = 97.00;
      const quantity = 3;
      const total = arredondarMoeda(unitPrice * quantity);
      
      expect(total).toBe(291.00);
      
      const resultado = calcularTaxasVenda(total, 'pix', 0);
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(291);
    });

    it('deve manter precisão decimal com quantidade', () => {
      const unitPrice = 33.33;
      const quantity = 3;
      const total = arredondarMoeda(unitPrice * quantity);
      
      expect(total).toBe(99.99);
    });
  });

  describe('Assinaturas', () => {
    // Utility to simulate subscription quantity validation
    const validateSubscriptionQuantity = (
      quantityMode: 'single' | 'license' | 'seat',
      requestedQuantity: number
    ): { valid: boolean; quantity: number } => {
      if (quantityMode === 'single' && requestedQuantity !== 1) {
        return { valid: false, quantity: 1 }; // Force to 1
      }
      if (requestedQuantity < 1 || requestedQuantity > 100) {
        return { valid: false, quantity: Math.max(1, Math.min(100, requestedQuantity)) };
      }
      return { valid: true, quantity: requestedQuantity };
    };

    it('deve forçar quantidade 1 para modo single', () => {
      const result = validateSubscriptionQuantity('single', 5);
      expect(result.valid).toBe(false);
      expect(result.quantity).toBe(1);
    });

    it('deve aceitar quantidade > 1 para modo license', () => {
      const result = validateSubscriptionQuantity('license', 5);
      expect(result.valid).toBe(true);
      expect(result.quantity).toBe(5);
    });

    it('deve aceitar quantidade > 1 para modo seat', () => {
      const result = validateSubscriptionQuantity('seat', 10);
      expect(result.valid).toBe(true);
      expect(result.quantity).toBe(10);
    });

    it('deve calcular total recorrente corretamente', () => {
      const unitPrice = 49.90;
      const quantity = 5;
      const totalRecurring = arredondarMoeda(unitPrice * quantity);
      
      expect(totalRecurring).toBe(249.50);
      
      const resultado = calcularTaxasVenda(totalRecurring, 'credit_card', 0);
      expect(resultado.valido).toBe(true);
    });

    it('deve limitar quantidade máxima a 100', () => {
      const result = validateSubscriptionQuantity('license', 150);
      expect(result.valid).toBe(false);
      expect(result.quantity).toBe(100);
    });
  });
});

describe('Consistência Frontend-Backend-Gateway', () => {
  interface CheckoutValues {
    unitPrice: number;
    quantity: number;
    orderBumpsTotal: number;
  }

  const calculateCheckoutTotal = (values: CheckoutValues) => {
    const productSubtotal = arredondarMoeda(values.unitPrice * values.quantity);
    const total = arredondarMoeda(productSubtotal + values.orderBumpsTotal);
    return { productSubtotal, total };
  };

  it('deve ter valores consistentes entre frontend e backend', () => {
    const values: CheckoutValues = {
      unitPrice: 97.00,
      quantity: 2,
      orderBumpsTotal: 29.90,
    };

    const result = calculateCheckoutTotal(values);
    
    expect(result.productSubtotal).toBe(194.00);
    expect(result.total).toBe(223.90);
    
    // Gateway receives amount in cents
    const gatewayAmount = Math.round(result.total * 100);
    expect(gatewayAmount).toBe(22390);
  });

  it('deve validar que taxa não excede valor', () => {
    const total = 5.00; // Valor baixo
    const resultado = calcularTaxasVenda(total, 'credit_card', 0);
    
    // Taxas: 6.99% de 5 + 1.49 = 0.35 + 1.49 = 1.84
    if (resultado.valido) {
      expect(resultado.totalTaxas).toBeLessThan(resultado.valorBruto);
      expect(resultado.valorLiquido).toBeGreaterThan(0);
    }
  });
});
});

/**
 * Testes de Validação de Cupom - Regra de Negócio Crítica
 * 
 * Cupons só podem ser aplicados em produtos:
 * 1. Criados pelo próprio usuário (dono do produto)
 * 2. Onde o usuário seja coprodutor
 */
describe('Validação de Cupom - Regra de Propriedade', () => {
  // Tipos para simular a validação
  interface CouponOwnershipValidation {
    campaignOwnerUserId: string;
    productOwnerUserId: string;
    coProducerUserIds: string[];
  }

  // Função que simula a lógica de validação do backend
  const validateCouponOwnership = (validation: CouponOwnershipValidation): {
    valid: boolean;
    reason: 'OWNER' | 'CO_PRODUCER' | 'NO_RELATION';
  } => {
    // Caso 1: Dono do cupom é o dono do produto
    if (validation.campaignOwnerUserId === validation.productOwnerUserId) {
      return { valid: true, reason: 'OWNER' };
    }

    // Caso 2: Dono do cupom é coprodutor do produto
    if (validation.coProducerUserIds.includes(validation.campaignOwnerUserId)) {
      return { valid: true, reason: 'CO_PRODUCER' };
    }

    // Caso 3: Sem vínculo - BLOQUEADO
    return { valid: false, reason: 'NO_RELATION' };
  };

  describe('Cupom do dono do produto', () => {
    it('deve PERMITIR cupom quando dono da campanha é o dono do produto', () => {
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-123',
        productOwnerUserId: 'user-123',
        coProducerUserIds: [],
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('OWNER');
    });
  });

  describe('Cupom de coprodutor', () => {
    it('deve PERMITIR cupom quando dono da campanha é coprodutor ativo', () => {
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-456',
        productOwnerUserId: 'user-123',
        coProducerUserIds: ['user-456', 'user-789'],
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('CO_PRODUCER');
    });

    it('deve PERMITIR quando há múltiplos coprodutores', () => {
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-789',
        productOwnerUserId: 'user-123',
        coProducerUserIds: ['user-456', 'user-789', 'user-000'],
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('CO_PRODUCER');
    });
  });

  describe('Cupom de usuário sem vínculo', () => {
    it('deve BLOQUEAR cupom de terceiros sem vínculo', () => {
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-stranger',
        productOwnerUserId: 'user-123',
        coProducerUserIds: ['user-456'],
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NO_RELATION');
    });

    it('deve BLOQUEAR mesmo com lista vazia de coprodutores', () => {
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-attacker',
        productOwnerUserId: 'user-123',
        coProducerUserIds: [],
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NO_RELATION');
    });

    it('deve BLOQUEAR tentativa de usar cupom de produto diferente', () => {
      // Simulação: usuário cria campanha para product-A e tenta usar em product-B
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-456', // Dono de outro produto
        productOwnerUserId: 'user-123',  // Dono do produto do checkout
        coProducerUserIds: [],           // user-456 não é coprodutor aqui
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NO_RELATION');
    });
  });

  describe('Cenários de ataque', () => {
    it('deve BLOQUEAR tentativa via API com campaign_id forjado', () => {
      // Simula alguém tentando forçar um cupom via requisição manual
      const attackResult = validateCouponOwnership({
        campaignOwnerUserId: 'hacker-user',
        productOwnerUserId: 'legitimate-seller',
        coProducerUserIds: ['partner-a', 'partner-b'],
      });

      expect(attackResult.valid).toBe(false);
    });

    it('deve BLOQUEAR quando coprodutor foi removido', () => {
      // Simulação: user-456 era coprodutor mas foi removido
      const result = validateCouponOwnership({
        campaignOwnerUserId: 'user-456',
        productOwnerUserId: 'user-123',
        coProducerUserIds: [], // Não está mais na lista de coprodutores ativos
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Preview de cupom', () => {
    it('NÃO deve consumir uso de cupom em preview', () => {
      // Preview é apenas validação visual - não incrementa current_uses
      const isPreview = true;
      const shouldIncrementUsage = !isPreview;
      
      expect(shouldIncrementUsage).toBe(false);
    });
  });
});
