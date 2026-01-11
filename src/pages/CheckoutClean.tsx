import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard,
  Smartphone,
  FileText,
  ShieldCheck,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  Copy,
  QrCode,
  Lock,
  Package,
  Repeat,
  Download,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { createCheckoutSchema, maskCPF, maskCNPJ, maskPhone } from "@/lib/validation";
import CreditCardForm from "@/components/checkout/CreditCardForm";
import SocialProofNotifications from "@/components/checkout/SocialProofNotifications";
import { usePodPayCard, CardFormData } from "@/hooks/usePodPayCard";
import { QRCodeSVG } from "qrcode.react";

// PodPay public key from environment
const PODPAY_PUBLIC_KEY = import.meta.env.VITE_PODPAY_PUBLIC_KEY || null;

// Cor verde para valores quando tema branco
const VALUE_GREEN_COLOR = "#22c55e";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  user_id: string;
  product_type: string;
}

interface OrderBump {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  is_active: boolean;
  position: number;
  highlight_color?: string | null;
}

interface ProductOffer {
  id: string;
  product_id: string;
  name: string;
  discount_type: string | null;
  discount_value: number | null;
  final_price: number;
  status: string;
}

interface CheckoutSettings {
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  background_color: string;
  button_text: string;
  show_product_image: boolean;
  show_product_description: boolean;
  show_guarantee: boolean;
  guarantee_days: number;
  require_phone: boolean;
  require_document: boolean;
  pix_enabled: boolean;
  credit_card_enabled: boolean;
  boleto_enabled: boolean;
  show_timer: boolean;
  timer_minutes: number;
  timer_text: string;
  timer_color: string;
  timer_text_color: string;
  timer_expired_text: string;
  headline: string | null;
  subheadline: string | null;
  footer_text: string | null;
  layout_type: string;
  form_layout: string;
  invert_columns: boolean;
  require_email: boolean;
  show_min_shipping_price: boolean;
  allow_item_removal: boolean;
  show_store_info: boolean;
  column_scroll_type: string;
  cart_display_type: string;
  button_status: string;
  document_type_accepted: string;
  order_bump_enabled: boolean;
  coupon_enabled: boolean;
  marquee_enabled: boolean;
  marquee_text: string | null;
  theme_mode: string;
  border_style: string;
  favicon_url: string | null;
  show_logo: boolean;
  social_proof_enabled: boolean;
  social_proof_notification_1_enabled: boolean;
  social_proof_notification_1_text: string;
  social_proof_notification_2_enabled: boolean;
  social_proof_notification_2_text: string;
  social_proof_notification_3_enabled: boolean;
  social_proof_notification_3_text: string;
  social_proof_notification_4_enabled: boolean;
  social_proof_notification_4_text: string;
  security_seals_enabled: boolean;
  security_seal_secure_site: boolean;
  security_seal_secure_purchase: boolean;
  security_seal_guarantee: boolean;
  security_seal_secure_site_text: string;
  security_seal_secure_purchase_text: string;
  security_seal_guarantee_text: string;
  checkout_animation_enabled: boolean;
  button_background_color: string;
  button_text_color: string;
  total_value_color: string | null;
}

interface PixData {
  pix_copia_cola: string;
  qr_code_base64: string;
  expiration_date?: string;
  expiration_minutes: number;
}

