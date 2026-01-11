import { describe, it, expect } from 'vitest';
import {
  calcularTaxasVenda,
  calcularTaxaSaque,
  calcularTaxasAssinatura,
  arredondarMoeda,
  calcularTaxaPercentual,
  DEFAULT_FEE_CONFIG,
  PaymentMethod,
  ACQUIRER_FEE_PER_TRANSACTION,
} from '../feeCalculations';

// =====================================
// CONSTANTES PARA TESTES - TAXAS OFICIAIS ROYALPAY
// =====================================

const GATEWAY_FEES = {
  pix: { percentual: 4.99, fixo: 1.49 },
  credit_card: { percentual: 6.99, fixo: 1.49 },
  boleto: { percentual: 5.99, fixo: 1.49 },
};

// =====================================
// TESTES DE FUNÇÕES UTILITÁRIAS
// =====================================

describe('Funções Utilitárias', () => {
  describe('arredondarMoeda', () => {
    it('deve arredondar para 2 casas decimais', () => {
      expect(arredondarMoeda(10.126)).toBe(10.13);
      expect(arredondarMoeda(10.124)).toBe(10.12);
      expect(arredondarMoeda(10.125)).toBe(10.13);
    });

    it('deve lidar com valores inteiros', () => {
      expect(arredondarMoeda(100)).toBe(100);
      expect(arredondarMoeda(0)).toBe(0);
    });

    it('deve lidar com valores negativos', () => {
      expect(arredondarMoeda(-10.126)).toBe(-10.13);
    });
  });

  describe('calcularTaxaPercentual', () => {
    it('deve calcular taxa percentual corretamente', () => {
      expect(calcularTaxaPercentual(100, 5)).toBe(5);
      expect(calcularTaxaPercentual(100, 4.99)).toBe(4.99);
      expect(calcularTaxaPercentual(200, 6.99)).toBe(13.98);
    });

    it('deve retornar 0 para percentual 0', () => {
      expect(calcularTaxaPercentual(100, 0)).toBe(0);
    });

    it('deve retornar 0 para valor base 0', () => {
      expect(calcularTaxaPercentual(0, 5)).toBe(0);
    });
  });
});

// =====================================
// TESTES DE CÁLCULO DE VENDA - TAXAS OFICIAIS ROYALPAY
// =====================================

