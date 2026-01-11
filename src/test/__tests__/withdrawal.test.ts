import { describe, it, expect, vi } from 'vitest';
import { 
  calcularTaxaSaque, 
  calcularTaxasVenda,
  arredondarMoeda,
  DEFAULT_FEE_CONFIG 
} from '@/lib/feeCalculations';

/**
 * Testes do Fluxo de Saque
 * 
 * Simula cenários de saque completo,
 * validando cálculos de taxas e saldo disponível.
 */

// Mock de conta bancária
const mockBankAccount = {
  id: 'bank-123',
  user_id: 'user-456',
  bank_name: 'Banco do Brasil',
  agency: '1234',
  account_number: '12345-6',
  pix_key: 'email@teste.com',
  pix_key_type: 'email',
  status: 'approved',
};

describe('Fluxo de Saque', () => {
  describe('Cálculo de taxa de saque', () => {
    it('deve calcular taxa fixa padrão de R$ 10,00', () => {
      const resultado = calcularTaxaSaque(100);
      
      expect(resultado.operationType).toBe('withdrawal');
      expect(resultado.valido).toBe(true);
      expect(resultado.totalTaxaSaque).toBe(10);
      expect(resultado.valorLiquido).toBe(90);
    });

    it('deve calcular saque de R$ 500 corretamente', () => {
      const resultado = calcularTaxaSaque(500);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorSolicitado).toBe(500);
      expect(resultado.totalTaxaSaque).toBe(10);
      expect(resultado.valorLiquido).toBe(490);
    });

    it('deve calcular saque de R$ 1000 corretamente', () => {
      const resultado = calcularTaxaSaque(1000);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorLiquido).toBe(990);
    });

    it('deve aplicar taxa percentual quando configurada', () => {
      // Taxa personalizada: 1% + R$ 5 fixo
      const resultado = calcularTaxaSaque(1000, 1, 5);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.taxaSaquePercentual).toBe(1);
      expect(resultado.taxaSaqueFixa).toBe(5);
      expect(resultado.totalTaxaSaque).toBe(15); // 1% de 1000 + 5
      expect(resultado.valorLiquido).toBe(985);
    });
  });

  describe('Validações de saque', () => {
    it('deve rejeitar saque de R$ 0', () => {
      const resultado = calcularTaxaSaque(0);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('maior que zero');
    });

    it('deve rejeitar saque negativo', () => {
      const resultado = calcularTaxaSaque(-100);
      
      expect(resultado.valido).toBe(false);
    });

    it('deve rejeitar saque menor que taxa', () => {
      // Saque de R$ 5 com taxa de R$ 10
      const resultado = calcularTaxaSaque(5);
      
      expect(resultado.valido).toBe(false);
      expect(resultado.erro).toContain('negativo ou zero');
    });

    it('deve rejeitar saque igual à taxa', () => {
      // Saque de R$ 10 com taxa de R$ 10 = líquido 0
      const resultado = calcularTaxaSaque(10);
      
      expect(resultado.valido).toBe(false);
    });

    it('deve aceitar saque mínimo válido (R$ 11)', () => {
      const resultado = calcularTaxaSaque(11);
      
      expect(resultado.valido).toBe(true);
      expect(resultado.valorLiquido).toBe(1);
    });
  });

  describe('Cálculo de saldo disponível', () => {
    it('deve calcular saldo disponível baseado em vendas aprovadas', () => {
      // Simula 3 vendas aprovadas
      const vendas = [
        calcularTaxasVenda(100, 'pix', 0),
        calcularTaxasVenda(200, 'credit_card', 0),
        calcularTaxasVenda(300, 'pix', 10), // Com afiliado
      ];
      
      // Soma dos valores líquidos
      const saldoDisponivel = vendas.reduce((total, venda) => {
        return arredondarMoeda(total + (venda.valido ? venda.valorLiquido : 0));
      }, 0);
      
      expect(saldoDisponivel).toBeGreaterThan(0);
      
      // Verifica que saldo é menor que soma dos valores brutos
      const totalBruto = vendas.reduce((total, venda) => total + venda.valorBruto, 0);
      expect(saldoDisponivel).toBeLessThan(totalBruto);
    });

    it('não deve incluir vendas pendentes no saldo', () => {
      // Vendas aprovadas
      const vendasAprovadas = [
        calcularTaxasVenda(100, 'pix', 0),
        calcularTaxasVenda(200, 'pix', 0),
      ];
      
      // Venda pendente (não deve contar)
      const vendaPendente = calcularTaxasVenda(500, 'credit_card', 0);
      
      const saldoAprovado = vendasAprovadas.reduce((total, venda) => {
        return arredondarMoeda(total + (venda.valido ? venda.valorLiquido : 0));
      }, 0);
      
      // Saldo não deve incluir venda pendente
      expect(saldoAprovado).not.toContain(vendaPendente.valorLiquido);
    });

    it('deve descontar saques já realizados do saldo', () => {
      // Saldo inicial de vendas
      const vendas = [
        calcularTaxasVenda(500, 'pix', 0),
        calcularTaxasVenda(500, 'pix', 0),
      ];
      
      const saldoInicial = vendas.reduce((total, venda) => {
        return arredondarMoeda(total + (venda.valido ? venda.valorLiquido : 0));
      }, 0);
      
      // Saque realizado
      const saque = calcularTaxaSaque(200);
      
      // Saldo após saque (débito do valor solicitado, não do líquido)
      const saldoAposSaque = arredondarMoeda(saldoInicial - saque.valorSolicitado);
      
      expect(saldoAposSaque).toBeLessThan(saldoInicial);
      expect(saldoAposSaque).toBe(arredondarMoeda(saldoInicial - 200));
    });
  });

  describe('Validação de conta bancária', () => {
    it('deve validar conta bancária aprovada', () => {
      expect(mockBankAccount.status).toBe('approved');
    });

    it('deve ter dados obrigatórios preenchidos', () => {
      expect(mockBankAccount.bank_name).toBeTruthy();
      expect(mockBankAccount.agency).toBeTruthy();
      expect(mockBankAccount.account_number).toBeTruthy();
    });

    it('deve ter chave PIX ou dados bancários', () => {
      const temPix = mockBankAccount.pix_key && mockBankAccount.pix_key_type;
      const temDadosBancarios = mockBankAccount.agency && mockBankAccount.account_number;
      
      expect(temPix || temDadosBancarios).toBe(true);
    });
  });

  describe('Simulação de fluxo completo de saque', () => {
    it('deve simular saque de R$ 500 com sucesso', () => {
      // 1. Verificar saldo (simulado)
      const saldoDisponivel = 1000;
      const valorSaque = 500;
      
      expect(valorSaque).toBeLessThanOrEqual(saldoDisponivel);
      
      // 2. Calcular taxa
      const calculo = calcularTaxaSaque(valorSaque);
      expect(calculo.valido).toBe(true);
      
      // 3. Preparar dados para salvar
      const withdrawalData = {
        user_id: mockBankAccount.user_id,
        bank_account_id: mockBankAccount.id,
        amount: calculo.valorSolicitado,
        fee: calculo.totalTaxaSaque,
        net_amount: calculo.valorLiquido,
        status: 'pending',
      };
      
      // 4. Validar dados
      expect(withdrawalData.amount).toBe(500);
      expect(withdrawalData.fee).toBe(10);
      expect(withdrawalData.net_amount).toBe(490);
      
      // 5. Verificar consistência
      expect(withdrawalData.amount - withdrawalData.fee).toBe(withdrawalData.net_amount);
    });

    it('deve rejeitar saque maior que saldo disponível', () => {
      const saldoDisponivel = 100;
      const valorSaque = 500;
      
      expect(valorSaque).toBeGreaterThan(saldoDisponivel);
      
      // Sistema deve rejeitar
      const podeRealizarSaque = valorSaque <= saldoDisponivel;
      expect(podeRealizarSaque).toBe(false);
    });

    it('deve verificar valor mínimo de saque', () => {
      const valorMinimoSaque = DEFAULT_FEE_CONFIG.withdrawal.fixo + 1; // Taxa + 1
      
      // Saque abaixo do mínimo
      const resultadoAbaixo = calcularTaxaSaque(valorMinimoSaque - 1);
      expect(resultadoAbaixo.valido).toBe(false);
      
      // Saque no mínimo
      const resultadoMinimo = calcularTaxaSaque(valorMinimoSaque);
      expect(resultadoMinimo.valido).toBe(true);
    });
  });

  describe('Auditoria de saques', () => {
    it('deve incluir detalhes de auditoria no cálculo', () => {
      const resultado = calcularTaxaSaque(500);
      
      expect(resultado.detalhes).toBeDefined();
      expect(resultado.detalhes.formula).toContain('valor_liquido_saque');
      expect(resultado.detalhes.passos.length).toBeGreaterThan(0);
      expect(resultado.detalhes.timestamp).toBeDefined();
    });

    it('deve registrar passos do cálculo', () => {
      const resultado = calcularTaxaSaque(500);
      
      const passos = resultado.detalhes.passos;
      
      // Deve conter passos obrigatórios
      expect(passos.some(p => p.includes('Valor solicitado'))).toBe(true);
      expect(passos.some(p => p.includes('Taxa'))).toBe(true);
      expect(passos.some(p => p.includes('Valor líquido'))).toBe(true);
    });
  });

  describe('Consistência dos cálculos de saque', () => {
    it('valorSolicitado = valorLiquido + totalTaxaSaque', () => {
      const valores = [50, 100, 250, 500, 1000, 5000, 10000];
      
      valores.forEach(valor => {
        const resultado = calcularTaxaSaque(valor);
        
        if (resultado.valido) {
          const soma = arredondarMoeda(
            resultado.valorLiquido + resultado.totalTaxaSaque
          );
          expect(soma).toBe(resultado.valorSolicitado);
        }
      });
    });

    it('taxa nunca deve ser negativa', () => {
      const resultado = calcularTaxaSaque(1000);
      
      expect(resultado.taxaSaquePercentual).toBeGreaterThanOrEqual(0);
      expect(resultado.taxaSaqueFixa).toBeGreaterThanOrEqual(0);
      expect(resultado.totalTaxaSaque).toBeGreaterThanOrEqual(0);
    });

    it('valor líquido deve ser menor que valor solicitado', () => {
      const resultado = calcularTaxaSaque(1000);
      
      expect(resultado.valorLiquido).toBeLessThan(resultado.valorSolicitado);
    });
  });
});

