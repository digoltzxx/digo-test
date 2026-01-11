/**
 * Gateway Financial Calculations
 * 
 * This module defines the clear structure for gateway operational costs
 * and provides calculation functions for financial reporting.
 */

// ============================================
// CUSTO OPERACIONAL - DEFINIÇÃO OFICIAL
// ============================================

/**
 * TAXAS QUE ENTRAM COMO CUSTO OPERACIONAL
 * (Reduzem diretamente o lucro líquido do gateway)
 * 
 * 1. Taxas da Adquirente (PodPay):
 *    - Taxa percentual por transação
 *    - Taxa fixa por transação
 * 
 * 2. Taxas de Banking:
 *    - Taxas de saque
 *    - Taxas de transferência
 * 
 * 3. Custos de Serviços Externos:
 *    - Antifraude
 *    - KYC (Know Your Customer)
 *    - BaaS (Banking as a Service)
 * 
 * 4. Custos Recorrentes Operacionais:
 *    - Serviços obrigatórios para funcionamento do gateway
 */

/**
 * TAXAS QUE NÃO ENTRAM COMO CUSTO OPERACIONAL
 * (Aparecem apenas como informação, não são abatidas)
 * 
 * 1. Taxas repassadas ao usuário final
 * 2. Taxas cobradas do vendedor/cliente final
 * 3. Valores apenas informativos ou de repasse
 * 4. Impostos (se tratados separadamente)
 */

export interface OperationalCosts {
  // Taxas da Adquirente (PodPay)
  acquirerFees: number;           // payment_fee das vendas
  
  // Taxas de Banking
  withdrawalFees: number;         // Taxa de saque
  transferFees: number;           // Taxa de transferência
  
  // Serviços Externos
  antifraudFees: number;          // Antifraude
  kycFees: number;                // KYC
  baasFees: number;               // Banking as a Service
  
  // Custos Recorrentes
  recurringCosts: number;         // Serviços obrigatórios
  
  // Total
  total: number;
}

export interface GatewayRevenue {
  // Receita do Gateway
  platformFees: number;           // platform_fee das vendas
  
  // Outras receitas
  otherRevenue: number;           // Receitas extras
  
  // Total
  total: number;
}

export interface GatewayFinancials {
  // Volume transacionado
  grossVolume: number;            // Total de vendas aprovadas
  
  // Receita do Gateway
  revenue: GatewayRevenue;
  
  // Custos Operacionais
  operationalCosts: OperationalCosts;
  
  // Lucro Líquido
  netProfit: number;              // revenue.total - operationalCosts.total
  
  // Margem
  margin: number;                 // (netProfit / revenue.total) * 100
}

export interface DailyFinancials extends GatewayFinancials {
  date: string;
  dayLabel: string;
}

export interface PeriodFinancials extends GatewayFinancials {
  startDate: string;
  endDate: string;
  dailyBreakdown: DailyFinancials[];
}

// ============================================
// FUNÇÕES DE CÁLCULO
// ============================================

/**
 * Calcula os custos operacionais totais
 */
export function calculateOperationalCosts(costs: Omit<OperationalCosts, 'total'>): OperationalCosts {
  const total = 
    costs.acquirerFees +
    costs.withdrawalFees +
    costs.transferFees +
    costs.antifraudFees +
    costs.kycFees +
    costs.baasFees +
    costs.recurringCosts;
  
  return { ...costs, total };
}

/**
 * Calcula a receita total do gateway
 */
export function calculateRevenue(revenue: Omit<GatewayRevenue, 'total'>): GatewayRevenue {
  const total = revenue.platformFees + revenue.otherRevenue;
  return { ...revenue, total };
}

/**
 * Calcula o lucro líquido e margem do gateway
 */
export function calculateNetProfit(
  revenue: GatewayRevenue,
  operationalCosts: OperationalCosts
): { netProfit: number; margin: number } {
  const netProfit = revenue.total - operationalCosts.total;
  const margin = revenue.total > 0 ? (netProfit / revenue.total) * 100 : 0;
  return { netProfit, margin };
}

/**
 * Calcula os financeiros completos do gateway
 */
export function calculateGatewayFinancials(
  grossVolume: number,
  platformFees: number,
  otherRevenue: number,
  acquirerFees: number,
  withdrawalFees: number,
  transferFees: number = 0,
  antifraudFees: number = 0,
  kycFees: number = 0,
  baasFees: number = 0,
  recurringCosts: number = 0
): GatewayFinancials {
  const revenue = calculateRevenue({ platformFees, otherRevenue });
  const operationalCosts = calculateOperationalCosts({
    acquirerFees,
    withdrawalFees,
    transferFees,
    antifraudFees,
    kycFees,
    baasFees,
    recurringCosts,
  });
  const { netProfit, margin } = calculateNetProfit(revenue, operationalCosts);
  
  return {
    grossVolume,
    revenue,
    operationalCosts,
    netProfit,
    margin,
  };
}

// ============================================
// TIPOS DE PERÍODO
// ============================================

export type PeriodType = 'today' | '7days' | '30days' | 'month' | 'custom';

export interface PeriodOption {
  type: PeriodType;
  label: string;
  getRange: () => { from: Date; to: Date };
}

export const periodOptions: PeriodOption[] = [
  {
    type: 'today',
    label: 'Hoje',
    getRange: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    type: '7days',
    label: '7 dias',
    getRange: () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: today };
    },
  },
  {
    type: '30days',
    label: '30 dias',
    getRange: () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: today };
    },
  },
  {
    type: 'month',
    label: 'Mês atual',
    getRange: () => {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: today };
    },
  },
  {
    type: 'custom',
    label: 'Personalizado',
    getRange: () => {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: today };
    },
  },
];

export function getPeriodLabel(from: Date, to: Date): string {
  const formatDate = (d: Date) => 
    `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  
  if (from.toDateString() === to.toDateString()) {
    return formatDate(from);
  }
  
  return `${formatDate(from)} - ${formatDate(to)}`;
}
