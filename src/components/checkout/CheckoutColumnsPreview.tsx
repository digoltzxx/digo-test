import { useState } from "react";
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
  User,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Check,
  Calendar,
  Info,
  AlertTriangle,
  Lock,
  Clock,
  Wallet,
  ChevronRight,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ColumnPreviewProduct {
  id: string;
  name: string;
  type: "digital" | "physical" | "subscription";
  price: number;
  quantity: number;
  image_url?: string | null;
  subscription_interval?: "monthly" | "yearly" | "weekly" | "quarterly";
}

export interface ColumnPreviewData {
  products: ColumnPreviewProduct[];
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
  paymentMethod?: "pix" | "credit_card" | "boleto" | "wallet";
  installments?: number;
  buyer: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
    address?: {
      street: string;
      number: string;
      city: string;
      state: string;
      zipCode: string;
    };
  };
  subscription?: {
    plan: string;
    interval: string;
    startDate: string;
    nextPaymentDate: string;
  };
}

interface CheckoutColumnsPreviewProps {
  data: ColumnPreviewData;
  settings?: {
    primary_color?: string;
    pix_enabled?: boolean;
    credit_card_enabled?: boolean;
    boleto_enabled?: boolean;
    show_guarantee?: boolean;
    guarantee_days?: number;
    max_installments?: number;
  };
  onPaymentMethodChange?: (method: "pix" | "credit_card" | "boleto" | "wallet") => void;
  onInstallmentsChange?: (installments: number) => void;
  onConfirm?: () => void;
  isLoading?: boolean;
}

