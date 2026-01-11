/**
 * Sistema Centralizado de Cálculo de Taxas por Tipo de Operação
 * ==============================================================
 * 
 * Este módulo padroniza todos os cálculos de taxas do sistema.
 * NUNCA modifique as fórmulas sem atualizar este arquivo.
 * 
 * TIPOS DE OPERAÇÃO:
 * 1. VENDA - Taxas descontadas antes de creditar ao vendedor
 * 2. SAQUE - Taxa fixa descontada do valor solicitado
 * 3. ASSINATURA - Taxas recorrentes a cada ciclo de cobrança
 * 
 * REGRA IMPORTANTE:
 * - Cada tipo de operação tem seu próprio cálculo
 * - NUNCA misturar regras entre tipos
 * - NUNCA aplicar a mesma taxa duas vezes
 */

// =====================================
// ENUMS E TIPOS
// =====================================

export type OperationType = 'sale' | 'withdrawal' | 'subscription';

export type PaymentMethod = 'pix' | 'credit_card' | 'boleto' | 'debit_card' | 'balance';

// =====================================
// CONFIGURAÇÃO DE TAXAS
// =====================================

export interface FeeConfig {
  // Taxas de pagamento por método (para VENDAS)
  payment: {
    pix: { percentual: number; fixo: number };
    credit_card: { percentual: number; fixo: number };
    boleto: { percentual: number; fixo: number };
    debit_card: { percentual: number; fixo: number };
    balance: { percentual: number; fixo: number }; // Saldo da plataforma
  };
  // Taxa da plataforma adicional (se separada)
  platform: {
    percentual: number;
    fixo: number;
  };
  // Taxa de saque (para SAQUES)
  withdrawal: {
    percentual: number;
    fixo: number;
  };
  // Taxa de assinatura (para ASSINATURAS)
  subscription: {
    percentual: number;
    fixo: number;
  };
}

/**
 * TAXAS ROYALPAY (CONFIGURÁVEIS VIA ADMIN)
 * ==========================================
 * 
 * As taxas abaixo são valores PADRÃO. As taxas reais são carregadas
 * do banco de dados (tabela system_settings) via hook useGatewayFees.
 * 
 * Para alterar as taxas, acesse: Admin > Configurações > Taxas
 * 
 * TAXAS DO GATEWAY (padrão, por método de pagamento):
 * - PIX: 4.99% + R$ 1.49 fixo
 * - Boleto: 5.99% + R$ 1.49 fixo
 * - Cartão de crédito: 6.99% (2,7,15 dias) ou 4.99% (30 dias) + R$ 1.49 fixo
 * - Débito: 5.99% + R$ 1.49 fixo
 * 
 * TAXA DA ADQUIRENTE (padrão):
 * - R$ 0.60 por transação aprovada
 * 
 * ORDEM DE CÁLCULO (NUNCA ALTERAR):
 * 1. Valor pago pelo cliente
 * 2. Descontar taxa percentual do gateway
 * 3. Descontar taxa fixa do gateway
 * 4. Resultado = Valor após taxas do gateway
 * 5. Descontar taxa da adquirente
 * 6. Resultado final = Lucro Líquido
 */

// Taxa padrão da adquirente por transação aprovada (configurável via admin)
export const ACQUIRER_FEE_PER_TRANSACTION = 0.60;

// Configuração padrão das taxas
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  payment: {
    pix: { percentual: 4.99, fixo: 1.49 },
    credit_card: { percentual: 6.99, fixo: 1.49 }, // Padrão 6.99% (2,7,15 dias)
    boleto: { percentual: 5.99, fixo: 1.49 },
    debit_card: { percentual: 5.99, fixo: 1.49 },
    balance: { percentual: 0, fixo: 0 }, // Sem taxa para saldo
  },
  platform: {
    percentual: 0, // Já incluído na taxa de pagamento
    fixo: 0,
  },
  withdrawal: {
    percentual: 0,
    fixo: 10.00, // Taxa fixa de saque
  },
  subscription: {
    percentual: 4.99, // Taxa recorrente
    fixo: 0,
  },
};

// Taxa especial de cartão para 30 dias
export const CREDIT_CARD_30_DAYS_RATE = 4.99;

// =====================================
// RESULTADO DO CÁLCULO DE VENDA
// =====================================

export interface SaleFeeResult {
  // Tipo da operação
  operationType: 'sale';
  
