import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  TaxaConfigurada,
  TaxaAplicada,
  TransacaoProcessada,
  getTaxasConfiguradas,
  getTaxasPorCategoria,
  calcularTaxasPreview,
  processarTransacao,
  atualizarTaxa,
  criarTaxa,
  desativarTaxa,
  getResumoTaxasPorCategoria
} from '@/lib/taxasService';
import { startOfMonth, endOfMonth } from 'date-fns';

export interface UseTaxasReturn {
  taxas: TaxaConfigurada[];
  isLoading: boolean;
  error: Error | null;
  refreshTaxas: () => Promise<void>;
  
  // CRUD
  updateTaxa: (id: string, updates: Partial<TaxaConfigurada>) => Promise<boolean>;
  createTaxa: (taxa: Omit<TaxaConfigurada, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TaxaConfigurada | null>;
  deleteTaxa: (id: string) => Promise<boolean>;
  
  // Cálculos
  calcularPreview: (valor: number, tipo: string) => Promise<{
    taxas: TaxaAplicada[];
    totalTaxas: number;
    valorLiquido: number;
    statusFinanceiro: string;
  }>;
  processarTransacaoCompleta: (transacaoId: string) => Promise<TransacaoProcessada | null>;
  
  // Relatórios
  resumoPorCategoria: Array<{ categoria: string; totalTaxas: number; quantidade: number }>;
  loadResumoPorCategoria: (inicio: Date, fim: Date) => Promise<void>;
}

export function useTaxas(apenasAtivas: boolean = true): UseTaxasReturn {
  const [taxas, setTaxas] = useState<TaxaConfigurada[]>([]);
  const [resumoPorCategoria, setResumoPorCategoria] = useState<Array<{ categoria: string; totalTaxas: number; quantidade: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTaxas = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getTaxasConfiguradas(apenasAtivas);
      setTaxas(data);
    } catch (err) {
      console.error('[useTaxas] Erro ao carregar taxas:', err);
      setError(err instanceof Error ? err : new Error('Falha ao carregar taxas'));
    } finally {
      setIsLoading(false);
    }
  }, [apenasAtivas]);

  // Carregamento inicial
  useEffect(() => {
    loadTaxas();
  }, [loadTaxas]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('taxas-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taxas_configuradas' },
        () => loadTaxas()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taxas_transacoes' },
        () => {
          // Recarregar resumo se necessário
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTaxas]);

  // CRUD
  const updateTaxa = useCallback(async (id: string, updates: Partial<TaxaConfigurada>) => {
    const success = await atualizarTaxa(id, updates);
    if (success) await loadTaxas();
    return success;
  }, [loadTaxas]);

  const createTaxa = useCallback(async (taxa: Omit<TaxaConfigurada, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await criarTaxa(taxa);
    if (created) await loadTaxas();
    return created;
  }, [loadTaxas]);

  const deleteTaxa = useCallback(async (id: string) => {
    const success = await desativarTaxa(id);
    if (success) await loadTaxas();
    return success;
  }, [loadTaxas]);

  // Cálculos
  const calcularPreview = useCallback(async (valor: number, tipo: string) => {
    return calcularTaxasPreview(valor, tipo);
  }, []);

  const processarTransacaoCompleta = useCallback(async (transacaoId: string) => {
    return processarTransacao(transacaoId);
  }, []);

  // Relatórios
  const loadResumoPorCategoria = useCallback(async (inicio: Date, fim: Date) => {
    const resumo = await getResumoTaxasPorCategoria(inicio, fim);
    setResumoPorCategoria(resumo);
  }, []);

  return {
    taxas,
    isLoading,
    error,
    refreshTaxas: loadTaxas,
    updateTaxa,
    createTaxa,
    deleteTaxa,
    calcularPreview,
    processarTransacaoCompleta,
    resumoPorCategoria,
    loadResumoPorCategoria
  };
}

// Hook simplificado para preview de taxas
export function useTaxasPreview(valorBruto: number, tipoTransacao: string) {
  const [preview, setPreview] = useState<{
    taxas: TaxaAplicada[];
    totalTaxas: number;
    valorLiquido: number;
    statusFinanceiro: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (valorBruto > 0 && tipoTransacao) {
      setIsLoading(true);
      calcularTaxasPreview(valorBruto, tipoTransacao)
        .then(setPreview)
        .finally(() => setIsLoading(false));
    } else {
      setPreview(null);
    }
  }, [valorBruto, tipoTransacao]);

  return { preview, isLoading };
}
