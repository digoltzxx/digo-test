import { supabase } from "@/integrations/supabase/client";
import Decimal from "decimal.js";

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface PlatformFee {
  id: string;
  fee_type: string;
  value: number;
  value_type: string;
  min_value: number | null;
  is_active: boolean;
  description: string;
}

export interface TaxaConfigurada {
  id: string;
  codigo: string;
  nome: string;
  tipo_transacao: string;
  tipo_valor: string;
  valor: number;
  valor_fixo: number;
  categoria_taxa: string;
  ativa: boolean;
}

export interface TaxaAplicada {
  id: string;
  transacao_id: string;
  taxa_configurada_id: string;
  nome_taxa: string;
  codigo_taxa: string;
  categoria_taxa: string;
  tipo_taxa: string;
  valor_base: number;
  percentual_aplicado: number;
  valor_taxa: number;
  valor_liquido_apos: number;
}

export interface TransacaoAuditada {
  id: string;
  transaction_id: string;
  valor_bruto: number;
  status: string;
  payment_method: string;
  created_at: string;
  // Taxas calculadas corretamente
  taxa_plataforma_calculada: number;
  taxa_plataforma_percentual: number;
  taxa_adquirente_calculada: number;
  comissao_afiliado_calculada: number;
  comissao_afiliado_percentual: number;
  // Taxas salvas no banco
  taxa_plataforma_banco: number;
  taxa_adquirente_banco: number;
  comissao_afiliado_banco: number;
  valor_liquido_banco: number;
  // Valores corretos
  valor_liquido_correto: number;
  // Status da auditoria
  auditoria_status: 'correto' | 'corrigido' | 'divergente';
  divergencias: string[];
  // Dados do produto
  produto_nome?: string;
  comprador_nome?: string;
}

export interface ResultadoAuditoria {
  usuario_id: string;
  data_auditoria: string;
  total_transacoes: number;
  transacoes_corretas: number;
  transacoes_corrigidas: number;
  transacoes_divergentes: number;
  transacoes: TransacaoAuditada[];
  resumo: {
    total_bruto: number;
    total_taxas_plataforma: number;
    total_taxas_adquirente: number;
    total_comissoes_afiliado: number;
    total_liquido_correto: number;
    total_divergencia: number;
  };
}

// ============================================
// FUNÇÕES DE AUDITORIA
// ============================================

/**
 * Carrega todas as taxas da plataforma do banco (platform_fees)
 */
export async function carregarPlatformFees(): Promise<PlatformFee[]> {
  const { data, error } = await supabase
    .from('platform_fees')
    .select('*')
    .eq('is_active', true);
  
  if (error) {
    console.error('Erro ao carregar platform_fees:', error);
    return [];
  }
  
  return (data || []).map(f => ({
    ...f,
    value: Number(f.value),
    min_value: f.min_value ? Number(f.min_value) : null
  }));
}

/**
 * Obtém a taxa para um tipo específico
 */
function obterPlatformFee(fees: PlatformFee[], feeType: string): PlatformFee | undefined {
  return fees.find(f => f.fee_type === feeType);
}

/**
 * Mapeia método de pagamento para tipo de taxa
 */
function mapPaymentMethodToFeeType(paymentMethod: string): string {
  switch (paymentMethod?.toLowerCase()) {
    case 'pix':
      return 'pix';
    case 'credit_card':
    case 'creditcard':
    case 'card':
      return 'credit_card_30d'; // Padrão 30 dias
    case 'boleto':
    case 'bank_slip':
      return 'boleto';
    default:
      return 'transaction'; // Taxa padrão
  }
}

/**
 * Calcula todas as taxas para uma transação usando platform_fees
 * Estrutura: Taxa Plataforma = percentual + fixo (min_value)
 *            Taxa Adquirente = R$ 0.60 fixo (acquirer)
 */
