import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Mail,
  ExternalLink,
  CreditCard,
  Calendar,
  Package,
  HelpCircle,
  Sparkles,
  QrCode,
  Banknote,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getMessage, getDefaultTone, type CommunicationTone } from "@/lib/communicationTone";
import { useABTestTracking } from "@/hooks/useABTestTracking";
import { useSaleStatusPolling } from "@/hooks/useSaleStatusPolling";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// A/B Test Variants for Success Screen
type SuccessVariant = 'A' | 'B' | 'C';

const successVariants = {
  A: {
    name: 'Direta e objetiva',
    title: 'Compra realizada com sucesso!',
    subtitle: 'Seu pagamento foi confirmado e o acesso já está disponível.',
    cta: 'Acessar produto',
  },
  B: {
    name: 'Humana e acolhedora',
    title: 'Tudo certo com sua compra 🎉',
    subtitle: 'Recebemos seu pagamento e já estamos liberando seu acesso. Em poucos instantes você poderá aproveitar o conteúdo.',
    cta: 'Quero acessar agora',
  },
  C: {
    name: 'Educativa',
    title: 'Sua compra foi concluída',
    subtitle: 'O pagamento foi confirmado. Abaixo você encontra os próximos passos para acessar seu produto.',
    cta: 'Ver próximos passos',
  },
} as const;

// Get or set A/B variant
function getOrSetVariant(): SuccessVariant {
  if (typeof window === 'undefined') return 'A';
  const stored = localStorage.getItem('success_variant');
  if (stored && ['A', 'B', 'C'].includes(stored)) {
    return stored as SuccessVariant;
  }
  const variants: SuccessVariant[] = ['A', 'B', 'C'];
  const newVariant = variants[Math.floor(Math.random() * 3)];
  localStorage.setItem('success_variant', newVariant);
  return newVariant;
}

interface TransactionStatus {
  sale_id: string;
  transaction_id: string;
  status: string;
  amount: number;
  buyer_name: string;
  buyer_email: string;
  product_name: string;
  product_image: string | null;
  created_at: string;
  podpay_status: string | null;
  payment_method?: string;
  delivery_method?: string;
  is_subscription?: boolean;
}

interface FunnelPurchase {
  type: "upsell" | "downsell";
  product_name: string;
  amount: number;
  status: string;
}

const CheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hasTracked, setHasTracked] = useState(false);
  const [upsellChecked, setUpsellChecked] = useState(false);
  const [funnelPurchases, setFunnelPurchases] = useState<FunnelPurchase[]>([]);
  const [transactionData, setTransactionData] = useState<TransactionStatus | null>(null);

  const saleId = searchParams.get("sale_id");
  const orderId = searchParams.get("order_id");
  const transactionId = searchParams.get("transaction_id");
  const fromUpsell = searchParams.get("upsell") === "true";
  const fromDownsell = searchParams.get("downsell") === "true";

  // A/B variant and communication tone
  const [variant] = useState<SuccessVariant>(() => getOrSetVariant());
  const [tone] = useState<CommunicationTone>(() => getDefaultTone());
  const variantContent = successVariants[variant];
  
  // A/B Test tracking
  const { trackPageView, trackCTAClick, trackProductAccess, setupAbandonTracking } = useABTestTracking();

  // Use new polling hook with realtime support
  const handleStatusChange = useCallback((newStatus: string, oldStatus: string) => {
    console.log(`[CheckoutSuccess] Status changed: ${oldStatus} -> ${newStatus}`);
    if (newStatus === "approved") {
      toast.success("Pagamento confirmado!", {
        description: "Seu acesso foi liberado automaticamente.",
      });
    } else if (newStatus === "refused") {
      toast.error("Pagamento não aprovado", {
        description: "Tente novamente ou use outro método de pagamento.",
      });
    }
  }, []);

  const { 
    status: saleStatus, 
    loading, 
    error, 
    isPolling, 
    pollCount,
    refetch 
  } = useSaleStatusPolling({
    saleId,
    orderId,
    transactionId,
    enabled: true,
    pollInterval: 5000,
    maxPolls: 12, // 1 minute of polling
    onStatusChange: handleStatusChange,
  });

  // Update transactionData when saleStatus changes
  useEffect(() => {
    if (saleStatus) {
      setTransactionData({
        sale_id: saleStatus.id,
        transaction_id: saleStatus.id,
        status: saleStatus.status,
        amount: saleStatus.amount,
        buyer_name: saleStatus.buyer_name,
        buyer_email: saleStatus.buyer_email,
        product_name: saleStatus.product_name || "",
        product_image: null,
        created_at: saleStatus.created_at,
        podpay_status: null,
      });
    }
  }, [saleStatus]);

  // Check for upsell and redirect if available (only for approved purchases, not coming from upsell/downsell)
  useEffect(() => {
    const checkForUpsell = async () => {
      if (!transactionData || transactionData.status !== "approved" || upsellChecked || fromUpsell || fromDownsell) return;
      
      setUpsellChecked(true);
      
      try {
        // Get the product_id from the sale
        const { data: sale } = await supabase
          .from("sales")
          .select("product_id")
          .eq("id", saleId)
          .single();
          
        if (!sale) return;
        
        // Check for active upsell
        const { data: upsell } = await supabase
          .from("upsells")
          .select("id")
          .eq("product_id", sale.product_id)
          .eq("is_active", true)
          .order("position")
          .limit(1)
          .single();
          
        if (upsell) {
          // Redirect to upsell page
          navigate(`/offer/upsell?sale_id=${saleId}&upsell_id=${upsell.id}`);
          return;
        }
      } catch (error) {
        console.log("No upsell found or error:", error);
      }
      
      // If we got here from upsell/downsell, fetch funnel purchases
      if (fromUpsell || fromDownsell) {
        try {
          const { data: funnelOrders } = await supabase
            .from("funnel_orders")
            .select("order_type, amount, status, product:product_id(name)")
            .eq("parent_sale_id", saleId);
            
          if (funnelOrders && funnelOrders.length > 0) {
            const purchases: FunnelPurchase[] = funnelOrders.map((fo: any) => ({
              type: fo.order_type as "upsell" | "downsell",
              product_name: fo.product?.name || "Produto adicional",
              amount: fo.amount,
              status: fo.status,
            }));
            setFunnelPurchases(purchases);
          }
        } catch (e) {
          console.log("Error fetching funnel purchases:", e);
        }
      }
    };
    
    checkForUpsell();
  }, [transactionData, saleId, upsellChecked, fromUpsell, fromDownsell, navigate]);

  // Track page view when transaction data is loaded
  useEffect(() => {
    if (transactionData && !hasTracked) {
      const productType = transactionData.is_subscription ? 'subscription' : 'one_time';
      trackPageView(variant, undefined, productType, transactionData.payment_method);
      setHasTracked(true);
      
      // Setup abandon tracking
      const cleanup = setupAbandonTracking(variant, undefined, productType);
      return cleanup;
    }
  }, [transactionData, hasTracked, variant, trackPageView, setupAbandonTracking]);

  // Handle CTA click with tracking
  const handleCTAClick = useCallback((ctaType: string) => {
    const productType = transactionData?.is_subscription ? 'subscription' : 'one_time';
    trackCTAClick(variant, ctaType, undefined, productType);
    trackProductAccess(variant, undefined, productType);
  }, [transactionData, variant, trackCTAClick, trackProductAccess]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getPaymentMethodIcon = (method?: string) => {
    switch (method?.toLowerCase()) {
      case "pix":
        return <QrCode className="w-4 h-4" />;
      case "boleto":
        return <Banknote className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method?.toLowerCase()) {
      case "pix":
        return "PIX";
      case "boleto":
        return "Boleto Bancário";
      default:
        return "Cartão de Crédito";
    }
  };

  const isApproved = transactionData?.status === "approved";
  const isPending = transactionData?.status === "pending";
  const isRefused = transactionData?.status === "refused" || transactionData?.status === "failed";
  const deliveryMethod = transactionData?.delivery_method || "member_area";
  const isSubscription = transactionData?.is_subscription;

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 md:w-12 md:h-12 animate-spin text-primary" />
            </div>
            <div className="absolute inset-0 w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Verificando seu pagamento</p>
            <p className="text-sm text-muted-foreground">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State - friendly, no technical info
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <HelpCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-xl font-semibold">Não foi possível carregar os detalhes</h1>
          <p className="text-muted-foreground">
            Se você realizou o pagamento, não se preocupe. Entre em contato com o suporte para mais informações.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="gap-2">
            <Mail className="w-4 h-4" />
            Falar com suporte
          </Button>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="hidden sm:inline">Ambiente seguro</span>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6 md:py-10">
        <div className="max-w-2xl mx-auto space-y-5 md:space-y-6">
          
          {/* Success Header */}
          <div className="text-center space-y-3 md:space-y-4">
            {isApproved ? (
              <>
                <div className="relative inline-flex">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 md:w-14 md:h-14 text-green-500" />
                  </div>
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-yellow-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                    {variantContent.title}
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto">
                    {variantContent.subtitle}
                  </p>
                </div>
              </>
            ) : isPending ? (
              <>
                <div className="relative inline-flex">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
                    <Clock className="w-12 h-12 md:w-14 md:h-14 text-amber-500 animate-pulse" />
                  </div>
                  {isPolling && (
                    <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-1 shadow-lg">
                      <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                    Aguardando confirmação
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto">
                    Estamos verificando seu pagamento. Assim que for aprovado, o acesso será liberado automaticamente.
                  </p>
                  {isPolling && (
                    <p className="text-xs text-muted-foreground">
                      Verificando... ({pollCount}/12)
                    </p>
                  )}
                </div>
              </>
            ) : isRefused ? (
              <>
                <div className="relative inline-flex">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center">
                    <XCircle className="w-12 h-12 md:w-14 md:h-14 text-red-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
                    Pagamento não aprovado
                  </h1>
                  <p className="text-muted-foreground text-base md:text-lg max-w-md mx-auto">
                    Infelizmente seu pagamento não foi aprovado. Tente novamente ou use outro método de pagamento.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {transactionData && (
            <>
              {/* Purchase Summary Card */}
              <Card className="border-border/50 shadow-lg overflow-hidden">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start gap-4">
                    {transactionData.product_image ? (
                      <img
                        src={transactionData.product_image}
                        alt={transactionData.product_name}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover border border-border/50 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Produto</p>
                          <h3 className="font-semibold text-base md:text-lg truncate">{transactionData.product_name}</h3>
                        </div>
                        {isSubscription && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary whitespace-nowrap">
                            Assinatura
                          </span>
                        )}
                      </div>
                      <p className="text-xl md:text-2xl font-bold text-primary">
                        {formatCurrency(transactionData.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Details - stacked on mobile, grid on desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                        {getPaymentMethodIcon(transactionData.payment_method)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                        <p className="font-medium text-sm md:text-base truncate">{getPaymentMethodLabel(transactionData.payment_method)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Data da compra</p>
                        <p className="font-medium text-sm truncate">{formatDate(transactionData.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center justify-center mt-4">
                    {isApproved ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Pagamento confirmado
                      </div>
                    ) : isPending ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Aguardando confirmação
                      </div>
                    ) : null}
                  </div>
                  
                  {/* Funnel Purchases Summary */}
                  {funnelPurchases.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-sm font-medium mb-3 text-muted-foreground">Compras adicionais:</p>
                      <div className="space-y-2">
                        {funnelPurchases.filter(p => p.status === 'approved').map((purchase, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <div>
                                <p className="text-sm font-medium">{purchase.product_name}</p>
                                <p className="text-xs text-muted-foreground capitalize">{purchase.type}</p>
                              </div>
                            </div>
                            <p className="font-semibold text-green-600">{formatCurrency(purchase.amount)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border/30 flex justify-between">
                        <p className="text-sm font-medium">Total Geral:</p>
                        <p className="text-lg font-bold text-primary">
                          {formatCurrency(
                            transactionData.amount + 
                            funnelPurchases.filter(p => p.status === 'approved').reduce((sum, p) => sum + p.amount, 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Next Steps Card - "O que acontece agora?" */}
              <Card className="border-border/50 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-4 md:px-6 py-3 md:py-4 border-b border-border/50">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ArrowRight className="w-4 h-4 text-primary" />
                    O que acontece agora?
                  </div>
                </div>
                <CardContent className="p-4 md:p-6">
                  {isApproved ? (
                    <>
                      {/* Subscription */}
                      {isSubscription ? (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 md:gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base md:text-lg">Sua assinatura foi criada com sucesso.</h4>
                              <p className="text-muted-foreground text-sm mt-1">
                                O acesso ficará disponível enquanto a assinatura estiver ativa.
                              </p>
                            </div>
                          </div>
                          {deliveryMethod === "member_area" && (
                            <div className="space-y-3 pt-2">
                              <Button 
                                size="lg" 
                                className="w-full gap-2 text-base"
                                onClick={() => handleCTAClick('member_area_subscription')}
                              >
                                <ExternalLink className="w-4 h-4" />
                                {variantContent.cta}
                              </Button>
                              <p className="text-xs text-center text-muted-foreground">
                                Você pode acessar o conteúdo sempre que quiser enquanto sua assinatura estiver ativa.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* One-time purchase */
                        <div className="space-y-4">
                          {deliveryMethod === "member_area" && (
                            <>
                              <div className="flex items-start gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <ExternalLink className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-base md:text-lg">Seu acesso já está disponível.</h4>
                                  <p className="text-muted-foreground text-sm mt-1">
                                    Clique no botão abaixo para acessar todo o conteúdo do produto.
                                  </p>
                                </div>
                              </div>
                              <Button 
                                size="lg" 
                                className="w-full gap-2 text-base"
                                onClick={() => handleCTAClick('member_area_one_time')}
                              >
                                <ExternalLink className="w-4 h-4" />
                                {variantContent.cta}
                              </Button>
                            </>
                          )}

                          {deliveryMethod === "email" && (
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base md:text-lg">O conteúdo foi enviado para o seu email cadastrado.</h4>
                                <p className="text-muted-foreground text-sm mt-1">
                                  Enviamos para <span className="font-medium text-foreground">{transactionData.buyer_email}</span>
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span>Caso não encontre, verifique a caixa de spam.</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {deliveryMethod === "none" && (
                            <div className="flex items-start gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base md:text-lg">Pagamento registrado com sucesso.</h4>
                                <p className="text-muted-foreground text-sm mt-1">
                                  Este produto não possui entrega automática. O pagamento foi registrado com sucesso.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : isPending ? (
                    <div className="flex items-start gap-3 md:gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-amber-500 animate-spin" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base md:text-lg">Aguardando confirmação do pagamento</h4>
                        <p className="text-muted-foreground text-sm mt-1">
                          Assim que o pagamento for aprovado, a liberação acontecerá automaticamente.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Support Section */}
              <Card className="border-border/30 bg-muted/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-center sm:text-left">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-background flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-base">Precisa de ajuda?</p>
                        <p className="text-xs md:text-sm text-muted-foreground">Entre em contato com nosso suporte</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                      <Mail className="w-4 h-4" />
                      Falar com suporte
                    </Button>
                  </div>
                  {transactionData.transaction_id && (
                    <div className="mt-4 pt-4 border-t border-border/30 text-center">
                      <p className="text-xs text-muted-foreground">
                        ID da transação: <span className="font-mono select-all">{transactionData.transaction_id}</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Back Button */}
              <div className="text-center pt-2">
                <Button variant="ghost" onClick={() => navigate("/")} className="text-muted-foreground">
                  Voltar ao início
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 md:py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>Transação protegida por criptografia</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CheckoutSuccess;
