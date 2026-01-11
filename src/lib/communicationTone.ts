// =====================================================
// SISTEMA DE TOM DE COMUNICAÇÃO
// Permite alternar entre tom informal e corporativo
// =====================================================

export type CommunicationTone = 'informal' | 'corporate';

export interface ToneConfig {
  tone: CommunicationTone;
  label: string;
  description: string;
}

export const TONE_OPTIONS: ToneConfig[] = [
  {
    tone: 'informal',
    label: 'Informal',
    description: 'Linguagem próxima e amigável, ideal para infoprodutos e criadores de conteúdo',
  },
  {
    tone: 'corporate',
    label: 'Corporativo',
    description: 'Linguagem profissional e objetiva, ideal para empresas e B2B',
  },
];

// =====================================================
// MENSAGENS OTIMIZADAS PARA CONVERSÃO
// Cada mensagem tem versão informal e corporativa
// =====================================================

export interface TonedMessage {
  informal: string;
  corporate: string;
}

export interface ConversionMessage {
  title: TonedMessage;
  description: TonedMessage;
  action?: string;
}

export const CONVERSION_MESSAGES = {
  // =====================================================
  // PAGAMENTO
  // =====================================================
  PAYMENT_RECEIVED: {
    title: {
      informal: 'Pagamento recebido! 🎉',
      corporate: 'Pagamento confirmado',
    },
    description: {
      informal: 'Já recebemos seu pagamento 😊 Estamos liberando seu acesso agora.',
      corporate: 'Seu pagamento foi confirmado. O acesso ao produto será liberado em instantes.',
    },
  },
  PAYMENT_PROCESSING: {
    title: {
      informal: 'Quase lá!',
      corporate: 'Processando pagamento',
    },
    description: {
      informal: 'Recebemos seu pagamento e estamos finalizando a liberação do acesso. Isso pode levar alguns instantes.',
      corporate: 'O pagamento está sendo processado. A liberação do acesso será concluída em breve.',
    },
  },
  PAYMENT_PENDING: {
    title: {
      informal: 'Aguardando pagamento',
      corporate: 'Pagamento pendente',
    },
    description: {
      informal: 'Seu pagamento está sendo processado. Para PIX, é rapidinho! Para boleto, pode levar até 3 dias úteis.',
      corporate: 'O pagamento está em processamento. Pagamentos via PIX são confirmados em segundos. Boletos podem levar até 3 dias úteis.',
    },
  },
  PAYMENT_FAILED: {
    title: {
      informal: 'Ops! Algo deu errado',
      corporate: 'Pagamento não aprovado',
    },
    description: {
      informal: 'Não conseguimos aprovar o pagamento. Pode ser limite ou dados incorretos. Tente novamente ou use outro método!',
      corporate: 'O pagamento não foi aprovado. Verifique os dados informados ou tente outro método de pagamento.',
    },
  },

  // =====================================================
  // ENTREGA
  // =====================================================
  DELIVERY_PROCESSING: {
    title: {
      informal: 'Preparando seu acesso! 🚀',
      corporate: 'Preparando acesso',
    },
    description: {
      informal: 'Seu pagamento foi aprovado. Estamos preparando seu acesso agora mesmo.',
      corporate: 'O pagamento foi confirmado. O acesso está sendo preparado e será liberado em instantes.',
    },
  },
  DELIVERY_COMPLETED: {
    title: {
      informal: 'Tudo pronto! 🎊',
      corporate: 'Entrega concluída',
    },
    description: {
      informal: 'Seu conteúdo já está disponível! Aproveite 😄',
      corporate: 'O acesso ao conteúdo foi liberado com sucesso.',
    },
  },
  DELIVERY_FAILED: {
    title: {
      informal: 'Estamos resolvendo',
      corporate: 'Processamento em andamento',
    },
    description: {
      informal: 'Tivemos um probleminha, mas já estamos cuidando disso. Em breve seu acesso estará liberado!',
      corporate: 'Houve uma intercorrência no processamento. Nossa equipe foi notificada e o acesso será liberado em breve.',
    },
  },

  // =====================================================
  // EMAIL
  // =====================================================
  EMAIL_SENT: {
    title: {
      informal: 'Email enviado! 📧',
      corporate: 'Email enviado',
    },
    description: {
      informal: 'Enviamos o conteúdo para seu email. Caso não encontre, dá uma olhada na caixa de spam!',
      corporate: 'O conteúdo foi enviado para seu email. Caso não localize, verifique a caixa de spam.',
    },
  },
  EMAIL_SENDING: {
    title: {
      informal: 'Enviando email...',
      corporate: 'Enviando email',
    },
    description: {
      informal: 'Estamos enviando o conteúdo para seu email. Chega em alguns instantes!',
      corporate: 'O email com o conteúdo está sendo enviado. Chegará em instantes.',
    },
  },
  EMAIL_FAILED: {
    title: {
      informal: 'Email não enviado',
      corporate: 'Falha no envio',
    },
    description: {
      informal: 'Não conseguimos enviar o email agora, mas vamos tentar novamente. Se não receber, fale com o suporte.',
      corporate: 'Houve uma falha no envio do email. Uma nova tentativa será realizada. Caso não receba, contate o suporte.',
    },
  },

  // =====================================================
  // ÁREA DE MEMBROS
  // =====================================================
  MEMBERS_ACCESS_GRANTED: {
    title: {
      informal: 'Acesso liberado! 🔓',
      corporate: 'Acesso concedido',
    },
    description: {
      informal: 'Seu acesso à área de membros está liberado. Aproveite todo o conteúdo!',
      corporate: 'O acesso à área de membros foi liberado com sucesso.',
    },
  },
  MEMBERS_ACCESS_PENDING: {
    title: {
      informal: 'Liberando acesso...',
      corporate: 'Liberação em andamento',
    },
    description: {
      informal: 'Seu acesso está sendo liberado. Em poucos instantes você poderá acessar todo o conteúdo.',
      corporate: 'O acesso à área de membros está sendo processado e será liberado em instantes.',
    },
  },
  MEMBERS_ACCESS_FAILED: {
    title: {
      informal: 'Opa, estamos ajustando',
      corporate: 'Acesso em processamento',
    },
    description: {
      informal: 'Tivemos um probleminha com seu acesso, mas já estamos resolvendo. Não se preocupe!',
      corporate: 'Houve uma intercorrência na liberação do acesso. Nossa equipe está atuando na resolução.',
    },
  },

  // =====================================================
  // ASSINATURA
  // =====================================================
  SUBSCRIPTION_ACTIVATING: {
    title: {
      informal: 'Ativando assinatura...',
      corporate: 'Ativando assinatura',
    },
    description: {
      informal: 'Sua assinatura está sendo ativada. Assim que finalizar, o acesso será liberado automaticamente.',
      corporate: 'A assinatura está sendo ativada. O acesso será liberado assim que o processo for concluído.',
    },
  },
  SUBSCRIPTION_ACTIVE: {
    title: {
      informal: 'Assinatura ativa! ✨',
      corporate: 'Assinatura ativa',
    },
    description: {
      informal: 'Sua assinatura está ativa e você tem acesso a todo o conteúdo. Aproveite!',
      corporate: 'Sua assinatura está ativa. Você possui acesso completo ao conteúdo.',
    },
  },
  SUBSCRIPTION_EXPIRED: {
    title: {
      informal: 'Assinatura expirada',
      corporate: 'Assinatura expirada',
    },
    description: {
      informal: 'Sua assinatura expirou. Renove agora para continuar acessando todo o conteúdo!',
      corporate: 'Sua assinatura expirou. Renove para recuperar o acesso ao conteúdo.',
    },
    action: 'Renovar assinatura',
  },
  SUBSCRIPTION_CANCELED: {
    title: {
      informal: 'Assinatura cancelada',
      corporate: 'Assinatura cancelada',
    },
    description: {
      informal: 'Você ainda tem acesso até o fim do período pago. Sentiremos sua falta!',
      corporate: 'A assinatura foi cancelada. O acesso permanece disponível até o término do período vigente.',
    },
    action: 'Reativar assinatura',
  },

  // =====================================================
  // SUCESSO GERAL
  // =====================================================
  SUCCESS_GENERAL: {
    title: {
      informal: 'Sucesso! 🎉',
      corporate: 'Operação concluída',
    },
    description: {
      informal: 'Tudo certo por aqui!',
      corporate: 'A operação foi concluída com sucesso.',
    },
  },

  // =====================================================
  // ERRO GERAL
  // =====================================================
  ERROR_GENERAL: {
    title: {
      informal: 'Algo deu errado',
      corporate: 'Erro no processamento',
    },
    description: {
      informal: 'Encontramos um probleminha, mas estamos cuidando disso. Tente novamente em alguns minutos.',
      corporate: 'Ocorreu um erro no processamento. Por favor, tente novamente em alguns instantes.',
    },
  },
} as const;