  // Valores
  valorBruto: number;
  taxaPagamento: number;
  taxaPagamentoPercentual: number;
  taxaPagamentoFixa: number;
  taxaPlataforma: number;
  taxaPlataformaPercentual: number;
  comissaoAfiliado: number;
  comissaoAfiliadoPercentual: number;
  totalTaxas: number;
  valorLiquido: number;
  
  // Metadados
  metodoPagamento: PaymentMethod;
  temAfiliado: boolean;
  valido: boolean;
  erro?: string;
  
  // Auditoria
  detalhes: {
    formula: string;
    passos: string[];
    timestamp: string;
  };
}

// =====================================
// RESULTADO DO CÁLCULO DE SAQUE
// =====================================

export interface WithdrawalFeeResult {
  // Tipo da operação
  operationType: 'withdrawal';
  
  // Valores
  valorSolicitado: number;
  taxaSaquePercentual: number;
  taxaSaqueFixa: number;
  totalTaxaSaque: number;
  valorLiquido: number;
  
  // Metadados
  valido: boolean;
  erro?: string;
  
  // Auditoria
  detalhes: {
    formula: string;
    passos: string[];
    timestamp: string;
  };
}

// =====================================
// RESULTADO DO CÁLCULO DE ASSINATURA
// =====================================

export interface SubscriptionFeeResult {
  // Tipo da operação
  operationType: 'subscription';
  
  // Valores
  valorPlano: number;
  taxaRecorrente: number;
  taxaRecorrentePercentual: number;
  taxaRecorrenteFixa: number;
  taxaPlataforma: number;
  totalTaxas: number;
  valorLiquido: number;
  
  // Metadados
  ciclo: 'monthly' | 'yearly';
  metodoPagamento: PaymentMethod;
  valido: boolean;
  erro?: string;
  
  // Auditoria
  detalhes: {
    formula: string;
    passos: string[];
    timestamp: string;
  };
}

// Tipo legado para compatibilidade
export interface FeeCalculationResult extends SaleFeeResult {}

// =====================================
// FUNÇÕES UTILITÁRIAS
// =====================================

/**
 * Arredonda valor monetário para 2 casas decimais
 */
export function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Calcula taxa percentual sobre um valor base
 */
export function calcularTaxaPercentual(valorBase: number, percentual: number): number {
  return arredondarMoeda((valorBase * percentual) / 100);
}

/**
 * Obtém configuração de taxa para método de pagamento
 */
export function obterTaxaPagamento(
  metodo: PaymentMethod, 
  config: FeeConfig = DEFAULT_FEE_CONFIG
): { percentual: number; fixo: number } {
  return config.payment[metodo] || config.payment.pix;
}

/**
 * Gera timestamp ISO para auditoria
 */
function gerarTimestamp(): string {
  return new Date().toISOString();
}

// =====================================
// 1. CÁLCULO DE TAXAS PARA VENDA
// =====================================

/**
 * Calcula todas as taxas de uma VENDA
 * 
 * FÓRMULA:
 * valor_liquido = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado
 * 
 * ORDEM DE CÁLCULO:
 * 1. Valor bruto da transação
 * 2. Taxa percentual + fixa do meio de pagamento
 * 3. Taxa da plataforma (se separada)
 * 4. Comissão do afiliado (se houver)
 * 5. Total de taxas
 * 6. Valor líquido final
 * 
 * @param valorBruto - Valor total da venda (pago pelo cliente)
 * @param metodoPagamento - Método de pagamento utilizado
 * @param comissaoAfiliadoPercent - Percentual de comissão do afiliado (0 se não houver)
 * @param config - Configuração de taxas (opcional)
 */
