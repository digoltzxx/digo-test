// =====================================================
// SISTEMA DE COMUNICAÇÃO E DIAGNÓSTICO DE ENTREGAS
// =====================================================

// Tipos de método de entrega
export type DeliveryMethod = 'payment_only' | 'email' | 'member_area';

// Códigos de erro (para logs técnicos)
export type ErrorCode = 
  // Payment errors
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CONFIRMED_BUT_DELIVERY_FAILED'
  // Payment only errors
  | 'PAYMENT_ONLY_NO_DELIVERY'
  | 'PAYMENT_ONLY_INVALID_ACTION'
  // Email errors
  | 'EMAIL_NOT_CONFIGURED'
  | 'EMAIL_TEMPLATE_MISSING'
  | 'EMAIL_SEND_FAILED'
  | 'EMAIL_DELIVERY_ERROR'
  | 'EMAIL_PAYMENT_PENDING'
  | 'EMAIL_SERVICE_UNAVAILABLE'
  // Member area errors
  | 'MEMBER_AREA_NOT_LINKED'
  | 'MEMBER_SUBSCRIPTION_INACTIVE'
  | 'MEMBER_SUBSCRIPTION_EXPIRED'
  | 'MEMBER_SUBSCRIPTION_PENDING'
  | 'MEMBERS_AREA_ACCESS_NOT_GRANTED'
  | 'MEMBER_ACCESS_FAILED'
  | 'MEMBER_PAYMENT_INVALID'
  // Subscription errors
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_EXPIRED'
  // General errors
  | 'PRODUCT_NOT_FOUND'
  | 'DELIVERY_CONFIG_MISSING'
  | 'DELIVERY_METHOD_UNKNOWN'
  | 'PAYMENT_NOT_CONFIRMED';

// =====================================================
// MENSAGENS PARA FRONTEND (Copy Final - Amigáveis)
// =====================================================

export interface FrontendMessage {
  title: string;
  description: string;
  action?: string;
}

export const FRONTEND_MESSAGES: Record<string, FrontendMessage> = {
  // Pagamento
  PAYMENT_PENDING: {
    title: 'Pagamento pendente',
    description: 'Seu pagamento ainda não foi confirmado. Assim que for aprovado, a entrega será liberada automaticamente.',
    action: 'Aguarde a confirmação ou tente novamente.',
  },
  PAYMENT_FAILED: {
    title: 'Pagamento não confirmado',
    description: 'Não foi possível confirmar o pagamento no momento.',
    action: 'Tente novamente ou aguarde alguns minutos.',
  },
  
  // Entrega via email
  EMAIL_DELIVERY_SUCCESS: {
    title: 'Email enviado!',
    description: 'O conteúdo foi enviado para o seu email cadastrado.',
    action: 'Verifique sua caixa de entrada e pasta de spam.',
  },
  EMAIL_DELIVERY_FAILED: {
    title: 'Problema no envio do email',
    description: 'O pagamento foi confirmado, mas houve um problema ao enviar o email com o conteúdo.',
    action: 'Nossa equipe já foi notificada. Caso não receba o email, entre em contato com o suporte.',
  },
  EMAIL_NOT_CONFIGURED: {
    title: 'Email não configurado',
    description: 'A entrega via email não está configurada para este produto.',
    action: 'Entre em contato com o suporte para mais informações.',
  },
  
  // Área de membros
  MEMBER_ACCESS_SUCCESS: {
    title: 'Acesso liberado!',
    description: 'Seu acesso à área de membros foi liberado com sucesso.',
    action: 'Acesse a área de membros para começar.',
  },
  MEMBER_ACCESS_FAILED: {
    title: 'Acesso não liberado',
    description: 'Seu pagamento foi aprovado, mas o acesso à área de membros ainda não foi liberado.',
    action: 'Estamos ajustando isso para você. Em caso de dúvida, fale com o suporte.',
  },
  MEMBER_AREA_NOT_CONFIGURED: {
    title: 'Área de membros não configurada',
    description: 'Este produto não possui uma área de membros configurada.',
    action: 'Entre em contato com o vendedor para mais informações.',
  },
  
  // Assinatura
  SUBSCRIPTION_PENDING: {
    title: 'Assinatura pendente',
    description: 'O pagamento foi confirmado, porém sua assinatura ainda não está ativa.',
    action: 'O acesso será liberado assim que a assinatura for ativada.',
  },
  SUBSCRIPTION_INACTIVE: {
    title: 'Assinatura inativa',
    description: 'A assinatura vinculada a este produto não está ativa.',
    action: 'Renove sua assinatura para recuperar o acesso.',
  },
  SUBSCRIPTION_EXPIRED: {
    title: 'Assinatura expirada',
    description: 'Sua assinatura expirou e o acesso foi suspenso.',
    action: 'Renove sua assinatura para continuar acessando o conteúdo.',
  },
  
  // Geral
  DELIVERY_SUCCESS: {
    title: 'Entrega realizada!',
    description: 'Seu produto foi entregue com sucesso.',
  },
  GENERIC_ERROR: {
    title: 'Algo deu errado',
    description: 'Ocorreu um problema inesperado. Nossa equipe foi notificada.',
    action: 'Se o problema persistir, entre em contato com o suporte.',
  },
};

