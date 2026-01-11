// =====================================================
// SISTEMA DEFINITIVO DE CÓDIGOS DE ERRO E MENSAGENS
// =====================================================

export type MessageTone = 'short' | 'human';

export interface DeliveryMessage {
  // Mensagem curta (toasts, alerts, status)
  short: string;
  // Mensagem humana (telas de erro, detalhes)
  human: string;
  // Ação sugerida para o usuário
  action?: string;
}

// =====================================================
// CÓDIGOS INTERNOS DE ERRO - LISTA DEFINITIVA
// Formato: [CONTEXTO]_[PROBLEMA]_[DETALHE]
// Nunca exibido ao usuário final
// =====================================================

export type InternalErrorCode =
  // Pagamento
  | 'PAYMENT_NOT_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_WEBHOOK_NOT_RECEIVED'
  // Produto
  | 'PRODUCT_DELIVERY_NOT_CONFIGURED'
  | 'PRODUCT_INVALID_DELIVERY_TYPE'
  // Entrega geral
  | 'DELIVERY_PROCESS_FAILED'
  | 'DELIVERY_ALREADY_PROCESSED'
  // Email
  | 'EMAIL_TEMPLATE_NOT_CONFIGURED'
  | 'EMAIL_SEND_FAILED'
  // Área de membros
  | 'MEMBERS_AREA_NOT_CONFIGURED'
  | 'MEMBERS_ACCESS_NOT_GRANTED'
  // Assinatura
  | 'SUBSCRIPTION_NOT_CREATED'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_CANCELED'
  // Integração
  | 'WEBHOOK_INVALID_SIGNATURE'
  | 'WEBHOOK_PROCESSING_FAILED';

// =====================================================
// MENSAGENS PARA O USUÁRIO FINAL
// Tom: empático, claro, tranquilo
// Nunca técnico, nunca culpa o usuário
// =====================================================