export function calcularTaxasVenda(
  valorBruto: number,
  metodoPagamento: PaymentMethod,
  comissaoAfiliadoPercent: number = 0,
  config: FeeConfig = DEFAULT_FEE_CONFIG
): SaleFeeResult {
  const passos: string[] = [];
  const timestamp = gerarTimestamp();
  
  // Validação inicial
  if (valorBruto <= 0) {
    return {
      operationType: 'sale',
      valorBruto: 0,
      taxaPagamento: 0,
      taxaPagamentoPercentual: 0,
      taxaPagamentoFixa: 0,
      taxaPlataforma: 0,
      taxaPlataformaPercentual: 0,
      comissaoAfiliado: 0,
      comissaoAfiliadoPercentual: 0,
      totalTaxas: 0,
      valorLiquido: 0,
      metodoPagamento,
      temAfiliado: false,
      valido: false,
      erro: 'Valor bruto deve ser maior que zero',
      detalhes: { formula: '', passos: [], timestamp },
    };
  }

  passos.push(`[VENDA] 1. Valor bruto: R$ ${valorBruto.toFixed(2)}`);

  // Passo 1: Calcular taxa de pagamento
  const taxaConfig = obterTaxaPagamento(metodoPagamento, config);
  const taxaPagamentoPercentualValor = calcularTaxaPercentual(valorBruto, taxaConfig.percentual);
  const taxaPagamentoFixa = arredondarMoeda(taxaConfig.fixo);
  const taxaPagamento = arredondarMoeda(taxaPagamentoPercentualValor + taxaPagamentoFixa);
  
  passos.push(`[VENDA] 2. Taxa pagamento (${metodoPagamento}): ${taxaConfig.percentual}% de R$ ${valorBruto.toFixed(2)} = R$ ${taxaPagamentoPercentualValor.toFixed(2)} + R$ ${taxaPagamentoFixa.toFixed(2)} fixo = R$ ${taxaPagamento.toFixed(2)}`);

  // Passo 2: Calcular taxa da plataforma
  const taxaPlataformaPercentualValor = calcularTaxaPercentual(valorBruto, config.platform.percentual);
  const taxaPlataforma = arredondarMoeda(taxaPlataformaPercentualValor + config.platform.fixo);
  
  if (taxaPlataforma > 0) {
    passos.push(`[VENDA] 3. Taxa plataforma: ${config.platform.percentual}% de R$ ${valorBruto.toFixed(2)} = R$ ${taxaPlataforma.toFixed(2)}`);
  } else {
    passos.push(`[VENDA] 3. Taxa plataforma: R$ 0.00 (incluída na taxa de pagamento)`);
  }

  // Passo 3: Calcular comissão de afiliado
  const temAfiliado = comissaoAfiliadoPercent > 0;
  const comissaoAfiliado = temAfiliado 
    ? calcularTaxaPercentual(valorBruto, comissaoAfiliadoPercent)
    : 0;
  
  if (temAfiliado) {
    passos.push(`[VENDA] 4. Comissão afiliado: ${comissaoAfiliadoPercent}% de R$ ${valorBruto.toFixed(2)} = R$ ${comissaoAfiliado.toFixed(2)}`);
  } else {
    passos.push(`[VENDA] 4. Comissão afiliado: R$ 0.00 (sem afiliado)`);
  }

  // Passo 4: Calcular total de taxas
  const totalTaxas = arredondarMoeda(taxaPagamento + taxaPlataforma + comissaoAfiliado);
  passos.push(`[VENDA] 5. Total taxas: R$ ${taxaPagamento.toFixed(2)} + R$ ${taxaPlataforma.toFixed(2)} + R$ ${comissaoAfiliado.toFixed(2)} = R$ ${totalTaxas.toFixed(2)}`);

  // Passo 5: Calcular valor líquido
  const valorLiquido = arredondarMoeda(valorBruto - totalTaxas);
  passos.push(`[VENDA] 6. Valor líquido: R$ ${valorBruto.toFixed(2)} - R$ ${totalTaxas.toFixed(2)} = R$ ${valorLiquido.toFixed(2)}`);

  // Validação: valor líquido não pode ser negativo
  if (valorLiquido < 0) {
    return {
      operationType: 'sale',
      valorBruto: arredondarMoeda(valorBruto),
      taxaPagamento,
      taxaPagamentoPercentual: taxaConfig.percentual,
      taxaPagamentoFixa,
      taxaPlataforma,
      taxaPlataformaPercentual: config.platform.percentual,
      comissaoAfiliado,
      comissaoAfiliadoPercentual: comissaoAfiliadoPercent,
      totalTaxas,
      valorLiquido,
      metodoPagamento,
      temAfiliado,
      valido: false,
      erro: `Valor líquido negativo: R$ ${valorLiquido.toFixed(2)}. Total de taxas (R$ ${totalTaxas.toFixed(2)}) excede valor bruto.`,
      detalhes: {
        formula: 'valor_liquido_venda = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado',
        passos,
        timestamp,
      },
    };
  }

  // Validação: taxas não podem exceder valor bruto
  if (totalTaxas > valorBruto) {
    return {
      operationType: 'sale',
      valorBruto: arredondarMoeda(valorBruto),
      taxaPagamento,
      taxaPagamentoPercentual: taxaConfig.percentual,
      taxaPagamentoFixa,
      taxaPlataforma,
      taxaPlataformaPercentual: config.platform.percentual,
      comissaoAfiliado,
      comissaoAfiliadoPercentual: comissaoAfiliadoPercent,
      totalTaxas,
      valorLiquido,
      metodoPagamento,
      temAfiliado,
      valido: false,
      erro: `Total de taxas (R$ ${totalTaxas.toFixed(2)}) maior que valor bruto (R$ ${valorBruto.toFixed(2)})`,
      detalhes: {
        formula: 'valor_liquido_venda = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado',
        passos,
        timestamp,
      },
    };
  }

  return {
    operationType: 'sale',
    valorBruto: arredondarMoeda(valorBruto),
    taxaPagamento,
    taxaPagamentoPercentual: taxaConfig.percentual,
    taxaPagamentoFixa,
    taxaPlataforma,
    taxaPlataformaPercentual: config.platform.percentual,
    comissaoAfiliado,
    comissaoAfiliadoPercentual: comissaoAfiliadoPercent,
    totalTaxas,
    valorLiquido,
    metodoPagamento,
    temAfiliado,
    valido: true,
    detalhes: {
      formula: 'valor_liquido_venda = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado',
      passos,
      timestamp,
    },
  };
}