const defaultSettings: CheckoutSettings = {
  logo_url: null,
  banner_url: null,
  primary_color: '#22c55e',
  background_color: '#ffffff',
  button_text: 'Finalizar Compra',
  show_product_image: true,
  show_product_description: true,
  show_guarantee: false,
  guarantee_days: 7,
  require_phone: true,
  require_document: true,
  pix_enabled: true,
  credit_card_enabled: true,
  boleto_enabled: false,
  show_timer: false,
  timer_minutes: 15,
  timer_text: 'Oferta expira em:',
  timer_color: '#ef4444',
  timer_text_color: '#ffffff',
  timer_expired_text: 'OFERTA ACABOU',
  headline: null,
  subheadline: null,
  footer_text: null,
  layout_type: 'moderno',
  form_layout: 'direct',
  invert_columns: false,
  require_email: true,
  show_min_shipping_price: false,
  allow_item_removal: false,
  show_store_info: false,
  column_scroll_type: 'independent',
  cart_display_type: 'desktop',
  button_status: '',
  document_type_accepted: 'cpf',
  order_bump_enabled: true,
  coupon_enabled: false,
  marquee_enabled: false,
  marquee_text: null,
  theme_mode: 'light', // Padrão light para checkout clean
  border_style: 'rounded',
  favicon_url: null,
  show_logo: true,
  social_proof_enabled: false,
  social_proof_notification_1_enabled: false,
  social_proof_notification_1_text: '',
  social_proof_notification_2_enabled: false,
  social_proof_notification_2_text: '',
  social_proof_notification_3_enabled: false,
  social_proof_notification_3_text: '',
  social_proof_notification_4_enabled: false,
  social_proof_notification_4_text: '',
  security_seals_enabled: true,
  security_seal_secure_site: true,
  security_seal_secure_purchase: true,
  security_seal_guarantee: true,
  security_seal_secure_site_text: 'Site Protegido',
  security_seal_secure_purchase_text: 'Compra 100% Segura',
  security_seal_guarantee_text: 'Garantia Total',
  checkout_animation_enabled: false,
  button_background_color: '#22c55e',
  button_text_color: '#ffffff',
  total_value_color: null,
};

type PaymentMethod = "pix" | "credit_card" | "boleto";