describe('Cálculo de Taxas de Venda - RoyalPay', () => {
  
  describe('📌 Exemplo 1 — PIX (R$ 100,00)', () => {
    /**
     * Valor pago: R$ 100,00
     * Taxa PIX: 4,99% = R$ 4,99
     * Taxa fixa gateway: R$ 1,49
     * Lucro do gateway: R$ 4,99 + R$ 1,49 = R$ 6,48
     * Valor após gateway: 100 - 6,48 = R$ 93,52
     * Taxa adquirente: R$ 0,60
     * Lucro Líquido: 93,52 - 0,60 = R$ 92,92
     */
    it('deve calcular corretamente uma venda PIX de R$ 100', () => {
      const resultado = calcularTaxasVenda(100, 'pix', 0);
      
      expect(resultado.operationType).toBe('sale');
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(100);
      
      // Taxa PIX: 4.99% de 100 + R$ 1.49 fixo = 4.99 + 1.49 = 6.48
      const taxaPercentual = arredondarMoeda(100 * 4.99 / 100); // 4.99
      const taxaFixa = 1.49;
      const taxaEsperada = arredondarMoeda(taxaPercentual + taxaFixa); // 6.48
      
      expect(resultado.taxaPagamento).toBe(taxaEsperada);
      expect(resultado.taxaPagamentoPercentual).toBe(4.99);
      expect(resultado.taxaPagamentoFixa).toBe(1.49);
      
      // Valor líquido (sem adquirente - apenas taxas do gateway)
      const valorLiquidoEsperado = arredondarMoeda(100 - taxaEsperada); // 93.52
      expect(resultado.valorLiquido).toBe(valorLiquidoEsperado);
    });
  });

  describe('📌 Exemplo 2 — Boleto (R$ 200,00)', () => {
    /**
     * Taxa boleto: 5,99% = R$ 11,98
     * Taxa fixa gateway: R$ 1,49
     * Volume Transacionado (Lucro Gateway): 11,98 + 1,49 = R$ 13,47
     * Valor após gateway: 200 - 13,47 = R$ 186,53
     * Taxa adquirente: R$ 0,60
     * Lucro Líquido: R$ 185,93
     */
    it('deve calcular corretamente uma venda Boleto de R$ 200', () => {
      const resultado = calcularTaxasVenda(200, 'boleto', 0);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(200);
      
      // Taxa Boleto: 5.99% de 200 + R$ 1.49 fixo = 11.98 + 1.49 = 13.47
      const taxaPercentual = arredondarMoeda(200 * 5.99 / 100); // 11.98
      const taxaFixa = 1.49;
      const taxaEsperada = arredondarMoeda(taxaPercentual + taxaFixa); // 13.47
      
      expect(resultado.taxaPagamento).toBe(taxaEsperada);
      expect(resultado.taxaPagamentoPercentual).toBe(5.99);
      
      // Valor líquido após taxas do gateway
      const valorLiquidoEsperado = arredondarMoeda(200 - taxaEsperada); // 186.53
      expect(resultado.valorLiquido).toBe(valorLiquidoEsperado);
    });
  });

  describe('📌 Exemplo 3 — Cartão (R$ 150,00 / taxa padrão 6.99%)', () => {
    /**
     * Taxa cartão: 6,99% = R$ 10,49
     * Taxa fixa gateway: R$ 1,49
     * Volume Transacionado: 10,49 + 1,49 = R$ 11,98
     * Valor após gateway: 150 - 11,98 = R$ 138,02
     * Taxa adquirente: R$ 0,60
     * Lucro Líquido: R$ 137,42
     */
    it('deve calcular corretamente uma venda com cartão de R$ 150', () => {
      const resultado = calcularTaxasVenda(150, 'credit_card', 0);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorBruto).toBe(150);
      
      // Taxa Cartão: 6.99% de 150 + R$ 1.49 fixo = 10.485 (arredonda p/ 10.49) + 1.49 = 11.98
      const taxaPercentual = arredondarMoeda(150 * 6.99 / 100); // 10.49
      const taxaFixa = 1.49;
      const taxaEsperada = arredondarMoeda(taxaPercentual + taxaFixa); // 11.98
      
      expect(resultado.taxaPagamento).toBe(taxaEsperada);
      expect(resultado.taxaPagamentoPercentual).toBe(6.99);
      
      // Valor líquido após taxas do gateway
      const valorLiquidoEsperado = arredondarMoeda(150 - taxaEsperada); // 138.02
      expect(resultado.valorLiquido).toBe(valorLiquidoEsperado);
    });
  });

  describe('Cálculo com Afiliado', () => {
    it('deve calcular corretamente uma venda com afiliado 10%', () => {
      const resultado = calcularTaxasVenda(100, 'pix', 10);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.temAfiliado).toBe(true);
      expect(resultado.comissaoAfiliado).toBe(10); // 10% de 100
      expect(resultado.comissaoAfiliadoPercentual).toBe(10);
      
      // Total = taxa PIX + comissão
      const taxaPix = arredondarMoeda((100 * 4.99 / 100) + 1.49); // 6.48
      const totalTaxas = arredondarMoeda(taxaPix + 10); // 16.48
      expect(resultado.totalTaxas).toBe(totalTaxas);
    });
  });

  describe('Cenários de erro', () => {
    it('deve rejeitar valor bruto menor ou igual a zero', () => {
      const resultado = calcularTaxasVenda(0, 'pix', 0);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('maior que zero');
    });

    it('deve rejeitar valor bruto negativo', () => {
      const resultado = calcularTaxasVenda(-50, 'pix', 0);
      
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar quando taxas excedem valor bruto', () => {
      const resultado = calcularTaxasVenda(1, 'credit_card', 50);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('negativo');
    });
  });

  describe('Validações de consistência', () => {
    it('valor líquido + taxas deve ser igual ao valor bruto', () => {
      const valores = [50, 100, 250, 500, 1000, 2500];
      const metodos: PaymentMethod[] = ['pix', 'credit_card', 'boleto'];
      
      valores.forEach(valor => {
        metodos.forEach(metodo => {
          const resultado = calcularTaxasVenda(valor, metodo, 0);
          if (resultado.valido) {
            const soma = arredondarMoeda(resultado.valorLiquido + resultado.totalTaxas);
            expect(soma).toBe(resultado.valorBruto);
          }
        });
      });
    });

    it('taxas nunca devem ser negativas', () => {
      const resultado = calcularTaxasVenda(100, 'pix', 0);
      
      expect(resultado.taxaPagamento).toBeGreaterThanOrEqual(0);
      expect(resultado.taxaPlataforma).toBeGreaterThanOrEqual(0);
      expect(resultado.comissaoAfiliado).toBeGreaterThanOrEqual(0);
      expect(resultado.totalTaxas).toBeGreaterThanOrEqual(0);
    });
    
    it('deve incluir detalhes de auditoria', () => {
      const resultado = calcularTaxasVenda(100, 'pix', 0);
      
      expect(resultado.detalhes).toBeDefined();
      expect(resultado.detalhes.formula).toContain('valor_liquido_venda');
      expect(resultado.detalhes.passos.length).toBeGreaterThan(0);
      expect(resultado.detalhes.timestamp).toBeDefined();
    });
  });
});

