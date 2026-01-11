import { CreditCard, QrCode, FileBarChart, HelpCircle } from "lucide-react";
import { ReactNode } from "react";

// Valores internos padronizados (enum-like)
export type PaymentMethodKey = 
  | "pix" 
  | "credit_card" 
  | "boleto";

interface PaymentMethodInfo {
  key: PaymentMethodKey;
  label: string;
  fullLabel: string;
  icon: ReactNode;
  emoji: string;
  color: string;
}

// Configuração centralizada de todas as formas de pagamento
export const PAYMENT_METHODS: Record<PaymentMethodKey, PaymentMethodInfo> = {
  pix: {
    key: "pix",
    label: "PIX",
    fullLabel: "PIX - Pagamento Instantâneo",
    icon: <QrCode className="w-4 h-4" />,
    emoji: "◉",
    color: "text-green-500",
  },
  credit_card: {
    key: "credit_card",
    label: "Cartão de Crédito",
    fullLabel: "Cartão de Crédito",
    icon: <CreditCard className="w-4 h-4" />,
    emoji: "💳",
    color: "text-blue-500",
  },
  boleto: {
    key: "boleto",
    label: "Boleto",
    fullLabel: "Boleto Bancário",
    icon: <FileBarChart className="w-4 h-4" />,
    emoji: "📄",
    color: "text-orange-500",
  },
};

// Fallback para métodos desconhecidos
const UNKNOWN_METHOD: PaymentMethodInfo = {
  key: "pix", // fallback
  label: "Desconhecido",
  fullLabel: "Método Desconhecido",
  icon: <HelpCircle className="w-4 h-4" />,
  emoji: "❓",
  color: "text-muted-foreground",
};

/**
 * Obtém as informações de uma forma de pagamento
 * @param method - Chave do método de pagamento
 * @returns Informações completas do método
 */
export function getPaymentMethod(method: string): PaymentMethodInfo {
  return PAYMENT_METHODS[method as PaymentMethodKey] || UNKNOWN_METHOD;
}

/**
 * Componente para exibir badge da forma de pagamento com ícone
 */
interface PaymentMethodBadgeProps {
  method: string;
  showFullLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

export function PaymentMethodBadge({ 
  method, 
  showFullLabel = false, 
  showIcon = true,
  className = "" 
}: PaymentMethodBadgeProps) {
  const info = getPaymentMethod(method);
  
  return (
    <span className={`inline-flex items-center gap-1.5 ${info.color} ${className}`}>
      {showIcon && info.icon}
      <span className="text-sm font-medium">
        {showFullLabel ? info.fullLabel : info.label}
      </span>
    </span>
  );
}

/**
 * Componente simples com emoji (para tabelas compactas)
 */
export function PaymentMethodSimple({ method }: { method: string }) {
  const info = getPaymentMethod(method);
  
  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <span className={info.color}>{info.emoji}</span>
      {info.label}
    </span>
  );
}

// Lista de todos os métodos para select/filtros
export const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHODS).map(m => ({
  value: m.key,
  label: m.label,
  emoji: m.emoji,
}));