// =====================================
// 2. CÁLCULO DE TAXAS PARA SAQUE
// =====================================

/**
 * Calcula taxa de SAQUE
 * 
 * FÓRMULA:
 * valor_liquido_saque = valor_saque - total_taxas_saque
 * valor_debitado_saldo = valor_saque (o valor solicitado é debitado integralmente)
 * 
 * REGRAS:
 * - A taxa é descontada do valor solicitado
 * - O valor líquido é o que o usuário recebe
 * - O saldo é debitado pelo valor solicitado (não pelo líquido)
 * - Nunca permitir valor líquido negativo
 * 
 * @param valorSolicitado - Valor que o usuário quer sacar
 * @param taxaPercentual - Taxa percentual de saque (padrão: 0%)
 * @param taxaFixa - Taxa fixa de saque (padrão: R$ 10.00)
 */
export function calcularTaxaSaque(
  valorSolicitado: number,
  taxaPercentual: number = DEFAULT_FEE_CONFIG.withdrawal.percentual,
  taxaFixa: number = DEFAULT_FEE_CONFIG.withdrawal.fixo
): WithdrawalFeeResult {
  const passos: string[] = [];
  const timestamp = gerarTimestamp();
  
  if (valorSolicitado <= 0) {
    return {
      operationType: 'withdrawal',
      valorSolicitado: 0,
      taxaSaquePercentual: 0,
      taxaSaqueFixa: 0,
      totalTaxaSaque: 0,
      valorLiquido: 0,
      valido: false,
      erro: 'Valor do saque deve ser maior que zero',
      detalhes: { formula: '', passos: [], timestamp },
    };
  }

  passos.push(`[SAQUE] 1. Valor solicitado: R$ ${valorSolicitado.toFixed(2)}`);

  // Calcular taxa percentual
  const taxaPercentualValor = calcularTaxaPercentual(valorSolicitado, taxaPercentual);
  passos.push(`[SAQUE] 2. Taxa percentual: ${taxaPercentual}% de R$ ${valorSolicitado.toFixed(2)} = R$ ${taxaPercentualValor.toFixed(2)}`);
  
  // Taxa fixa
  const taxaFixaValor = arredondarMoeda(taxaFixa);
  passos.push(`[SAQUE] 3. Taxa fixa: R$ ${taxaFixaValor.toFixed(2)}`);

  // Total de taxas de saque
  const totalTaxaSaque = arredondarMoeda(taxaPercentualValor + taxaFixaValor);
  passos.push(`[SAQUE] 4. Total taxa saque: R$ ${taxaPercentualValor.toFixed(2)} + R$ ${taxaFixaValor.toFixed(2)} = R$ ${totalTaxaSaque.toFixed(2)}`);

  // Valor líquido
  const valorLiquido = arredondarMoeda(valorSolicitado - totalTaxaSaque);
  passos.push(`[SAQUE] 5. Valor líquido (recebido): R$ ${valorSolicitado.toFixed(2)} - R$ ${totalTaxaSaque.toFixed(2)} = R$ ${valorLiquido.toFixed(2)}`);

  // Validação: valor líquido não pode ser negativo ou zero
  if (valorLiquido <= 0) {
    return {
      operationType: 'withdrawal',
      valorSolicitado: arredondarMoeda(valorSolicitado),
      taxaSaquePercentual: taxaPercentual,
      taxaSaqueFixa: taxaFixaValor,
      totalTaxaSaque,
      valorLiquido,
      valido: false,
      erro: `Valor líquido negativo ou zero. Taxa de saque (R$ ${totalTaxaSaque.toFixed(2)}) maior ou igual ao valor solicitado.`,
      detalhes: {
        formula: 'valor_liquido_saque = valor_saque - taxa_saque_percentual - taxa_saque_fixa',
        passos,
        timestamp,
      },
    };
  }

  return {
    operationType: 'withdrawal',
    valorSolicitado: arredondarMoeda(valorSolicitado),
    taxaSaquePercentual: taxaPercentual,
    taxaSaqueFixa: taxaFixaValor,
    totalTaxaSaque,
    valorLiquido,
    valido: true,
    detalhes: {
      formula: 'valor_liquido_saque = valor_saque - taxa_saque_percentual - taxa_saque_fixa',
      passos,
      timestamp,
    },
  };
}