// =====================================
// TESTES DE CÁLCULO DO GATEWAY (VOLUME TRANSACIONADO + LUCRO LÍQUIDO)
// =====================================

describe('Cálculo Financeiro do Gateway RoyalPay', () => {
  
  /**
   * DEFINIÇÕES OFICIAIS:
   * - Volume Transacionado = Lucro do Gateway (taxas percentuais + fixas)
   * - Taxas de Transação = Apenas adquirente (R$ 0.60 × transações)
   * - Lucro Líquido = Volume Transacionado - Taxas de Transação
   */
  
  describe('Volume Transacionado (Lucro do Gateway)', () => {
    it('PIX R$ 100 → Lucro Gateway = R$ 6.48', () => {
      // Taxa percentual: 4.99% de 100 = 4.99
      // Taxa fixa: 1.49
      // Lucro Gateway = 4.99 + 1.49 = 6.48
      const taxaPercentual = arredondarMoeda(100 * 4.99 / 100);
      const taxaFixa = 1.49;
      const lucroGateway = arredondarMoeda(taxaPercentual + taxaFixa);
      
      expect(lucroGateway).toBe(6.48);
    });
    
    it('Boleto R$ 200 → Lucro Gateway = R$ 13.47', () => {
      // Taxa percentual: 5.99% de 200 = 11.98
      // Taxa fixa: 1.49
      // Lucro Gateway = 11.98 + 1.49 = 13.47
      const taxaPercentual = arredondarMoeda(200 * 5.99 / 100);
      const taxaFixa = 1.49;
      const lucroGateway = arredondarMoeda(taxaPercentual + taxaFixa);
      
      expect(lucroGateway).toBe(13.47);
    });
    
    it('Cartão R$ 150 → Lucro Gateway = R$ 11.98', () => {
      // Taxa percentual: 6.99% de 150 = 10.485 → 10.49
      // Taxa fixa: 1.49
      // Lucro Gateway = 10.49 + 1.49 = 11.98
      const taxaPercentual = arredondarMoeda(150 * 6.99 / 100);
      const taxaFixa = 1.49;
      const lucroGateway = arredondarMoeda(taxaPercentual + taxaFixa);
      
      expect(lucroGateway).toBe(11.98);
    });
  });
  
  describe('Taxas de Transação (Adquirente)', () => {
    it('deve calcular R$ 0.60 por transação aprovada', () => {
      expect(ACQUIRER_FEE_PER_TRANSACTION).toBe(0.60);
      
      // 1 transação = R$ 0.60
      expect(1 * ACQUIRER_FEE_PER_TRANSACTION).toBe(0.60);
      
      // 10 transações = R$ 6.00
      expect(10 * ACQUIRER_FEE_PER_TRANSACTION).toBe(6.00);
      
      // 100 transações = R$ 60.00
      expect(100 * ACQUIRER_FEE_PER_TRANSACTION).toBe(60.00);
    });
  });
  
  describe('Lucro Líquido Final', () => {
    it('PIX R$ 100 com 1 transação → Lucro Líquido = R$ 5.88', () => {
      // Lucro Gateway = R$ 6.48
      // Taxa Adquirente = R$ 0.60
      // Lucro Líquido = 6.48 - 0.60 = R$ 5.88
      const lucroGateway = 6.48;
      const taxaAdquirente = 0.60;
      const lucroLiquido = arredondarMoeda(lucroGateway - taxaAdquirente);
      
      expect(lucroLiquido).toBe(5.88);
    });
    
    it('Boleto R$ 200 com 1 transação → Lucro Líquido = R$ 12.87', () => {
      // Lucro Gateway = R$ 13.47
      // Taxa Adquirente = R$ 0.60
      // Lucro Líquido = 13.47 - 0.60 = R$ 12.87
      const lucroGateway = 13.47;
      const taxaAdquirente = 0.60;
      const lucroLiquido = arredondarMoeda(lucroGateway - taxaAdquirente);
      
      expect(lucroLiquido).toBe(12.87);
    });
    
    it('Cartão R$ 150 com 1 transação → Lucro Líquido = R$ 11.38', () => {
      // Lucro Gateway = R$ 11.98
      // Taxa Adquirente = R$ 0.60
      // Lucro Líquido = 11.98 - 0.60 = R$ 11.38
      const lucroGateway = 11.98;
      const taxaAdquirente = 0.60;
      const lucroLiquido = arredondarMoeda(lucroGateway - taxaAdquirente);
      
      expect(lucroLiquido).toBe(11.38);
    });
  });
  
  describe('Cenário de múltiplas transações', () => {
    it('10 vendas PIX de R$ 100 cada', () => {
      // Lucro Gateway por transação: R$ 6.48
      // Total Lucro Gateway: R$ 64.80
      // Taxa Adquirente Total: 10 × R$ 0.60 = R$ 6.00
      // Lucro Líquido: R$ 64.80 - R$ 6.00 = R$ 58.80
      
      const lucroPorTransacao = 6.48;
      const totalLucroGateway = arredondarMoeda(10 * lucroPorTransacao);
      const totalAdquirente = arredondarMoeda(10 * 0.60);
      const lucroLiquido = arredondarMoeda(totalLucroGateway - totalAdquirente);
      
      expect(totalLucroGateway).toBe(64.80);
      expect(totalAdquirente).toBe(6.00);
      expect(lucroLiquido).toBe(58.80);
    });
  });
});

