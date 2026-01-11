/**
 * Configuração centralizada de status financeiros
 * 
 * REGRA CENTRAL: A carteira só pode ser atualizada com status PERMITIDOS
 * Qualquer outro status deve ser ignorado pela lógica financeira.
 */

// Status permitidos na carteira (únicos válidos)
// Estes indicam: Pagamento concluído, Webhook validado, Dinheiro real
export const ALLOWED_WALLET_STATUSES = ['paid', 'approved', 'confirmed'] as const;

// Status proibidos na carteira (nunca entram no saldo)
export const BLOCKED_WALLET_STATUSES = [
  'pending',
  'waiting_payment', 
  'processing',
  'under_analysis',
  'refused',
  'canceled',
  'cancelled',
  'expired',
  'refunded',
  'chargeback'
] as const;

// Status que indicam venda pendente de confirmação
export const PENDING_STATUSES = [
  'pending',
  'waiting_payment',
  'processing', 
  'under_analysis'
] as const;

// Status terminais negativos (venda não concluída)
export const TERMINAL_NEGATIVE_STATUSES = [
  'refused',
  'canceled',
  'cancelled',
  'expired',
  'refunded',
  'chargeback'
] as const;

/**
 * Verifica se um status é permitido na carteira
 */
export function isStatusAllowedInWallet(status: string): boolean {
  return ALLOWED_WALLET_STATUSES.includes(status as any);
}

/**
 * Verifica se um status é pendente
 */
export function isPendingStatus(status: string): boolean {
  return PENDING_STATUSES.includes(status as any);
}

/**
 * Verifica se um status é terminal negativo
 */
export function isTerminalNegativeStatus(status: string): boolean {
  return TERMINAL_NEGATIVE_STATUSES.includes(status as any);
}

/**
 * Mensagens de status para o frontend
 */
export const STATUS_MESSAGES = {
  wallet: {
    info: "Apenas vendas aprovadas entram no saldo. Vendas pendentes ou em análise não representam dinheiro disponível.",
    releaseInfo: "O saldo à liberar considera apenas vendas aprovadas por cartão. Pagamentos pendentes, recusados ou cancelados não são contabilizados."
  },
  pending: {
    card: "Pagamento em análise. Esta venda ainda não entrou no seu saldo.",
    cardAlt: "Venda pendente de confirmação do cartão. O valor só será liberado após aprovação.",
    generic: "Venda pendente de confirmação. O valor só será liberado após aprovação do pagamento."
  }
} as const;

export type AllowedWalletStatus = typeof ALLOWED_WALLET_STATUSES[number];
export type BlockedWalletStatus = typeof BLOCKED_WALLET_STATUSES[number];
export type PendingStatus = typeof PENDING_STATUSES[number];
