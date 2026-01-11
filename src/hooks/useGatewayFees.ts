import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Interface das taxas do gateway configuráveis
 * Todas as taxas são carregadas da tabela system_settings
 */
export interface GatewayFeeSettings {
  // PIX
  pix: {
    percentual: number;
    fixo: number;
  };
  // Boleto
  boleto: {
    percentual: number;
    fixo: number;
    dias: number;
  };
  // Cartão de Crédito (por prazo)
  card_2d: {
    percentual: number;
    fixo: number;
  };
  card_7d: {
    percentual: number;
    fixo: number;
  };
  card_15d: {
    percentual: number;
    fixo: number;
  };
  card_30d: {
    percentual: number;
    fixo: number;
  };
  // Taxa da adquirente (fixa por transação)
  acquirer_fee: number;
  // Reserva de segurança
  reserve: {
    card_7d: number;
    card_15d: number;
    card_30d: number;
    pix_days: number;
    pix_percent: number;
  };
  // Taxa de saque
  withdrawal: {
    fixo: number;
    minimo: number;
  };
}

// Valores padrão das taxas (usados se não houver configuração no banco)
export const DEFAULT_GATEWAY_FEES: GatewayFeeSettings = {
  pix: { percentual: 4.99, fixo: 1.49 },
  boleto: { percentual: 5.99, fixo: 1.49, dias: 2 },
  card_2d: { percentual: 6.99, fixo: 1.49 },
  card_7d: { percentual: 6.99, fixo: 1.49 },
  card_15d: { percentual: 6.99, fixo: 1.49 },
  card_30d: { percentual: 4.99, fixo: 1.49 },
  acquirer_fee: 0.60,
  reserve: {
    card_7d: 10,
    card_15d: 10,
    card_30d: 10,
    pix_days: 10,
    pix_percent: 0,
  },
  withdrawal: {
    fixo: 4.90,
    minimo: 50,
  },
};

/**
 * Hook para carregar taxas do gateway do banco de dados
 * Atualiza em tempo real quando as configurações mudam
 */
export const useGatewayFees = () => {
  const [fees, setFees] = useState<GatewayFeeSettings>(DEFAULT_GATEWAY_FEES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      setFees({
        pix: {
          percentual: parseFloat(settingsMap['pix_instant_percent'] || '4.99'),
          fixo: parseFloat(settingsMap['pix_instant_fixed'] || '1.49'),
        },
        boleto: {
          percentual: parseFloat(settingsMap['boleto_percent'] || '5.99'),
          fixo: parseFloat(settingsMap['boleto_fixed'] || '1.49'),
          dias: parseInt(settingsMap['boleto_days'] || '2'),
        },
        card_2d: {
          percentual: parseFloat(settingsMap['card_2d_percent'] || '6.99'),
          fixo: parseFloat(settingsMap['card_2d_fixed'] || '1.49'),
        },
        card_7d: {
          percentual: parseFloat(settingsMap['card_7d_percent'] || '6.99'),
          fixo: parseFloat(settingsMap['card_7d_fixed'] || '1.49'),
        },
        card_15d: {
          percentual: parseFloat(settingsMap['card_15d_percent'] || '6.99'),
          fixo: parseFloat(settingsMap['card_15d_fixed'] || '1.49'),
        },
        card_30d: {
          percentual: parseFloat(settingsMap['card_30d_percent'] || '4.99'),
          fixo: parseFloat(settingsMap['card_30d_fixed'] || '1.49'),
        },
        acquirer_fee: parseFloat(settingsMap['acquirer_fee'] || '0.60'),
        reserve: {
          card_7d: parseFloat(settingsMap['reserve_card_7d'] || '10'),
          card_15d: parseFloat(settingsMap['reserve_card_15d'] || '10'),
          card_30d: parseFloat(settingsMap['reserve_card_30d'] || '10'),
          pix_days: parseFloat(settingsMap['reserve_pix_days'] || '10'),
          pix_percent: parseFloat(settingsMap['reserve_pix_percent'] || '0'),
        },
        withdrawal: {
          fixo: parseFloat(settingsMap['withdrawal_fee'] || '4.90'),
          minimo: parseFloat(settingsMap['minimum_withdrawal'] || '50'),
        },
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching gateway fees:', err);
      setError('Erro ao carregar taxas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();

    // Atualizar em tempo real quando as configurações mudarem
    const channel = supabase
      .channel('gateway-fees-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
        },
        () => {
          fetchFees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { fees, loading, error, refetch: fetchFees };
};

/**
 * Função para obter taxa do gateway por método de pagamento
 * Usa o prazo padrão para cartão (2 dias) se não especificado
 */
export const getGatewayFeeForMethod = (
  fees: GatewayFeeSettings,
  paymentMethod: string,
  cardDays?: number
): { percentual: number; fixo: number } => {
  switch (paymentMethod) {
    case 'pix':
      return fees.pix;
    case 'boleto':
      return fees.boleto;
    case 'credit_card':
    case 'card':
    case 'cartao':
      // Usar prazo específico do cartão se fornecido
      if (cardDays === 30) return fees.card_30d;
      if (cardDays === 15) return fees.card_15d;
      if (cardDays === 7) return fees.card_7d;
      return fees.card_2d; // Padrão: 2 dias
    default:
      return fees.pix; // Fallback para PIX
  }
};

/**
 * Calcula o lucro do gateway para uma transação
 */
export const calculateGatewayProfit = (
  amount: number,
  fees: GatewayFeeSettings,
  paymentMethod: string,
  cardDays?: number
): { gatewayFee: number; acquirerFee: number; netProfit: number } => {
  const methodFee = getGatewayFeeForMethod(fees, paymentMethod, cardDays);
  
  // Taxa percentual + taxa fixa do gateway
  const percentualFee = amount * (methodFee.percentual / 100);
  const gatewayFee = Math.round((percentualFee + methodFee.fixo) * 100) / 100;
  
  // Taxa da adquirente
  const acquirerFee = fees.acquirer_fee;
  
  // Lucro líquido = taxa do gateway - custo da adquirente
  const netProfit = Math.round((gatewayFee - acquirerFee) * 100) / 100;
  
  return { gatewayFee, acquirerFee, netProfit };
};