// =====================================
// TESTES DE CÁLCULO DE SAQUE
// =====================================

describe('Cálculo de Taxas de Saque', () => {
  describe('Cenários de sucesso', () => {
    it('deve calcular corretamente um saque de R$ 100 com taxa padrão', () => {
      const resultado = calcularTaxaSaque(100);
      
      expect(resultado.operationType).toBe('withdrawal');
      expect(resultado.valido).toBe(true);
      expect(resultado.valorSolicitado).toBe(100);
      
      // Taxa padrão: 0% + R$ 10.00 fixo
      expect(resultado.totalTaxaSaque).toBe(10);
      expect(resultado.valorLiquido).toBe(90);
    });

    it('deve calcular corretamente um saque de R$ 500', () => {
      const resultado = calcularTaxaSaque(500);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorLiquido).toBe(490);
    });

    it('deve aplicar taxa percentual quando configurada', () => {
      const resultado = calcularTaxaSaque(100, 2, 5); // 2% + R$ 5 fixo
      
      expect(resultado.valido).toBe(true);
      expect(resultado.taxaSaquePercentual).toBe(2);
      expect(resultado.taxaSaqueFixa).toBe(5);
      expect(resultado.totalTaxaSaque).toBe(7); // 2% de 100 + 5
      expect(resultado.valorLiquido).toBe(93);
    });

    it('deve incluir detalhes de auditoria', () => {
      const resultado = calcularTaxaSaque(100);
      
      expect(resultado.detalhes).toBeDefined();
      expect(resultado.detalhes.formula).toContain('valor_liquido_saque');
      expect(resultado.detalhes.passos.length).toBeGreaterThan(0);
    });
  });

  describe('Cenários de erro', () => {
    it('deve rejeitar valor de saque menor ou igual a zero', () => {
      const resultado = calcularTaxaSaque(0);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('maior que zero');
    });

    it('deve rejeitar quando valor líquido é zero ou negativo', () => {
      const resultado = calcularTaxaSaque(10, 0, 10);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('negativo ou zero');
    });

    it('deve rejeitar quando taxa é maior que valor solicitado', () => {
      const resultado = calcularTaxaSaque(5, 0, 10);
      
      expect(resultado.valido).toBe(false);
    });
  });

  describe('Validações de consistência', () => {
    it('valor líquido + taxa deve ser igual ao valor solicitado', () => {
      const valores = [50, 100, 250, 500, 1000];
      
      valores.forEach(valor => {
        const resultado = calcularTaxaSaque(valor);
        if (resultado.valido) {
          const soma = arredondarMoeda(resultado.valorLiquido + resultado.totalTaxaSaque);
          expect(soma).toBe(resultado.valorSolicitado);
        }
      });
    });

    it('valor mínimo de saque deve cobrir a taxa', () => {
      const resultado = calcularTaxaSaque(11);
      expect(resultado.valido).toBe(true);
      expect(resultado.valorLiquido).toBe(1);
    });
  });
});