function calcularTaxasTransacao(
  valorBruto: number,
  comissaoAfiliado: number,
  fees: PlatformFee[],
  paymentMethod: string = 'pix'
): {
  taxaPlataforma: number;
  taxaPlataformaPercentual: number;
  taxaPlataformaFixa: number;
  taxaAdquirente: number;
  valorLiquido: number;
} {
  const valor = new Decimal(valorBruto);
  
  // Determinar qual taxa de pagamento usar baseado no método
  const feeType = mapPaymentMethodToFeeType(paymentMethod);
  const paymentFee = obterPlatformFee(fees, feeType);
  
  // Fallback para taxa de transação genérica
  const transactionFee = obterPlatformFee(fees, 'transaction');
  
  // Taxa de plataforma (percentual + valor fixo)
  let taxaPlataformaPercentual: Decimal;
  let taxaPlataformaFixa: Decimal;
  
  if (paymentFee) {
    taxaPlataformaPercentual = new Decimal(paymentFee.value);
    taxaPlataformaFixa = new Decimal(paymentFee.min_value || 0);
  } else if (transactionFee) {
    taxaPlataformaPercentual = new Decimal(transactionFee.value);
    taxaPlataformaFixa = new Decimal(0);
  } else {
    // Valores padrão: 4.99% + R$ 1.49
    taxaPlataformaPercentual = new Decimal(4.99);
    taxaPlataformaFixa = new Decimal(1.49);
  }
  
  // Calcular taxa de plataforma: (valor * percentual / 100) + fixo
  const taxaPlataformaPercent = valor.mul(taxaPlataformaPercentual).div(100);
  const taxaPlataforma = taxaPlataformaPercent.plus(taxaPlataformaFixa);
  
  // Taxa do adquirente - R$ 0.60 fixo
  const acquirerFee = obterPlatformFee(fees, 'acquirer');
  const taxaAdquirente = acquirerFee ? new Decimal(acquirerFee.value) : new Decimal(0.60);
  
  // Comissão de afiliado
  const comissao = new Decimal(comissaoAfiliado || 0);
  
  // Valor líquido = valor_bruto - taxa_plataforma - taxa_adquirente - comissao_afiliado
  const valorLiquido = valor
    .minus(taxaPlataforma)
    .minus(taxaAdquirente)
    .minus(comissao);
  
  return {
    taxaPlataforma: taxaPlataforma.toDecimalPlaces(2).toNumber(),
    taxaPlataformaPercentual: taxaPlataformaPercentual.toNumber(),
    taxaPlataformaFixa: taxaPlataformaFixa.toNumber(),
    taxaAdquirente: taxaAdquirente.toDecimalPlaces(2).toNumber(),
    valorLiquido: valorLiquido.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Audita todas as transações de um usuário usando platform_fees
 */
export async function auditarTransacoesUsuario(userId: string): Promise<ResultadoAuditoria> {
  // Carregar taxas da plataforma do banco
  const platformFees = await carregarPlatformFees();
  
  console.log('Platform fees carregadas:', platformFees);
  
  // Carregar vendas do usuário
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .eq('seller_user_id', userId)
    .order('created_at', { ascending: false });
  
  if (salesError) {
    console.error('Erro ao carregar vendas:', salesError);
    throw new Error('Falha ao carregar vendas para auditoria');
  }
  
  const sales = salesData || [];
  
  // Carregar nomes dos produtos
  const productIds = [...new Set(sales.map(s => s.product_id))];
  const { data: productsData } = await supabase
    .from('products')
    .select('id, name')
    .in('id', productIds);
  
  const productsMap = new Map((productsData || []).map(p => [p.id, p.name]));
  
  // Auditar cada transação
  const transacoesAuditadas: TransacaoAuditada[] = [];
  let totalCorretas = 0;
  let totalCorrigidas = 0;
  let totalDivergentes = 0;
  
  // Resumo financeiro
  let totalBruto = new Decimal(0);
  let totalTaxasPlataforma = new Decimal(0);
  let totalTaxasAdquirente = new Decimal(0);
  let totalComissoesAfiliado = new Decimal(0);
  let totalLiquidoCorreto = new Decimal(0);
  let totalDivergencia = new Decimal(0);
  
  for (const sale of sales) {
    const valorBruto = new Decimal(sale.amount || 0);
    const comissaoAfiliado = new Decimal(sale.commission_amount || 0);
    
    // Calcular taxas corretas baseadas no método de pagamento
    const taxasCalculadas = calcularTaxasTransacao(
      valorBruto.toNumber(),
      comissaoAfiliado.toNumber(),
      platformFees,
      sale.payment_method || 'pix'
    );
    
    // Valores salvos no banco
    const taxaPlataformaBanco = new Decimal(sale.platform_fee || 0);
    const taxaAdquirenteBanco = new Decimal(sale.payment_fee || 0);
    const valorLiquidoBanco = new Decimal(sale.net_amount || 0);
    
    // Verificar divergências
    const divergencias: string[] = [];
    
    const diffPlataforma = Math.abs(taxasCalculadas.taxaPlataforma - taxaPlataformaBanco.toNumber());
    const diffAdquirente = Math.abs(taxasCalculadas.taxaAdquirente - taxaAdquirenteBanco.toNumber());
    const diffLiquido = Math.abs(taxasCalculadas.valorLiquido - valorLiquidoBanco.toNumber());
    
    // Tolerância de R$ 0.01 para arredondamentos
    const tolerancia = 0.01;
    
    if (diffPlataforma > tolerancia) {
      divergencias.push(`Taxa plataforma: esperado R$ ${taxasCalculadas.taxaPlataforma.toFixed(2)}, encontrado R$ ${taxaPlataformaBanco.toFixed(2)}`);
    }
    if (diffAdquirente > tolerancia) {
      divergencias.push(`Taxa adquirente: esperado R$ ${taxasCalculadas.taxaAdquirente.toFixed(2)}, encontrado R$ ${taxaAdquirenteBanco.toFixed(2)}`);
    }
    if (diffLiquido > tolerancia) {
      divergencias.push(`Valor líquido: esperado R$ ${taxasCalculadas.valorLiquido.toFixed(2)}, encontrado R$ ${valorLiquidoBanco.toFixed(2)}`);
    }
    
    let auditoriaStatus: 'correto' | 'corrigido' | 'divergente' = 'correto';
    if (divergencias.length > 0) {
      // Se os valores no banco são 0 ou nulos, consideramos "corrigido" (usaremos valores calculados)
      if (taxaPlataformaBanco.isZero() && taxaAdquirenteBanco.isZero()) {
        auditoriaStatus = 'corrigido';
        totalCorrigidas++;
      } else {
        auditoriaStatus = 'divergente';
        totalDivergentes++;
      }
    } else {
      totalCorretas++;
    }
    
    const transacaoAuditada: TransacaoAuditada = {
      id: sale.id,
      transaction_id: sale.transaction_id,
      valor_bruto: valorBruto.toNumber(),
      status: sale.status,
      payment_method: sale.payment_method,
      created_at: sale.created_at,
      // Taxas calculadas
      taxa_plataforma_calculada: taxasCalculadas.taxaPlataforma,
      taxa_plataforma_percentual: taxasCalculadas.taxaPlataformaPercentual,
      taxa_adquirente_calculada: taxasCalculadas.taxaAdquirente,
      comissao_afiliado_calculada: comissaoAfiliado.toNumber(),
      comissao_afiliado_percentual: sale.affiliate_commission_percent || 0,
      // Taxas do banco
      taxa_plataforma_banco: taxaPlataformaBanco.toNumber(),
      taxa_adquirente_banco: taxaAdquirenteBanco.toNumber(),
      comissao_afiliado_banco: comissaoAfiliado.toNumber(),
      valor_liquido_banco: valorLiquidoBanco.toNumber(),
      // Valores corretos
      valor_liquido_correto: taxasCalculadas.valorLiquido,
      // Status
      auditoria_status: auditoriaStatus,
      divergencias,
      // Dados extras
      produto_nome: productsMap.get(sale.product_id) || 'Produto',
      comprador_nome: sale.buyer_name,
    };
    
    transacoesAuditadas.push(transacaoAuditada);
    
    // Somar ao resumo apenas vendas aprovadas (completed ou approved)
    if (sale.status === 'completed' || sale.status === 'approved') {
      totalBruto = totalBruto.plus(valorBruto);
      totalTaxasPlataforma = totalTaxasPlataforma.plus(taxasCalculadas.taxaPlataforma);
      totalTaxasAdquirente = totalTaxasAdquirente.plus(taxasCalculadas.taxaAdquirente);
      totalComissoesAfiliado = totalComissoesAfiliado.plus(comissaoAfiliado);
      totalLiquidoCorreto = totalLiquidoCorreto.plus(taxasCalculadas.valorLiquido);
      totalDivergencia = totalDivergencia.plus(new Decimal(diffLiquido));
    }
  }
  
  return {
    usuario_id: userId,
    data_auditoria: new Date().toISOString(),
    total_transacoes: sales.length,
    transacoes_corretas: totalCorretas,
    transacoes_corrigidas: totalCorrigidas,
    transacoes_divergentes: totalDivergentes,
    transacoes: transacoesAuditadas,
    resumo: {
      total_bruto: totalBruto.toNumber(),
      total_taxas_plataforma: totalTaxasPlataforma.toNumber(),
      total_taxas_adquirente: totalTaxasAdquirente.toNumber(),
      total_comissoes_afiliado: totalComissoesAfiliado.toNumber(),
      total_liquido_correto: totalLiquidoCorreto.toNumber(),
      total_divergencia: totalDivergencia.toNumber(),
    },
  };
}

/**
 * Corrige as taxas de uma transação no banco de dados
 */
export async function corrigirTransacao(
  transacaoId: string,
  taxaPlataforma: number,
  taxaAdquirente: number,
  valorLiquido: number,
  motivo: string = 'Correção automática via auditoria'
): Promise<boolean> {
  try {
    // Atualizar a venda com os valores corretos
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        platform_fee: taxaPlataforma,
        payment_fee: taxaAdquirente,
        net_amount: valorLiquido,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transacaoId);
    
    if (updateError) {
      console.error('Erro ao corrigir transação:', updateError);
      return false;
    }
    
    console.log(`Transação ${transacaoId} corrigida: taxa_plataforma=${taxaPlataforma}, taxa_adquirente=${taxaAdquirente}, valor_liquido=${valorLiquido}`);
    return true;
  } catch (error) {
    console.error('Erro ao corrigir transação:', error);
    return false;
  }
}

/**
 * Corrige todas as transações divergentes de um usuário
 */
export async function corrigirTodasTransacoes(userId: string): Promise<{
  corrigidas: number;
  erros: number;
}> {
  const auditoria = await auditarTransacoesUsuario(userId);
  
  let corrigidas = 0;
  let erros = 0;
  
  for (const transacao of auditoria.transacoes) {
    if (transacao.auditoria_status === 'divergente' || transacao.auditoria_status === 'corrigido') {
      const sucesso = await corrigirTransacao(
        transacao.id,
        transacao.taxa_plataforma_calculada,
        transacao.taxa_adquirente_calculada,
        transacao.valor_liquido_correto
      );
      
      if (sucesso) {
        corrigidas++;
      } else {
        erros++;
      }
    }
  }
  
  return { corrigidas, erros };
}
