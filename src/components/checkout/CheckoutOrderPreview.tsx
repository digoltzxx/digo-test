import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Package,
  CreditCard,
  Smartphone,
  FileText,
  Shield,
  Truck,
  Tag,
  Receipt,
  AlertCircle,
  Clock,
  Users,
  RefreshCw,
  Check,
  Calendar,
  Info,
} from "lucide-react";

export interface OrderPreviewProduct {
  id: string;
  name: string;
  type: "digital" | "physical" | "subscription";
  price: number;
  quantity: number;
  image_url?: string | null;
  subscription_interval?: "monthly" | "yearly" | "weekly";
}

export interface OrderPreviewOrderBump {
  id: string;
  name: string;
  price: number;
  discount_price?: number;
  selected: boolean;
}

export interface OrderPreviewData {
  products: OrderPreviewProduct[];
  orderBumps?: OrderPreviewOrderBump[];
  subtotal: number;
  discount?: {
    code: string;
    type: "percentage" | "fixed";
    value: number;
    amount: number;
  };
  shipping?: {
    method: string;
    price: number;
    estimatedDays?: number;
  };
  taxes?: {
    name: string;
    rate: number;
    amount: number;
  }[];
  total: number;
  paymentMethod?: "pix" | "credit_card" | "boleto";
  installments?: number;
  buyer?: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  hasSubscription?: boolean;
  subscriptionInfo?: {
    interval: string;
    firstPaymentDate: string;
    nextPaymentDate: string;
  };
}

interface CheckoutOrderPreviewProps {
  data: OrderPreviewData;
  settings?: {
    primary_color?: string;
    theme_mode?: string;
    show_guarantee?: boolean;
    guarantee_days?: number;
    pix_enabled?: boolean;
    credit_card_enabled?: boolean;
    boleto_enabled?: boolean;
  };
  onPaymentMethodChange?: (method: "pix" | "credit_card" | "boleto") => void;
  onInstallmentsChange?: (installments: number) => void;
  onConfirm?: () => void;
  isLoading?: boolean;
  className?: string;
}