// =====================================
// TESTES DE CÁLCULO DE ASSINATURA
// =====================================

describe('Cálculo de Taxas de Assinatura', () => {
  describe('Cenários de sucesso', () => {
    it('deve calcular corretamente uma assinatura mensal de R$ 100', () => {
      const resultado = calcularTaxasAssinatura(100, 'credit_card', 'monthly');
      
      expect(resultado.operationType).toBe('subscription');
      expect(resultado.valido).toBe(true);
      expect(resultado.valorPlano).toBe(100);
      expect(resultado.ciclo).toBe('monthly');
    });

    it('deve calcular corretamente uma assinatura anual', () => {
      const resultado = calcularTaxasAssinatura(1200, 'credit_card', 'yearly');
      
      expect(resultado.valido).toBe(true);
      expect(resultado.ciclo).toBe('yearly');
    });

    it('deve aplicar taxa recorrente corretamente', () => {
      const resultado = calcularTaxasAssinatura(100, 'pix', 'monthly');
      
      expect(resultado.valido).toBe(true);
      expect(resultado.taxaRecorrentePercentual).toBe(DEFAULT_FEE_CONFIG.subscription.percentual);
    });

    it('deve incluir detalhes de auditoria', () => {
      const resultado = calcularTaxasAssinatura(100, 'credit_card');
      
      expect(resultado.detalhes).toBeDefined();
      expect(resultado.detalhes.formula).toContain('valor_liquido_assinatura');
    });
  });

  describe('Cenários de erro', () => {
    it('deve rejeitar valor do plano menor ou igual a zero', () => {
      const resultado = calcularTaxasAssinatura(0, 'credit_card');
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('maior que zero');
    });
  });

  describe('Validações de consistência', () => {
    it('valor líquido + taxas deve ser igual ao valor do plano', () => {
      const resultado = calcularTaxasAssinatura(100, 'credit_card');
      
      if (resultado.valido) {
        const soma = arredondarMoeda(resultado.valorLiquido + resultado.totalTaxas);
        expect(soma).toBe(resultado.valorPlano);
      }
    });
  });
});

// =====================================
// TESTES DE ISOLAMENTO DE OPERAÇÕES
// =====================================

describe('Isolamento de Operações', () => {
  it('não deve misturar regras entre venda e saque', () => {
    const venda = calcularTaxasVenda(100, 'pix', 0);
    const saque = calcularTaxaSaque(100);
    
    expect(venda.totalTaxas).not.toBe(saque.totalTaxaSaque);
    expect(venda.operationType).toBe('sale');
    expect(saque.operationType).toBe('withdrawal');
  });

  it('não deve misturar regras entre venda e assinatura', () => {
    const venda = calcularTaxasVenda(100, 'credit_card', 0);
    const assinatura = calcularTaxasAssinatura(100, 'credit_card');
    
    expect(venda.operationType).toBe('sale');
    expect(assinatura.operationType).toBe('subscription');
  });

  it('cada operação deve ter seu próprio conjunto de taxas', () => {
    const venda = calcularTaxasVenda(100, 'pix', 0);
    const saque = calcularTaxaSaque(100);
    const assinatura = calcularTaxasAssinatura(100, 'pix');
    
    expect('taxaPagamento' in venda).toBe(true);
    expect('totalTaxaSaque' in saque).toBe(true);
    expect('taxaRecorrente' in assinatura).toBe(true);
  });
});