// =====================================================
// LOGS TÉCNICOS (Para administradores)
// =====================================================

export interface TechnicalLog {
  code: ErrorCode;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'payment' | 'email' | 'member_area' | 'subscription' | 'delivery' | 'config';
  message: string;
  technicalDetails: string;
  suggestedAction: string;
}

export const TECHNICAL_LOGS: Record<ErrorCode, TechnicalLog> = {
  // Payment errors
  PAYMENT_PENDING: {
    code: 'PAYMENT_PENDING',
    severity: 'info',
    category: 'payment',
    message: 'Pagamento aguardando confirmação',
    technicalDetails: 'Transação iniciada mas não confirmada pela adquirente',
    suggestedAction: 'Aguardar webhook de confirmação ou verificar status no gateway',
  },
  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    severity: 'error',
    category: 'payment',
    message: 'Falha na confirmação do pagamento',
    technicalDetails: 'Pagamento recusado ou expirado pela adquirente',
    suggestedAction: 'Verificar logs do gateway e motivo da recusa',
  },
  PAYMENT_CONFIRMED_BUT_DELIVERY_FAILED: {
    code: 'PAYMENT_CONFIRMED_BUT_DELIVERY_FAILED',
    severity: 'critical',
    category: 'delivery',
    message: 'Pagamento confirmado mas entrega falhou',
    technicalDetails: 'Transação aprovada porém processo de entrega não executou corretamente',
    suggestedAction: 'Reprocessar entrega manualmente via painel admin',
  },
  
  // Payment only errors
  PAYMENT_ONLY_NO_DELIVERY: {
    code: 'PAYMENT_ONLY_NO_DELIVERY',
    severity: 'info',
    category: 'config',
    message: 'Produto configurado apenas para pagamento',
    technicalDetails: 'delivery_method = payment_only, nenhuma ação de entrega executada',
    suggestedAction: 'Nenhuma ação necessária - comportamento esperado',
  },
  PAYMENT_ONLY_INVALID_ACTION: {
    code: 'PAYMENT_ONLY_INVALID_ACTION',
    severity: 'warning',
    category: 'config',
    message: 'Tentativa de entrega em produto payment_only',
    technicalDetails: 'Sistema tentou executar entrega em produto sem método de entrega',
    suggestedAction: 'Verificar fluxo e corrigir configuração do produto',
  },
  
  // Email errors
  EMAIL_NOT_CONFIGURED: {
    code: 'EMAIL_NOT_CONFIGURED',
    severity: 'error',
    category: 'email',
    message: 'Serviço de email não configurado',
    technicalDetails: 'RESEND_API_KEY não encontrada nas variáveis de ambiente',
    suggestedAction: 'Configurar RESEND_API_KEY no painel de secrets',
  },
  EMAIL_TEMPLATE_MISSING: {
    code: 'EMAIL_TEMPLATE_MISSING',
    severity: 'warning',
    category: 'email',
    message: 'Template de email não encontrado',
    technicalDetails: 'Nenhum registro em product_deliverables para este produto',
    suggestedAction: 'Configurar template de email no gerenciamento do produto',
  },
  EMAIL_SEND_FAILED: {
    code: 'EMAIL_SEND_FAILED',
    severity: 'error',
    category: 'email',
    message: 'Falha ao enviar email',
    technicalDetails: 'API Resend retornou erro no envio',
    suggestedAction: 'Verificar logs do Resend e reenviar manualmente se necessário',
  },
  EMAIL_DELIVERY_ERROR: {
    code: 'EMAIL_DELIVERY_ERROR',
    severity: 'error',
    category: 'email',
    message: 'Erro no processo de entrega por email',
    technicalDetails: 'Exceção durante execução do fluxo de email',
    suggestedAction: 'Verificar logs detalhados e reprocessar',
  },
  EMAIL_PAYMENT_PENDING: {
    code: 'EMAIL_PAYMENT_PENDING',
    severity: 'warning',
    category: 'email',
    message: 'Email não enviado - pagamento pendente',
    technicalDetails: 'Tentativa de envio antes da confirmação do pagamento',
    suggestedAction: 'Aguardar confirmação do pagamento',
  },
  EMAIL_SERVICE_UNAVAILABLE: {
    code: 'EMAIL_SERVICE_UNAVAILABLE',
    severity: 'error',
    category: 'email',
    message: 'Serviço de email indisponível',
    technicalDetails: 'API Resend não respondeu ou retornou erro de serviço',
    suggestedAction: 'Verificar status do Resend e tentar novamente',
  },
  
  // Member area errors
  MEMBER_AREA_NOT_LINKED: {
    code: 'MEMBER_AREA_NOT_LINKED',
    severity: 'error',
    category: 'member_area',
    message: 'Área de membros não vinculada',
    technicalDetails: 'Produto configurado como member_area mas sem configuração válida',
    suggestedAction: 'Configurar área de membros no gerenciamento do produto',
  },
  MEMBER_SUBSCRIPTION_INACTIVE: {
    code: 'MEMBER_SUBSCRIPTION_INACTIVE',
    severity: 'error',
    category: 'subscription',
    message: 'Assinatura inativa',
    technicalDetails: 'subscription.status != active',
    suggestedAction: 'Verificar status da assinatura e pagamentos pendentes',
  },
  MEMBER_SUBSCRIPTION_EXPIRED: {
    code: 'MEMBER_SUBSCRIPTION_EXPIRED',
    severity: 'warning',
    category: 'subscription',
    message: 'Assinatura expirada',
    technicalDetails: 'current_period_end < now()',
    suggestedAction: 'Aguardar renovação ou notificar usuário',
  },
  MEMBER_SUBSCRIPTION_PENDING: {
    code: 'MEMBER_SUBSCRIPTION_PENDING',
    severity: 'info',
    category: 'subscription',
    message: 'Assinatura pendente de ativação',
    technicalDetails: 'subscription.status = pending',
    suggestedAction: 'Aguardar confirmação do primeiro pagamento',
  },
  MEMBERS_AREA_ACCESS_NOT_GRANTED: {
    code: 'MEMBERS_AREA_ACCESS_NOT_GRANTED',
    severity: 'critical',
    category: 'member_area',
    message: 'Acesso à área de membros não foi liberado',
    technicalDetails: 'Falha no upsert em member_access após pagamento confirmado',
    suggestedAction: 'Liberar acesso manualmente e investigar causa',
  },
  MEMBER_ACCESS_FAILED: {
    code: 'MEMBER_ACCESS_FAILED',
    severity: 'error',
    category: 'member_area',
    message: 'Falha ao liberar acesso',
    technicalDetails: 'Erro durante upsert em member_access',
    suggestedAction: 'Verificar logs e reprocessar',
  },
  MEMBER_PAYMENT_INVALID: {
    code: 'MEMBER_PAYMENT_INVALID',
    severity: 'error',
    category: 'member_area',
    message: 'Pagamento inválido para área de membros',
    technicalDetails: 'Tentativa de acesso sem sale ou subscription válidos',
    suggestedAction: 'Verificar histórico de pagamentos do usuário',
  },
  
  // Subscription errors
  SUBSCRIPTION_NOT_ACTIVE: {
    code: 'SUBSCRIPTION_NOT_ACTIVE',
    severity: 'error',
    category: 'subscription',
    message: 'Assinatura não está ativa',
    technicalDetails: 'Status da assinatura diferente de active',
    suggestedAction: 'Verificar pagamentos e status no gateway',
  },
  SUBSCRIPTION_CANCELED: {
    code: 'SUBSCRIPTION_CANCELED',
    severity: 'warning',
    category: 'subscription',
    message: 'Assinatura cancelada',
    technicalDetails: 'subscription.status = canceled',
    suggestedAction: 'Revogar acesso se ainda não foi feito',
  },
  SUBSCRIPTION_EXPIRED: {
    code: 'SUBSCRIPTION_EXPIRED',
    severity: 'warning',
    category: 'subscription',
    message: 'Assinatura expirada',
    technicalDetails: 'subscription.status = expired ou period_end ultrapassado',
    suggestedAction: 'Revogar acesso e notificar usuário para renovação',
  },
  
  // General errors
  PRODUCT_NOT_FOUND: {
    code: 'PRODUCT_NOT_FOUND',
    severity: 'error',
    category: 'config',
    message: 'Produto não encontrado',
    technicalDetails: 'product_id não existe na tabela products',
    suggestedAction: 'Verificar integridade dos dados',
  },
  DELIVERY_CONFIG_MISSING: {
    code: 'DELIVERY_CONFIG_MISSING',
    severity: 'error',
    category: 'config',
    message: 'Configuração de entrega ausente',
    technicalDetails: 'Produto sem delivery_method definido',
    suggestedAction: 'Configurar método de entrega no produto',
  },
  DELIVERY_METHOD_UNKNOWN: {
    code: 'DELIVERY_METHOD_UNKNOWN',
    severity: 'error',
    category: 'config',
    message: 'Método de entrega desconhecido',
    technicalDetails: 'delivery_method com valor não reconhecido',
    suggestedAction: 'Corrigir valor do delivery_method',
  },
  PAYMENT_NOT_CONFIRMED: {
    code: 'PAYMENT_NOT_CONFIRMED',
    severity: 'warning',
    category: 'payment',
    message: 'Pagamento não confirmado',
    technicalDetails: 'sale.status != paid ou subscription.status != active',
    suggestedAction: 'Aguardar confirmação ou verificar status no gateway',
  },
};