export const ERROR_MESSAGES: Record<InternalErrorCode, DeliveryMessage> = {
  // Pagamento
  PAYMENT_NOT_CONFIRMED: {
    short: 'Pagamento ainda não confirmado.',
    human: 'Seu pagamento foi recebido, mas ainda estamos confirmando a liberação do acesso. Isso deve levar apenas alguns instantes.',
    action: 'Aguarde a confirmação.',
  },
  PAYMENT_FAILED: {
    short: 'Pagamento não aprovado.',
    human: 'Não foi possível aprovar seu pagamento. Isso pode acontecer por limite, dados incorretos ou bloqueio do banco. Tente novamente ou use outro método.',
    action: 'Tente novamente ou use outro método de pagamento.',
  },
  PAYMENT_WEBHOOK_NOT_RECEIVED: {
    short: 'Confirmação não recebida.',
    human: 'Ainda não recebemos a confirmação do seu pagamento. Pode levar alguns minutos. Se já pagou, aguarde um pouco mais.',
    action: 'Aguarde ou verifique seu email.',
  },

  // Produto
  PRODUCT_DELIVERY_NOT_CONFIGURED: {
    short: 'Entrega não configurada.',
    human: 'Este produto ainda não possui configuração de entrega definida pelo vendedor. Nossa equipe foi notificada e está trabalhando nisso.',
    action: 'Aguarde contato do suporte.',
  },
  PRODUCT_INVALID_DELIVERY_TYPE: {
    short: 'Tipo de entrega inválido.',
    human: 'Houve um problema técnico na configuração da entrega deste produto. Estamos trabalhando para resolver.',
    action: 'Entre em contato com o suporte.',
  },

  // Entrega geral
  DELIVERY_PROCESS_FAILED: {
    short: 'Entrega não realizada.',
    human: 'O pagamento foi aprovado, mas houve um atraso na entrega do conteúdo. Nossa equipe já foi avisada e isso será resolvido em breve.',
    action: 'Aguarde ou entre em contato com o suporte.',
  },
  DELIVERY_ALREADY_PROCESSED: {
    short: 'Entrega já realizada.',
    human: 'Sua entrega já foi processada anteriormente. Verifique seu email ou sua área de membros.',
    action: 'Verifique seu email ou área de membros.',
  },

  // Email
  EMAIL_TEMPLATE_NOT_CONFIGURED: {
    short: 'Configuração de email pendente.',
    human: 'O email de entrega será enviado em breve. Estamos preparando seu conteúdo.',
    action: 'Aguarde o recebimento.',
  },
  EMAIL_SEND_FAILED: {
    short: 'Email não enviado.',
    human: 'O email com seu conteúdo não pôde ser enviado agora. Caso não o receba em alguns minutos, fale com nosso suporte.',
    action: 'Verifique sua caixa de spam ou contate o suporte.',
  },

  // Área de membros
  MEMBERS_AREA_NOT_CONFIGURED: {
    short: 'Área de membros não configurada.',
    human: 'A área de membros deste produto ainda está sendo configurada pelo vendedor. Em breve você terá acesso.',
    action: 'Aguarde contato do vendedor.',
  },
  MEMBERS_ACCESS_NOT_GRANTED: {
    short: 'Acesso não liberado.',
    human: 'Seu acesso à área de membros ainda não foi liberado. Estamos ajustando isso agora mesmo.',
    action: 'Aguarde ou entre em contato com o suporte.',
  },

  // Assinatura
  SUBSCRIPTION_NOT_CREATED: {
    short: 'Assinatura não criada.',
    human: 'Identificamos um problema na criação da sua assinatura. Assim que for corrigido, o acesso será liberado automaticamente.',
    action: 'Aguarde ou contate o suporte.',
  },
  SUBSCRIPTION_NOT_ACTIVE: {
    short: 'Assinatura inativa.',
    human: 'Identificamos um problema na ativação da sua assinatura. Assim que for corrigido, o acesso será liberado automaticamente.',
    action: 'Aguarde a ativação.',
  },
  SUBSCRIPTION_EXPIRED: {
    short: 'Assinatura expirada.',
    human: 'Sua assinatura expirou e o acesso foi suspenso. Renove para recuperar o acesso imediatamente.',
    action: 'Renove agora para continuar.',
  },
  SUBSCRIPTION_CANCELED: {
    short: 'Assinatura cancelada.',
    human: 'Sua assinatura foi cancelada. O acesso permanece até o final do período já pago.',
    action: 'Reative se desejar continuar.',
  },

  // Integração
  WEBHOOK_INVALID_SIGNATURE: {
    short: 'Erro de autenticação.',
    human: 'Houve um problema na comunicação com o sistema de pagamento. Nossa equipe foi notificada.',
    action: 'Aguarde contato do suporte.',
  },
  WEBHOOK_PROCESSING_FAILED: {
    short: 'Erro no processamento.',
    human: 'Houve um erro ao processar a confirmação do seu pagamento. Nossa equipe foi notificada e está trabalhando na solução.',
    action: 'Aguarde contato ou procure o suporte.',
  },
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

/**
 * Obtém mensagem por código de erro
 */
export function getMessage(code: InternalErrorCode, tone: MessageTone = 'short'): string {
  const message = ERROR_MESSAGES[code];
  if (!message) return 'Algo deu errado. Tente novamente.';
  return message[tone];
}

/**
 * Obtém mensagem completa com ação
 */
export function getFullMessage(code: InternalErrorCode): DeliveryMessage {
  return ERROR_MESSAGES[code] || {
    short: 'Algo deu errado.',
    human: 'Algo não saiu como esperado. Se o problema persistir, entre em contato com nosso suporte.',
    action: 'Tente novamente ou contate o suporte.',
  };
}

/**
 * Verifica se o código indica que pode resolver internamente (suporte não-técnico)
 */
export function canResolveInternally(code: InternalErrorCode): boolean {
  const resolvableInternally: InternalErrorCode[] = [
    'PAYMENT_NOT_CONFIRMED',
    'PAYMENT_WEBHOOK_NOT_RECEIVED',
    'DELIVERY_ALREADY_PROCESSED',
    'EMAIL_SEND_FAILED',
    'MEMBERS_ACCESS_NOT_GRANTED',
    'SUBSCRIPTION_NOT_ACTIVE',
    'SUBSCRIPTION_EXPIRED',
  ];
  return resolvableInternally.includes(code);
}

/**
 * Verifica se o código requer escalação para equipe técnica
 */
export function requiresTechnicalEscalation(code: InternalErrorCode): boolean {
  const technicalCodes: InternalErrorCode[] = [
    'PRODUCT_DELIVERY_NOT_CONFIGURED',
    'PRODUCT_INVALID_DELIVERY_TYPE',
    'EMAIL_TEMPLATE_NOT_CONFIGURED',
    'MEMBERS_AREA_NOT_CONFIGURED',
    'SUBSCRIPTION_NOT_CREATED',
    'WEBHOOK_INVALID_SIGNATURE',
    'WEBHOOK_PROCESSING_FAILED',
  ];
  return technicalCodes.includes(code);
}

/**
 * Categoriza o código de erro
 */
export function getErrorCategory(code: InternalErrorCode): string {
  if (code.startsWith('PAYMENT')) return 'Pagamento';
  if (code.startsWith('PRODUCT')) return 'Produto';
  if (code.startsWith('DELIVERY')) return 'Entrega';
  if (code.startsWith('EMAIL')) return 'Email';
  if (code.startsWith('MEMBERS')) return 'Área de Membros';
  if (code.startsWith('SUBSCRIPTION')) return 'Assinatura';
  if (code.startsWith('WEBHOOK')) return 'Integração';
  return 'Sistema';
}

/**
 * Obtém severidade do erro
 */
export function getErrorSeverity(code: InternalErrorCode): 'info' | 'warning' | 'error' | 'critical' {
  const info: InternalErrorCode[] = [
    'PAYMENT_NOT_CONFIRMED',
    'PAYMENT_WEBHOOK_NOT_RECEIVED',
    'DELIVERY_ALREADY_PROCESSED',
  ];
  const warning: InternalErrorCode[] = [
    'EMAIL_TEMPLATE_NOT_CONFIGURED',
    'SUBSCRIPTION_CANCELED',
    'SUBSCRIPTION_EXPIRED',
  ];
  const critical: InternalErrorCode[] = [
    'DELIVERY_PROCESS_FAILED',
    'MEMBERS_ACCESS_NOT_GRANTED',
    'WEBHOOK_PROCESSING_FAILED',
    'WEBHOOK_INVALID_SIGNATURE',
  ];
  
  if (info.includes(code)) return 'info';
  if (warning.includes(code)) return 'warning';
  if (critical.includes(code)) return 'critical';
  return 'error';
}

/**
 * Obtém descrição interna do erro (para painel admin)
 */
export function getInternalDescription(code: InternalErrorCode): string {
  const descriptions: Record<InternalErrorCode, string> = {
    PAYMENT_NOT_CONFIRMED: 'Pagamento realizado, aguardando confirmação do gateway.',
    PAYMENT_FAILED: 'Pagamento recusado pelo gateway ou banco.',
    PAYMENT_WEBHOOK_NOT_RECEIVED: 'Webhook de confirmação de pagamento não recebido.',
    PRODUCT_DELIVERY_NOT_CONFIGURED: 'Produto não possui delivery_method configurado.',
    PRODUCT_INVALID_DELIVERY_TYPE: 'Tipo de entrega configurado não é válido.',
    DELIVERY_PROCESS_FAILED: 'Erro ao processar a entrega do produto.',
    DELIVERY_ALREADY_PROCESSED: 'Tentativa de reprocessar entrega já realizada.',
    EMAIL_TEMPLATE_NOT_CONFIGURED: 'Template de email não configurado para o produto.',
    EMAIL_SEND_FAILED: 'Falha ao enviar email via serviço de email.',
    MEMBERS_AREA_NOT_CONFIGURED: 'Área de membros não vinculada ao produto.',
    MEMBERS_ACCESS_NOT_GRANTED: 'Acesso à área de membros não foi concedido.',
    SUBSCRIPTION_NOT_CREATED: 'Falha ao criar registro de assinatura.',
    SUBSCRIPTION_NOT_ACTIVE: 'Assinatura criada, porém não ativada após pagamento.',
    SUBSCRIPTION_EXPIRED: 'Período da assinatura expirou.',
    SUBSCRIPTION_CANCELED: 'Assinatura cancelada pelo usuário ou sistema.',
    WEBHOOK_INVALID_SIGNATURE: 'Assinatura do webhook inválida ou expirada.',
    WEBHOOK_PROCESSING_FAILED: 'Erro ao processar dados do webhook.',
  };
  return descriptions[code] || 'Erro não catalogado.';
}

// =====================================================
// INTERFACE PARA DIAGNÓSTICO
// =====================================================

export interface DiagnosticStatus {
  label: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  errorCode?: InternalErrorCode;
  details?: string;
  canResolve: boolean;
  needsEscalation: boolean;
}

export interface DiagnosticResult {
  // Identificação
  userId?: string;
  userEmail: string;
  userName?: string;
  productId: string;
  productName?: string;
  
  // Tipo
  deliveryType: 'payment_only' | 'email' | 'member_area' | null;
  isSubscription: boolean;
  
  // Status
  paymentStatus: DiagnosticStatus;
  deliveryStatus: DiagnosticStatus;
  subscriptionStatus?: DiagnosticStatus;
  emailStatus?: DiagnosticStatus;
  memberAccessStatus?: DiagnosticStatus;
  
  // Resumo
  overallStatus: 'ok' | 'warning' | 'error';
  lastErrorCode?: InternalErrorCode;
  lastErrorAt?: string;
  
  // Ações
  canResolveInternally: boolean;
  needsTechnicalEscalation: boolean;
  suggestedActions: string[];
}

// =====================================================
// AÇÕES SUGERIDAS PARA SUPORTE
// =====================================================

export function getSuggestedActions(code: InternalErrorCode): string[] {
  const actions: Record<InternalErrorCode, string[]> = {
    PAYMENT_NOT_CONFIRMED: [
      'Verificar status do pagamento no gateway',
      'Aguardar webhook de confirmação',
    ],
    PAYMENT_FAILED: [
      'Orientar cliente a tentar novamente',
      'Sugerir outro método de pagamento',
    ],
    PAYMENT_WEBHOOK_NOT_RECEIVED: [
      'Verificar logs de webhook',
      'Confirmar pagamento manualmente se necessário',
    ],
    PRODUCT_DELIVERY_NOT_CONFIGURED: [
      'Escalar para equipe técnica',
      'Configurar método de entrega no produto',
    ],
    PRODUCT_INVALID_DELIVERY_TYPE: [
      'Escalar para equipe técnica',
      'Verificar configuração do produto',
    ],
    DELIVERY_PROCESS_FAILED: [
      'Reprocessar entrega manualmente',
      'Verificar logs de entrega',
    ],
    DELIVERY_ALREADY_PROCESSED: [
      'Verificar se cliente recebeu o conteúdo',
      'Orientar cliente a verificar email/spam',
    ],
    EMAIL_TEMPLATE_NOT_CONFIGURED: [
      'Escalar para equipe técnica',
      'Configurar template de email',
    ],
    EMAIL_SEND_FAILED: [
      'Reenviar email manualmente',
      'Verificar email do cliente',
    ],
    MEMBERS_AREA_NOT_CONFIGURED: [
      'Escalar para equipe técnica',
      'Vincular área de membros ao produto',
    ],
    MEMBERS_ACCESS_NOT_GRANTED: [
      'Liberar acesso manualmente',
      'Verificar status do pagamento',
    ],
    SUBSCRIPTION_NOT_CREATED: [
      'Escalar para equipe técnica',
      'Verificar logs de criação de assinatura',
    ],
    SUBSCRIPTION_NOT_ACTIVE: [
      'Verificar status da assinatura',
      'Ativar assinatura manualmente',
    ],
    SUBSCRIPTION_EXPIRED: [
      'Orientar cliente a renovar',
      'Verificar se há pagamento pendente',
    ],
    SUBSCRIPTION_CANCELED: [
      'Confirmar cancelamento com cliente',
      'Orientar sobre reativação se desejado',
    ],
    WEBHOOK_INVALID_SIGNATURE: [
      'Escalar para equipe técnica',
      'Verificar configuração de webhook',
    ],
    WEBHOOK_PROCESSING_FAILED: [
      'Escalar para equipe técnica',
      'Verificar logs de webhook',
    ],
  };
  return actions[code] || ['Verificar detalhes do erro', 'Contatar equipe técnica'];
}