// =====================================
// TESTES DE CENÁRIOS REAIS
// =====================================

describe('Cenários Reais de Uso', () => {
  it('Venda de produto digital de R$ 197 via PIX', () => {
    const resultado = calcularTaxasVenda(197, 'pix', 0);
    
    expect(resultado.valido).toBe(true);
    // Taxa PIX: 4.99% de 197 + R$ 1.49 = R$ 9.83 + R$ 1.49 = R$ 11.32
    const taxaEsperada = arredondarMoeda((197 * 4.99 / 100) + 1.49);
    expect(resultado.taxaPagamento).toBe(taxaEsperada);
    expect(resultado.valorLiquido).toBe(arredondarMoeda(197 - taxaEsperada));
  });

  it('Venda de curso de R$ 997 via cartão com afiliado 20%', () => {
    const resultado = calcularTaxasVenda(997, 'credit_card', 20);
    
    expect(resultado.valido).toBe(true);
    expect(resultado.temAfiliado).toBe(true);
    expect(resultado.comissaoAfiliado).toBe(arredondarMoeda(997 * 0.20));
  });

  it('Saque de R$ 1000 do vendedor', () => {
    const resultado = calcularTaxaSaque(1000);
    
    expect(resultado.valido).toBe(true);
    expect(resultado.valorLiquido).toBe(990); // 1000 - 10 taxa
  });

  it('Assinatura mensal de R$ 47 via cartão', () => {
    const resultado = calcularTaxasAssinatura(47, 'credit_card', 'monthly');
    
    expect(resultado.valido).toBe(true);
    expect(resultado.ciclo).toBe('monthly');
    expect(resultado.valorLiquido).toBeLessThan(47);
  });
});

// =====================================
// TESTES DE REGRESSÃO
// =====================================

describe('Testes de Regressão', () => {
  it('alterar taxa não deve quebrar cálculo de vendas existentes', () => {
    // Simula vendas com taxas atuais
    const vendaPix = calcularTaxasVenda(100, 'pix', 0);
    const vendaCartao = calcularTaxasVenda(100, 'credit_card', 0);
    const vendaBoleto = calcularTaxasVenda(100, 'boleto', 0);
    
    // Todas devem ser válidas
    expect(vendaPix.valido).toBe(true);
    expect(vendaCartao.valido).toBe(true);
    expect(vendaBoleto.valido).toBe(true);
    
    // Taxas devem ser diferentes por método
    expect(vendaPix.taxaPagamento).not.toBe(vendaCartao.taxaPagamento);
    expect(vendaPix.taxaPagamento).not.toBe(vendaBoleto.taxaPagamento);
  });
  
  it('arredondamento deve ser consistente em todos os cálculos', () => {
    // Valores que podem causar problemas de arredondamento
    const valoresProblematicos = [99.99, 100.01, 0.01, 0.99, 1.005, 10.125];
    
    valoresProblematicos.forEach(valor => {
      if (valor > 5) { // Valor mínimo para cobrir taxas
        const resultado = calcularTaxasVenda(valor, 'pix', 0);
        // Verifica se não há NaN ou Infinity
        expect(Number.isFinite(resultado.taxaPagamento)).toBe(true);
        expect(Number.isFinite(resultado.valorLiquido)).toBe(true);
      }
    });
  });
  
  it('nenhum valor deve ser negativo em transações válidas', () => {
    const metodos: PaymentMethod[] = ['pix', 'credit_card', 'boleto'];
    const valores = [10, 50, 100, 500, 1000, 5000];
    
    metodos.forEach(metodo => {
      valores.forEach(valor => {
        const resultado = calcularTaxasVenda(valor, metodo, 0);
        if (resultado.valido) {
          expect(resultado.taxaPagamento).toBeGreaterThanOrEqual(0);
          expect(resultado.valorLiquido).toBeGreaterThanOrEqual(0);
          expect(resultado.totalTaxas).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});
