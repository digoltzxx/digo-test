import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  MessageCircle,
  Plus,
  Minus,
} from "lucide-react";
import Logo from "@/components/ui/Logo";
import { createCheckoutSchema, maskCPF, maskCNPJ, maskPhone } from "@/lib/validation";
import CreditCardForm from "@/components/checkout/CreditCardForm";
import SocialProofNotifications from "@/components/checkout/SocialProofNotifications";
import SocialProofTestimonials from "@/components/checkout/SocialProofTestimonials";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
import MobileCheckoutLayout from "@/components/checkout/MobileCheckoutLayout";
import CheckoutDebugPanel from "@/components/checkout/CheckoutDebugPanel";
import { usePodPayCard, CardFormData } from "@/hooks/usePodPayCard";
import { useCheckoutDebug } from "@/hooks/useCheckoutDebug";
import { useAbandonedCartTracking } from "@/hooks/useAbandonedCartTracking";
import { validateCheckoutPayload, logValidationResult } from "@/lib/checkoutValidation";
import { hasValidLogisticsForCheckout, isPhysicalProduct, buildFreightPayload } from "@/lib/logisticsValidation";
import AddressSection, { AddressData } from "@/components/checkout/AddressSection";
import { QRCodeSVG } from "qrcode.react";
import { useIsMobile } from "@/hooks/use-mobile";
import useUtmTracking from "@/hooks/useUtmTracking";

// PodPay public key from environment
const PODPAY_PUBLIC_KEY = import.meta.env.VITE_PODPAY_PUBLIC_KEY || null;

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  user_id: string;
  payment_type?: 'one_time' | 'subscription';
  subscription_quantity_mode?: 'single' | 'license' | 'seat';
  product_type?: string;
  // Logistics fields for physical products
  height_cm?: number | null;
  width_cm?: number | null;
  length_cm?: number | null;
  weight_grams?: number | null;
}

interface OrderBump {
  id: string;
  product_id: string;
  bump_product_id: string | null;
  name: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  discount_type?: 'fixed' | 'percentage';
  discount_value?: number;
  is_active: boolean;
  is_subscription?: boolean;
  subscription_interval?: 'monthly' | 'quarterly' | 'yearly' | null;
  position: number;
  image_url: string | null;
  sales_phrase: string | null;
  auxiliary_phrase: string | null;
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
  // New fields
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
  // Social Proof Notifications
  social_proof_enabled: boolean;
  social_proof_notification_1_enabled: boolean;
  social_proof_notification_1_text: string;
  social_proof_notification_2_enabled: boolean;
  social_proof_notification_2_text: string;
  social_proof_notification_3_enabled: boolean;
  social_proof_notification_3_text: string;
  social_proof_notification_4_enabled: boolean;
  social_proof_notification_4_text: string;
  social_proof_initial_delay: number;
  social_proof_duration: number;
  social_proof_interval_min: number;
  social_proof_interval_max: number;
  social_proof_min_people: number;
  social_proof_max_people: number;
  // Security Seals
  security_seals_enabled: boolean;
  security_seal_secure_site: boolean;
  security_seal_secure_purchase: boolean;
  security_seal_guarantee: boolean;
  security_seal_secure_site_text: string;
  security_seal_secure_purchase_text: string;
  security_seal_guarantee_text: string;
  // Animations
  checkout_animation_enabled: boolean;
  // Button Colors
  button_background_color: string;
  button_text_color: string;
  // WhatsApp Button
  whatsapp_button_enabled: boolean;
  whatsapp_support_phone: string | null;
  // Back Redirect
  back_redirect_enabled: boolean;
  back_redirect_url: string | null;
  // Quantity Selector
  quantity_selector_enabled: boolean;
}

interface PixData {
  // Código EMV/copia-e-cola válido retornado pela PodPay
  pix_copia_cola: string;
  // QR Code em base64
  qr_code_base64: string;
  // Data de expiração
  expiration_date?: string;
  // Tempo de expiração em minutos
  expiration_minutes: number;
}

const defaultSettings: CheckoutSettings = {
  logo_url: null,
  banner_url: null,
  primary_color: '#3b82f6', // Azul como cor padrão do gateway
  background_color: '#0f172a',
  button_text: 'Finalizar Compra',
  show_product_image: true,
  show_product_description: true,
  show_guarantee: true,
  guarantee_days: 7,
  require_phone: false,
  require_document: false,
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
  // New fields
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
  theme_mode: 'dark',
  border_style: 'rounded',
  favicon_url: null,
  show_logo: true,
  // Social Proof Notifications
  social_proof_enabled: false,
  social_proof_notification_1_enabled: false,
  social_proof_notification_1_text: '{quantidadePessoas} pessoas estão comprando {nomeProduto} **AGORA**.',
  social_proof_notification_2_enabled: false,
  social_proof_notification_2_text: '{quantidadePessoas} pessoas compraram {nomeProduto} **HOJE**.',
  social_proof_notification_3_enabled: false,
  social_proof_notification_3_text: '{nomeHomem} comprou {nomeProduto} **AGORA**.',
  social_proof_notification_4_enabled: false,
  social_proof_notification_4_text: '{nomeMulher} comprou {nomeProduto} **AGORA**.',
  social_proof_initial_delay: 3,
  social_proof_duration: 5,
  social_proof_interval_min: 8,
  social_proof_interval_max: 15,
  social_proof_min_people: 2,
  social_proof_max_people: 15,
  // Security Seals
  security_seals_enabled: true,
  security_seal_secure_site: true,
  security_seal_secure_purchase: true,
  security_seal_guarantee: true,
  security_seal_secure_site_text: 'Site Protegido com Criptografia',
  security_seal_secure_purchase_text: 'Compra 100% Segura',
  security_seal_guarantee_text: 'Garantia Total de Satisfação',
  // Animations
  checkout_animation_enabled: false,
  // Button Colors
  button_background_color: '#3b82f6',
  button_text_color: '#ffffff',
  // WhatsApp Button
  whatsapp_button_enabled: false,
  whatsapp_support_phone: null,
  // Back Redirect
  back_redirect_enabled: false,
  back_redirect_url: null,
  // Quantity Selector
  quantity_selector_enabled: false,
};

