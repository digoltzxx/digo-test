import { supabase } from "@/integrations/supabase/client";
import Decimal from "decimal.js";

// Configure Decimal.js for financial precision (15,2)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ============================================
// INTERFACES
// ============================================

export interface TaxaConfigurada {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  valor: number;
  tipoValor: 'percentual' | 'fixo';
  categoriaTaxa: 'taxas_plataforma' | 'taxas_financeiras' | 'taxas_disputa' | 'taxas_banking' | 'taxas_extensoes';
  tipoTransacao: 'pagamento' | 'saque' | 'antecipacao' | 'reembolso' | 'chargeback' | 'assinatura' | 'todos';
  ativa: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaxaAplicada {
  nome: string;
  categoria: string;
  tipo: 'percentual' | 'fixo';
  percentual: number | null;
  valor: number;
}

export interface TransacaoProcessada {
  idTransacao: string;
  valorBruto: number;
  listaDeTaxas: TaxaAplicada[];
  totalTaxas: number;
  valorLiquido: number;
  dataHora: string;
  statusFinanceiro: 'POSITIVO' | 'NEGATIVO' | 'ZERADO' | 'pendente';
  calculadoEm: string;
}

export interface TaxaTransacao {
  id: string;
  transacaoId: string;
  taxaConfiguradaId: string | null;
  nomeTaxa: string;
  codigoTaxa: string;
  categoriaTaxa: string;
  tipoTaxa: string;
  valorBase: number;
  percentualAplicado: number | null;
  valorTaxa: number;
  valorLiquidoApos: number;
  calculadoEm: string;
}

// ============================================
// FUNÇÕES DE PRECISÃO
// ============================================

function toDecimal(value: number | string | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  return new Decimal(value);
}

function toNumber(decimal: Decimal): number {
  return decimal.toDecimalPlaces(2).toNumber();
}

// ============================================
// BUSCA DE TAXAS CONFIGURADAS
// ============================================

/**
 * Busca todas as taxas configuradas
 */
export async function getTaxasConfiguradas(apenasAtivas: boolean = true): Promise<TaxaConfigurada[]> {
  let query = supabase
    .from('taxas_configuradas')
    .select('*')
    .order('categoria_taxa')
    .order('nome');
  
  if (apenasAtivas) {
    query = query.eq('ativa', true);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    console.error('[Taxas] Erro ao buscar taxas configuradas:', error);
    return [];
  }
  
  return data.map(mapTaxaConfigurada);
}

/**
 * Busca taxas por tipo de transação
 */
export async function getTaxasPorTipoTransacao(tipoTransacao: string): Promise<TaxaConfigurada[]> {
  const { data, error } = await supabase
    .from('taxas_configuradas')
    .select('*')
    .eq('ativa', true)
    .or(`tipo_transacao.eq.${tipoTransacao},tipo_transacao.eq.todos`)
    .order('categoria_taxa')
    .order('nome');
  
  if (error || !data) {
    console.error('[Taxas] Erro ao buscar taxas por tipo:', error);
    return [];
  }
  
  return data.map(mapTaxaConfigurada);
}

/**
 * Busca taxas por categoria
 */
export async function getTaxasPorCategoria(categoria: string): Promise<TaxaConfigurada[]> {
  const { data, error } = await supabase
    .from('taxas_configuradas')
    .select('*')
    .eq('ativa', true)
    .eq('categoria_taxa', categoria)
    .order('nome');
  
  if (error || !data) return [];
  
  return data.map(mapTaxaConfigurada);
}

function mapTaxaConfigurada(data: any): TaxaConfigurada {
  return {
    id: data.id,
    nome: data.nome,
    codigo: data.codigo,
    descricao: data.descricao,
    valor: Number(data.valor),
    tipoValor: data.tipo_valor,
    categoriaTaxa: data.categoria_taxa,
    tipoTransacao: data.tipo_transacao,
    ativa: data.ativa,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// ============================================
// PROCESSAMENTO DE TRANSAÇÕES
// ============================================

/**
 * Processa uma transação e calcula todas as taxas (via RPC)
 */
export async function processarTransacao(transacaoId: string): Promise<TransacaoProcessada | null> {
  const { data, error } = await supabase.rpc('processar_transacao_completa', {
    p_transacao_id: transacaoId
  });
  
  if (error) {
    console.error('[Taxas] Erro ao processar transação:', error);
    return null;
  }
  
  if (!data) {
    console.error('[Taxas] Transação não encontrada');
    return null;
  }

  // Type assertion for the RPC response
  const result = data as Record<string, unknown>;
  
  if (result.error) {
    console.error('[Taxas] Erro na transação:', result.error);
    return null;
  }
  
  const listaTaxas = (result.lista_de_taxas as Array<Record<string, unknown>> || []).map((t) => ({
    nome: String(t.nome || ''),
    categoria: String(t.categoria || ''),
    tipo: t.tipo as 'percentual' | 'fixo',
    percentual: t.percentual != null ? Number(t.percentual) : null,
    valor: Number(t.valor || 0)
  }));
  
  return {
    idTransacao: String(result.id_transacao || transacaoId),
    valorBruto: Number(result.valor_bruto || 0),
    listaDeTaxas: listaTaxas,
    totalTaxas: Number(result.total_taxas || 0),
    valorLiquido: Number(result.valor_liquido || 0),
    dataHora: String(result.data_hora || new Date().toISOString()),
    statusFinanceiro: (result.status_financeiro as 'POSITIVO' | 'NEGATIVO' | 'ZERADO' | 'pendente') || 'pendente',
    calculadoEm: String(result.calculado_em || new Date().toISOString())
  };
}

/**
 * Calcula taxas para uma transação localmente (sem persistir)
 * Útil para preview antes de confirmar
 */
export async function calcularTaxasPreview(
  valorBruto: number,
  tipoTransacao: string
): Promise<{ taxas: TaxaAplicada[]; totalTaxas: number; valorLiquido: number; statusFinanceiro: string }> {
  const taxasConfig = await getTaxasPorTipoTransacao(tipoTransacao);
  
  const taxasAplicadas: TaxaAplicada[] = [];
  let totalTaxas = new Decimal(0);
  const valorBrutoDecimal = toDecimal(valorBruto);
  
  for (const taxa of taxasConfig) {
    let valorTaxa: Decimal;
    
    if (taxa.tipoValor === 'percentual') {
      valorTaxa = valorBrutoDecimal.times(toDecimal(taxa.valor).div(100));
    } else {
      valorTaxa = toDecimal(taxa.valor);
    }
    
    totalTaxas = totalTaxas.plus(valorTaxa);
    
    taxasAplicadas.push({
      nome: taxa.nome,
      categoria: taxa.categoriaTaxa,
      tipo: taxa.tipoValor,
      percentual: taxa.tipoValor === 'percentual' ? taxa.valor : null,
      valor: toNumber(valorTaxa)
    });
  }
  
  const valorLiquido = valorBrutoDecimal.minus(totalTaxas);
  let statusFinanceiro: string;
  
  if (valorLiquido.lt(0)) {
    statusFinanceiro = 'NEGATIVO';
  } else if (valorLiquido.eq(0)) {
    statusFinanceiro = 'ZERADO';
  } else {
    statusFinanceiro = 'POSITIVO';
  }
  
  return {
    taxas: taxasAplicadas,
    totalTaxas: toNumber(totalTaxas),
    valorLiquido: toNumber(valorLiquido),
    statusFinanceiro
  };
}

// ============================================
// BUSCA DE TAXAS APLICADAS POR TRANSAÇÃO
// ============================================

/**
 * Busca as taxas aplicadas a uma transação específica
 */
export async function getTaxasTransacao(transacaoId: string): Promise<TaxaTransacao[]> {
  const { data, error } = await supabase
    .from('taxas_transacoes')
    .select('*')
    .eq('transacao_id', transacaoId)
    .order('categoria_taxa')
    .order('nome_taxa');
  
  if (error || !data) return [];
  
  return data.map(t => ({
    id: t.id,
    transacaoId: t.transacao_id,
    taxaConfiguradaId: t.taxa_configurada_id,
    nomeTaxa: t.nome_taxa,
    codigoTaxa: t.codigo_taxa,
    categoriaTaxa: t.categoria_taxa,
    tipoTaxa: t.tipo_taxa,
    valorBase: Number(t.valor_base),
    percentualAplicado: t.percentual_aplicado ? Number(t.percentual_aplicado) : null,
    valorTaxa: Number(t.valor_taxa),
    valorLiquidoApos: Number(t.valor_liquido_apos),
    calculadoEm: t.calculado_em
  }));
}

// ============================================
// GESTÃO DE TAXAS (CRUD)
// ============================================

/**
 * Atualiza uma taxa configurada
 */
export async function atualizarTaxa(
  taxaId: string,
  updates: Partial<Pick<TaxaConfigurada, 'nome' | 'valor' | 'tipoValor' | 'categoriaTaxa' | 'tipoTransacao' | 'ativa' | 'descricao'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('taxas_configuradas')
    .update({
      nome: updates.nome,
      valor: updates.valor,
      tipo_valor: updates.tipoValor,
      categoria_taxa: updates.categoriaTaxa,
      tipo_transacao: updates.tipoTransacao,
      ativa: updates.ativa,
      descricao: updates.descricao,
      updated_at: new Date().toISOString()
    })
    .eq('id', taxaId);
  
  return !error;
}

/**
 * Cria uma nova taxa configurada
 */
export async function criarTaxa(
  taxa: Omit<TaxaConfigurada, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TaxaConfigurada | null> {
  const { data, error } = await supabase
    .from('taxas_configuradas')
    .insert({
      nome: taxa.nome,
      codigo: taxa.codigo,
      descricao: taxa.descricao,
      valor: taxa.valor,
      tipo_valor: taxa.tipoValor,
      categoria_taxa: taxa.categoriaTaxa,
      tipo_transacao: taxa.tipoTransacao,
      ativa: taxa.ativa
    })
    .select()
    .single();
  
  if (error || !data) {
    console.error('[Taxas] Erro ao criar taxa:', error);
    return null;
  }
  
  return mapTaxaConfigurada(data);
}

/**
 * Desativa uma taxa (soft delete)
 */
export async function desativarTaxa(taxaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('taxas_configuradas')
    .update({ ativa: false, updated_at: new Date().toISOString() })
    .eq('id', taxaId);
  
  return !error;
}

// ============================================
// RELATÓRIOS
// ============================================

/**
 * Resumo de taxas por categoria em um período
 */
export async function getResumoTaxasPorCategoria(
  dataInicio: Date,
  dataFim: Date
): Promise<Array<{ categoria: string; totalTaxas: number; quantidade: number }>> {
  const { data, error } = await supabase
    .from('taxas_transacoes')
    .select('categoria_taxa, valor_taxa')
    .gte('calculado_em', dataInicio.toISOString())
    .lte('calculado_em', dataFim.toISOString());
  
  if (error || !data) return [];
  
  // Agrupar por categoria
  const resumo: Record<string, { total: Decimal; count: number }> = {};
  
  for (const item of data) {
    const cat = item.categoria_taxa;
    if (!resumo[cat]) {
      resumo[cat] = { total: new Decimal(0), count: 0 };
    }
    resumo[cat].total = resumo[cat].total.plus(toDecimal(item.valor_taxa));
    resumo[cat].count++;
  }
  
  return Object.entries(resumo).map(([categoria, { total, count }]) => ({
    categoria,
    totalTaxas: toNumber(total),
    quantidade: count
  }));
}

// ============================================
// FORMATAÇÃO
// ============================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

export const CATEGORIA_LABELS: Record<string, string> = {
  'taxas_plataforma': 'Taxas da Plataforma',
  'taxas_financeiras': 'Taxas Financeiras',
  'taxas_disputa': 'Taxas de Disputa',
  'taxas_banking': 'Taxas Banking',
  'taxas_extensoes': 'Taxas de Extensões'
};

export const TIPO_TRANSACAO_LABELS: Record<string, string> = {
  'pagamento': 'Pagamento',
  'saque': 'Saque',
  'antecipacao': 'Antecipação',
  'reembolso': 'Reembolso',
  'chargeback': 'Chargeback',
  'assinatura': 'Assinatura',
  'todos': 'Todos'
};
