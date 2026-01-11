import { toast } from 'sonner';
import { getMessage, getFullMessage, InternalErrorCode } from '@/lib/deliveryMessages';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface DeliveryToastOptions {
  type?: ToastType;
  duration?: number;
  useHumanTone?: boolean;
}

// Map error codes to toast types
const errorCodeToType: Record<string, ToastType> = {
  // Info
  PAYMENT_PENDING: 'info',
  SUBSCRIPTION_PENDING: 'info',
  DELIVERY_SKIPPED: 'info',
  
  // Warnings
  PAYMENT_EXPIRED: 'warning',
  EMAIL_TEMPLATE_MISSING: 'warning',
  SUBSCRIPTION_CANCELED: 'warning',
  
  // Errors
  PAYMENT_FAILED: 'error',
  PAYMENT_NOT_CONFIRMED: 'error',
  EMAIL_SEND_FAILED: 'error',
  EMAIL_CONFIG_MISSING: 'error',
  EMAIL_SERVICE_DOWN: 'error',
  DELIVERY_FAILED: 'error',
  DELIVERY_CONFIG_MISSING: 'error',
  MEMBERS_ACCESS_NOT_GRANTED: 'error',
  MEMBERS_AREA_NOT_LINKED: 'error',
  SUBSCRIPTION_NOT_ACTIVE: 'error',
  SUBSCRIPTION_EXPIRED: 'error',
  PRODUCT_NOT_FOUND: 'error',
  INTERNAL_ERROR: 'error',
  UNKNOWN_ERROR: 'error',
};

const getToastIcon = (type: ToastType): ReactNode => {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'info':
    default:
      return <Info className="h-5 w-5 text-blue-500" />;
  }
};

/**
 * Exibe toast com mensagem amigável baseada no código de erro
 * NUNCA exibe o código interno ao usuário
 */
export function showDeliveryToast(
  errorCode: InternalErrorCode | string,
  options?: DeliveryToastOptions
) {
  const fullMessage = getFullMessage(errorCode as InternalErrorCode);
  const type = options?.type || errorCodeToType[errorCode] || 'info';
  const duration = options?.duration || 5000;
  const message = options?.useHumanTone ? fullMessage.human : fullMessage.short;

  toast(message, {
    duration,
    icon: getToastIcon(type),
  });
}

/**
 * Exibe toast de sucesso para entrega realizada
 */
export function showDeliverySuccess(productName: string, deliveryType: 'email' | 'member_area' | 'payment') {
  const messages = {
    email: {
      short: 'Email enviado!',
      human: `O conteúdo de "${productName}" foi enviado para o seu email.`,
    },
    member_area: {
      short: 'Acesso liberado!',
      human: `Seu acesso a "${productName}" foi liberado na área de membros.`,
    },
    payment: {
      short: 'Pagamento confirmado!',
      human: `Sua compra de "${productName}" foi confirmada com sucesso.`,
    },
  };

  const msg = messages[deliveryType];
  
  toast.success(msg.short, {
    description: msg.human,
    duration: 5000,
    icon: getToastIcon('success'),
  });
}

/**
 * Exibe toast de erro para falha de entrega (mensagem humana)
 */
export function showDeliveryError(productName: string, deliveryType: 'email' | 'member_area') {
  const messages = {
    email: {
      short: 'Email não enviado.',
      human: `O email de "${productName}" não pôde ser enviado. Nossa equipe foi notificada.`,
      action: 'Verifique sua caixa de spam ou contate o suporte.',
    },
    member_area: {
      short: 'Acesso não liberado.',
      human: `Houve um problema ao liberar seu acesso a "${productName}".`,
      action: 'Entre em contato com o suporte.',
    },
  };

  const msg = messages[deliveryType];
  
  toast.error(msg.short, {
    description: msg.human,
    duration: 8000,
    icon: getToastIcon('error'),
  });
}

/**
 * Exibe toast de pagamento pendente
 */
export function showPaymentPending() {
  toast.info('Pagamento em processamento.', {
    description: 'Assim que for confirmado, a entrega será liberada automaticamente.',
    duration: 6000,
    icon: getToastIcon('info'),
  });
}

/**
 * Exibe toast de status de assinatura
 */
export function showSubscriptionStatus(status: 'pending' | 'inactive' | 'expired') {
  const messages = {
    pending: {
      short: 'Assinatura pendente.',
      human: 'Sua assinatura está sendo ativada. Isso deve levar apenas alguns segundos.',
      type: 'info' as ToastType,
    },
    inactive: {
      short: 'Assinatura inativa.',
      human: 'Sua assinatura não está ativa. Renove para recuperar o acesso.',
      type: 'warning' as ToastType,
    },
    expired: {
      short: 'Assinatura expirada.',
      human: 'Sua assinatura expirou. Renove para continuar acessando o conteúdo.',
      type: 'error' as ToastType,
    },
  };

  const msg = messages[status];
  
  toast[msg.type === 'error' ? 'error' : msg.type === 'warning' ? 'warning' : 'info'](msg.short, {
    description: msg.human,
    duration: 6000,
    icon: getToastIcon(msg.type),
  });
}

/**
 * Exibe toast genérico de erro (sem expor detalhes técnicos)
 */
export function showGenericError() {
  toast.error('Algo deu errado.', {
    description: 'Algo não saiu como esperado. Se o problema persistir, entre em contato com nosso suporte.',
    duration: 6000,
    icon: getToastIcon('error'),
  });
}