// =====================================================
// INTERFACE DE LOG PARA BANCO DE DADOS
// =====================================================

export interface DeliveryLogEntry {
  // Identificadores
  sale_id?: string;
  subscription_id?: string;
  product_id: string;
  user_email: string;
  user_name?: string;
  
  // Tipo de operação
  operation_type: 'payment' | 'email_delivery' | 'member_access' | 'subscription';
  delivery_type: DeliveryMethod | string;
  
  // Status e erro
  delivery_status: 'pending' | 'processing' | 'delivered' | 'failed';
  error_code?: ErrorCode;
  error_message?: string;
  
  // Contexto adicional
  payment_status?: string;
  subscription_status?: string;
  
  // Timestamps
  created_at?: string;
  delivered_at?: string;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// Obter mensagem amigável para o frontend
export function getFrontendMessage(errorCode: ErrorCode | string): FrontendMessage {
  // Mapeamento de códigos de erro para chaves de mensagem
  const messageMap: Record<string, string> = {
    PAYMENT_PENDING: 'PAYMENT_PENDING',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    EMAIL_SEND_FAILED: 'EMAIL_DELIVERY_FAILED',
    EMAIL_DELIVERY_ERROR: 'EMAIL_DELIVERY_FAILED',
    EMAIL_NOT_CONFIGURED: 'EMAIL_NOT_CONFIGURED',
    EMAIL_TEMPLATE_MISSING: 'EMAIL_NOT_CONFIGURED',
    MEMBER_ACCESS_FAILED: 'MEMBER_ACCESS_FAILED',
    MEMBERS_AREA_ACCESS_NOT_GRANTED: 'MEMBER_ACCESS_FAILED',
    MEMBER_AREA_NOT_LINKED: 'MEMBER_AREA_NOT_CONFIGURED',
    MEMBER_SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
    MEMBER_SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
    SUBSCRIPTION_NOT_ACTIVE: 'SUBSCRIPTION_INACTIVE',
    SUBSCRIPTION_CANCELED: 'SUBSCRIPTION_INACTIVE',
    SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
    MEMBER_SUBSCRIPTION_PENDING: 'SUBSCRIPTION_PENDING',
  };
  
  const messageKey = messageMap[errorCode] || 'GENERIC_ERROR';
  return FRONTEND_MESSAGES[messageKey] || FRONTEND_MESSAGES.GENERIC_ERROR;
}

// Obter log técnico
export function getTechnicalLog(errorCode: ErrorCode): TechnicalLog | null {
  return TECHNICAL_LOGS[errorCode] || null;
}

// Criar entrada de log
export function createLogEntry(
  params: Partial<DeliveryLogEntry> & { 
    product_id: string; 
    user_email: string; 
    delivery_type: string;
  }
): DeliveryLogEntry {
  return {
    product_id: params.product_id,
    user_email: params.user_email,
    delivery_type: params.delivery_type,
    operation_type: params.operation_type || 'email_delivery',
    delivery_status: params.delivery_status || 'pending',
    ...params,
  };
}

// =====================================================
// CHECKLIST PARA SUPORTE NÃO TÉCNICO
// =====================================================

export interface SupportChecklistItem {
  id: string;
  category: 'payment' | 'delivery' | 'email' | 'member_area' | 'subscription' | 'logs';
  question: string;
  options: { value: 'yes' | 'no' | 'na'; label: string }[];
  followUp?: {
    onYes?: string;
    onNo?: string;
  };
  priority: number;
}

export const SUPPORT_CHECKLIST: SupportChecklistItem[] = [
  // Pagamento
  {
    id: 'payment_status',
    category: 'payment',
    question: 'O pagamento está como "Pago" no sistema?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    followUp: {
      onNo: 'Orientar cliente a aguardar ou verificar com banco/cartão',
    },
    priority: 1,
  },
  