type PaymentMethod = "pix" | "credit_card" | "boleto";

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shortId, slug } = useParams<{ shortId?: string; slug?: string }>();
  const isMobile = useIsMobile();
  
  // Support both /p/:shortId and /checkout?product=id
  const productId = useMemo(() => {
    if (shortId) {
      return shortId;
    }
    return searchParams.get("product");
  }, [shortId, searchParams]);

  // Custom link slug for tracking and custom price
  const [customLink, setCustomLink] = useState<{ id: string; custom_price: number | null } | null>(null);

  // Get offer ID from URL query param
  const offerId = useMemo(() => searchParams.get("offer"), [searchParams]);

  // Support both ?ref= (affiliate link) and ?aff= (legacy)
  // Also check localStorage for persisted affiliate tracking
  const affiliateRef = useMemo(() => {
    const refParam = searchParams.get("ref") || searchParams.get("aff");
    if (refParam) {
      // Store in localStorage for persistence across page navigation
      localStorage.setItem("affiliate_ref", refParam);
      localStorage.setItem("affiliate_ref_product", productId || "");
      return refParam;
    }
    // Check localStorage for existing affiliate tracking
    const storedRef = localStorage.getItem("affiliate_ref");
    const storedProduct = localStorage.getItem("affiliate_ref_product");
    // Only use stored ref if it matches the current product
    if (storedRef && storedProduct === productId) {
      return storedRef;
    }
    return null;
  }, [searchParams, productId]);

  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
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
  const [quantity, setQuantity] = useState(1);
  const [priceAnimating, setPriceAnimating] = useState(false);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    campaign_id: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  
  // Selected document type when both CPF and CNPJ are allowed
  const [selectedDocType, setSelectedDocType] = useState<'cpf' | 'cnpj'>('cpf');

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    emailConfirm: "",
    document: "",
    phone: "",
  });

  // Address data for physical products
  const [addressData, setAddressData] = useState<AddressData>({
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  // Credit card state
  const [cardData, setCardData] = useState<CardFormData>({
    number: "",
    holderName: "",
    expiry: "",
    cvv: "",
  });
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // PodPay card hook - only for encryption and 3DS
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

  // Debug hook for step-by-step checkout debugging
  const checkoutDebug = useCheckoutDebug(productId);
  const [showDebugPanel, setShowDebugPanel] = useState(checkoutDebug.debugEnabled);

  // UTM Tracking - capture and persist UTMs for attribution
  const { utms, isInitialized: utmsInitialized, getUtmsForCheckout, hasUtms, refreshUtms } = useUtmTracking();

  // Refresh UTMs when URL changes (SPA navigation)
  useEffect(() => {
    refreshUtms();
  }, [searchParams, refreshUtms]);

  // UTM tracking initialized

  // Abandoned cart tracking - create cart data when product is loaded
  const abandonedCartData = useMemo(() => {
    if (!product) return null;
    return {
      productId: product.id,
      productName: product.name,
      amount: product.price,
      sellerUserId: product.user_id,
    };
  }, [product]);

  const { 
    updateCustomerData: updateAbandonedCartCustomer, 
    removeAbandonedCart,
    markAsRecovered 
  } = useAbandonedCartTracking(abandonedCartData);

  // Validate and resolve affiliate reference - silent validation, no errors to user
  useEffect(() => {
    const validateAffiliate = async () => {
      // No affiliate reference - nothing to validate
      if (!affiliateRef || !productId) {
        setAffiliateId(null);
        setAffiliateError(null);
        return;
      }

      try {
        // Try multiple matching strategies for affiliate validation
        let affiliation = null;

        // Strategy 1: Try exact match with full UUID
        if (affiliateRef.length === 36 && affiliateRef.includes("-")) {
          const { data } = await supabase
            .from("affiliations")
            .select("id, product_id, user_id, status")
            .eq("id", affiliateRef)
            .eq("status", "active")
            .maybeSingle();
          
          if (data) {
            affiliation = data;
          }
        }

        // Strategy 2: Try short ID match (first 8 chars)
        if (!affiliation && affiliateRef.length >= 8) {
          const { data } = await supabase
            .from("affiliations")
            .select("id, product_id, user_id, status")
            .ilike("id", `${affiliateRef.slice(0, 8)}%`)
            .eq("status", "active")
            .limit(1);
          
          if (data && data.length > 0) {
            affiliation = data[0];
          }
        }

        if (!affiliation) {
          // Silently clear - don't show error to user
          setAffiliateId(null);
          setAffiliateError(null);
          localStorage.removeItem("affiliate_ref");
          localStorage.removeItem("affiliate_ref_product");
          return;
        }

        // Now validate product match
        const affiliateProductShort = affiliation.product_id.slice(0, 8).toLowerCase();
        const currentProductShort = productId.slice(0, 8).toLowerCase();
        const isFullMatch = affiliation.product_id === productId;
        const isShortMatch = affiliateProductShort === currentProductShort;

        if (import.meta.env.DEV) console.log("Product validation:", {
          affiliateProductId: affiliation.product_id,
          currentProductId: productId,
          affiliateProductShort,
          currentProductShort,
          isFullMatch,
          isShortMatch
        });

        if (isFullMatch || isShortMatch) {
          // Valid affiliate - set it silently
          setAffiliateId(affiliation.id);
          setAffiliateError(null);
          if (import.meta.env.DEV) console.log("✅ Affiliate validated successfully:", affiliation.id);

          // Track affiliate click silently - don't block checkout if it fails
          const sessionId = localStorage.getItem("session_id") || 
            `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem("session_id", sessionId);

          // Fire and forget - don't await
          supabase.functions.invoke('track-affiliate-click', {
            body: {
              affiliation_id: affiliation.id,
              product_id: affiliation.product_id,
              session_id: sessionId,
              referrer_url: document.referrer || null,
              landing_url: window.location.href,
            },
          }).then(({ error }) => {
            if (import.meta.env.DEV) {
              if (error) {
                console.log("Tracking call had error (non-blocking):", error);
              } else {
                console.log("✅ Affiliate click tracked");
              }
            }
          }).catch(err => {
            if (import.meta.env.DEV) console.log("Tracking failed (non-blocking):", err);
          });

        } else {
          // Product mismatch - silently ignore, clear local storage
          if (import.meta.env.DEV) console.log("Affiliate product mismatch - clearing");
          setAffiliateId(null);
          setAffiliateError(null);
          localStorage.removeItem("affiliate_ref");
          localStorage.removeItem("affiliate_ref_product");
        }
      } catch (err) {
        // Any error - silently fail, don't block checkout
        console.error("Error in affiliate validation (non-blocking):", err);
        setAffiliateId(null);
        setAffiliateError(null);
      }
    };

    validateAffiliate();
  }, [affiliateRef, productId]);

  // Note: Custom link fetch is now handled inside fetchProductAndSettings
  // to ensure it runs AFTER the product is loaded

  useEffect(() => {
    if (import.meta.env.DEV) console.log("Checkout loading with productId:", productId, "offerId:", offerId, "slug:", slug);
    if (productId) {
      // Reset offer state when offerId changes to prevent stale data
      // Note: Don't reset customLink here - it will be fetched after product loads
      setOffer(null);
      fetchProductAndSettings(slug);
    } else {
      setLoading(false);
    }
  }, [productId, offerId, slug]);

  // Back redirect effect - handle browser back button
  useEffect(() => {
    if (!settings.back_redirect_enabled || !settings.back_redirect_url) return;

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.location.href = settings.back_redirect_url!;
    };

    // Push current state to history so we can detect back button
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [settings.back_redirect_enabled, settings.back_redirect_url]);

  // Timer countdown for offer - RESPECTS PAYMENT STATUS
  useEffect(() => {
    if (settings.show_timer && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [settings.show_timer, timeLeft]);

  // Handle timer expiration - NEVER expires if payment approved or processing
  useEffect(() => {
    if (timeLeft === 0 && settings.show_timer && paymentStatus === 'idle') {
      // Only show expiration if not processing or approved
      if (import.meta.env.DEV) console.log('[Timer] Session timer expired, status:', paymentStatus);
      // Don't auto-fail, just show expired text in timer UI
    }
  }, [timeLeft, settings.show_timer, paymentStatus]);

  // Timer countdown for PIX expiration - RESPECTS PAYMENT STATUS
  useEffect(() => {
    if (paymentStatus === "pix_pending" && pixTimeLeft > 0) {
      const timer = setInterval(() => {
        setPixTimeLeft((prev) => {
          if (prev <= 1) {
            // Check payment status before showing error
            // Use callback to get current paymentStatus
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [paymentStatus, pixTimeLeft]);

  // Handle PIX expiration separately to respect payment status
  useEffect(() => {
    if (pixTimeLeft === 0 && paymentStatus === "pix_pending") {
      // Only show error if still pending (not approved in the meantime)
      if (import.meta.env.DEV) console.log('[PIX Timer] Expired, checking status before error');
      // Small delay to ensure we don't race with approval
      const timeout = setTimeout(() => {
        if (paymentStatus === "pix_pending") {
          setPaymentStatus("error");
          toast.error("Tempo expirado. Por favor, tente novamente.");
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [pixTimeLeft, paymentStatus]);

  // =====================================================
  // POLLING AUTOMÁTICO DE STATUS DO PAGAMENTO PIX
  // Verifica a cada 5 segundos se o pagamento foi aprovado
  // REGRA: Uma vez aprovado, PARA o polling e não muda mais
  // =====================================================
  useEffect(() => {
    // Só faz polling se estiver aguardando PIX
    if (paymentStatus !== "pix_pending" || !transactionId) {
      return;
    }

    if (import.meta.env.DEV) console.log("[Polling] Starting payment status polling for transaction:", transactionId);
    let isApproved = false; // Flag local para evitar race conditions

    const checkPaymentStatus = async () => {
      // Se já aprovado localmente, para
      if (isApproved) {
        if (import.meta.env.DEV) console.log("[Polling] Already approved locally, skipping check");
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-transaction?transaction_id=${transactionId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );

        if (!response.ok) {
          if (import.meta.env.DEV) console.log("[Polling] Status check response not ok:", response.status);
          return;
        }

        const result = await response.json();
        if (import.meta.env.DEV) console.log("[Polling] Payment status check result:", result);

        if (result.success && result.status === 'approved') {
          if (import.meta.env.DEV) console.log("[Polling] ✅ Payment APPROVED! Setting success state...");
          
          // LOCK: Marca como aprovado ANTES de atualizar estado
          isApproved = true;
          
          // Atualiza estado - isso vai parar o polling no próximo ciclo
          setPaymentStatus("success");
          
          // Mostra toast de sucesso (prioridade máxima)
          toast.success("Pagamento confirmado! Obrigado pela compra.", {
            duration: 5000,
          });
          
          // Clear affiliate tracking after successful purchase
          localStorage.removeItem("affiliate_ref");
          localStorage.removeItem("affiliate_ref_product");
          
          // Mark abandoned cart as recovered (purchase completed)
          markAsRecovered();
          
        } else if (result.status === 'refused' || result.status === 'cancelled') {
          // Só mostra erro se não foi aprovado
          if (!isApproved) {
            if (import.meta.env.DEV) console.log("[Polling] Payment failed with status:", result.status);
            setPaymentStatus("error");
            toast.error(`Pagamento ${result.status === 'refused' ? 'recusado' : 'cancelado'}.`);
          }
        }
        // NOTE: Não tratamos 'expired' aqui pois o timer do PIX já cuida disso
      } catch (err) {
        console.error("[Polling] Error checking payment status:", err);
        // Don't show error to user, just log - polling will retry
      }
    };

    // Check immediately, then every 5 seconds
    checkPaymentStatus();
    const pollInterval = setInterval(checkPaymentStatus, 5000);

    return () => {
      if (import.meta.env.DEV) console.log("[Polling] Stopping payment status polling");
      clearInterval(pollInterval);
    };
  }, [paymentStatus, transactionId]);

  const fetchProductAndSettings = async (slugParam?: string) => {
    const currentSlug = slugParam || slug;
    if (import.meta.env.DEV) console.log("=== FETCH START ===");
    if (import.meta.env.DEV) console.log("productId:", productId, "offerId:", offerId, "currentSlug:", currentSlug);
    
    try {
      let productData = null;
      const isFullUUID = productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

      if (isFullUUID) {
        if (import.meta.env.DEV) console.log("Fetching product by full UUID:", productId);
        const { data: exactMatch, error: exactError } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .eq("status", "active")
          .maybeSingle();

        if (exactError) {
          console.error("Error fetching product by UUID:", exactError);
        }
        productData = exactMatch;
      } else if (productId) {
        // First try to find campaign link by short_code
        if (import.meta.env.DEV) console.log("Trying to fetch campaign link by short_code:", productId);
        const { data: linkData } = await supabase.rpc('find_product_link_by_code', { code: productId });
        
        if (linkData && linkData.length > 0) {
          const link = linkData[0];
          if (import.meta.env.DEV) console.log("Found campaign link:", link);
          // Fetch the actual product
          const { data: productByLink } = await supabase
            .from("products")
            .select("*")
            .eq("id", link.product_id)
            .eq("status", "active")
            .maybeSingle();
          
          if (productByLink) {
            productData = productByLink;
            // Set custom link price immediately
            setCustomLink({ id: link.id, custom_price: link.custom_price });
            // Track click - increment
            supabase
              .from("product_links")
              .select("clicks")
              .eq("id", link.id)
              .single()
              .then(({ data: linkClicks }) => {
                supabase
                  .from("product_links")
                  .update({ clicks: ((linkClicks as any)?.clicks || 0) + 1 })
                  .eq("id", link.id)
                  .then(() => {});
              });
          }
        }
        
        // If not found as campaign link, try slug
        if (!productData) {
          if (import.meta.env.DEV) console.log("Trying to fetch product by slug:", productId);
          const { data: slugMatch, error: slugError } = await supabase
            .from("products")
            .select("*")
            .eq("slug", productId)
            .eq("status", "active")
            .maybeSingle();
          
          if (slugError) {
            console.error("Error fetching product by slug:", slugError);
          }
          
          if (slugMatch) {
            if (import.meta.env.DEV) console.log("Found product by slug:", slugMatch.id);
            productData = slugMatch;
          } else if (productId.length >= 8) {
            // Fallback to short ID
            if (import.meta.env.DEV) console.log("Fetching product by short ID:", productId);
            const { data: shortMatch, error: shortError } = await supabase
              .rpc("find_product_by_short_id", { short_id: productId })
              .maybeSingle();
            
            if (shortError) {
              console.error("Error fetching product by short ID:", shortError);
            }
            productData = shortMatch;
          }
        }
      }

      if (import.meta.env.DEV) console.log("Product data found:", productData?.id, productData?.name, "Price:", productData?.price);
      setProduct(productData);
      
      // Fetch custom link if slug is provided - do this BEFORE setting loading to false
      if (currentSlug && productData) {
        if (import.meta.env.DEV) console.log("[CustomLink] Fetching in fetchProductAndSettings - slug:", currentSlug, "productId:", productData.id);
        try {
          const { data: linkData, error: linkError } = await supabase
            .from("product_links")
            .select("id, custom_price, is_active, clicks, product_id")
            .eq("slug", currentSlug)
            .eq("is_active", true)
            .maybeSingle();
          
          if (linkError) {
            console.error("[CustomLink] Error:", linkError);
          } else if (linkData && linkData.product_id === productData.id) {
            if (import.meta.env.DEV) console.log("[CustomLink] ✅ Found! custom_price:", linkData.custom_price);
            setCustomLink({ id: linkData.id, custom_price: linkData.custom_price });
            
            // Track click
            await supabase
              .from("product_links")
              .update({ clicks: (linkData.clicks || 0) + 1 })
              .eq("id", linkData.id);
          } else {
            if (import.meta.env.DEV) console.log("[CustomLink] No match - linkData:", linkData, "expected product:", productData.id);
          }
        } catch (err) {
          console.error("[CustomLink] Exception:", err);
        }
      }
      
      // Log checkout start for debugging
      if (productData) {
        checkoutDebug.logStart({
          id: productData.id,
          name: productData.name,
          price: productData.price,
        });
      }

      if (productData) {
        // Fetch offer if offerId is provided
        let offerData: ProductOffer | null = null;
        if (offerId) {
          if (import.meta.env.DEV) console.log("=== FETCHING OFFER ===");
          if (import.meta.env.DEV) console.log("offerId from URL:", offerId);
          if (import.meta.env.DEV) console.log("Product ID for offer lookup:", productData.id);
          
          // Try full UUID first, then short ID (prefix match)
          const isOfferFullUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(offerId);
          
          if (isOfferFullUUID) {
            if (import.meta.env.DEV) console.log("Fetching offer by full UUID");
            const { data: fetchedOffer, error: offerError } = await supabase
              .from("product_offers")
              .select("*")
              .eq("id", offerId)
              .eq("product_id", productData.id)
              .eq("status", "active")
              .maybeSingle();

            if (offerError) {
              console.error("Error fetching offer by UUID:", offerError);
            }
            if (fetchedOffer) {
              offerData = fetchedOffer as ProductOffer;
              if (import.meta.env.DEV) console.log("Offer fetched by UUID:", fetchedOffer);
            }
          } else if (offerId.length >= 8) {
            // Short ID - search by prefix
            if (import.meta.env.DEV) console.log("Fetching offer by short ID prefix:", offerId);
            const { data: fetchedOffers, error: offerError } = await supabase
              .from("product_offers")
              .select("*")
              .ilike("id", `${offerId}%`)
              .eq("product_id", productData.id)
              .eq("status", "active");

            if (offerError) {
              console.error("Error fetching offer by short ID:", offerError);
            }
            if (import.meta.env.DEV) console.log("Offers found by short ID:", fetchedOffers);
            if (fetchedOffers && fetchedOffers.length > 0) {
              offerData = fetchedOffers[0] as ProductOffer;
            }
          }
          
          if (offerData) {
            setOffer(offerData);
            if (import.meta.env.DEV) {
              console.log("=== OFFER SET ===");
              console.log("Offer ID:", offerData.id);
              console.log("Offer Name:", offerData.name);
              console.log("Offer Final Price:", offerData.final_price);
            }
          } else {
            if (import.meta.env.DEV) {
              console.log("=== OFFER NOT FOUND ===");
              console.log("No offer found for ID:", offerId);
            }
            // Ensure offer is null if not found
            setOffer(null);
          }
        } else {
          if (import.meta.env.DEV) console.log("No offerId in URL - using product base price");
          setOffer(null);
        }

        const { data: settingsData } = await supabase
          .from("checkout_settings")
          .select("*")
          .eq("product_id", productData.id)
          .maybeSingle();

        if (settingsData) {
          setSettings({ ...defaultSettings, ...settingsData });
          if (settingsData.show_timer) {
            setTimeLeft(settingsData.timer_minutes * 60);
          }
        }

        // Payment method selection based on settings only
        const pixEnabled = settingsData?.pix_enabled ?? true;
        const creditCardEnabled = settingsData?.credit_card_enabled ?? true;
        const boletoEnabled = settingsData?.boleto_enabled ?? false;

        if (pixEnabled) {
          setPaymentMethod("pix");
        } else if (creditCardEnabled) {
          setPaymentMethod("credit_card");
        } else if (boletoEnabled) {
          setPaymentMethod("boleto");
        }

        // Always fetch order bumps - they will be displayed if any exist
        const { data: bumpsData } = await supabase
          .from("order_bumps")
          .select("*, bump_product:products!order_bumps_bump_product_id_fkey(description)")
          .eq("product_id", productData.id)
          .eq("is_active", true)
          .order("position");
        
        if (bumpsData && bumpsData.length > 0) {
          if (import.meta.env.DEV) {
            console.log('=== ORDER BUMPS LOADED ===');
            console.log('Bumps count:', bumpsData.length);
            console.log('Bumps:', bumpsData.map(b => ({ id: b.id, name: b.name, price: b.price, discount: b.discount_price })));
          }
          
          // Cast discount_type to proper type and use bump product description as fallback
          const typedBumps: OrderBump[] = bumpsData.map(b => ({
            ...b,
            description: b.description || (b.bump_product as any)?.description || null,
            discount_type: (b.discount_type as 'fixed' | 'percentage') || undefined,
            subscription_interval: (b.subscription_interval as 'monthly' | 'quarterly' | 'yearly' | null) || null,
          }));
          setOrderBumps(typedBumps);
        }
      }
    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Erro ao carregar produto");
    } finally {
      setLoading(false);
    }
  };

  // Calculate base price (custom link price > offer price > product price)
  const basePrice = useMemo(() => {
    if (import.meta.env.DEV) console.log("[BasePrice] Calculating - customLink:", customLink, "offer:", offer?.final_price, "product.price:", product?.price);
    
    // Priority: Custom link price > Offer price > Product price
    if (customLink?.custom_price && customLink.custom_price > 0) {
      if (import.meta.env.DEV) console.log("[BasePrice] Using custom link price:", customLink.custom_price);
      return Math.max(0.01, customLink.custom_price);
    }
    const price = offer ? offer.final_price : (product?.price || 0);
    if (import.meta.env.DEV) console.log("[BasePrice] Using regular price:", price);
    // Ensure minimum price of 0.01
    return Math.max(0.01, price);
  }, [offer, product, customLink]);

  // Calculate order bumps total with validation
  const orderBumpsTotal = useMemo(() => {
    // Filter only valid selected bumps
    const selectedBumpItems = orderBumps.filter(bump => {
      // Must be selected
      if (!selectedBumps.includes(bump.id)) return false;
      // Must be active
      if (!bump.is_active) return false;
      // Must have valid ID
      if (!bump.id) return false;
      return true;
    });
    
    const total = selectedBumpItems.reduce((sum, bump) => {
      // Get the effective price (discount or original)
      let bumpPrice = bump.discount_price !== null ? bump.discount_price : bump.price;
      // Ensure positive price (minimum 1 centavo)
      bumpPrice = Math.max(0.01, bumpPrice);
      return sum + bumpPrice;
    }, 0);
    
    // Round to 2 decimal places to avoid floating point issues
    const roundedTotal = Math.round(total * 100) / 100;
    
    if (import.meta.env.DEV) {
      console.log('=== ORDER BUMPS TOTAL CALCULATION ===');
      console.log('Selected bump IDs:', selectedBumps);
      console.log('Valid selected bumps:', selectedBumpItems.map(b => ({ 
        id: b.id, 
        name: b.name, 
        price: b.price, 
        discount: b.discount_price,
        effectivePrice: b.discount_price ?? b.price 
      })));
      console.log('Order bumps total:', roundedTotal);
    }
    
    return roundedTotal;
  }, [orderBumps, selectedBumps]);

  // Get selected order bump details for submission
  const selectedOrderBumpDetails = useMemo(() => {
    return orderBumps
      .filter(bump => selectedBumps.includes(bump.id) && bump.is_active)
      .map(bump => ({
        id: bump.id,
        bump_product_id: bump.bump_product_id,
        name: bump.name,
        price: Math.max(0.01, bump.discount_price ?? bump.price),
        is_subscription: bump.is_subscription || false,
        subscription_interval: bump.subscription_interval,
      }));
  }, [orderBumps, selectedBumps]);

  // Calculate coupon discount
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    
    const subtotal = basePrice * quantity + orderBumpsTotal;
    
    if (appliedCoupon.discount_type === 'percentage') {
      return Math.round((subtotal * appliedCoupon.discount_value / 100) * 100) / 100;
    } else {
      // Fixed discount can't be more than the subtotal
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  }, [appliedCoupon, basePrice, quantity, orderBumpsTotal]);

  // Calculate total displayed price (base * quantity + order bumps - coupon discount)
  const displayedPrice = useMemo(() => {
    const productTotal = basePrice * quantity;
    const subtotal = productTotal + orderBumpsTotal;
    const total = Math.max(0.01, subtotal - couponDiscount); // Minimum 1 centavo
    // Round to 2 decimal places
    const roundedTotal = Math.round(total * 100) / 100;
    
    if (import.meta.env.DEV) {
      console.log('=== DISPLAYED PRICE CALCULATION ===');
      console.log('Base price:', basePrice);
      console.log('Quantity:', quantity);
      console.log('Product total:', productTotal);
      console.log('Order bumps total:', orderBumpsTotal);
      console.log('Coupon discount:', couponDiscount);
      console.log('Displayed price:', roundedTotal);
    }
    
    return roundedTotal;
  }, [basePrice, orderBumpsTotal, quantity, couponDiscount]);

  // Validate and apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !product) return;
    
    setCouponLoading(true);
    setCouponError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          coupon_code: couponCode.trim().toUpperCase(),
          product_id: product.id,
          amount: basePrice * quantity + orderBumpsTotal,
        },
      });

      if (error) throw error;

      if (data.valid) {
        setAppliedCoupon({
          code: couponCode.trim().toUpperCase(),
          campaign_id: data.discount.campaign_id,
          discount_type: data.discount.type,
          discount_value: data.discount.value,
        });
        setCouponCode("");
        setPriceAnimating(true);
        setTimeout(() => setPriceAnimating(false), 300);
        toast.success(data.message);
      } else {
        setCouponError(data.message);
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setCouponError('Erro ao validar cupom');
      toast.error('Erro ao validar cupom');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
    setPriceAnimating(true);
    setTimeout(() => setPriceAnimating(false), 300);
    toast.info('Cupom removido');
  };

  const toggleOrderBump = (bumpId: string) => {
    // Validate bump exists
    const bump = orderBumps.find(b => b.id === bumpId);
    if (!bump) {
      console.error('[toggleOrderBump] Bump not found:', bumpId);
      return;
    }

    // Validate bump is active
    if (!bump.is_active) {
      console.error('[toggleOrderBump] Bump is inactive:', bumpId);
      toast.error('Este item não está mais disponível');
      return;
    }

    const isAdding = !selectedBumps.includes(bumpId);
    
    // Prevent duplicate additions
    if (isAdding && selectedBumps.includes(bumpId)) {
      console.warn('[toggleOrderBump] Bump already selected:', bumpId);
      return;
    }
    
    const newSelection = isAdding 
      ? [...selectedBumps, bumpId]
      : selectedBumps.filter(id => id !== bumpId);
    
    // Debug logging
    const bumpPrice = Math.max(0.01, bump.discount_price ?? bump.price);
    checkoutDebug.logOrderBumpToggle(
      bumpId, 
      bump.name, 
      bumpPrice,
      isAdding,
      newSelection
    );
    
    // Trigger price animation
    setPriceAnimating(true);
    setTimeout(() => setPriceAnimating(false), 300);
    
    setSelectedBumps(newSelection);
    
    // Show toast notification
    if (isAdding) {
      toast.success(`"${bump.name}" adicionado ao pedido!`, {
        description: `+${formatCurrency(bumpPrice)}`,
        duration: 2000,
      });
    } else {
      toast.info(`"${bump.name}" removido do pedido`, {
        duration: 2000,
      });
    }
  };

  // Get available payment methods from settings (offer doesn't control this anymore)
  const availablePaymentMethods = useMemo(() => {
    return {
      pix: settings.pix_enabled,
      credit_card: settings.credit_card_enabled,
      boleto: settings.boleto_enabled,
    };
  }, [settings]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Determine effective document type for validation and masking
  const effectiveDocType = useMemo(() => {
    if (settings.document_type_accepted === 'both') {
      return selectedDocType;
    }
    return settings.document_type_accepted as 'cpf' | 'cnpj';
  }, [settings.document_type_accepted, selectedDocType]);

  const validationSchema = useMemo(
    () => createCheckoutSchema(
      settings.require_document, 
      settings.require_phone, 
      settings.require_email,
      settings.document_type_accepted as 'cpf' | 'cnpj' | 'both',
      selectedDocType
    ),
    [settings.require_document, settings.require_phone, settings.require_email, settings.document_type_accepted, selectedDocType]
  );

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Clear document when switching document type
  const handleDocTypeChange = (docType: 'cpf' | 'cnpj') => {
    setSelectedDocType(docType);
    setFormData((prev) => ({ ...prev, document: '' }));
    setFormErrors((prev) => ({ ...prev, document: '' }));
  };

  const handleInputChange = (field: string, value: string) => {
    let maskedValue = value;
    if (field === 'document') {
      maskedValue = effectiveDocType === 'cnpj' ? maskCNPJ(value) : maskCPF(value);
    } else if (field === 'phone') {
      maskedValue = maskPhone(value);
    }
    setFormData((prev) => ({ ...prev, [field]: maskedValue }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }));
    }
    
    // Update abandoned cart with customer data
    if (field === 'name' || field === 'email' || field === 'phone') {
      const updatedData = { ...formData, [field]: maskedValue };
      updateAbandonedCartCustomer(
        updatedData.name || undefined,
        updatedData.email || undefined,
        updatedData.phone || undefined
      );
    }
  };

  const validateField = (field: string, value: string) => {
    try {
      const partialData = { ...formData, [field]: value };
      const result = validationSchema.safeParse(partialData);
      if (!result.success) {
        const fieldError = result.error.errors.find(err => err.path[0] === field);
        if (fieldError) {
          setFormErrors(prev => ({ ...prev, [field]: fieldError.message }));
        } else {
          setFormErrors(prev => ({ ...prev, [field]: '' }));
        }
      } else {
        setFormErrors(prev => ({ ...prev, [field]: '' }));
      }
    } catch (e) {
      // Ignore validation errors during field typing
    }
  };

  const copyPixCode = async () => {
    if (pixData?.pix_copia_cola) {
      try {
        await navigator.clipboard.writeText(pixData.pix_copia_cola);
        setCopiedPix(true);
        toast.success("Código PIX copiado!");
        setTimeout(() => setCopiedPix(false), 3000);
      } catch (error) {
        toast.error("Erro ao copiar código");
      }
    }
  };

  const handleCardDataChange = (field: string, value: string) => {
    setCardData((prev) => ({ ...prev, [field]: value }));
    if (cardErrors[field]) {
      setCardErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Address handlers for physical products
  const handleAddressChange = (field: keyof AddressData, value: string) => {
    setAddressData((prev) => ({ ...prev, [field]: value }));
    if (addressErrors[field]) {
      setAddressErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateAddressField = (field: string, value: string) => {
    // Validate required address fields
    const requiredFields = ['cep', 'street', 'number', 'neighborhood', 'city', 'state'];
    if (requiredFields.includes(field) && !value.trim()) {
      const fieldNames: Record<string, string> = {
        cep: 'CEP',
        street: 'Rua',
        number: 'Número',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'Estado',
      };
      setAddressErrors((prev) => ({ ...prev, [field]: `${fieldNames[field] || field} é obrigatório` }));
    } else if (field === 'cep') {
      const cleanCep = value.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        setAddressErrors((prev) => ({ ...prev, cep: 'CEP deve ter 8 dígitos' }));
      } else {
        setAddressErrors((prev) => ({ ...prev, cep: '' }));
      }
    } else {
      setAddressErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Validate all address fields for physical products
  const validateAddress = (): boolean => {
    if (!product || !isPhysicalProduct(product.product_type)) {
      return true; // No address needed for non-physical products
    }

    const errors: Record<string, string> = {};
    const cleanCep = addressData.cep.replace(/\D/g, '');

    if (!cleanCep || cleanCep.length !== 8) {
      errors.cep = 'CEP válido é obrigatório';
    }
    if (!addressData.street.trim()) {
      errors.street = 'Rua é obrigatória';
    }
    if (!addressData.number.trim()) {
      errors.number = 'Número é obrigatório';
    }
    if (!addressData.neighborhood.trim()) {
      errors.neighborhood = 'Bairro é obrigatório';
    }
    if (!addressData.city.trim()) {
      errors.city = 'Cidade é obrigatória';
    }
    if (!addressData.state.trim() || addressData.state.length !== 2) {
      errors.state = 'Estado (UF) é obrigatório';
    }

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if product requires address (physical product)
  const requiresAddress = useMemo(() => {
    return product && isPhysicalProduct(product.product_type);
  }, [product]);

  const validateCardData = (): boolean => {
    // If hideCardForm is true, skip validation (card data comes from iframe)
    if (threeDSSettings?.hideCardForm) {
      return iframeFormValid || true; // Allow proceeding if iframe validation not available
    }

    const errors: Record<string, string> = {};
    
    if (!cardData.number || cardData.number.replace(/\s/g, '').length < 13) {
      errors.cardNumber = 'Número do cartão inválido';
    }
    if (!cardData.holderName || cardData.holderName.length < 3) {
      errors.holderName = 'Nome do titular inválido';
    }
    if (!cardData.expiry || cardData.expiry.length < 5) {
      errors.expiry = 'Validade inválida';
    }
    if (!cardData.cvv || cardData.cvv.length < 3) {
      errors.cvv = 'CVV inválido';
    }
    
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    // Validate logistics for physical products
    if (isPhysicalProduct(product.product_type)) {
      const logisticsCheck = hasValidLogisticsForCheckout(product.product_type, {
        height_cm: product.height_cm ?? null,
        width_cm: product.width_cm ?? null,
        length_cm: product.length_cm ?? null,
        weight_grams: product.weight_grams ?? null,
      });

      if (!logisticsCheck.canProceed) {
        toast.error(logisticsCheck.errorMessage || "Não foi possível calcular o frete deste produto.");
        console.error("[Checkout] Physical product missing logistics data:", {
          productId: product.id,
          productType: product.product_type,
          height_cm: product.height_cm,
          width_cm: product.width_cm,
          length_cm: product.length_cm,
          weight_grams: product.weight_grams,
        });
        return;
      }
    }

    // Validate email confirmation when required
    if (settings.require_email && formData.email !== formData.emailConfirm) {
      setFormErrors(prev => ({ ...prev, emailConfirm: 'Os e-mails informados não são iguais. Verifique e tente novamente.' }));
      toast.error("Os e-mails informados não são iguais. Verifique e tente novamente.");
      return;
    }

    const result = validationSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFormErrors(errors);
      const firstError = result.error.errors[0];
      toast.error(firstError?.message || "Preencha os campos corretamente");
      return;
    }

    // Validate address for physical products
    if (isPhysicalProduct(product.product_type)) {
      if (!validateAddress()) {
        toast.error("Preencha o endereço de entrega corretamente");
        return;
      }
    }

    // Validate card data for credit card payments
    if (paymentMethod === "credit_card") {
      if (!validateCardData()) {
        toast.error("Preencha os dados do cartão corretamente");
        return;
      }
      if (!isPodPayReady) {
        toast.error("Sistema de pagamento ainda carregando. Aguarde...");
        return;
      }
    }

    setFormErrors({});
    setProcessing(true);

    try {
      const documentMaxLength = settings.document_type_accepted === 'cnpj' ? 14 : 11;
      const sanitizedData = {
        name: result.data.name.trim().substring(0, 100),
        email: result.data.email?.trim().toLowerCase().substring(0, 255) || '',
        document: result.data.document?.replace(/\D/g, '').substring(0, documentMaxLength) || null,
        phone: result.data.phone?.replace(/\D/g, '').substring(0, 11) || null,
      };

      let cardToken: string | null = null;

      // For credit card: prepare 3DS and encrypt card data
      if (paymentMethod === "credit_card") {
        setPaymentStatus("processing_card");
        toast.info("Processando dados do cartão...");
        
        // Step 1: Prepare 3DS with correct total amount (price * quantity + bumps)
        await prepareThreeDS(displayedPrice, 1, 'BRL');
        
        // Step 2: Encrypt card data to get token
        // If hideCardForm is true, pass null (iframe handles it)
        const cardDataToEncrypt = threeDSSettings?.hideCardForm ? null : cardData;
        cardToken = await encryptCard(cardDataToEncrypt);
        
        if (!cardToken) {
          throw new Error(tokenError || 'Erro ao processar dados do cartão');
        }
      }

      // Step 3: Send to backend - SALE IS CREATED ONLY IN BACKEND
      // Backend creates transaction with PodPay and returns full transaction data
      // Include buyer IP and user agent for PodPay tracking
      // Calculate final amounts with quantity
      const unitPrice = basePrice;
      const productSubtotal = unitPrice * quantity;
      // IMPORTANT: Use displayedPrice which already includes coupon discount
      const totalAmount = displayedPrice;

      // Debug: Log total recalculation
      checkoutDebug.logTotalRecalculation({
        basePrice: unitPrice,
        quantity,
        productSubtotal,
        orderBumpsTotal,
        selectedBumps: orderBumps
          .filter(b => selectedBumps.includes(b.id))
          .map(b => ({ id: b.id, name: b.name, price: b.discount_price ?? b.price })),
        grandTotal: totalAmount,
      });

      // Validate checkout payload before sending
      const payloadValidation = validateCheckoutPayload({
        productId: product.id,
        productName: product.name,
        productPrice: productSubtotal,
        quantity,
        orderBumps: selectedOrderBumpDetails.map(b => ({
            id: b.id,
            name: b.name,
            price: b.price,
            quantity: 1,
          })),
        totalAmount,
        paymentMethod,
        buyer: {
          name: sanitizedData.name,
          email: sanitizedData.email,
          document: sanitizedData.document || undefined,
          phone: sanitizedData.phone || undefined,
        },
        affiliateId: affiliateId || undefined,
      });

      logValidationResult(payloadValidation, 'checkout');

      if (!payloadValidation.valid) {
        checkoutDebug.logEvent('form_validated', {
          errors: payloadValidation.errors,
        }, 'error');
        toast.error(payloadValidation.errors[0]?.message || 'Erro na validação do pedido');
        setProcessing(false);
        return;
      }

      // Log PIX request
      if (paymentMethod === 'pix') {
        checkoutDebug.logPixRequest({
          amount: totalAmount,
          productId: product.id,
          orderBumps: selectedBumps,
        });
      }

      // Get UTMs for checkout - critical for UTMify attribution
      const checkoutUtms = getUtmsForCheckout();
      if (import.meta.env.DEV) console.log('[Checkout] Enviando UTMs para backend:', checkoutUtms);

      // Build logistics payload for physical products
      const logisticsPayload = isPhysicalProduct(product.product_type) 
        ? buildFreightPayload({
            height_cm: product.height_cm ?? null,
            width_cm: product.width_cm ?? null,
            length_cm: product.length_cm ?? null,
            weight_grams: product.weight_grams ?? null,
          }, quantity)
        : null;

      // Build shipping address payload for physical products
      const shippingPayload = isPhysicalProduct(product.product_type) ? {
        shipping_cep: addressData.cep.replace(/\D/g, ''),
        shipping_street: addressData.street,
        shipping_number: addressData.number,
        shipping_complement: addressData.complement || null,
        shipping_neighborhood: addressData.neighborhood,
        shipping_city: addressData.city,
        shipping_state: addressData.state,
      } : {};

      const { data, error } = await supabase.functions.invoke('process-checkout', {
        body: {
          product_id: product.id,
          buyer_name: sanitizedData.name,
          buyer_email: sanitizedData.email,
          buyer_document: sanitizedData.document,
          buyer_phone: sanitizedData.phone,
          payment_method: paymentMethod,
          affiliate_id: affiliateId,
          card_token: cardToken,
          offer_id: offer?.id || null,
          // Order bump data - send complete details for backend processing
          order_bump_ids: selectedBumps.length > 0 ? selectedBumps : null,
          order_bumps_total: orderBumpsTotal > 0 ? Math.round(orderBumpsTotal * 100) / 100 : 0,
          order_bumps_details: selectedOrderBumpDetails.length > 0 ? selectedOrderBumpDetails : null,
          quantity: quantity,
          unit_price: unitPrice,
          return_url: window.location.origin + '/checkout/success',
          installments: 1,
          // Subscription-specific data
          is_subscription: product.payment_type === 'subscription',
          subscription_quantity_mode: product.subscription_quantity_mode || 'single',
          // Coupon data
          coupon_code: appliedCoupon?.code || null,
          campaign_id: appliedCoupon?.campaign_id || null,
          coupon_discount: couponDiscount > 0 ? Math.round(couponDiscount * 100) / 100 : 0,
          // UTM tracking parameters - CRITICAL for UTMify
          tracking_parameters: checkoutUtms,
          // Logistics data for physical products (freight calculation)
          product_type: product.product_type || null,
          logistics: logisticsPayload,
          // Shipping address for physical products
          ...shippingPayload,
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        // Parse error response for better message
        let errorMessage = 'Erro ao processar pagamento';
        if (error.message) {
          try {
            const errorData = JSON.parse(error.message);
            errorMessage = errorData.error || errorData.message || error.message;
          } catch {
            errorMessage = error.message;
          }
        }
        throw new Error(errorMessage);
      }

      if (data?.success) {
        // Save transaction_id from backend
        setTransactionId(data.transaction_id);
        
        if (paymentMethod === "pix" && data.pix) {
          setPixData(data.pix);
          setPixTimeLeft(data.pix.expiration_minutes * 60);
          setPaymentStatus("pix_pending");
          
          // Debug: Log PIX success
          checkoutDebug.logPixSuccess({
            transactionId: data.transaction_id,
            pixCode: data.pix.pix_copia_cola,
            expirationMinutes: data.pix.expiration_minutes,
          });
          
          toast.success("PIX gerado com sucesso! Escaneie o QR code ou copie o código.");
        } else if (paymentMethod === "credit_card") {
          // Step 4: Call finishThreeDS with transaction data from backend
          // disableRedirect = false to allow automatic redirect
          if (data.transaction && threeDSSettings?.threeDSSecurity) {
            try {
              if (import.meta.env.DEV) console.log('Calling finishThreeDS with transaction:', data.transaction);
              await finishThreeDS(data.transaction, false); // disableRedirect = false
            } catch (threeDSError) {
              console.error('3DS finish error:', threeDSError);
              // 3DS may redirect, so this error might not be reached
            }
          }
          
          // Status is ALWAYS pending - webhook will update to approved
          // Show processing message, don't trust frontend status
          setPaymentStatus("success");
          toast.success("Pagamento em processamento! Você será notificado quando confirmado.");
          // Mark abandoned cart as recovered (purchase initiated)
          markAsRecovered();
        } else {
          setPaymentStatus("success");
          toast.success("Pagamento em processamento!");
          // Mark abandoned cart as recovered
          markAsRecovered();
        }
      } else {
        throw new Error(data?.error || 'Erro ao processar pagamento');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      // Debug: Log failure with rollback
      if (paymentMethod === 'pix') {
        checkoutDebug.logPixFailure({
          message: error.message || 'Unknown error',
          code: error.code,
          details: error,
        });
      } else {
        checkoutDebug.logEvent('payment_failed', {
          method: paymentMethod,
          error: error.message,
        }, 'error');
      }
      
      setPaymentStatus("error");
      toast.error(error.message || "Erro ao processar pagamento");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: settings.background_color }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: settings.primary_color }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Produto não encontrado</h1>
        <p className="text-muted-foreground">O produto solicitado não existe ou está indisponível.</p>
        <Button onClick={() => navigate("/")}>Voltar ao início</Button>
      </div>
    );
  }

  // PIX Payment Screen
  if (paymentStatus === "pix_pending" && pixData) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: settings.background_color }}>
        {/* Header */}
        <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 object-contain" />
            ) : <div />}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              Pagamento seguro
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-lg mx-auto">
            {/* Success Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${settings.primary_color}20` }}>
                <QrCode className="w-8 h-8" style={{ color: settings.primary_color }} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">PIX gerado com sucesso!</h1>
              <p className="text-gray-400">
                Escaneie o QR Code ou copie o código para realizar o pagamento
              </p>
            </div>

            {/* Timer Alert */}
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 mb-6">
              <Clock className="w-5 h-5 text-yellow-400" />
              <div className="text-center">
                <p className="text-yellow-400 text-sm">Expira em</p>
                <p className="text-yellow-300 font-bold text-xl tabular-nums">
                  {formatTime(pixTimeLeft)}
                </p>
              </div>
            </div>

            {/* Main Card */}
            <Card className="bg-gradient-to-br from-card/80 to-card/40 border-border/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-6 space-y-6">

                {/* QR Code Display - Mirrored */}
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-xl">
                    <QRCodeSVG
                      value={pixData.pix_copia_cola}
                      size={200}
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>
                </div>

                {/* Amount Display */}
                <div className="text-center py-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
                  <p className="text-gray-400 text-sm mb-1">Valor a pagar</p>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(displayedPrice)}
                  </p>
                </div>


                {/* Large Copy Button */}
                <Button
                  className="w-full h-12 text-base font-semibold transition-all hover:scale-[1.02]"
                  style={{ 
                    backgroundColor: copiedPix ? '#22c55e' : settings.primary_color,
                  }}
                  onClick={copyPixCode}
                >
                  {copiedPix ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Código copiado com sucesso!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copiar código PIX
                    </>
                  )}
                </Button>

                {/* Transaction Info */}
                <div className="p-4 rounded-xl bg-secondary/20 border border-border/30 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Produto</span>
                    <span className="text-white font-medium truncate max-w-[200px]">{product.name}</span>
                  </div>
                  <Separator className="bg-border/30" />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">ID da Transação</span>
                    <span className="text-white font-mono text-xs bg-background/50 px-2 py-1 rounded">{transactionId}</span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="rounded-xl bg-secondary/10 p-4 border border-border/20">
                  <p className="text-sm font-medium text-white mb-3">Como pagar:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold" style={{ color: settings.primary_color }}>1</span>
                      </div>
                      <p className="text-sm text-gray-400">Abra o app do seu banco ou carteira digital</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold" style={{ color: settings.primary_color }}>2</span>
                      </div>
                      <p className="text-sm text-gray-400">Escolha pagar via PIX com QR Code ou código</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold" style={{ color: settings.primary_color }}>3</span>
                      </div>
                      <p className="text-sm text-gray-400">Confirme o pagamento e pronto!</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  Após o pagamento, você receberá a confirmação por e-mail em instantes.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 mt-16 py-8">
          <div className="container mx-auto px-4 text-center text-sm text-gray-500">
            <p>© Royal Pay 2026. Todos os direitos reservados.</p>
            <p className="mt-1 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Ambiente seguro com criptografia SSL
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (paymentStatus === "success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4" style={{ backgroundColor: settings.background_color }}>
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-white">Pagamento realizado!</h1>
          <p className="text-gray-400">
            Você receberá um e-mail com os detalhes da sua compra.
          </p>
        </div>
        <Card className="w-full max-w-md bg-card/50 border-border/30">
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
                <h3 className="font-semibold text-white">{product.name}</h3>
                <p className="text-lg font-bold" style={{ color: settings.primary_color }}>{formatCurrency(product.price)}</p>
              </div>
            </div>
            <Separator className="my-4 bg-border/30" />
            <div className="text-sm text-gray-400">
              <p>Comprador: {formData.name}</p>
              <p>E-mail: {formData.email}</p>
              {transactionId && <p>Transação: {transactionId}</p>}
            </div>
          </CardContent>
        </Card>
        <Button variant="outline" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </div>
    );
  }

  // Determine border radius based on settings - matching CheckoutPreview structure
  const getBorderRadius = () => {
    switch (settings.border_style) {
      case 'rounded': return { card: 'rounded-xl', input: 'rounded-lg', button: 'rounded-full' };
      case 'semi': return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-lg' };
      case 'square': return { card: 'rounded-none', input: 'rounded-none', button: 'rounded-none' };
      default: return { card: 'rounded-lg', input: 'rounded-md', button: 'rounded-lg' };
    }
  };

  const borderRadius = getBorderRadius();
  const isLightTheme = settings.theme_mode === 'light';
  const textColor = isLightTheme ? 'text-slate-900' : 'text-white';
  const mutedTextColor = isLightTheme ? 'text-slate-600' : 'text-gray-400';
  const cardBg = isLightTheme ? 'bg-white/90' : 'bg-card/50';
  const inputBg = isLightTheme ? 'bg-white' : 'bg-background/50';

  // Render mobile checkout layout for mobile devices
  if (isMobile) {
    return (
      <MobileCheckoutLayout
        product={product}
        settings={{
          primary_color: settings.primary_color,
          guarantee_days: settings.guarantee_days,
          require_phone: settings.require_phone,
          require_document: settings.require_document,
          pix_enabled: settings.pix_enabled,
          credit_card_enabled: settings.credit_card_enabled,
          boleto_enabled: settings.boleto_enabled,
          show_guarantee: settings.show_guarantee,
          require_email: settings.require_email,
          document_type_accepted: settings.document_type_accepted,
          order_bump_enabled: settings.order_bump_enabled,
          quantity_selector_enabled: settings.quantity_selector_enabled,
          button_text: settings.button_text,
          button_status: settings.button_status,
          button_background_color: settings.button_background_color,
          button_text_color: settings.button_text_color,
          // Theme
          theme_mode: settings.theme_mode,
          border_style: settings.border_style,
          background_color: settings.background_color,
          // Banner
          banner_url: settings.banner_url,
          // Logo
          logo_url: settings.logo_url,
          show_logo: settings.show_logo,
          // Timer
          show_timer: settings.show_timer,
          timer_text: settings.timer_text,
          timer_color: settings.timer_color,
          timer_text_color: settings.timer_text_color,
          timer_expired_text: settings.timer_expired_text,
          // Security Seals
          security_seals_enabled: settings.security_seals_enabled,
          security_seal_secure_site: settings.security_seal_secure_site,
          security_seal_secure_purchase: settings.security_seal_secure_purchase,
          security_seal_guarantee: settings.security_seal_guarantee,
          security_seal_secure_site_text: settings.security_seal_secure_site_text,
          security_seal_secure_purchase_text: settings.security_seal_secure_purchase_text,
          security_seal_guarantee_text: settings.security_seal_guarantee_text,
          // Social Proof
          social_proof_enabled: settings.social_proof_enabled,
          social_proof_notification_1_enabled: settings.social_proof_notification_1_enabled,
          social_proof_notification_1_text: settings.social_proof_notification_1_text,
          social_proof_notification_2_enabled: settings.social_proof_notification_2_enabled,
          social_proof_notification_2_text: settings.social_proof_notification_2_text,
          social_proof_notification_3_enabled: settings.social_proof_notification_3_enabled,
          social_proof_notification_3_text: settings.social_proof_notification_3_text,
          social_proof_notification_4_enabled: settings.social_proof_notification_4_enabled,
          social_proof_notification_4_text: settings.social_proof_notification_4_text,
          social_proof_initial_delay: settings.social_proof_initial_delay,
          social_proof_duration: settings.social_proof_duration,
          social_proof_interval_min: settings.social_proof_interval_min,
          social_proof_interval_max: settings.social_proof_interval_max,
          social_proof_min_people: settings.social_proof_min_people,
          social_proof_max_people: settings.social_proof_max_people,
        }}
        basePrice={basePrice}
        quantity={quantity}
        setQuantity={setQuantity}
        orderBumps={orderBumps.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          price: b.price,
          discount_price: b.discount_price,
          discount_type: b.discount_type,
          discount_value: b.discount_value,
          is_active: b.is_active,
          is_subscription: b.is_subscription,
          subscription_interval: b.subscription_interval,
          position: b.position,
          image_url: b.image_url,
          sales_phrase: b.sales_phrase,
          auxiliary_phrase: b.auxiliary_phrase,
          highlight_color: b.highlight_color,
        }))}
        selectedBumps={selectedBumps}
        toggleOrderBump={toggleOrderBump}
        orderBumpsTotal={orderBumpsTotal}
        displayedPrice={displayedPrice}
        formData={formData}
        handleInputChange={handleInputChange}
        formErrors={formErrors}
        validateField={validateField}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cardData={cardData}
        handleCardDataChange={handleCardDataChange}
        cardErrors={cardErrors}
        processing={processing}
        isPodPayReady={isPodPayReady}
        isTokenizing={isTokenizing}
        handleSubmit={handleSubmit}
        threeDSSettings={threeDSSettings}
        getIframeId={getIframeId}
        selectedDocType={selectedDocType}
        handleDocTypeChange={handleDocTypeChange}
        effectiveDocType={effectiveDocType}
        hasPodPayKey={!!PODPAY_PUBLIC_KEY}
        priceAnimating={priceAnimating}
        timeLeft={timeLeft}
        requiresAddress={requiresAddress}
        addressData={addressData}
        onAddressChange={handleAddressChange}
        addressErrors={addressErrors}
        onValidateAddressField={validateAddressField}
      />
    );
  }

  return (
    <div 
      className={`min-h-screen ${settings.checkout_animation_enabled ? 'animate-fade-in' : ''}`} 
      style={{ backgroundColor: settings.background_color }}
    >
      {/* Marquee/Letreiro - Always black with white text */}
      {settings.marquee_enabled && settings.marquee_text && (
        <div 
          className="py-2 text-center text-sm font-medium overflow-hidden bg-black text-white"
        >
          <div className="animate-marquee whitespace-nowrap flex items-center justify-center gap-2">
            <span className="text-orange-500">⚡</span>
            {settings.marquee_text}
          </div>
        </div>
      )}

      {/* Timer */}
      {settings.show_timer && timeLeft > 0 && (
        <div 
          className="py-3 text-center" 
          style={{ 
            backgroundColor: settings.timer_color || settings.primary_color,
            color: settings.timer_text_color || '#ffffff'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{settings.timer_text}</span>
            <span className="font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>
      )}

      {/* Timer Expired Message */}
      {settings.show_timer && timeLeft === 0 && settings.timer_expired_text && (
        <div 
          className="py-3 text-center" 
          style={{ 
            backgroundColor: settings.timer_color || settings.primary_color,
            color: settings.timer_text_color || '#ffffff'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="font-bold text-lg">{settings.timer_expired_text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b ${isLightTheme ? 'border-slate-200 bg-white/80' : 'border-white/10 bg-black/20'} backdrop-blur-sm`}>
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          {settings.show_logo && settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-10 object-contain" />
          ) : <div />}
          <div className={`flex items-center gap-2 text-sm ${mutedTextColor}`}>
            <ShieldCheck className="w-4 h-4 text-green-500" />
            Pagamento seguro
          </div>
        </div>
      </header>

      {/* Banner */}
      {settings.banner_url && (
        <div className="w-full h-48 overflow-hidden">
          <img src={settings.banner_url} alt="Banner" className="w-full h-full object-cover" />
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Headlines */}
        {(settings.headline || settings.subheadline) && (
          <div className="text-center mb-8">
            {settings.headline && (
              <h1 className={`text-2xl md:text-3xl font-bold ${textColor} mb-2`}>{settings.headline}</h1>
            )}
            {settings.subheadline && (
              <p className={mutedTextColor}>{settings.subheadline}</p>
            )}
          </div>
        )}

        <div className={`max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 ${settings.invert_columns ? 'lg:flex-row-reverse' : ''}`} style={{ direction: settings.invert_columns ? 'rtl' : 'ltr' }}>
          {/* Product Info */}
          <Card className={`h-fit ${cardBg} border-border/30 ${borderRadius.card}`} style={{ direction: 'ltr' }}>
            <CardHeader>
              <CardTitle className={textColor}>Resumo do pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {settings.show_product_image && product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className={`w-24 h-24 ${borderRadius.card} object-cover`}
                  />
                ) : settings.show_product_image ? (
                  <div className={`w-24 h-24 ${borderRadius.card} bg-muted flex items-center justify-center`}>
                    <CreditCard className="w-8 h-8 text-muted-foreground" />
                  </div>
                ) : null}
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${textColor}`}>{product.name}</h3>
                  {settings.show_product_description && product.description && (
                    <p className={`text-sm ${mutedTextColor} mt-1 line-clamp-2`}>
                      {product.description}
                    </p>
                  )}
                </div>
              </div>
              <Separator className="my-4 bg-border/30" />
              
              {/* Quantity Selector - Disabled for subscriptions with mode 'single' */}
              {settings.quantity_selector_enabled && (
                (() => {
                  // Check if this is a subscription with 'single' mode (quantity must be 1)
                  const isSubscription = product?.payment_type === 'subscription';
                  const quantityMode = product?.subscription_quantity_mode || 'single';
                  const isQuantityDisabled = isSubscription && quantityMode === 'single';
                  
                  if (isQuantityDisabled) {
                    return null; // Don't show quantity selector for single-mode subscriptions
                  }
                  
                  return (
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        <span className={`font-medium ${textColor}`}>Quantidade</span>
                        {isSubscription && (
                          <span className={`text-xs ${mutedTextColor}`}>
                            {quantityMode === 'license' ? 'Licenças' : 'Assentos'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                            quantity <= 1 
                              ? 'border-border/30 opacity-50 cursor-not-allowed' 
                              : 'border-border/50 hover:border-border'
                          }`}
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className={`w-8 text-center font-semibold ${textColor}`}>{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(prev => Math.min(100, prev + 1))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 hover:border-border transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Price display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={mutedTextColor}>
                    {product?.payment_type === 'subscription' 
                      ? `Assinatura${quantity > 1 ? ` (${quantity} ${product?.subscription_quantity_mode === 'seat' ? 'assentos' : 'licenças'})` : ''}`
                      : `Produto${quantity > 1 ? ` (x${quantity})` : ''}`
                    }
                  </span>
                  <span className={textColor}>{formatCurrency(basePrice * quantity)}</span>
                </div>
                {orderBumpsTotal > 0 && (
                  <div className={`flex items-center justify-between transition-all duration-300 ${priceAnimating ? 'scale-105' : ''}`}>
                    <span className={mutedTextColor}>Adicionais ({selectedBumps.length})</span>
                    <span className="text-green-500 font-medium">+{formatCurrency(orderBumpsTotal)}</span>
                  </div>
                )}
                {appliedCoupon && couponDiscount > 0 && (
                  <div className={`flex items-center justify-between transition-all duration-300 ${priceAnimating ? 'scale-105' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={mutedTextColor}>Cupom ({appliedCoupon.code})</span>
                      <button 
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        remover
                      </button>
                    </div>
                    <span className="text-green-500 font-medium">-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                <Separator className="bg-border/30" />
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${textColor}`}>
                    {product?.payment_type === 'subscription' ? 'Total Recorrente' : 'Total'}
                  </span>
                  <div className="text-right">
                    <span 
                      className={`text-2xl font-bold transition-all duration-300 ${priceAnimating ? 'scale-110' : ''}`} 
                      style={{ 
                        color: settings.primary_color,
                        display: 'inline-block',
                        transform: priceAnimating ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      {formatCurrency(displayedPrice)}
                    </span>
                    {product?.payment_type === 'subscription' && (
                      <span className={`block text-xs ${mutedTextColor}`}>/mês</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coupon Input */}
              {settings.coupon_enabled && !appliedCoupon && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <Label className={`${mutedTextColor} text-sm mb-2 block`}>Cupom de desconto</Label>
                  <div className="flex gap-3">
                    <Input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      placeholder="DIGITE O CÓDIGO"
                      className={`${inputBg} border-2 border-primary/40 ${borderRadius.input} uppercase flex-1 font-bold text-base tracking-widest text-foreground placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal focus:border-primary focus:ring-2 focus:ring-primary/20 ${couponError ? 'border-red-500' : ''}`}
                      disabled={couponLoading}
                    />
                    <Button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={!couponCode.trim() || couponLoading}
                      className={`${borderRadius.button} font-bold text-base px-8 py-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 hover:brightness-110 disabled:opacity-50 disabled:hover:scale-100`}
                      style={{ 
                        backgroundColor: settings.button_background_color || '#3b82f6',
                        color: settings.button_text_color || '#ffffff'
                      }}
                    >
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aplicar'}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-xs text-red-400 mt-1">{couponError}</p>
                  )}
                </div>
              )}

              {/* Social Proof Testimonials - Inside order summary */}
              <SocialProofTestimonials
                productId={product.id}
                isDarkTheme={!isLightTheme}
                primaryColor={settings.primary_color}
                className="mt-4"
              />

            </CardContent>
          </Card>

          {/* Checkout Form */}
          <Card className={`${cardBg} border-border/30 ${borderRadius.card}`} style={{ direction: 'ltr' }}>
            <CardHeader>
              <CardTitle className={textColor}>Dados de pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Affiliate Success Indicator - only show positive feedback, never errors */}
              {affiliateId && affiliateRef && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-400">
                    Link promocional identificado com sucesso.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Data */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={textColor}>Nome completo *</Label>
                    <Input
                      id="name"
                      placeholder="Seu nome completo"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                      className={`${inputBg} border-border/50 ${formErrors.name ? 'border-red-500' : ''} ${borderRadius.input}`}
                    />
                    {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
                  </div>
                  {settings.require_email ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="email" className={textColor}>E-mail *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu@email.com"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                          className={`${inputBg} border-border/50 ${formErrors.email ? 'border-red-500' : ''} ${borderRadius.input}`}
                        />
                        {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emailConfirm" className={textColor}>Confirmar E-mail *</Label>
                        <Input
                          id="emailConfirm"
                          type="email"
                          placeholder="Confirme seu e-mail"
                          value={formData.emailConfirm}
                          onChange={(e) => handleInputChange('emailConfirm', e.target.value)}
                          required
                          className={`${inputBg} border-border/50 ${formErrors.emailConfirm ? 'border-red-500' : ''} ${borderRadius.input}`}
                        />
                        {formErrors.emailConfirm && <p className="text-xs text-red-500">{formErrors.emailConfirm}</p>}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="email" className={textColor}>E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com (opcional)"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className={`${inputBg} border-border/50 ${formErrors.email ? 'border-red-500' : ''} ${borderRadius.input}`}
                      />
                      {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                    </div>
                  )}
                  <div className={`grid gap-4 ${settings.require_document && settings.require_phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {settings.require_document && (
                      <div className="space-y-2">
                        {settings.document_type_accepted === 'both' ? (
                          <>
                            <div className="flex items-center justify-between">
                              <Label className={textColor}>
                                Documento *
                              </Label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDocTypeChange('cpf')}
                                  className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedDocType === 'cpf' 
                                      ? 'text-white' 
                                      : `${mutedTextColor} hover:opacity-80`
                                  }`}
                                  style={{ 
                                    backgroundColor: selectedDocType === 'cpf' ? settings.primary_color : 'transparent',
                                    border: `1px solid ${selectedDocType === 'cpf' ? settings.primary_color : 'currentColor'}`
                                  }}
                                >
                                  CPF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDocTypeChange('cnpj')}
                                  className={`px-2 py-1 text-xs rounded transition-colors ${
                                    selectedDocType === 'cnpj' 
                                      ? 'text-white' 
                                      : `${mutedTextColor} hover:opacity-80`
                                  }`}
                                  style={{ 
                                    backgroundColor: selectedDocType === 'cnpj' ? settings.primary_color : 'transparent',
                                    border: `1px solid ${selectedDocType === 'cnpj' ? settings.primary_color : 'currentColor'}`
                                  }}
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
                              className={`${inputBg} border-border/50 ${formErrors.document ? 'border-red-500' : ''} ${borderRadius.input}`}
                              maxLength={selectedDocType === 'cnpj' ? 18 : 14}
                            />
                          </>
                        ) : (
                          <>
                            <Label htmlFor="document" className={textColor}>
                              {effectiveDocType === 'cnpj' ? 'CNPJ' : 'CPF'} *
                            </Label>
                            <Input
                              id="document"
                              placeholder={effectiveDocType === 'cnpj' ? '00.000.000/0001-00' : '000.000.000-00'}
                              value={formData.document}
                              onChange={(e) => handleInputChange('document', e.target.value)}
                              required
                              className={`${inputBg} border-border/50 ${formErrors.document ? 'border-red-500' : ''} ${borderRadius.input}`}
                              maxLength={effectiveDocType === 'cnpj' ? 18 : 14}
                            />
                          </>
                        )}
                        {formErrors.document && <p className="text-xs text-red-500">{formErrors.document}</p>}
                      </div>
                    )}
                    {settings.require_phone && (
                      <div className="space-y-2">
                        <Label htmlFor="phone" className={textColor}>
                          Telefone *
                        </Label>
                        <Input
                          id="phone"
                          placeholder="(00) 00000-0000"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          required
                          className={`${inputBg} border-border/50 ${formErrors.phone ? 'border-red-500' : ''} ${borderRadius.input}`}
                          maxLength={15}
                        />
                        {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Address Section for Physical Products */}
                {requiresAddress && (
                  <AddressSection
                    addressData={addressData}
                    onAddressChange={handleAddressChange}
                    errors={addressErrors}
                    onValidateField={validateAddressField}
                    isLightTheme={isLightTheme}
                    primaryColor={settings.primary_color}
                    borderRadius={borderRadius.card}
                    stepNumber={2}
                  />
                )}

                <Separator className="bg-border/30" />

                {/* Payment Methods */}
                <div className="space-y-4">
                  <Label className={textColor}>Forma de pagamento</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {availablePaymentMethods.pix && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("pix")}
                        className={`p-4 ${borderRadius.card} border-2 transition-all flex flex-col items-center gap-2 ${
                          paymentMethod === "pix"
                            ? "bg-opacity-5"
                            : "border-border/30 hover:border-opacity-50"
                        }`}
                        style={{
                          borderColor: paymentMethod === "pix" ? settings.primary_color : undefined,
                          backgroundColor: paymentMethod === "pix" ? `${settings.primary_color}10` : undefined,
                        }}
                      >
                        <Smartphone className={`w-6 h-6 ${paymentMethod === "pix" ? "" : mutedTextColor}`} style={{ color: paymentMethod === "pix" ? settings.primary_color : undefined }} />
                        <span className={`text-sm font-medium ${textColor}`}>PIX</span>
                        {paymentMethod === "pix" && (
                          <Badge variant="secondary" className="text-xs">
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
                            ? "bg-opacity-5"
                            : "border-border/30 hover:border-opacity-50"
                        }`}
                        style={{
                          borderColor: paymentMethod === "credit_card" ? settings.primary_color : undefined,
                          backgroundColor: paymentMethod === "credit_card" ? `${settings.primary_color}10` : undefined,
                        }}
                      >
                        <CreditCard className={`w-6 h-6 ${paymentMethod === "credit_card" ? "" : mutedTextColor}`} style={{ color: paymentMethod === "credit_card" ? settings.primary_color : undefined }} />
                        <span className={`text-sm font-medium ${textColor}`}>Cartão</span>
                      </button>
                    )}
                    {availablePaymentMethods.boleto && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("boleto")}
                        className={`p-4 ${borderRadius.card} border-2 transition-all flex flex-col items-center gap-2 ${
                          paymentMethod === "boleto"
                            ? "bg-opacity-5"
                            : "border-border/30 hover:border-opacity-50"
                        }`}
                        style={{
                          borderColor: paymentMethod === "boleto" ? settings.primary_color : undefined,
                          backgroundColor: paymentMethod === "boleto" ? `${settings.primary_color}10` : undefined,
                        }}
                      >
                        <FileText className={`w-6 h-6 ${paymentMethod === "boleto" ? "" : mutedTextColor}`} style={{ color: paymentMethod === "boleto" ? settings.primary_color : undefined }} />
                        <span className={`text-sm font-medium ${textColor}`}>Boleto</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Credit Card Form - Always show when credit_card is selected */}
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
                      <p className="text-xs text-yellow-500 text-center">
                        Carregando sistema de pagamento seguro...
                      </p>
                    )}
                  </div>
                )}

                {/* Order Bumps Section - Integrated after payment methods, before submit button */}
                {orderBumps.length > 0 && (
                  <div className="space-y-3">
                    {orderBumps.map((bump) => {
                      const hasDiscount = bump.discount_price !== null && bump.discount_price < bump.price;
                      const finalPrice = bump.discount_price ?? bump.price;
                      const isSelected = selectedBumps.includes(bump.id);
                      const highlightColor = '#3b82f6'; // Always blue by default
                      
                      return (
                        <div 
                          key={bump.id}
                          className={`relative overflow-hidden transition-all ${borderRadius.card}`}
                          style={{
                            border: `2px solid ${isSelected ? '#22c55e' : highlightColor}`,
                            backgroundColor: isSelected 
                              ? (isLightTheme ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.08)')
                              : (isLightTheme ? 'rgba(248, 250, 252, 0.8)' : 'rgba(30, 41, 59, 0.5)')
                          }}
                        >
                          {/* Header badge */}
                          <div 
                            className="py-1.5 px-3 text-center text-xs font-semibold uppercase tracking-wide"
                            style={{ 
                              backgroundColor: isSelected ? '#22c55e' : highlightColor,
                              color: '#ffffff'
                            }}
                          >
                            ⚡ {bump.sales_phrase || 'Oferta especial'}
                          </div>
                          
                          {/* Auxiliary phrase */}
                          {bump.auxiliary_phrase && (
                            <div className={`py-1 px-3 text-center text-xs ${mutedTextColor}`}
                              style={{ 
                                backgroundColor: isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'
                              }}
                            >
                              {bump.auxiliary_phrase}
                            </div>
                          )}
                          
                          {/* Content */}
                          <div 
                            className="p-4 cursor-pointer"
                            onClick={() => toggleOrderBump(bump.id)}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <div className="flex-shrink-0 pt-0.5">
                                <div 
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                    isSelected 
                                      ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30' 
                                      : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOrderBump(bump.id);
                                  }}
                                >
                                  {isSelected ? (
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              
                              {/* Image (if exists) */}
                              {bump.image_url && (
                                <div className="flex-shrink-0">
                                  <img 
                                    src={bump.image_url} 
                                    alt={bump.name}
                                    className="w-12 h-12 rounded-lg object-cover"
                                  />
                                </div>
                              )}
                              
                              {/* Text content */}
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${textColor} leading-tight`}>
                                  {bump.name}
                                </p>
                                
                                {bump.description && (
                                  <p className={`text-xs ${mutedTextColor} mt-1 line-clamp-2`}>
                                    {bump.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-sm">
                                  {hasDiscount ? (
                                    <>
                                      <span className={mutedTextColor}>De</span>
                                      <span className="line-through" style={{ color: '#ef4444' }}>
                                        {formatCurrency(bump.price)}
                                      </span>
                                      <span className={mutedTextColor}>por apenas</span>
                                      <span className="font-semibold" style={{ color: '#22c55e' }}>
                                        {formatCurrency(finalPrice)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className={mutedTextColor}>Por</span>
                                      <span className="font-semibold" style={{ color: '#22c55e' }}>
                                        {formatCurrency(finalPrice)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}


                <Button
                  type="submit"
                  className={`w-full h-12 text-lg font-semibold shadow-none ${borderRadius.button}`}
                  disabled={processing || (paymentMethod === "credit_card" && PODPAY_PUBLIC_KEY && !isPodPayReady)}
                  style={{ 
                    backgroundColor: settings.button_background_color || '#3b82f6',
                    color: settings.button_text_color || '#ffffff'
                  }}
                >
                  {processing || isTokenizing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {isTokenizing ? "Processando cartão..." : "Processando..."}
                    </>
                  ) : (
                    <>{settings.button_status || settings.button_text}</>
                  )}
                </Button>

                {/* Security Seals - Below payment button */}
                {settings.security_seals_enabled && (
                  <div className={`flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mt-4 p-4 ${borderRadius.card} ${isLightTheme ? 'bg-slate-50 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                    {settings.security_seal_secure_purchase && (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <Lock className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className={`text-xs ${mutedTextColor}`}>{settings.security_seal_secure_purchase_text}</span>
                      </div>
                    )}
                    {settings.security_seal_secure_site && (
                      <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className={`text-xs ${mutedTextColor}`}>{settings.security_seal_secure_site_text}</span>
                      </div>
                    )}
                    {settings.security_seal_guarantee && (
                      <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className={`text-xs ${mutedTextColor}`}>{settings.security_seal_guarantee_text}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className={`text-xs text-center ${mutedTextColor}`}>
                  {settings.footer_text || "Ao clicar em pagar, você concorda com os termos de uso e política de privacidade."}
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Notificações de Prova Social */}
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
          social_proof_initial_delay: settings.social_proof_initial_delay,
          social_proof_duration: settings.social_proof_duration,
          social_proof_interval_min: settings.social_proof_interval_min,
          social_proof_interval_max: settings.social_proof_interval_max,
          social_proof_min_people: settings.social_proof_min_people,
          social_proof_max_people: settings.social_proof_max_people,
        }}
        productName={product.name}
        primaryColor={settings.primary_color}
        isDarkTheme={!isLightTheme}
      />

      {/* WhatsApp Floating Button */}
      {settings.whatsapp_button_enabled && settings.whatsapp_support_phone && (
        <a
          href={`https://wa.me/55${settings.whatsapp_support_phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-50"
          aria-label="Suporte via WhatsApp"
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </a>
      )}

      {/* Debug Panel */}
      {showDebugPanel && (
        <CheckoutDebugPanel
          enabled={checkoutDebug.debugEnabled}
          sessionId={checkoutDebug.sessionId}
          events={checkoutDebug.getDebugSummary().events}
          onExport={checkoutDebug.exportDebugData}
          onClose={() => setShowDebugPanel(false)}
        />
      )}

    </div>
  );
};

export default Checkout;