// =====================================
// 3. CÁLCULO DE TAXAS PARA ASSINATURA
// =====================================

/**
 * Calcula taxas de ASSINATURA (recorrente)
 * 
 * FÓRMULA:
 * valor_liquido_assinatura = valor_plano - taxa_recorrente - taxa_plataforma
 * 
 * REGRAS:
 * - O cálculo é feito a cada ciclo de cobrança
 * - As taxas são recalculadas a cada renovação
 * - Registrar histórico de cada cobrança
 * 
 * @param valorPlano - Valor do plano de assinatura
 * @param metodoPagamento - Método de pagamento (afeta taxa da adquirente)
 * @param ciclo - Ciclo de cobrança (mensal ou anual)
 * @param config - Configuração de taxas (opcional)
 */
export function calcularTaxasAssinatura(
  valorPlano: number,
  metodoPagamento: PaymentMethod,
  ciclo: 'monthly' | 'yearly' = 'monthly',
  config: FeeConfig = DEFAULT_FEE_CONFIG
): SubscriptionFeeResult {
  const passos: string[] = [];
  const timestamp = gerarTimestamp();
  
  if (valorPlano <= 0) {
    return {
      operationType: 'subscription',
      valorPlano: 0,
      taxaRecorrente: 0,
      taxaRecorrentePercentual: 0,
      taxaRecorrenteFixa: 0,
      taxaPlataforma: 0,
      totalTaxas: 0,
      valorLiquido: 0,
      ciclo,
      metodoPagamento,
      valido: false,
      erro: 'Valor do plano deve ser maior que zero',
      detalhes: { formula: '', passos: [], timestamp },
    };
  }

  passos.push(`[ASSINATURA] 1. Valor do plano (${ciclo}): R$ ${valorPlano.toFixed(2)}`);

  // Taxa da adquirente (baseada no método de pagamento)
  const taxaPagamentoConfig = obterTaxaPagamento(metodoPagamento, config);
  const taxaRecorrentePercentualValor = calcularTaxaPercentual(valorPlano, taxaPagamentoConfig.percentual);
  const taxaRecorrenteFixa = arredondarMoeda(taxaPagamentoConfig.fixo);
  const taxaRecorrente = arredondarMoeda(taxaRecorrentePercentualValor + taxaRecorrenteFixa);
  
  passos.push(`[ASSINATURA] 2. Taxa recorrente (${metodoPagamento}): ${taxaPagamentoConfig.percentual}% de R$ ${valorPlano.toFixed(2)} = R$ ${taxaRecorrentePercentualValor.toFixed(2)} + R$ ${taxaRecorrenteFixa.toFixed(2)} fixo = R$ ${taxaRecorrente.toFixed(2)}`);

  // Taxa da plataforma para assinaturas
  const taxaPlataformaValor = calcularTaxaPercentual(valorPlano, config.subscription.percentual);
  const taxaPlataforma = arredondarMoeda(taxaPlataformaValor + config.subscription.fixo);
  
  if (taxaPlataforma > 0) {
    passos.push(`[ASSINATURA] 3. Taxa plataforma: ${config.subscription.percentual}% de R$ ${valorPlano.toFixed(2)} = R$ ${taxaPlataforma.toFixed(2)}`);
  } else {
    passos.push(`[ASSINATURA] 3. Taxa plataforma: R$ 0.00 (incluída na taxa recorrente)`);
  }

  // Total de taxas
  const totalTaxas = arredondarMoeda(taxaRecorrente + taxaPlataforma);
  passos.push(`[ASSINATURA] 4. Total taxas: R$ ${taxaRecorrente.toFixed(2)} + R$ ${taxaPlataforma.toFixed(2)} = R$ ${totalTaxas.toFixed(2)}`);

  // Valor líquido
  const valorLiquido = arredondarMoeda(valorPlano - totalTaxas);
  passos.push(`[ASSINATURA] 5. Valor líquido: R$ ${valorPlano.toFixed(2)} - R$ ${totalTaxas.toFixed(2)} = R$ ${valorLiquido.toFixed(2)}`);

  // Validação
  if (valorLiquido < 0) {
    return {
      operationType: 'subscription',
      valorPlano: arredondarMoeda(valorPlano),
      taxaRecorrente,
      taxaRecorrentePercentual: taxaPagamentoConfig.percentual,
      taxaRecorrenteFixa,
      taxaPlataforma,
      totalTaxas,
      valorLiquido,
      ciclo,
      metodoPagamento,
      valido: false,
      erro: `Valor líquido negativo: R$ ${valorLiquido.toFixed(2)}. Total de taxas excede valor do plano.`,
      detalhes: {
        formula: 'valor_liquido_assinatura = valor_plano - taxa_recorrente - taxa_plataforma',
        passos,
        timestamp,
      },
    };
  }

  return {
    operationType: 'subscription',
    valorPlano: arredondarMoeda(valorPlano),
    taxaRecorrente,
    taxaRecorrentePercentual: taxaPagamentoConfig.percentual,
    taxaRecorrenteFixa,
    taxaPlataforma,
    totalTaxas,
    valorLiquido,
    ciclo,
    metodoPagamento,
    valido: true,
    detalhes: {
      formula: 'valor_liquido_assinatura = valor_plano - taxa_recorrente - taxa_plataforma',
      passos,
      timestamp,
    },
  };
}