const CheckoutColumnsPreview = ({
  data,
  settings = {},
  onPaymentMethodChange,
  onInstallmentsChange,
  onConfirm,
  isLoading = false,
}: CheckoutColumnsPreviewProps) => {
  const {
    primary_color = "#3b82f6",
    pix_enabled = true,
    credit_card_enabled = true,
    boleto_enabled = false,
    show_guarantee = true,
    guarantee_days = 7,
    max_installments = 12,
  } = settings;

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case "digital": return { label: "Digital", icon: Package, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
      case "physical": return { label: "Físico", icon: Truck, color: "text-orange-400 bg-orange-500/10 border-orange-500/20" };
      case "subscription": return { label: "Assinatura", icon: RefreshCw, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" };
      default: return { label: type, icon: Package, color: "text-gray-400 bg-gray-500/10 border-gray-500/20" };
    }
  };

  const hasPhysicalProduct = data.products.some((p) => p.type === "physical");
  const hasSubscription = data.products.some((p) => p.type === "subscription");

  // Column Card Component
  const ColumnCard = ({ 
    icon: Icon, 
    title, 
    children, 
    badge 
  }: { 
    icon: any; 
    title: string; 
    children: React.ReactNode; 
    badge?: React.ReactNode 
  }) => (
    <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between bg-gradient-to-r from-blue-600/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primary_color}15` }}>
            <Icon className="w-4 h-4" style={{ color: primary_color }} />
          </div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-800">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary_color}20` }}>
          <Receipt className="w-5 h-5" style={{ color: primary_color }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Pré-visualização do Checkout</h2>
          <p className="text-xs text-gray-500">Revise todos os detalhes antes de finalizar</p>
        </div>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Column 1: Products */}
        <ColumnCard 
          icon={Package} 
          title="Produtos"
          badge={<span className="text-[10px] text-gray-500">{data.products.length} item(s)</span>}
        >
          <div className="space-y-3">
            {data.products.map((product, idx) => {
              const typeInfo = getProductTypeLabel(product.type);
              const TypeIcon = typeInfo.icon;
              return (
                <div key={product.id || idx} className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        background: product.image_url
                          ? `url(${product.image_url}) center/cover`
                          : `linear-gradient(135deg, ${primary_color}20, ${primary_color}05)`,
                      }}
                    >
                      {!product.image_url && <Package className="w-5 h-5" style={{ color: primary_color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{product.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border", typeInfo.color)}>
                          <TypeIcon className="w-3 h-3" />
                          {typeInfo.label}
                        </span>
                        {product.quantity > 1 && (
                          <span className="text-xs text-gray-500">x{product.quantity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
                    <span className="text-xs text-gray-500">Preço unitário</span>
                    <span className="text-sm font-semibold" style={{ color: primary_color }}>
                      {formatCurrency(product.price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Subtotal</span>
                    <span className="text-sm font-bold text-white">
                      {formatCurrency(product.price * product.quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ColumnCard>

        {/* Column 2: Values & Totals */}
        <ColumnCard icon={Receipt} title="Valores e Totais">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Subtotal</span>
              <span className="text-sm text-white">{formatCurrency(data.subtotal)}</span>
            </div>

            {data.taxes && data.taxes.length > 0 && (
              <div className="border-t border-gray-800 pt-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Impostos</p>
                {data.taxes.map((tax, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-400">{tax.name} ({tax.rate}%)</span>
                    <span className="text-xs text-white">{formatCurrency(tax.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {hasPhysicalProduct && data.shipping && (
              <div className="flex items-center justify-between py-2 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-400">Frete</span>
                    <p className="text-[10px] text-gray-500">{data.shipping.method}</p>
                  </div>
                </div>
                <span className="text-sm text-white">
                  {data.shipping.price === 0 ? "Grátis" : formatCurrency(data.shipping.price)}
                </span>
              </div>
            )}

            {data.discount && (
              <div className="flex items-center justify-between py-2 bg-green-500/10 rounded-lg px-3 -mx-1">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-400">Cupom: {data.discount.code}</span>
                </div>
                <span className="text-sm font-medium text-green-400">
                  -{formatCurrency(data.discount.amount)}
                </span>
              </div>
            )}

            <div className="border-t border-gray-700 pt-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-white">Total</span>
                <span className="text-xl font-bold" style={{ color: primary_color }}>
                  {formatCurrency(data.total)}
                </span>
              </div>
            </div>
          </div>
        </ColumnCard>

        {/* Column 3: Subscription / Member Area */}
        {hasSubscription && (
          <ColumnCard 
            icon={RefreshCw} 
            title="Assinatura / Área de Membros"
            badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">Recorrente</span>}
          >
            <div className="space-y-3">
              {data.subscription && (
                <>
                  <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-purple-300">Plano {data.subscription.plan}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Início</span>
                        <p className="text-white font-medium">{data.subscription.startDate}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Próximo pagamento</span>
                        <p className="text-white font-medium">{data.subscription.nextPaymentDate}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-300">
                        O acesso à <strong>Área de Membros</strong> será liberado automaticamente após a confirmação do pagamento.
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-300">
                        <p className="font-medium mb-1">Importante:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
                          <li>Cancelamento suspende acesso imediatamente</li>
                          <li>Inadimplência revoga acesso à área de membros</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ColumnCard>
        )}

        {/* Column 4: Buyer Data */}
        <ColumnCard 
          icon={User} 
          title="Dados do Comprador"
          badge={
            <button className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
              <Edit3 className="w-3 h-3" />
              Editar
            </button>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{data.buyer.name}</p>
                <p className="text-[10px] text-gray-500">Nome completo</p>
              </div>
            </div>

            <div className="flex items-center gap-3 py-2 border-t border-gray-800">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <Mail className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-white">{data.buyer.email}</p>
                <p className="text-[10px] text-gray-500">E-mail</p>
              </div>
            </div>

            {data.buyer.phone && (
              <div className="flex items-center gap-3 py-2 border-t border-gray-800">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-white">{data.buyer.phone}</p>
                  <p className="text-[10px] text-gray-500">Telefone</p>
                </div>
              </div>
            )}

            {data.buyer.document && (
              <div className="flex items-center gap-3 py-2 border-t border-gray-800">
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-white">{data.buyer.document}</p>
                  <p className="text-[10px] text-gray-500">CPF/CNPJ</p>
                </div>
              </div>
            )}

            {hasPhysicalProduct && data.buyer.address && (
              <div className="pt-2 border-t border-gray-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">
                      {data.buyer.address.street}, {data.buyer.address.number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {data.buyer.address.city} - {data.buyer.address.state}
                    </p>
                    <p className="text-xs text-gray-500">{data.buyer.address.zipCode}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Endereço de entrega</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ColumnCard>

        {/* Column 5: Payment Methods */}
        <ColumnCard icon={CreditCard} title="Pagamentos Aceitos">
          <div className="space-y-2">
            {pix_enabled && (
              <button
                onClick={() => onPaymentMethodChange?.("pix")}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                  data.paymentMethod === "pix"
                    ? "border-green-500 bg-green-500/10"
                    : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  data.paymentMethod === "pix" ? "bg-green-500/20" : "bg-gray-800"
                )}>
                  <Smartphone className={cn("w-5 h-5", data.paymentMethod === "pix" ? "text-green-500" : "text-gray-400")} />
                </div>
                <div className="flex-1 text-left">
                  <p className={cn("text-sm font-medium", data.paymentMethod === "pix" ? "text-green-400" : "text-white")}>
                    PIX
                  </p>
                  <p className="text-[10px] text-gray-500">Aprovação instantânea</p>
                </div>
                {data.paymentMethod === "pix" && <Check className="w-5 h-5 text-green-500" />}
              </button>
            )}

            {credit_card_enabled && (
              <button
                onClick={() => onPaymentMethodChange?.("credit_card")}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                  data.paymentMethod === "credit_card"
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  data.paymentMethod === "credit_card" ? "bg-blue-500/20" : "bg-gray-800"
                )}>
                  <CreditCard className={cn("w-5 h-5", data.paymentMethod === "credit_card" ? "text-blue-500" : "text-gray-400")} />
                </div>
                <div className="flex-1 text-left">
                  <p className={cn("text-sm font-medium", data.paymentMethod === "credit_card" ? "text-blue-400" : "text-white")}>
                    Cartão de Crédito
                  </p>
                  <p className="text-[10px] text-gray-500">Até {max_installments}x sem juros</p>
                </div>
                {data.paymentMethod === "credit_card" && <Check className="w-5 h-5 text-blue-500" />}
              </button>
            )}

            {boleto_enabled && (
              <button
                onClick={() => onPaymentMethodChange?.("boleto")}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                  data.paymentMethod === "boleto"
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  data.paymentMethod === "boleto" ? "bg-orange-500/20" : "bg-gray-800"
                )}>
                  <FileText className={cn("w-5 h-5", data.paymentMethod === "boleto" ? "text-orange-500" : "text-gray-400")} />
                </div>
                <div className="flex-1 text-left">
                  <p className={cn("text-sm font-medium", data.paymentMethod === "boleto" ? "text-orange-400" : "text-white")}>
                    Boleto Bancário
                  </p>
                  <p className="text-[10px] text-gray-500">Até 3 dias para compensar</p>
                </div>
                {data.paymentMethod === "boleto" && <Check className="w-5 h-5 text-orange-500" />}
              </button>
            )}

            <button
              onClick={() => onPaymentMethodChange?.("wallet")}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                data.paymentMethod === "wallet"
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:border-gray-600 bg-gray-800/30"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                data.paymentMethod === "wallet" ? "bg-purple-500/20" : "bg-gray-800"
              )}>
                <Wallet className={cn("w-5 h-5", data.paymentMethod === "wallet" ? "text-purple-500" : "text-gray-400")} />
              </div>
              <div className="flex-1 text-left">
                <p className={cn("text-sm font-medium", data.paymentMethod === "wallet" ? "text-purple-400" : "text-white")}>
                  Carteira Digital
                </p>
                <p className="text-[10px] text-gray-500">Google Pay, Apple Pay</p>
              </div>
              {data.paymentMethod === "wallet" && <Check className="w-5 h-5 text-purple-500" />}
            </button>

            {/* Installments */}
            {data.paymentMethod === "credit_card" && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <label className="text-xs text-gray-500 mb-2 block">Parcelamento:</label>
                <select
                  value={data.installments || 1}
                  onChange={(e) => onInstallmentsChange?.(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm"
                >
                  {Array.from({ length: max_installments }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de {formatCurrency(data.total / n)} {n === 1 ? "(à vista)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </ColumnCard>

        {/* Column 6: Summary & Confirmation */}
        <ColumnCard icon={Lock} title="Resumo e Confirmação">
          <div className="space-y-4">
            {/* Quick Summary */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Produtos</span>
                <span className="text-white">{data.products.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Pagamento</span>
                <span className="text-white capitalize">
                  {data.paymentMethod === "credit_card" ? "Cartão" : 
                   data.paymentMethod === "wallet" ? "Carteira Digital" : 
                   data.paymentMethod?.toUpperCase() || "-"}
                </span>
              </div>
              {data.paymentMethod === "credit_card" && data.installments && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Parcelas</span>
                  <span className="text-white">{data.installments}x</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-700">
                <span className="text-white">Total</span>
                <span style={{ color: primary_color }}>{formatCurrency(data.total)}</span>
              </div>
            </div>

            {/* Guarantee */}
            {show_guarantee && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-green-400">Garantia de {guarantee_days} dias</p>
                  <p className="text-[10px] text-green-300/70">Satisfação ou reembolso integral</p>
                </div>
              </div>
            )}

            {/* Security Badge */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Lock className="w-3 h-3" />
              <span>Ambiente seguro com criptografia SSL</span>
            </div>

            {/* Confirm Button */}
            <Button
              onClick={onConfirm}
              disabled={isLoading || !data.paymentMethod}
              className="w-full h-12 text-base font-bold rounded-xl shadow-lg"
              style={{ backgroundColor: primary_color }}
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Finalizar Compra
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>

            <p className="text-[10px] text-gray-500 text-center">
              Ao clicar, você será redirecionado para o gateway de pagamento seguro
            </p>
          </div>
        </ColumnCard>
      </div>
    </div>
  );
};

export default CheckoutColumnsPreview;