const CheckoutOrderPreview = ({
  data,
  settings = {},
  onPaymentMethodChange,
  onInstallmentsChange,
  onConfirm,
  isLoading = false,
  className,
}: CheckoutOrderPreviewProps) => {
  const {
    primary_color = "#3b82f6",
    theme_mode = "dark",
    show_guarantee = true,
    guarantee_days = 7,
    pix_enabled = true,
    credit_card_enabled = true,
    boleto_enabled = false,
  } = settings;

  const isDark = theme_mode === "dark";
  const bgCard = isDark ? "bg-[#0d1117]" : "bg-white";
  const borderColor = isDark ? "border-gray-800" : "border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-400";

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case "digital":
        return { label: "Digital", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "physical":
        return { label: "Físico", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
      case "subscription":
        return { label: "Assinatura", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      default:
        return { label: type, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "pix":
        return <Smartphone className="w-4 h-4" />;
      case "credit_card":
        return <CreditCard className="w-4 h-4" />;
      case "boleto":
        return <FileText className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const hasPhysicalProduct = data.products.some((p) => p.type === "physical");
  const hasSubscription = data.products.some((p) => p.type === "subscription");

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${primary_color}15` }}
        >
          <Receipt className="w-5 h-5" style={{ color: primary_color }} />
        </div>
        <div>
          <h2 className={cn("text-lg font-semibold", textPrimary)}>
            Resumo do Pedido
          </h2>
          <p className={cn("text-xs", textMuted)}>
            Revise os detalhes antes de finalizar
          </p>
        </div>
      </div>

      {/* Products Section */}
      <div className={cn("rounded-xl border p-4", bgCard, borderColor)}>
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4" style={{ color: primary_color }} />
          <h3 className={cn("text-sm font-medium", textPrimary)}>Produtos</h3>
        </div>

        <div className="space-y-3">
          {data.products.map((product, idx) => {
            const typeInfo = getProductTypeLabel(product.type);
            return (
              <div
                key={product.id || idx}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  isDark ? "bg-gray-800/30 border-gray-700/50" : "bg-gray-50 border-gray-200"
                )}
              >
                {/* Product Image */}
                <div
                  className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                  style={{
                    background: product.image_url
                      ? `url(${product.image_url}) center/cover`
                      : `linear-gradient(135deg, ${primary_color}20, ${primary_color}05)`,
                  }}
                >
                  {!product.image_url && (
                    <Package className="w-5 h-5" style={{ color: primary_color }} />
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={cn("text-sm font-medium truncate", textPrimary)}>
                        {product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                            typeInfo.color
                          )}
                        >
                          {typeInfo.label}
                        </span>
                        {product.quantity > 1 && (
                          <span className={cn("text-xs", textMuted)}>
                            x{product.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-sm font-semibold"
                        style={{ color: primary_color }}
                      >
                        {formatCurrency(product.price * product.quantity)}
                      </p>
                      {product.quantity > 1 && (
                        <p className={cn("text-[10px]", textMuted)}>
                          {formatCurrency(product.price)} un.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Subscription Info */}
                  {product.type === "subscription" && (
                    <div
                      className={cn(
                        "mt-2 p-2 rounded-md text-xs",
                        isDark ? "bg-purple-500/10" : "bg-purple-50"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-purple-400">
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          Cobrança{" "}
                          {product.subscription_interval === "monthly"
                            ? "mensal"
                            : product.subscription_interval === "yearly"
                            ? "anual"
                            : "semanal"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Bumps */}
        {data.orderBumps && data.orderBumps.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-700/50">
            <p className={cn("text-xs font-medium mb-2", textSecondary)}>
              Ofertas adicionais selecionadas:
            </p>
            {data.orderBumps
              .filter((bump) => bump.selected)
              .map((bump) => (
                <div
                  key={bump.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-green-500" />
                    <span className={cn("text-xs", textPrimary)}>{bump.name}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: primary_color }}>
                    {formatCurrency(bump.discount_price || bump.price)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Payment Method Selection */}
      <div className={cn("rounded-xl border p-4", bgCard, borderColor)}>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4" style={{ color: primary_color }} />
          <h3 className={cn("text-sm font-medium", textPrimary)}>
            Método de Pagamento
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {pix_enabled && (
            <button
              onClick={() => onPaymentMethodChange?.("pix")}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                data.paymentMethod === "pix"
                  ? "border-green-500 bg-green-500/10"
                  : isDark
                  ? "border-gray-700 hover:border-gray-600"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <Smartphone
                className={cn(
                  "w-5 h-5",
                  data.paymentMethod === "pix" ? "text-green-500" : textSecondary
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  data.paymentMethod === "pix" ? "text-green-500" : textSecondary
                )}
              >
                PIX
              </span>
            </button>
          )}

          {credit_card_enabled && (
            <button
              onClick={() => onPaymentMethodChange?.("credit_card")}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                data.paymentMethod === "credit_card"
                  ? "border-blue-500 bg-blue-500/10"
                  : isDark
                  ? "border-gray-700 hover:border-gray-600"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <CreditCard
                className={cn(
                  "w-5 h-5",
                  data.paymentMethod === "credit_card" ? "text-blue-500" : textSecondary
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  data.paymentMethod === "credit_card" ? "text-blue-500" : textSecondary
                )}
              >
                Cartão
              </span>
            </button>
          )}

          {boleto_enabled && (
            <button
              onClick={() => onPaymentMethodChange?.("boleto")}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                data.paymentMethod === "boleto"
                  ? "border-orange-500 bg-orange-500/10"
                  : isDark
                  ? "border-gray-700 hover:border-gray-600"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <FileText
                className={cn(
                  "w-5 h-5",
                  data.paymentMethod === "boleto" ? "text-orange-500" : textSecondary
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  data.paymentMethod === "boleto" ? "text-orange-500" : textSecondary
                )}
              >
                Boleto
              </span>
            </button>
          )}
        </div>

        {/* Installments for credit card */}
        {data.paymentMethod === "credit_card" && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <label className={cn("text-xs", textMuted)}>Parcelas:</label>
            <select
              value={data.installments || 1}
              onChange={(e) => onInstallmentsChange?.(parseInt(e.target.value))}
              className={cn(
                "w-full mt-1 px-3 py-2 rounded-lg border text-sm",
                isDark
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              )}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>
                  {n}x de {formatCurrency(data.total / n)}
                  {n === 1 ? " (à vista)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Shipping (for physical products) */}
      {hasPhysicalProduct && data.shipping && (
        <div className={cn("rounded-xl border p-4", bgCard, borderColor)}>
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4" style={{ color: primary_color }} />
            <h3 className={cn("text-sm font-medium", textPrimary)}>Entrega</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className={cn("text-sm", textPrimary)}>{data.shipping.method}</p>
              {data.shipping.estimatedDays && (
                <p className={cn("text-xs", textMuted)}>
                  Entrega em até {data.shipping.estimatedDays} dias úteis
                </p>
              )}
            </div>
            <p className="text-sm font-medium" style={{ color: primary_color }}>
              {data.shipping.price === 0
                ? "Grátis"
                : formatCurrency(data.shipping.price)}
            </p>
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className={cn("rounded-xl border p-4", bgCard, borderColor)}>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4" style={{ color: primary_color }} />
          <h3 className={cn("text-sm font-medium", textPrimary)}>Resumo</h3>
        </div>

        <div className="space-y-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between">
            <span className={cn("text-sm", textSecondary)}>Subtotal</span>
            <span className={cn("text-sm", textPrimary)}>
              {formatCurrency(data.subtotal)}
            </span>
          </div>

          {/* Discount */}
          {data.discount && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-green-500" />
                <span className="text-sm text-green-500">
                  Cupom: {data.discount.code}
                </span>
              </div>
              <span className="text-sm text-green-500">
                -{formatCurrency(data.discount.amount)}
              </span>
            </div>
          )}

          {/* Taxes */}
          {data.taxes && data.taxes.length > 0 && (
            <>
              {data.taxes.map((tax, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className={cn("text-sm", textSecondary)}>
                    {tax.name} ({tax.rate}%)
                  </span>
                  <span className={cn("text-sm", textPrimary)}>
                    {formatCurrency(tax.amount)}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Shipping */}
          {data.shipping && (
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", textSecondary)}>Frete</span>
              <span className={cn("text-sm", textPrimary)}>
                {data.shipping.price === 0
                  ? "Grátis"
                  : formatCurrency(data.shipping.price)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-700/50 my-2" />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className={cn("text-base font-semibold", textPrimary)}>
              Total
            </span>
            <span
              className="text-xl font-bold"
              style={{ color: primary_color }}
            >
              {formatCurrency(data.total)}
            </span>
          </div>

          {/* Installment info */}
          {data.paymentMethod === "credit_card" && data.installments && data.installments > 1 && (
            <p className={cn("text-xs text-center", textMuted)}>
              ou {data.installments}x de {formatCurrency(data.total / data.installments)}
            </p>
          )}
        </div>
      </div>

      {/* Subscription Warning */}
      {hasSubscription && (
        <div
          className={cn(
            "rounded-xl border p-4",
            isDark ? "bg-purple-500/10 border-purple-500/30" : "bg-purple-50 border-purple-200"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className={cn("text-sm font-medium", textPrimary)}>
                Produto com assinatura
              </h4>
              <ul className={cn("text-xs mt-1 space-y-1", textSecondary)}>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-green-500" />
                  Acesso à Área de Membros após pagamento aprovado
                </li>
                <li className="flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 text-purple-400" />
                  Cobrança automática no próximo ciclo
                </li>
                <li className="flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-blue-400" />
                  Cancele a qualquer momento sem multa
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Guarantee */}
      {show_guarantee && (
        <div className="flex items-center justify-center gap-2 py-2">
          <Shield className="w-4 h-4" style={{ color: primary_color }} />
          <span className={cn("text-xs", textSecondary)}>
            Garantia de {guarantee_days} dias ou seu dinheiro de volta
          </span>
        </div>
      )}

      {/* Confirm Button */}
      {onConfirm && (
        <button
          onClick={onConfirm}
          disabled={isLoading || !data.paymentMethod}
          className={cn(
            "w-full py-4 rounded-xl font-semibold text-white transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
          style={{
            backgroundColor: primary_color,
            boxShadow: `0 4px 20px ${primary_color}40`,
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Finalizar Compra
            </>
          )}
        </button>
      )}

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-green-500" />
          <span className={cn("text-[10px]", textMuted)}>Pagamento seguro</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-blue-400" />
          <span className={cn("text-[10px]", textMuted)}>Acesso imediato</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3 h-3 text-purple-400" />
          <span className={cn("text-[10px]", textMuted)}>Suporte 24h</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutOrderPreview;
