import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/ui/Logo";
import {
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  AlertCircle,
  X,
} from "lucide-react";

interface UpsellData {
  id: string;
  name: string;
  description: string | null;
  original_price: number;
  offer_price: number;
  headline: string | null;
  subheadline: string | null;
  cta_text: string;
  decline_text: string;
  timer_enabled: boolean;
  timer_minutes: number;
  is_subscription: boolean;
  subscription_interval: string | null;
  upsell_product_id: string;
  product?: {
    name: string;
    image_url: string | null;
    description: string | null;
  };
}

interface SaleData {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  buyer_document: string | null;
  payment_method: string;
  transaction_id: string;
  product_id: string;
  seller_user_id: string;
}

const UpsellOffer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [upsell, setUpsell] = useState<UpsellData | null>(null);
  const [sale, setSale] = useState<SaleData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expired, setExpired] = useState(false);
  const [sessionId] = useState(() => `upsell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const saleId = searchParams.get("sale_id");
  const upsellId = searchParams.get("upsell_id");

  useEffect(() => {
    if (!saleId || !upsellId) {
      navigate("/");
      return;
    }
    fetchData();
    logFunnelEvent("viewed");
  }, [saleId, upsellId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !upsell?.timer_enabled) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setExpired(true);
          logFunnelEvent("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, upsell?.timer_enabled]);

  const fetchData = async () => {
    try {
      // Fetch sale data
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .select("id, buyer_name, buyer_email, buyer_phone, buyer_document, payment_method, transaction_id, product_id, seller_user_id")
        .eq("id", saleId)
        .eq("status", "approved")
        .single();

      if (saleError || !saleData) {
        console.error("Sale not found:", saleError);
        navigate("/");
        return;
      }
      setSale(saleData);

      // Fetch upsell data with product info
      const { data: upsellData, error: upsellError } = await supabase
        .from("upsells")
        .select(`
          *,
          product:upsell_product_id (
            name,
            image_url,
            description
          )
        `)
        .eq("id", upsellId)
        .eq("is_active", true)
        .single();

      if (upsellError || !upsellData) {
        console.error("Upsell not found:", upsellError);
        navigate(`/checkout/success?sale_id=${saleId}`);
        return;
      }

      setUpsell(upsellData as unknown as UpsellData);
      
      if (upsellData.timer_enabled) {
        setTimeLeft(upsellData.timer_minutes * 60);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const logFunnelEvent = async (action: string, offerId?: string) => {
    try {
      await supabase.from("sales_funnel_events").insert({
        sale_id: saleId,
        session_id: sessionId,
        user_email: sale?.buyer_email,
        product_id: sale?.product_id,
        step: "upsell",
        action,
        offer_id: offerId || upsellId,
        offer_type: "upsell",
        amount: upsell?.offer_price,
        metadata: { upsell_id: upsellId },
      });
    } catch (error) {
      console.error("Error logging funnel event:", error);
    }
  };

  const handleAccept = async () => {
    if (!upsell || !sale || processing || expired) return;

    setProcessing(true);
    try {
      // Call edge function to process one-click purchase
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-one-click`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            parent_sale_id: saleId,
            offer_type: "upsell",
            upsell_id: upsell.id,
            product_id: upsell.upsell_product_id,
            amount: upsell.offer_price,
            buyer_name: sale.buyer_name,
            buyer_email: sale.buyer_email,
            buyer_document: sale.buyer_document,
            buyer_phone: sale.buyer_phone,
            original_transaction_id: sale.transaction_id,
            is_subscription: upsell.is_subscription,
            subscription_interval: upsell.subscription_interval,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        await logFunnelEvent("accepted", upsell.id);
        toast({
          title: "Compra realizada!",
          description: "Seu acesso foi liberado.",
        });
        // Redirect to thank you page
        navigate(`/checkout/success?sale_id=${result.funnel_order_id || saleId}&upsell=true`);
      } else {
        throw new Error(result.error || "Erro ao processar compra");
      }
    } catch (error) {
      console.error("Error processing upsell:", error);
      await logFunnelEvent("error");
      toast({
        title: "Erro ao processar",
        description: "Não foi possível processar sua compra. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    await logFunnelEvent("declined");
    
    // Check if there's a downsell for this upsell
    const { data: downsell } = await supabase
      .from("downsells")
      .select("id")
      .eq("upsell_id", upsellId)
      .eq("is_active", true)
      .single();

    if (downsell) {
      // Redirect to downsell page
      navigate(`/offer/downsell?sale_id=${saleId}&downsell_id=${downsell.id}`);
    } else {
      // No downsell, go to thank you page
      navigate(`/checkout/success?sale_id=${saleId}`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calculateDiscount = (original: number, offer: number) => {
    return Math.round(((original - offer) / original) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!upsell || !sale) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span>Compra segura</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Timer */}
        {upsell.timer_enabled && !expired && (
          <div className="mb-6 flex items-center justify-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-sm text-amber-500 font-medium">
              Oferta expira em:
            </span>
            <span className="text-lg font-bold text-amber-500 font-mono">
              {formatTime(timeLeft)}
            </span>
          </div>
        )}

        {expired && (
          <div className="mb-6 flex items-center justify-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-sm text-destructive font-medium">
              Esta oferta expirou
            </span>
          </div>
        )}

        {/* Success Badge */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full text-sm font-medium mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Compra aprovada com sucesso!
          </div>
        </div>

        {/* Offer Card */}
        <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
          {/* Ribbon */}
          <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-center">
            <p className="text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              OFERTA EXCLUSIVA - APENAS AGORA
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Headlines */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {upsell.headline || "Oferta exclusiva para você!"}
              </h1>
              <p className="text-muted-foreground">
                {upsell.subheadline || "Aproveite esta oportunidade única"}
              </p>
            </div>

            {/* Product */}
            <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl">
              {upsell.product?.image_url ? (
                <img
                  src={upsell.product.image_url}
                  alt={upsell.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{upsell.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {upsell.description || upsell.product?.description}
                </p>
                {upsell.is_subscription && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">
                    Assinatura {upsell.subscription_interval === "monthly" ? "Mensal" : 
                               upsell.subscription_interval === "quarterly" ? "Trimestral" : "Anual"}
                  </span>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl text-muted-foreground line-through">
                  {formatCurrency(upsell.original_price)}
                </span>
                <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-semibold">
                  {calculateDiscount(upsell.original_price, upsell.offer_price)}% OFF
                </span>
              </div>
              <p className="text-4xl font-bold text-green-500">
                {formatCurrency(upsell.offer_price)}
              </p>
              <p className="text-sm text-muted-foreground">
                Pagamento único via {sale.payment_method === "pix" ? "PIX" : "cartão"}
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
              <p className="text-sm font-medium text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Compra com 1 clique - sem preencher dados novamente
              </p>
              <p className="text-sm font-medium text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Acesso liberado imediatamente
              </p>
              <p className="text-sm font-medium text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Garantia de satisfação
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={processing || expired}
                size="lg"
                className="w-full text-lg h-14 bg-green-500 hover:bg-green-600 text-white"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {upsell.cta_text}
              </Button>
              <button
                onClick={handleDecline}
                disabled={processing}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {upsell.decline_text}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Security Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Pagamento 100% seguro e protegido
          </p>
        </div>
      </main>
    </div>
  );
};

export default UpsellOffer;