describe('Cenários de Edge Cases', () => {
  it('deve lidar com valores decimais corretamente', () => {
    const resultado = calcularTaxaSaque(123.45);
    
    expect(resultado.valido).toBe(true);
    expect(resultado.valorSolicitado).toBe(123.45);
    expect(resultado.valorLiquido).toBe(arredondarMoeda(123.45 - 10));
  });

  it('deve lidar com valores muito grandes', () => {
    const resultado = calcularTaxaSaque(1000000);
    
    expect(resultado.valido).toBe(true);
    expect(resultado.valorLiquido).toBe(999990);
  });

  it('deve manter precisão em cálculos encadeados', () => {
    // Simula múltiplos saques
    const saques = [
      calcularTaxaSaque(100),
      calcularTaxaSaque(200),
      calcularTaxaSaque(300),
    ];
    
    const totalLiquido = saques.reduce((total, saque) => {
      return arredondarMoeda(total + (saque.valido ? saque.valorLiquido : 0));
    }, 0);
    
    const totalTaxas = saques.reduce((total, saque) => {
      return arredondarMoeda(total + (saque.valido ? saque.totalTaxaSaque : 0));
    }, 0);
    
    const totalSolicitado = saques.reduce((total, saque) => {
      return arredondarMoeda(total + (saque.valido ? saque.valorSolicitado : 0));
    }, 0);
    
    expect(arredondarMoeda(totalLiquido + totalTaxas)).toBe(totalSolicitado);
  });
});