  // Tipo de entrega
  {
    id: 'delivery_type',
    category: 'delivery',
    question: 'Qual o tipo de entrega do produto?',
    options: [
      { value: 'yes', label: 'Apenas pagamento' },
      { value: 'no', label: 'Email' },
      { value: 'na', label: 'Área de membros' },
    ],
    priority: 2,
  },
  
  // Email
  {
    id: 'email_sent',
    category: 'email',
    question: 'O email foi enviado? (verificar logs)',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    followUp: {
      onYes: 'Orientar cliente a verificar spam/lixo eletrônico',
      onNo: 'Verificar configuração de email do produto',
    },
    priority: 3,
  },
  {
    id: 'email_spam',
    category: 'email',
    question: 'Cliente verificou pasta de spam/lixo?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    followUp: {
      onNo: 'Solicitar que verifique spam antes de prosseguir',
    },
    priority: 4,
  },
  
  // Área de membros
  {
    id: 'member_product_active',
    category: 'member_area',
    question: 'O produto aparece como ativo para o usuário?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    followUp: {
      onNo: 'Verificar member_access no painel',
    },
    priority: 5,
  },
  {
    id: 'is_subscription',
    category: 'subscription',
    question: 'É um produto de assinatura?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    priority: 6,
  },
  {
    id: 'subscription_active',
    category: 'subscription',
    question: 'A assinatura está ativa?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
      { value: 'na', label: 'N/A' },
    ],
    followUp: {
      onNo: 'Verificar status da assinatura e pagamentos',
    },
    priority: 7,
  },
  
  // Logs
  {
    id: 'error_logged',
    category: 'logs',
    question: 'Existe mensagem de erro registrada no painel?',
    options: [
      { value: 'yes', label: 'Sim' },
      { value: 'no', label: 'Não' },
    ],
    followUp: {
      onYes: 'Verificar código do erro e seguir orientação técnica',
      onNo: 'Escalar para equipe técnica',
    },
    priority: 8,
  },
];