// =====================================
// FUNÇÕES DE SALDO
// =====================================

/**
 * Calcula saldo disponível para saque
 * 
 * IMPORTANTE: Usar apenas net_amount das vendas (já com todas as taxas descontadas)
 * 
 * @param totalLiquidoVendas - Soma de net_amount de todas as vendas aprovadas
 * @param saquesCompletados - Total de saques já completados
 * @param saquesPendentes - Total de saques pendentes (reservados)
 */
export function calcularSaldoDisponivel(
  totalLiquidoVendas: number,
  saquesCompletados: number,
  saquesPendentes: number
): number {
  const saldo = arredondarMoeda(totalLiquidoVendas - saquesCompletados - saquesPendentes);
  return Math.max(saldo, 0); // Nunca retornar saldo negativo
}

// =====================================
// FUNÇÕES DE FORMATAÇÃO
// =====================================

/**
 * Formata valor como moeda brasileira
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Retorna descrição legível da taxa
 */
export function descreverTaxa(tipo: string, percentual: number, fixo: number): string {
  if (percentual > 0 && fixo > 0) {
    return `${percentual}% + R$ ${fixo.toFixed(2)}`;
  }
  if (percentual > 0) {
    return `${percentual}%`;
  }
  if (fixo > 0) {
    return `R$ ${fixo.toFixed(2)}`;
  }
  return 'Isento';
}

// =====================================
// LOGS DE AUDITORIA
// =====================================

/**
 * Gera log de auditoria para operação de taxa
 */
export function gerarLogAuditoria(
  resultado: SaleFeeResult | WithdrawalFeeResult | SubscriptionFeeResult
): string {
  const linhas = [
    `=== AUDITORIA DE TAXAS - ${resultado.operationType.toUpperCase()} ===`,
    `Timestamp: ${resultado.detalhes.timestamp}`,
    `Fórmula: ${resultado.detalhes.formula}`,
    `Válido: ${resultado.valido ? 'SIM' : 'NÃO'}`,
    resultado.erro ? `Erro: ${resultado.erro}` : null,
    '',
    'Passos do cálculo:',
    ...resultado.detalhes.passos,
    '================================================',
  ].filter(Boolean);
  
  return linhas.join('\n');
}