export type ConversionMessageKey = keyof typeof CONVERSION_MESSAGES;

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

/**
 * Obtém mensagem no tom especificado
 */
export function getMessage(
  key: ConversionMessageKey,
  tone: CommunicationTone = 'corporate'
): { title: string; description: string; action?: string } {
  const msg = CONVERSION_MESSAGES[key];
  return {
    title: msg.title[tone],
    description: msg.description[tone],
    action: 'action' in msg ? msg.action : undefined,
  };
}

/**
 * Obtém apenas o título no tom especificado
 */
export function getTitle(key: ConversionMessageKey, tone: CommunicationTone = 'corporate'): string {
  return CONVERSION_MESSAGES[key].title[tone];
}

/**
 * Obtém apenas a descrição no tom especificado
 */
export function getDescription(key: ConversionMessageKey, tone: CommunicationTone = 'corporate'): string {
  return CONVERSION_MESSAGES[key].description[tone];
}

/**
 * Retorna o tom padrão do sistema (pode ser lido de configuração)
 */
export function getDefaultTone(): CommunicationTone {
  // Pode ser expandido para ler de localStorage, context, ou API
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('communication_tone');
    if (stored === 'informal' || stored === 'corporate') {
      return stored;
    }
  }
  return 'corporate';
}

/**
 * Salva o tom padrão do sistema
 */
export function setDefaultTone(tone: CommunicationTone): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('communication_tone', tone);
  }
}