// =====================================================
// VALIDAÇÃO DE ASSINATURA
// =====================================================

export type SubscriptionStatus = 'pending' | 'active' | 'past_due' | 'canceled' | 'expired';

export const VALID_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active'];
export const BLOCKED_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['pending', 'canceled', 'expired'];

export function isSubscriptionValid(status: SubscriptionStatus): boolean {
  return VALID_SUBSCRIPTION_STATUSES.includes(status);
}

export function getSubscriptionErrorCode(status: SubscriptionStatus): ErrorCode | null {
  switch (status) {
    case 'pending':
      return 'MEMBER_SUBSCRIPTION_PENDING';
    case 'canceled':
      return 'SUBSCRIPTION_CANCELED';
    case 'expired':
      return 'SUBSCRIPTION_EXPIRED';
    default:
      return null;
  }
}

// Legacy support
export function getSubscriptionError(status: SubscriptionStatus): TechnicalLog | null {
  const code = getSubscriptionErrorCode(status);
  return code ? TECHNICAL_LOGS[code] : null;
}

// =====================================================
// TIPOS LEGADOS (COMPATIBILIDADE)
// =====================================================

export interface DeliveryError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  severity: 'info' | 'warning' | 'error';
  deliveryMethod?: DeliveryMethod;
}

// Manter compatibilidade com código existente
export const DELIVERY_ERRORS: Record<string, DeliveryError> = Object.fromEntries(
  Object.entries(TECHNICAL_LOGS).map(([code, log]) => [
    code,
    {
      code: code as ErrorCode,
      message: log.message,
      userMessage: getFrontendMessage(code as ErrorCode).description,
      severity: log.severity === 'critical' ? 'error' : log.severity,
      deliveryMethod: log.category === 'email' ? 'email' : 
                      log.category === 'member_area' ? 'member_area' : undefined,
    },
  ])
);

// =====================================================
// DEBUG CHECKLIST INTERFACE (COMPATIBILIDADE)
// =====================================================

export interface DeliveryDebugItem {
  id: string;
  category: 'payment' | 'product' | 'subscription' | 'email' | 'member_area' | 'logs';
  question: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  details?: string;
}

export interface DeliveryDebugResult {
  saleId?: string;
  subscriptionId?: string;
  productId: string;
  userEmail: string;
  deliveryMethod: DeliveryMethod | null;
  checklist: DeliveryDebugItem[];
  overallStatus: 'success' | 'partial' | 'failed';
  recommendations: string[];
}
