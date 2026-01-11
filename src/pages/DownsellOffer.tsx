import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDownsellTracking, DownsellTrackingData } from "@/hooks/useDownsellTracking";
import Logo from "@/components/ui/Logo";
import {
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingDown,
  AlertCircle,
  Gift,
  Zap,
} from "lucide-react";

interface DownsellData {
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
  downsell_product_id: string;
  upsell_id: string;
  is_active: boolean;
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

const DownsellOffer = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const tracking = useDownsellTracking();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [downsell, setDownsell] = useState<DownsellData | null>(null);
  const [sale, setSale] = useState<SaleData | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expired, setExpired] = useState(false);
  const [sessionId] = useState(() => `downsell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [trackingData, setTrackingData] = useState<DownsellTrackingData | null>(null);
  
  const timerStartedRef = useRef(false);
  const viewedTrackedRef = useRef(false);

  const saleId = searchParams.get("sale_id");
  const downsellId = searchParams.get("downsell_id");

  useEffect(() => {
    if (!saleId || !downsellId) {
      navigate("/");
      return;
    }
    fetchData();
  }, [saleId, downsellId]);

  // Track downsell_viewed quando dados estiverem prontos
  useEffect(() => {
    if (trackingData && !viewedTrackedRef.current) {
      viewedTrackedRef.current = true;
      tracking.trackDownsellViewed(trackingData);
    }
  }, [trackingData, tracking]);

  // Timer countdown com tracking
  useEffect(() => {
    if (timeLeft <= 0 || !downsell?.timer_enabled || !trackingData) return;

    // Track timer started apenas uma vez
    if (!timerStartedRef.current) {
      timerStartedRef.current = true;
      tracking.trackTimerStarted(trackingData);
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setExpired(true);
          if (trackingData) {
            tracking.trackTimerExpired(trackingData);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, downsell?.timer_enabled, trackingData, tracking]);

  // Timeout handler - recusa automática quando timer expira
  useEffect(() => {
    if (expired && trackingData) {
      tracking.trackDownsellTimeout(trackingData);
    }
  }, [expired, trackingData, tracking]);

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

      // Fetch downsell data with product info
      const { data: downsellData, error: downsellError } = await supabase
        .from("downsells")
        .select(`
          *,
          product:downsell_product_id (
            name,
            image_url,
            description
          )
        `)
        .eq("id", downsellId)
        .eq("is_active", true)
        .single();

      if (downsellError || !downsellData) {
        console.error("Downsell not found:", downsellError);
        navigate(`/checkout/success?sale_id=${saleId}`);
        return;
      }

      const typedDownsell = downsellData as unknown as DownsellData;
      setDownsell(typedDownsell);
      
      // Criar tracking data
      const newTrackingData = tracking.createTrackingData(
        {
          id: typedDownsell.id,
          upsell_id: typedDownsell.upsell_id,
          downsell_product_id: typedDownsell.downsell_product_id,
          name: typedDownsell.name,
          description: typedDownsell.description,
          headline: typedDownsell.headline,
          subheadline: typedDownsell.subheadline,
          cta_text: typedDownsell.cta_text,
          decline_text: typedDownsell.decline_text,
          original_price: typedDownsell.original_price,
          offer_price: typedDownsell.offer_price,
          is_subscription: typedDownsell.is_subscription,
          subscription_interval: typedDownsell.subscription_interval,
          timer_enabled: typedDownsell.timer_enabled,
          timer_minutes: typedDownsell.timer_minutes,
          is_active: typedDownsell.is_active,
        },
        {
          id: saleData.id,
          product_id: saleData.product_id,
          buyer_email: saleData.buyer_email,
          buyer_name: saleData.buyer_name,
        },
        sessionId
      );
      setTrackingData(newTrackingData);
      
      if (downsellData.timer_enabled) {
        setTimeLeft(downsellData.timer_minutes * 60);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!downsell || !sale || processing || expired || !trackingData) return;

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
            offer_type: "downsell",
            downsell_id: downsell.id,
            product_id: downsell.downsell_product_id,
            amount: downsell.offer_price,
            buyer_name: sale.buyer_name,
            buyer_email: sale.buyer_email,
            buyer_document: sale.buyer_document,
            buyer_phone: sale.buyer_phone,
            original_transaction_id: sale.transaction_id,
            is_subscription: downsell.is_subscription,
            subscription_interval: downsell.subscription_interval,
            original_price: downsell.original_price,
            discount_percentage: trackingData.discount_percentage,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        await tracking.trackDownsellAccepted(trackingData, result.funnel_order_id);
        toast({
          title: "Compra realizada!",
          description: "Seu acesso foi liberado.",
        });
        // Redirect to thank you page
        navigate(`/checkout/success?sale_id=${result.funnel_order_id || saleId}&downsell=true`);
      } else {
        throw new Error(result.error || "Erro ao processar compra");
      }
    } catch (error) {
      console.error("Error processing downsell:", error);
      await tracking.trackError(trackingData, error instanceof Error ? error.message : "Unknown error");
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
    if (trackingData) {
      await tracking.trackDownsellDeclined(trackingData);
    }
    // Go to thank you page
    navigate(`/checkout/success?sale_id=${saleId}`);
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

  if (!downsell || !sale) {
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
        {/* Wait Message */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 rounded-full text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Espere! Temos uma oferta especial
          </div>
        </div>

        {/* Timer */}
        {downsell.timer_enabled && !expired && (
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

        {/* Offer Card */}
        <Card className="border-2 border-amber-500/20 shadow-lg shadow-amber-500/5 overflow-hidden">
          {/* Ribbon */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-center">
            <p className="text-sm font-semibold text-white flex items-center justify-center gap-2">
              <Gift className="w-4 h-4" />
              OFERTA ESPECIAL - APENAS PARA VOCÊ
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Headlines */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {downsell.headline || "Espere! Temos uma oferta especial"}
              </h1>
              <p className="text-muted-foreground">
                {downsell.subheadline || "Uma opção mais acessível para você"}
              </p>
            </div>

            {/* Product */}
            <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl">
              {downsell.product?.image_url ? (
                <img
                  src={downsell.product.image_url}
                  alt={downsell.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingDown className="w-8 h-8 text-amber-500" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{downsell.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {downsell.description || downsell.product?.description}
                </p>
                {downsell.is_subscription && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-500/10 text-amber-500 text-xs rounded">
                    Assinatura {downsell.subscription_interval === "monthly" ? "Mensal" : 
                               downsell.subscription_interval === "quarterly" ? "Trimestral" : "Anual"}
                  </span>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <span className="text-xl text-muted-foreground line-through">
                  {formatCurrency(downsell.original_price)}
                </span>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-sm font-semibold">
                  {calculateDiscount(downsell.original_price, downsell.offer_price)}% OFF
                </span>
              </div>
              <p className="text-4xl font-bold text-amber-500">
                {formatCurrency(downsell.offer_price)}
              </p>
              <p className="text-sm text-muted-foreground">
                Compra rápida com 1 clique
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Preço especial exclusivo
              </p>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Compra com 1 clique
              </p>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Acesso liberado imediatamente
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={processing || expired}
                size="lg"
                className="w-full text-lg h-14 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : null}
                {downsell.cta_text}
              </Button>
              <button
                onClick={handleDecline}
                disabled={processing}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {downsell.decline_text}
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

export default DownsellOffer;