const CheckoutClean = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shortId } = useParams<{ shortId?: string }>();
  
  const productId = useMemo(() => {
    if (shortId) return shortId;
    return searchParams.get("product");
  }, [shortId, searchParams]);

  const offerId = useMemo(() => searchParams.get("offer"), [searchParams]);

  const affiliateRef = useMemo(() => {
    const refParam = searchParams.get("ref") || searchParams.get("aff");
    if (refParam) {
      localStorage.setItem("affiliate_ref", refParam);
      localStorage.setItem("affiliate_ref_product", productId || "");
      return refParam;
    }
    const storedRef = localStorage.getItem("affiliate_ref");
    const storedProduct = localStorage.getItem("affiliate_ref_product");
    if (storedRef && storedProduct === productId) {
      return storedRef;
    }
    return null;
  }, [searchParams, productId]);

  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [offer, setOffer] = useState<ProductOffer | null>(null);
  const [settings, setSettings] = useState<CheckoutSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pix_pending" | "processing_card" | "success" | "error">("idle");
  const [timeLeft, setTimeLeft] = useState(0);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [pixTimeLeft, setPixTimeLeft] = useState(0);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [orderBumps, setOrderBumps] = useState<OrderBump[]>([]);
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<'cpf' | 'cnpj'>('cpf');

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    emailConfirm: "",
    document: "",
    phone: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [cardData, setCardData] = useState<CardFormData>({
    number: "",
    holderName: "",
    expiry: "",
    cvv: "",
  });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const { 
    isReady: isPodPayReady, 
    isLoading: isTokenizing, 
    error: tokenError, 
    prepareThreeDS,
    encryptCard,
    finishThreeDS,
    threeDSSettings,
    iframeFormValid,
    getIframeId,
  } = usePodPayCard(PODPAY_PUBLIC_KEY);

  // Determina se deve usar valores verdes (tema branco/light)
  const isWhiteTheme = useMemo(() => {
    const bgColor = settings.background_color.toLowerCase();
    return bgColor === '#ffffff' || bgColor === '#fff' || bgColor === 'white' || settings.theme_mode === 'light';
  }, [settings.background_color, settings.theme_mode]);

  // Cor dos valores monetários
  const valueColor = useMemo(() => {
    if (isWhiteTheme) {
      return settings.total_value_color || VALUE_GREEN_COLOR;
    }
    return settings.total_value_color || '#ffffff';
  }, [isWhiteTheme, settings.total_value_color]);

  useEffect(() => {
    if (productId) {
      setOffer(null);
      fetchProductAndSettings();
    } else {
      setLoading(false);
    }
  }, [productId, offerId]);

  // Timer countdown
  useEffect(() => {
    if (settings.show_timer && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [settings.show_timer, timeLeft]);

  // PIX timer countdown
  useEffect(() => {
    if (paymentStatus === "pix_pending" && pixTimeLeft > 0) {
      const timer = setInterval(() => {
        setPixTimeLeft((prev) => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentStatus, pixTimeLeft]);

  useEffect(() => {
    if (pixTimeLeft === 0 && paymentStatus === "pix_pending") {
      const timeout = setTimeout(() => {
        if (paymentStatus === "pix_pending") {
          setPaymentStatus("error");
          toast.error("Tempo expirado. Por favor, tente novamente.");
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [pixTimeLeft, paymentStatus]);

  // Polling de status PIX
  useEffect(() => {
    if (paymentStatus !== "pix_pending" || !transactionId) return;

    let isApproved = false;
    const pollInterval = setInterval(async () => {
      if (isApproved) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-transaction', {
          body: { transaction_id: transactionId }
        });
        
        if (!error && data?.status === 'approved') {
          isApproved = true;
          clearInterval(pollInterval);
          setPaymentStatus("success");
          toast.success("Pagamento aprovado!");
        }
      } catch (err) {
        console.log('[Polling] Error:', err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [paymentStatus, transactionId]);

  const fetchProductAndSettings = async () => {
    try {
      let foundProduct = null;
      let customPrice: number | null = null;
      
      // Try exact UUID match first
      if (productId && productId.length === 36 && productId.includes("-")) {
        const { data } = await supabase
          .from("products")
          .select("id, name, description, price, image_url, user_id, product_type")
          .eq("id", productId)
          .eq("status", "active")
          .maybeSingle();
        foundProduct = data;
      }
      
      // Try campaign link match (short_code or slug)
      if (!foundProduct && productId) {
        const { data: linkData } = await supabase.rpc('find_product_link_by_code', { code: productId });
        if (linkData && linkData.length > 0) {
          const link = linkData[0];
          customPrice = link.custom_price;
          // Fetch the actual product
          const { data: productData } = await supabase
            .from("products")
            .select("id, name, description, price, image_url, user_id, product_type")
            .eq("id", link.product_id)
            .eq("status", "active")
            .maybeSingle();
          if (productData) {
            foundProduct = {
              ...productData,
              price: customPrice || productData.price,
            };
          }
        }
      }
      
      // Try short ID match
      if (!foundProduct && productId) {
        const { data } = await supabase.rpc('find_product_by_short_id', { short_id: productId });
        if (data && data.length > 0) {
          foundProduct = data[0];
        }
      }

      if (!foundProduct) {
        toast.error("Produto não encontrado");
        setLoading(false);
        return;
      }

      setProduct(foundProduct);

      // Fetch settings - force white background for clean theme
      const { data: settingsData } = await supabase
        .from("checkout_settings")
        .select("*")
        .eq("product_id", foundProduct.id)
        .maybeSingle();

      if (settingsData) {
        setSettings({
          ...defaultSettings,
          ...settingsData,
          // Force clean white theme
          background_color: '#ffffff',
          theme_mode: 'light',
        });
      } else {
        setSettings(defaultSettings);
      }

      // Fetch offer if specified
      if (offerId) {
        const { data: offerData } = await supabase
          .from("product_offers")
          .select("*")
          .eq("id", offerId)
          .eq("product_id", foundProduct.id)
          .eq("status", "active")
          .maybeSingle();
        
        if (offerData) {
          setOffer(offerData);
        }
      }

      // Fetch order bumps
      const { data: bumpsData } = await supabase
        .from("order_bumps")
        .select("*")
        .eq("product_id", foundProduct.id)
        .eq("is_active", true)
        .order("position");
      
      if (bumpsData) {
        setOrderBumps(bumpsData);
      }

      if (settingsData?.show_timer) {
        setTimeLeft((settingsData.timer_minutes || 15) * 60);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Erro ao carregar produto");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Preço do produto com oferta
  const displayedPrice = useMemo(() => {
    if (offer) return offer.final_price;
    return product?.price || 0;
  }, [offer, product]);

  // Total com order bumps
  const totalPrice = useMemo(() => {
    let total = displayedPrice;
    orderBumps.forEach(bump => {
      if (selectedBumps.includes(bump.id)) {
        total += bump.discount_price || bump.price;
      }
    });
    return total;
  }, [displayedPrice, orderBumps, selectedBumps]);

  const handleInputChange = (field: string, value: string) => {
    let maskedValue = value;
    
    if (field === 'document') {
      const effectiveDocType = settings.document_type_accepted === 'both' ? selectedDocType : settings.document_type_accepted;
      maskedValue = effectiveDocType === 'cnpj' ? maskCNPJ(value) : maskCPF(value);
    } else if (field === 'phone') {
      maskedValue = maskPhone(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: maskedValue }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleDocTypeChange = (type: 'cpf' | 'cnpj') => {
    setSelectedDocType(type);
    setFormData(prev => ({ ...prev, document: '' }));
  };

  const handleCardDataChange = (field: string, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) errors.name = 'Nome é obrigatório';
    if (settings.require_email && !formData.email.trim()) errors.email = 'E-mail é obrigatório';
    if (settings.require_email && formData.email !== formData.emailConfirm) errors.emailConfirm = 'E-mails não conferem';
    if (settings.require_document && !formData.document.trim()) errors.document = 'Documento é obrigatório';
    if (settings.require_phone && !formData.phone.trim()) errors.phone = 'Telefone é obrigatório';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const copyPixCode = () => {
    if (pixData?.pix_copia_cola) {
      navigator.clipboard.writeText(pixData.pix_copia_cola);
      setCopiedPix(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopiedPix(false), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!product) return;

    setProcessing(true);

    try {
      const payload = {
        product_id: product.id,
        buyer_name: formData.name,
        buyer_email: formData.email,
        buyer_document: formData.document.replace(/\D/g, ''),
        buyer_phone: formData.phone.replace(/\D/g, ''),
        payment_method: paymentMethod,
        amount: totalPrice,
        affiliation_id: affiliateId,
        order_bumps: selectedBumps,
        offer_id: offer?.id,
      };

      if (paymentMethod === 'credit_card') {
        if (!isPodPayReady || !PODPAY_PUBLIC_KEY) {
          toast.error("Sistema de pagamento não disponível");
          setProcessing(false);
          return;
        }

        const encryptedCard = await encryptCard(cardData);
        if (!encryptedCard) {
          toast.error("Erro ao processar cartão");
          setProcessing(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('process-checkout', {
          body: { ...payload, card_encrypted: encryptedCard }
        });

        if (error) throw error;
        
        if (data.success) {
          setTransactionId(data.transaction_id);
          setPaymentStatus("success");
          toast.success("Pagamento aprovado!");
        } else {
          throw new Error(data.error || "Pagamento recusado");
        }
      } else {
        const { data, error } = await supabase.functions.invoke('process-checkout', { body: payload });
        
        if (error) throw error;
        
        if (data.pix_data) {
          setPixData({
            pix_copia_cola: data.pix_data.pix_copia_cola,
            qr_code_base64: data.pix_data.qr_code_base64,
            expiration_minutes: data.pix_data.expiration_minutes || 30,
          });
          setTransactionId(data.transaction_id);
          setPixTimeLeft((data.pix_data.expiration_minutes || 30) * 60);
          setPaymentStatus("pix_pending");
        }
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Erro ao processar pagamento");
      setPaymentStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  const getProductTypeIcon = () => {
    switch (product?.product_type) {
      case 'digital': return <Download className="w-4 h-4" />;
      case 'physical': return <Package className="w-4 h-4" />;
      case 'subscription': return <Repeat className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getProductTypeLabel = () => {
    switch (product?.product_type) {
      case 'digital': return 'Digital';
      case 'physical': return 'Físico';
      case 'subscription': return 'Assinatura';
      default: return 'Produto';
    }
  };

  const effectiveDocType = settings.document_type_accepted === 'both' ? selectedDocType : settings.document_type_accepted;

  const availablePaymentMethods = {
    pix: settings.pix_enabled,
    credit_card: settings.credit_card_enabled,
    boleto: settings.boleto_enabled,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-16 h-16 text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-900">Produto não encontrado</h1>
        <p className="text-slate-500">O produto solicitado não existe ou está indisponível.</p>
        <Button onClick={() => navigate("/")} className="bg-emerald-500 hover:bg-emerald-600">Voltar ao início</Button>
      </div>
    );
  }

  // PIX Payment Screen
  if (paymentStatus === "pix_pending" && pixData) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-slate-200 bg-white">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 object-contain" />
            ) : (
              <Logo />
            )}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Pagamento seguro
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">PIX gerado com sucesso!</h1>
              <p className="text-slate-500">
                Escaneie o QR Code ou copie o código para realizar o pagamento
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
              <Clock className="w-5 h-5 text-amber-600" />
              <div className="text-center">
                <p className="text-amber-600 text-sm">Expira em</p>
                <p className="text-amber-700 font-bold text-xl tabular-nums">
                  {formatTime(pixTimeLeft)}
                </p>
              </div>
            </div>

            <Card className="bg-white border-slate-200 shadow-lg">
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl border-2 border-emerald-200 shadow-sm">
                    <QRCodeSVG
                      value={pixData.pix_copia_cola}
                      size={256}
                      level="M"
                      includeMargin={false}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                <div className="text-center py-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <p className="text-slate-500 text-sm mb-1">Valor a pagar</p>
                  <p className="text-3xl font-bold" style={{ color: VALUE_GREEN_COLOR }}>
                    {formatCurrency(totalPrice)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <Separator className="flex-1 bg-slate-200" />
                  <span className="text-slate-400 text-xs uppercase">ou</span>
                  <Separator className="flex-1 bg-slate-200" />
                </div>

                <div className="space-y-3">
                  <Label className="text-slate-700 text-sm flex items-center gap-2">
                    <Copy className="w-4 h-4 text-slate-400" />
                    PIX Copia e Cola
                  </Label>
                  <div className="relative group">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-mono text-slate-500 break-all pr-20 line-clamp-2">
                        {pixData.pix_copia_cola}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{ backgroundColor: copiedPix ? VALUE_GREEN_COLOR : settings.primary_color }}
                      onClick={copyPixCode}
                    >
                      {copiedPix ? (
                        <><CheckCircle className="w-4 h-4 mr-1" /> Copiado!</>
                      ) : (
                        <><Copy className="w-4 h-4 mr-1" /> Copiar</>
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold"
                  style={{ backgroundColor: copiedPix ? VALUE_GREEN_COLOR : settings.primary_color }}
                  onClick={copyPixCode}
                >
                  {copiedPix ? (
                    <><CheckCircle className="w-5 h-5 mr-2" /> Código copiado!</>
                  ) : (
                    <><Copy className="w-5 h-5 mr-2" /> Copiar código PIX</>
                  )}
                </Button>

                <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  Após o pagamento, você receberá a confirmação por e-mail.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6 p-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-slate-900">Pagamento realizado!</h1>
          <p className="text-slate-500">
            Você receberá um e-mail com os detalhes da sua compra.
          </p>
          {product.product_type === 'digital' && (
            <p className="text-emerald-600 mt-2 font-medium">
              Seu acesso será liberado em instantes.
            </p>
          )}
        </div>
        <Card className="w-full max-w-md bg-white border-slate-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              {settings.show_product_image && product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div>
                <h3 className="font-semibold text-slate-900">{product.name}</h3>
                <p className="text-lg font-bold" style={{ color: VALUE_GREEN_COLOR }}>{formatCurrency(totalPrice)}</p>
              </div>
            </div>
            <Separator className="my-4 bg-slate-200" />
            <div className="text-sm text-slate-500 space-y-1">
              <p>Comprador: {formData.name}</p>
              <p>E-mail: {formData.email}</p>
              {transactionId && <p className="font-mono text-xs">ID: {transactionId}</p>}
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  const getBorderRadius = () => {
    switch (settings.border_style) {
      case 'rounded': return { card: 'rounded-xl', input: 'rounded-lg', button: 'rounded-full' };
      case 'semi': return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-lg' };
      case 'square': return { card: 'rounded-none', input: 'rounded-none', button: 'rounded-none' };
      default: return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-lg' };
    }
  };

  const borderRadius = getBorderRadius();

  return (
    <div className="min-h-screen bg-white">
      {/* Timer */}
      {settings.show_timer && timeLeft > 0 && (
        <div 
          className="py-3 text-center" 
          style={{ 
            backgroundColor: settings.timer_color || '#ef4444',
            color: settings.timer_text_color || '#ffffff'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{settings.timer_text}</span>
            <span className="font-bold tabular-nums">{formatTime(timeLeft)}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {settings.show_logo && (
            settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 object-contain" />
            ) : (
              <Logo />
            )
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Lock className="w-4 h-4 text-emerald-500" />
            Ambiente seguro
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-8">
            
            {/* Coluna Esquerda - Produto e Valores */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Card */}
              <Card className={`bg-white border-slate-200 shadow-sm ${borderRadius.card}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                    Resumo do Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    {settings.show_product_image && product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className={`w-20 h-20 object-cover ${borderRadius.input}`}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
                          {getProductTypeIcon()}
                          <span className="ml-1">{getProductTypeLabel()}</span>
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-slate-900">{product.name}</h3>
                      {settings.show_product_description && product.description && (
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-slate-200" />

                  {/* Valores */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium" style={{ color: valueColor }}>
                        {formatCurrency(displayedPrice)}
                      </span>
                    </div>
                    
                    {offer && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Desconto</span>
                        <span className="font-medium" style={{ color: VALUE_GREEN_COLOR }}>
                          -{formatCurrency((product?.price || 0) - offer.final_price)}
                        </span>
                      </div>
                    )}

                    {selectedBumps.length > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Adicionais</span>
                        <span className="font-medium" style={{ color: valueColor }}>
                          {formatCurrency(
                            orderBumps
                              .filter(b => selectedBumps.includes(b.id))
                              .reduce((acc, b) => acc + (b.discount_price || b.price), 0)
                          )}
                        </span>
                      </div>
                    )}

                    <Separator className="bg-slate-200" />

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-900">Total</span>
                      <span className="text-2xl font-bold" style={{ color: valueColor }}>
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Order Bumps */}
                  {orderBumps.length > 0 && (
                    <>
                      <Separator className="bg-slate-200" />
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">Adicione ao seu pedido:</p>
                        {orderBumps.map((bump) => (
                          <label
                            key={bump.id}
                            className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-all ${borderRadius.input} ${
                              selectedBumps.includes(bump.id)
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedBumps.includes(bump.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBumps([...selectedBumps, bump.id]);
                                } else {
                                  setSelectedBumps(selectedBumps.filter(id => id !== bump.id));
                                }
                              }}
                              className="mt-1 accent-emerald-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 text-sm">{bump.name}</p>
                              {bump.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{bump.description}</p>
                              )}
                              <p className="text-sm mt-1" style={{ color: VALUE_GREEN_COLOR }}>
                                +{formatCurrency(bump.discount_price || bump.price)}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Security Seals - Desktop */}
              {settings.security_seals_enabled && (
                <div className={`hidden lg:flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 ${borderRadius.card}`}>
                  {settings.security_seal_secure_purchase && (
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-slate-600">{settings.security_seal_secure_purchase_text}</span>
                    </div>
                  )}
                  {settings.security_seal_secure_site && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-slate-600">{settings.security_seal_secure_site_text}</span>
                    </div>
                  )}
                  {settings.security_seal_guarantee && (
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-slate-600">{settings.security_seal_guarantee_text}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Coluna Direita - Formulário */}
            <div className="lg:col-span-3">
              <Card className={`bg-white border-slate-200 shadow-sm ${borderRadius.card}`}>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-slate-900">
                    Dados para pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Dados do Comprador */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-slate-700">Nome completo *</Label>
                        <Input
                          id="name"
                          placeholder="Seu nome"
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          required
                          className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.name ? 'border-red-500' : ''} ${borderRadius.input}`}
                        />
                        {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
                      </div>

                      {settings.require_email && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700">E-mail *</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="seu@email.com"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              required
                              className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.email ? 'border-red-500' : ''} ${borderRadius.input}`}
                            />
                            {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="emailConfirm" className="text-slate-700">Confirmar E-mail *</Label>
                            <Input
                              id="emailConfirm"
                              type="email"
                              placeholder="Confirme seu e-mail"
                              value={formData.emailConfirm}
                              onChange={(e) => handleInputChange('emailConfirm', e.target.value)}
                              required
                              className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.emailConfirm ? 'border-red-500' : ''} ${borderRadius.input}`}
                            />
                            {formErrors.emailConfirm && <p className="text-xs text-red-500">{formErrors.emailConfirm}</p>}
                          </div>
                        </>
                      )}

                      <div className={`grid gap-4 ${settings.require_document && settings.require_phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {settings.require_document && (
                          <div className="space-y-2">
                            {settings.document_type_accepted === 'both' ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <Label className="text-slate-700">Documento *</Label>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDocTypeChange('cpf')}
                                      className={`px-2 py-1 text-xs rounded transition-colors ${
                                        selectedDocType === 'cpf' 
                                          ? 'bg-emerald-500 text-white' 
                                          : 'text-slate-500 border border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      CPF
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDocTypeChange('cnpj')}
                                      className={`px-2 py-1 text-xs rounded transition-colors ${
                                        selectedDocType === 'cnpj' 
                                          ? 'bg-emerald-500 text-white' 
                                          : 'text-slate-500 border border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      CNPJ
                                    </button>
                                  </div>
                                </div>
                                <Input
                                  id="document"
                                  placeholder={selectedDocType === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                                  value={formData.document}
                                  onChange={(e) => handleInputChange('document', e.target.value)}
                                  required
                                  className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.document ? 'border-red-500' : ''} ${borderRadius.input}`}
                                  maxLength={selectedDocType === 'cnpj' ? 18 : 14}
                                />
                              </>
                            ) : (
                              <>
                                <Label htmlFor="document" className="text-slate-700">
                                  {effectiveDocType === 'cnpj' ? 'CNPJ' : 'CPF'} *
                                </Label>
                                <Input
                                  id="document"
                                  placeholder={effectiveDocType === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                                  value={formData.document}
                                  onChange={(e) => handleInputChange('document', e.target.value)}
                                  required
                                  className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.document ? 'border-red-500' : ''} ${borderRadius.input}`}
                                  maxLength={effectiveDocType === 'cnpj' ? 18 : 14}
                                />
                              </>
                            )}
                            {formErrors.document && <p className="text-xs text-red-500">{formErrors.document}</p>}
                          </div>
                        )}
                        {settings.require_phone && (
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-slate-700">Telefone *</Label>
                            <Input
                              id="phone"
                              placeholder="(00) 00000-0000"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              required
                              className={`bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 ${formErrors.phone ? 'border-red-500' : ''} ${borderRadius.input}`}
                              maxLength={15}
                            />
                            {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-slate-200" />

                    {/* Payment Methods */}
                    <div className="space-y-4">
                      <Label className="text-slate-700">Forma de pagamento</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {availablePaymentMethods.pix && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("pix")}
                            className={`p-4 ${borderRadius.card} border-2 transition-all flex flex-col items-center gap-2 ${
                              paymentMethod === "pix"
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <Smartphone className={`w-6 h-6 ${paymentMethod === "pix" ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <span className="text-sm font-medium text-slate-900">PIX</span>
                            {paymentMethod === "pix" && (
                              <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">
                                Aprovação imediata
                              </Badge>
                            )}
                          </button>
                        )}
                        {availablePaymentMethods.credit_card && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("credit_card")}
                            className={`p-4 ${borderRadius.card} border-2 transition-all flex flex-col items-center gap-2 ${
                              paymentMethod === "credit_card"
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <CreditCard className={`w-6 h-6 ${paymentMethod === "credit_card" ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <span className="text-sm font-medium text-slate-900">Cartão</span>
                          </button>
                        )}
                        {availablePaymentMethods.boleto && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("boleto")}
                            className={`p-4 ${borderRadius.card} border-2 transition-all flex flex-col items-center gap-2 ${
                              paymentMethod === "boleto"
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                          >
                            <FileText className={`w-6 h-6 ${paymentMethod === "boleto" ? 'text-emerald-500' : 'text-slate-400'}`} />
                            <span className="text-sm font-medium text-slate-900">Boleto</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Credit Card Form */}
                    {paymentMethod === "credit_card" && (
                      <div className="space-y-4">
                        <CreditCardForm
                          cardData={cardData}
                          onCardDataChange={handleCardDataChange}
                          errors={cardErrors}
                          disabled={processing}
                          threeDSSettings={threeDSSettings}
                          iframeId={getIframeId()}
                        />
                        {!isPodPayReady && PODPAY_PUBLIC_KEY && (
                          <p className="text-xs text-amber-600 text-center">
                            Carregando sistema de pagamento seguro...
                          </p>
                        )}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className={`w-full h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all ${borderRadius.button}`}
                      disabled={processing || (paymentMethod === "credit_card" && PODPAY_PUBLIC_KEY && !isPodPayReady)}
                      style={{ 
                        backgroundColor: settings.button_background_color || VALUE_GREEN_COLOR,
                        color: settings.button_text_color || '#ffffff'
                      }}
                    >
                      {processing || isTokenizing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {isTokenizing ? "Processando cartão..." : "Processando..."}
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5 mr-2" />
                          {settings.button_status || settings.button_text}
                        </>
                      )}
                    </Button>

                    {/* Security Seals - Mobile */}
                    {settings.security_seals_enabled && (
                      <div className={`lg:hidden flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 ${borderRadius.card}`}>
                        {settings.security_seal_secure_purchase && (
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-slate-600">{settings.security_seal_secure_purchase_text}</span>
                          </div>
                        )}
                        {settings.security_seal_secure_site && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-slate-600">{settings.security_seal_secure_site_text}</span>
                          </div>
                        )}
                        {settings.security_seal_guarantee && (
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm text-slate-600">{settings.security_seal_guarantee_text}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-center text-slate-500">
                      {settings.footer_text || "Ao clicar em pagar, você concorda com os termos de uso."}
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-16 py-6 bg-slate-50">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Ambiente seguro com criptografia SSL
          </p>
        </div>
      </footer>

      {/* Social Proof */}
      <SocialProofNotifications
        settings={{
          social_proof_enabled: settings.social_proof_enabled,
          social_proof_notification_1_enabled: settings.social_proof_notification_1_enabled,
          social_proof_notification_1_text: settings.social_proof_notification_1_text,
          social_proof_notification_2_enabled: settings.social_proof_notification_2_enabled,
          social_proof_notification_2_text: settings.social_proof_notification_2_text,
          social_proof_notification_3_enabled: settings.social_proof_notification_3_enabled,
          social_proof_notification_3_text: settings.social_proof_notification_3_text,
          social_proof_notification_4_enabled: settings.social_proof_notification_4_enabled,
          social_proof_notification_4_text: settings.social_proof_notification_4_text,
        }}
        productName={product.name}
        primaryColor={settings.primary_color}
        isDarkTheme={false}
      />
    </div>
  );
};

export default CheckoutClean;
