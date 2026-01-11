import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitize string input
const sanitizeString = (input: string | null | undefined, maxLength: number = 100): string | null => {
  if (!input || typeof input !== 'string') return null;
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '');
};

// Sanitize email
const sanitizeEmail = (email: string | null | undefined): string | null => {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase().slice(0, 255);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) ? trimmed : null;
};

// Sanitize amount
const sanitizeAmount = (amount: unknown): number => {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num) || num < 0 || num > 999999999) return 0;
  return Math.round(num * 100) / 100;
};

// Sanitize document (CPF/CNPJ)
const sanitizeDocument = (doc: string | null | undefined): string | null => {
  if (!doc || typeof doc !== 'string') return null;
  return doc.replace(/\D/g, '').slice(0, 14);
};

// Sanitize phone
const sanitizePhone = (phone: string | null | undefined): string | null => {
  if (!phone || typeof phone !== 'string') return null;
  return phone.replace(/\D/g, '').slice(0, 15);
};

// ============================================================
// VALIDAÇÃO DE PRODUTO PARA PIX - REGRAS OBRIGATÓRIAS
// ============================================================

interface ProductValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: {
    amount: number;
    description: string;
    externalId: string;
  };
}

// Remove emojis e caracteres especiais inválidos
function removeInvalidChars(str: string): string {
  return str
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    // Remove quebras de linha
    .replace(/[\r\n\t]/g, ' ')
    // Remove caracteres especiais problemáticos
    .replace(/[<>{}[\]\\|^`]/g, '')
    // Remove múltiplos espaços
    .replace(/\s+/g, ' ')
    .trim();
}

// Valida dados do produto antes de criar cobrança PIX
function validateProductForPix(
  product: { name: string; price: number; description?: string | null },
  orderId: string,
  discount: number = 0
): ProductValidationResult {
  const errors: string[] = [];
  
  console.log('=== VALIDAÇÃO DE PRODUTO PARA PIX ===');
  console.log('Produto:', product.name);
  console.log('Preço original:', product.price);
  console.log('Desconto:', discount);
  
  // 1. Validar valor do produto
  const rawPrice = product.price;
  
  if (rawPrice === null || rawPrice === undefined) {
    errors.push('ERRO: Preço do produto é null ou undefined');
  }
  
  if (typeof rawPrice !== 'number' || isNaN(rawPrice)) {
    errors.push(`ERRO: Preço inválido - tipo: ${typeof rawPrice}, valor: ${rawPrice}`);
  }
  
  // 2. Calcular valor final após descontos
  const finalAmount = Math.round((rawPrice - discount) * 100) / 100;
  console.log('Valor final calculado:', finalAmount);
  
  if (finalAmount <= 0) {
    errors.push(`ERRO: Valor final deve ser maior que 0 (atual: ${finalAmount})`);
  }
  
  if (finalAmount < 0.01) {
    errors.push(`ERRO: Valor mínimo para PIX é R$ 0.01 (atual: R$ ${finalAmount})`);
  }
  
  if (finalAmount > 999999.99) {
    errors.push(`ERRO: Valor máximo para PIX é R$ 999.999,99 (atual: R$ ${finalAmount})`);
  }
  
  // 3. Validar que não é NaN ou Infinity
  if (!Number.isFinite(finalAmount)) {
    errors.push(`ERRO: Valor não é um número finito: ${finalAmount}`);
  }
  
  // 4. Validar descrição do produto
  let sanitizedDescription = product.name || 'Produto';
  
  // Remover caracteres inválidos (emojis, quebras de linha)
  sanitizedDescription = removeInvalidChars(sanitizedDescription);
  
  // Limitar a 140 caracteres (requisito PodPay)
  if (sanitizedDescription.length > 140) {
    sanitizedDescription = sanitizedDescription.substring(0, 137) + '...';
    console.log('AVISO: Descrição truncada para 140 caracteres');
  }
  
  if (sanitizedDescription.length === 0) {
    errors.push('ERRO: Descrição do produto está vazia após sanitização');
    sanitizedDescription = 'Produto';
  }
  
  // 5. Validar external_id / reference (deve ser único)
  if (!orderId || orderId.length === 0) {
    errors.push('ERRO: Order ID (external_id) não pode ser vazio');
  }
  
  if (orderId.length > 50) {
    errors.push(`ERRO: Order ID muito longo (${orderId.length} chars, max 50)`);
  }
  
  // Log resultado da validação
  if (errors.length > 0) {
    console.error('=== VALIDAÇÃO FALHOU ===');
    errors.forEach(err => console.error(err));
    console.log('Produto INVÁLIDO - bloqueando criação de PIX');
    
    return { valid: false, errors };
  }
  
  console.log('=== VALIDAÇÃO PASSOU ===');
  console.log('Produto VÁLIDO para PIX');
  console.log('- Valor final:', finalAmount.toFixed(2));
  console.log('- Descrição:', sanitizedDescription);
  console.log('- External ID:', orderId);
  
  return {
    valid: true,
    errors: [],
    sanitizedData: {
      amount: finalAmount,
      description: sanitizedDescription,
      externalId: orderId,
    }
  };
}

// Compara produto válido vs inválido para debug
function logProductComparison(
  original: { name: string; price: any; description?: string | null },
  sanitized: { amount: number; description: string; externalId: string }
) {
  console.log('=== COMPARAÇÃO: ORIGINAL vs SANITIZADO ===');
  console.log('| Campo       | Original               | Sanitizado            |');
  console.log('|-------------|------------------------|------------------------|');
  console.log(`| Nome        | ${String(original.name).substring(0, 20).padEnd(22)} | ${sanitized.description.substring(0, 20).padEnd(22)} |`);
  console.log(`| Preço       | ${String(original.price).padEnd(22)} | ${sanitized.amount.toFixed(2).padEnd(22)} |`);
  console.log(`| Tipo preço  | ${(typeof original.price).padEnd(22)} | number                 |`);
}

// CRC16 CCITT calculation for PIX payload
function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Generate PIX EMV payload (Pix Copia e Cola)
function generatePixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  transactionId: string;
  description?: string;
}): string {
  const { pixKey, merchantName, merchantCity, amount, transactionId, description } = params;

  const formatValue = (id: string, value: string): string => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const gui = formatValue('00', 'br.gov.bcb.pix');
  const key = formatValue('01', pixKey);
  const desc = description ? formatValue('02', description.slice(0, 72)) : '';
  const merchantAccountInfo = formatValue('26', gui + key + desc);

  let payload = '';
  payload += formatValue('00', '01');
  payload += merchantAccountInfo;
  payload += formatValue('52', '0000');
  payload += formatValue('53', '986');
  
  if (amount > 0) {
    payload += formatValue('54', amount.toFixed(2));
  }
  
  payload += formatValue('58', 'BR');
  payload += formatValue('59', merchantName.slice(0, 25));
  payload += formatValue('60', merchantCity.slice(0, 15));
  payload += formatValue('62', formatValue('05', transactionId.slice(0, 25)));

  payload += '6304';
  const crc = crc16ccitt(payload);
  payload = payload.slice(0, -4) + '6304' + crc;

  return payload;
}

// REMOVIDO: Geração de QR Code via API externa
// O QR Code DEVE ser gerado no frontend usando a biblioteca qrcode.react
// A partir do código EMV retornado pela PodPay
// Isso evita problemas de codificação que causam "QR inválido" no Nubank

// Log para debug: verificar se função foi removida
console.log('NOTA: Geração de QR Code movida para frontend (qrcode.react)');
console.log('Backend retorna apenas o código EMV da PodPay');


// Create transaction in PodPay API
// Returns full PodPay transaction response for 3DS flow
// Auth: Basic Auth with PUBLIC_KEY:SECRET_KEY in Base64
async function createPodPayTransaction(params: {
  publicKey: string;
  secretKey: string;
  saleId: string;
  orderId: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  buyerDocument: string | null;
  buyerPhone: string | null;
  buyerIp: string | null;
  productId: string;
  productName: string;
  webhookUrl: string;
  paymentMethod: string;
  cardToken?: string | null;
  returnUrl?: string | null;
  installments?: number;
  quantity?: number;
  unitPriceCents?: number;
  orderBumpItems?: Array<{ name: string; price: number }>;
}): Promise<{ success: boolean; transaction?: any; pixData?: any; error?: string; hasPix?: boolean }> {
  try {
    console.log('Creating PodPay transaction - Order:', params.orderId, 'Sale:', params.saleId, 'Method:', params.paymentMethod);
    
    // PodPay Sub API endpoint (official docs: https://app.podpay.co/docs/sales/create-sale)
    const apiUrl = 'https://api.podpay.co/v1/transactions';
    
    // Basic Auth: SECRET_KEY:x encoded in Base64
    // Docs show: authorization: 'Basic Og==' which is empty ':' - but we use secretKey:x
    const credentials = `${params.secretKey}:x`;
    const encodedCredentials = btoa(credentials);
    const authHeader = `Basic ${encodedCredentials}`;
    
    console.log('Using Basic Auth - SecretKey:x format, URL:', apiUrl);
    
    // Amount in cents (required)
    const amountInCents = Math.round(params.amount * 100);

    // Detect document type (CPF = 11 digits, CNPJ = 14 digits)
    const docNumber = params.buyerDocument?.replace(/\D/g, '') || '';
    const docType = docNumber.length === 14 ? 'cnpj' : 'cpf';

    // Build customer object following PodPay docs
    // API requires document and phone as objects with type/number structure
    const customer: any = {
      name: params.buyerName,
      email: params.buyerEmail,
    };
    
    // Document as object with type and number (required by PodPay)
    if (params.buyerDocument && docNumber.length >= 11) {
      customer.document = {
        type: docType,
        number: docNumber,
      };
    }
    
    // Phone as simple string (required by PodPay - must be string type)
    if (params.buyerPhone) {
      const phoneDigits = params.buyerPhone.replace(/\D/g, '');
      // Format: country code + area code + number (e.g., 5524998172597)
      customer.phone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    }

    // Build items array - main product + order bumps
    const items: Array<{ title: string; unitPrice: number; quantity: number; tangible: boolean }> = [
      {
        title: params.productName,
        unitPrice: params.unitPriceCents || amountInCents,
        quantity: params.quantity || 1,
        tangible: false,
      }
    ];
    
    // Add order bump items if present
    if (params.orderBumpItems && params.orderBumpItems.length > 0) {
      for (const bump of params.orderBumpItems) {
        items.push({
          title: bump.name,
          unitPrice: Math.round(bump.price * 100), // Convert to cents
          quantity: 1, // Order bumps always have quantity 1
          tangible: false,
        });
      }
      console.log('Order bumps added to PodPay items:', params.orderBumpItems.length);
    }

    // Build request body following PodPay docs
    const requestBody: any = {
      amount: amountInCents,
      paymentMethod: params.paymentMethod, // 'pix', 'credit_card', 'boleto'
      customer: customer,
      items: items,
      postbackUrl: params.webhookUrl,
      externalRef: params.orderId,
      metadata: JSON.stringify({
        sale_id: params.saleId,
        product_id: params.productId,
        order_id: params.orderId,
      }),
    };

    // Add IP if available
    if (params.buyerIp) {
      requestBody.ip = params.buyerIp;
    }

    // Add PIX specific options
    if (params.paymentMethod === 'pix') {
      requestBody.pix = {
        expiresInMinutes: 30,
      };
    }

    // Add card for credit card payments
    if (params.paymentMethod === 'credit_card' && params.cardToken) {
      requestBody.card = {
        token: params.cardToken,
      };
      requestBody.installments = params.installments || 1;
      
      if (params.returnUrl) {
        requestBody.returnUrl = params.returnUrl;
      }
    }

    console.log('PodPay request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log(`PodPay response: ${response.status} - ${responseText.substring(0, 1000)}`);

    if (!response.ok) {
      console.error('PodPay API error:', response.status, responseText);
      
      // Parse error message for user-friendly display
      let userMessage = 'Erro ao processar pagamento. Tente novamente.';
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.message) {
          // Map common gateway errors to user-friendly messages
          if (errorData.message.includes('adquirente') || response.status === 424) {
            userMessage = 'O gateway de pagamento está temporariamente indisponível. Por favor, tente novamente em alguns minutos ou entre em contato com o suporte.';
          } else if (errorData.message.includes('autenticação') || response.status === 401) {
            userMessage = 'Erro de configuração do pagamento. Entre em contato com o vendedor.';
          } else if (response.status === 400) {
            userMessage = 'Dados inválidos. Verifique as informações e tente novamente.';
          } else {
            userMessage = errorData.message;
          }
        }
      } catch (e) {
        // Keep default message if JSON parse fails
        console.error('Could not parse error response');
      }
      
      console.error('Technical error:', `PodPay API error: ${response.status} - ${responseText}`);
      
      return { 
        success: false, 
        error: userMessage
      };
    }

    const data = JSON.parse(responseText);
    console.log('PodPay transaction created successfully - ID:', data.id, 'Status:', data.status);
    
    // Log full PIX object for debugging
    if (data.pix) {
      console.log('PodPay PIX object:', JSON.stringify(data.pix));
    }
    
    // Extract PIX data from PodPay response
    // IMPORTANT: PodPay returns 'qrcode' (all lowercase) - this is the EMV/copia-e-cola code
    // We MUST use this value directly - DO NOT generate PIX locally
    let pixData = null;
    
    if (data.pix && data.pix.qrcode) {
      // PodPay returns the EMV code in pix.qrcode field (lowercase)
      // This is the valid copia-e-cola code that should be used to generate QR code
      pixData = {
        // The EMV/copia-e-cola code from PodPay - this is the valid PIX payload
        pix_copia_cola: data.pix.qrcode,
        // Expiration date from PodPay
        expiration_date: data.pix.expirationDate,
        // Transaction secure ID for status checking
        secure_id: data.secureId || data.secureUrl,
      };
      console.log('PIX copia-e-cola extracted from PodPay:', pixData.pix_copia_cola.substring(0, 50) + '...');
    } else {
      console.error('PodPay did not return PIX data. Response keys:', JSON.stringify(Object.keys(data)));
      if (data.pix) {
        console.error('PIX object keys:', JSON.stringify(Object.keys(data.pix)));
      }
    }

    console.log('Extracted PIX data:', pixData ? 'SUCCESS' : 'FAILED', '- Transaction ID:', data.id);

    return {
      success: true,
      transaction: data,
      pixData: pixData,
      // Flag if PodPay failed to return PIX data
      hasPix: !!(pixData && pixData.pix_copia_cola),
    };
  } catch (error) {
    console.error('Error creating PodPay transaction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      hasPix: false,
    };
  }
}

// Query transaction status from PodPay API
async function queryPodPayTransaction(apiKey: string, transactionId: string): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    console.log('Querying PodPay transaction:', transactionId);
    
    // Basic Auth: SECRET_KEY:x encoded in Base64
    const credentials = `${apiKey}:x`;
    const encodedCredentials = btoa(credentials);
    const authHeader = `Basic ${encodedCredentials}`;
    
    const response = await fetch(`https://api.podpay.co/v1/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PodPay query error:', response.status, errorText);
      return { success: false, error: `Query failed: ${response.status}` };
    }

    const data = await response.json();
    console.log('PodPay transaction status:', data.id, data.status);
    return { success: true, transaction: data };
  } catch (error) {
    console.error('Error querying PodPay:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10000) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP and user agent from request headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') ||
                     null;
    const clientUserAgent = req.headers.get('user-agent') || null;

    const body = await req.json();
    console.log('Processing checkout request - IP:', clientIp);

    const { 
      product_id, 
      buyer_name, 
      buyer_email, 
      buyer_document, 
      buyer_phone,
      buyer_ip,      // Frontend can also send IP
      buyer_user_agent, // Frontend can also send user agent
      payment_method, 
      affiliate_id, 
      card_token, 
      return_url,
      installments = 1,
      offer_id,  // Offer ID for discounted pricing
      order_bump_ids,  // Array of order bump IDs
      order_bumps_total = 0,  // Pre-calculated total from order bumps
      quantity = 1,  // Product quantity
      unit_price,    // Unit price from frontend (for validation)
      is_subscription = false,  // Whether this is a subscription checkout
      subscription_quantity_mode = 'single',  // Subscription quantity mode
      coupon_code,  // Coupon code applied
      campaign_id,  // Campaign ID for the coupon
      coupon_discount = 0,  // Pre-calculated coupon discount
      tracking_parameters,  // UTM parameters from frontend - CRITICAL for UTMify
      product_type,  // Product type (physical, digital, etc.)
      logistics,  // Logistics data for physical products { height, width, length, weight }
    } = body;

    // Log logistics data for physical products
    if (product_type === 'physical' && logistics) {
      console.log('[process-checkout] Physical product logistics:', JSON.stringify(logistics));
    }

    // Log UTM parameters received
    console.log('[process-checkout] UTM parameters received:', JSON.stringify(tracking_parameters));

    if (!product_id || !buyer_name || !buyer_email || !payment_method) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate card token for credit card payments
    if (payment_method === 'credit_card' && !card_token) {
      console.error('Card token required for credit card payment');
      return new Response(
        JSON.stringify({ error: 'Card token required for credit card payment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedProductId = String(product_id).slice(0, 36);
    const sanitizedBuyerName = sanitizeString(buyer_name, 100);
    const sanitizedBuyerEmail = sanitizeEmail(buyer_email);
    const sanitizedBuyerDocument = sanitizeDocument(buyer_document);
    const sanitizedBuyerPhone = sanitizePhone(buyer_phone);
    const sanitizedAffiliateId = affiliate_id ? String(affiliate_id).slice(0, 36) : null;
    const sanitizedPaymentMethod = ['pix', 'credit_card', 'boleto'].includes(payment_method) 
      ? payment_method 
      : 'pix';
    const sanitizedInstallments = Math.min(Math.max(parseInt(installments) || 1, 1), 12);

    // Use IP/UA from request headers, fallback to frontend-provided values
    const finalIp = clientIp || sanitizeString(buyer_ip, 45);
    const finalUserAgent = clientUserAgent || sanitizeString(buyer_user_agent, 500);

    if (!sanitizedBuyerName || !sanitizedBuyerEmail) {
      console.error('Invalid buyer name or email');
      return new Response(
        JSON.stringify({ error: 'Invalid buyer name or email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const podpaySecretKey = Deno.env.get('PODPAY_API_KEY'); // Secret key (sk_...)
    const podpayPublicKey = Deno.env.get('PODPAY_PUBLIC_KEY'); // Public key (pk_...)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Debug: Log key prefixes to verify correct keys are being used
    console.log('=== PODPAY CREDENTIALS CHECK ===');
    console.log('Secret Key prefix:', podpaySecretKey?.substring(0, 10) + '...');
    console.log('Public Key prefix:', podpayPublicKey?.substring(0, 10) + '...');
    console.log('Environment:', podpaySecretKey?.startsWith('sk_live') ? 'PRODUCTION' : podpaySecretKey?.startsWith('sk_test') ? 'SANDBOX' : 'UNKNOWN');

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, user_id, commission_percentage, status, payment_type, subscription_quantity_mode')
      .eq('id', sanitizedProductId)
      .eq('status', 'active')
      .maybeSingle();

    if (productError || !product) {
      console.error('Product not found or inactive:', productError);
      return new Response(
        JSON.stringify({ error: 'Product not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subscription quantity mode
    const isProductSubscription = product.payment_type === 'subscription';
    const productQuantityMode = product.subscription_quantity_mode || 'single';
    
    console.log('=== SUBSCRIPTION CHECK ===');
    console.log('Is subscription product:', isProductSubscription);
    console.log('Quantity mode:', productQuantityMode);
    console.log('Requested quantity:', quantity);
    
    // For subscription products with 'single' mode, force quantity to 1
    let validatedQuantity = Math.max(1, Math.min(100, parseInt(String(quantity)) || 1));
    if (isProductSubscription && productQuantityMode === 'single' && validatedQuantity !== 1) {
      console.warn('Subscription with single mode - forcing quantity to 1');
      validatedQuantity = 1;
    }

    // Fetch and validate offer if provided
    let offerData: { final_price: number } | null = null;
    const sanitizedOfferId = offer_id ? String(offer_id).slice(0, 36) : null;
    
    if (sanitizedOfferId) {
      // Try full UUID first, then short ID (prefix match)
      const isFullUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedOfferId);
      
      let fetchedOffer = null;
      
      if (isFullUUID) {
        const { data, error } = await supabase
          .from('product_offers')
          .select('id, product_id, final_price, status')
          .eq('id', sanitizedOfferId)
          .eq('product_id', product.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (error) console.error('Error fetching offer by UUID:', error);
        fetchedOffer = data;
      } else if (sanitizedOfferId.length >= 8) {
        // Short ID - search by prefix
        const { data, error } = await supabase
          .from('product_offers')
          .select('id, product_id, final_price, status')
          .ilike('id', `${sanitizedOfferId}%`)
          .eq('product_id', product.id)
          .eq('status', 'active');
        
        if (error) console.error('Error fetching offer by short ID:', error);
        if (data && data.length > 0) {
          fetchedOffer = data[0];
        }
      }
      
      if (fetchedOffer) {
        offerData = {
          final_price: fetchedOffer.final_price,
        };
        console.log('Offer validated:', fetchedOffer.id, 'Final price:', offerData.final_price);
      } else {
        console.log('Offer not found or not valid for this product:', sanitizedOfferId);
        // Continue with product price - don't block the sale
      }
    }

    // Validate affiliate if provided
    let validatedAffiliateId: string | null = null;
    let affiliateCommission: number = 0;
    
    if (sanitizedAffiliateId) {
      // Check if it's a full UUID or short ID
      const isFullUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedAffiliateId);
      
      let affiliationData = null;
      
      if (isFullUUID) {
        // Direct lookup by UUID
        const { data: affiliation } = await supabase
          .from('affiliations')
          .select('id, product_id, user_id, status')
          .eq('id', sanitizedAffiliateId)
          .eq('status', 'active')
          .maybeSingle();
        affiliationData = affiliation;
      } else {
        // Lookup by short ID (first 8 chars)
        const { data: affiliations } = await supabase
          .from('affiliations')
          .select('id, product_id, user_id, status')
          .ilike('id', `${sanitizedAffiliateId}%`)
          .eq('status', 'active');
        
        if (affiliations && affiliations.length > 0) {
          affiliationData = affiliations[0];
        }
      }
      
      if (affiliationData && affiliationData.product_id === product.id) {
        validatedAffiliateId = affiliationData.id;
        affiliateCommission = product.commission_percentage || 30;
        console.log('Affiliate validated:', validatedAffiliateId, 'Commission:', affiliateCommission + '%');
      } else {
        console.log('Affiliate not found or not valid for this product:', sanitizedAffiliateId);
        // Continue without affiliate - don't block the sale
      }
    }

    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', product.user_id)
      .maybeSingle();

    // ============================================================
    // CÁLCULO CORRETO DAS TAXAS - ORDEM OBRIGATÓRIA
    // ============================================================
    // 1. Valor bruto da venda (amount) - use offer price if available
    // 2. Taxa do meio de pagamento (% + valor fixo)
    // 3. Taxa da plataforma (% + valor fixo)
    // 4. Comissão de afiliado (calculada sobre valor bruto)
    // 5. Valor líquido final = bruto - taxas - comissão
    // ============================================================
    
    // Use validated quantity from subscription check (or sanitize again for non-subscription)
    const sanitizedQuantity = validatedQuantity;
    
    // Use offer price if available, otherwise use product price
    // Multiply by quantity and add order bumps total
    const sanitizedOrderBumpsTotal = sanitizeAmount(order_bumps_total || 0);
    const sanitizedCouponDiscount = sanitizeAmount(coupon_discount || 0);
    const unitAmount = sanitizeAmount(offerData ? offerData.final_price : product.price);
    const productSubtotal = sanitizeAmount(unitAmount * sanitizedQuantity);
    const subtotalBeforeDiscount = sanitizeAmount(productSubtotal + sanitizedOrderBumpsTotal);
    const amount = sanitizeAmount(Math.max(0.01, subtotalBeforeDiscount - sanitizedCouponDiscount)); // Valor bruto total após desconto
    
    console.log('=== QUANTITY, ORDER BUMPS & COUPON ===');
    console.log('Unit amount:', unitAmount);
    console.log('Quantity:', sanitizedQuantity);
    console.log('Product subtotal (unit x qty):', productSubtotal);
    console.log('Order bumps total:', sanitizedOrderBumpsTotal);
    console.log('Coupon discount:', sanitizedCouponDiscount);
    console.log('Order bump IDs:', order_bump_ids);
    console.log('Final amount:', amount);
    
    // Validate frontend unit_price matches backend (if provided)
    if (unit_price !== undefined) {
      const frontendUnitPrice = sanitizeAmount(unit_price);
      if (Math.abs(frontendUnitPrice - unitAmount) > 0.01) {
        console.warn('Price mismatch detected!', 'Frontend:', frontendUnitPrice, 'Backend:', unitAmount);
        // Log but don't block - backend is source of truth
      }
    }
    
    // =====================================
    // CÁLCULO PADRONIZADO DE TAXAS - TIPO: VENDA
    // Usa função específica para vendas (nunca misturar com saque/assinatura)
    // Fórmula: valor_liquido = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado
    // =====================================
    
    // Configuração de taxas por método de pagamento
    const TAXAS_PAGAMENTO: Record<string, { percentual: number; fixo: number }> = {
      pix: { percentual: 4.99, fixo: 1.49 },
      credit_card: { percentual: 6.99, fixo: 1.49 },
      boleto: { percentual: 3.99, fixo: 2.99 },
      debit_card: { percentual: 5.99, fixo: 1.49 },
      balance: { percentual: 0, fixo: 0 },
    };
    
    // Função de arredondamento monetário
    const arredondarMoeda = (valor: number): number => Math.round(valor * 100) / 100;
    
    // Obter configuração de taxa para o método
    const taxaConfig = TAXAS_PAGAMENTO[sanitizedPaymentMethod] || TAXAS_PAGAMENTO.pix;
    
    // Passo 1: Calcular taxa de pagamento (percentual + fixo)
    const taxaPagamentoPercentual = arredondarMoeda((amount * taxaConfig.percentual) / 100);
    const taxaPagamentoFixa = arredondarMoeda(taxaConfig.fixo);
    const paymentFee = arredondarMoeda(taxaPagamentoPercentual + taxaPagamentoFixa);
    const paymentFeePercent = taxaConfig.percentual;
    
    // Passo 2: Taxa da plataforma (já incluída na taxa de pagamento para vendas)
    const platformFeePercent = 0;
    const platformFee = 0;
    
    // Passo 3: Comissão de afiliado (apenas se houver afiliado validado)
    const affiliateCommissionPercent = validatedAffiliateId ? (product.commission_percentage || 30) : 0;
    const commissionAmount = validatedAffiliateId 
      ? arredondarMoeda((amount * affiliateCommissionPercent) / 100)
      : 0;
    
    // Passo 4: Calcular total de taxas (específico para VENDA)
    const totalTaxas = arredondarMoeda(paymentFee + platformFee + commissionAmount);
    
    // Passo 5: Calcular valor líquido final (VENDA: descontado antes de creditar ao vendedor)
    const netAmount = arredondarMoeda(amount - totalTaxas);
    
    // Log detalhado para auditoria - identificando tipo de operação
    console.log('=== CÁLCULO DE TAXAS - OPERAÇÃO: VENDA ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Passo 1 - Valor bruto (pago pelo cliente):', amount.toFixed(2));
    console.log(`Passo 2 - Taxa pagamento (${sanitizedPaymentMethod}): ${paymentFeePercent}% de R$ ${amount.toFixed(2)} = R$ ${taxaPagamentoPercentual.toFixed(2)} + R$ ${taxaPagamentoFixa.toFixed(2)} fixo = R$ ${paymentFee.toFixed(2)}`);
    console.log('Passo 3 - Taxa plataforma: R$', platformFee.toFixed(2), '(incluída na taxa de pagamento)');
    console.log(`Passo 4 - Comissão afiliado (${affiliateCommissionPercent}%): R$ ${commissionAmount.toFixed(2)}`);
    console.log('Passo 5 - Total taxas VENDA: R$', totalTaxas.toFixed(2));
    console.log('Passo 6 - Valor líquido (creditado ao vendedor): R$ ' + amount.toFixed(2) + ' - R$ ' + totalTaxas.toFixed(2) + ' = R$ ' + netAmount.toFixed(2));
    console.log('Fórmula VENDA: valor_liquido = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado');
    console.log('NOTA: Taxas descontadas ANTES de creditar saldo ao vendedor');
    console.log('==========================================');
    
    // VALIDAÇÃO CRÍTICA 1: Valor líquido não pode ser negativo
    if (netAmount < 0) {
      console.error('ERRO CRÍTICO: Valor líquido negativo! Bloqueando transação.');
      return new Response(
        JSON.stringify({ 
          error: 'Erro no cálculo das taxas. Valor líquido negativo.',
          code: 'FEE_CALCULATION_ERROR',
          details: {
            valor_bruto: amount,
            taxa_pagamento: paymentFee,
            taxa_plataforma: platformFee,
            comissao_afiliado: commissionAmount,
            total_taxas: totalTaxas,
            valor_liquido: netAmount,
            formula: 'valor_liquido = valor_bruto - taxa_pagamento - taxa_plataforma - comissao_afiliado'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // VALIDAÇÃO CRÍTICA 2: Taxas não podem exceder valor bruto
    if (totalTaxas > amount) {
      console.error('ERRO CRÍTICO: Total de taxas excede valor bruto! Bloqueando transação.');
      return new Response(
        JSON.stringify({ 
          error: 'Total de taxas excede o valor da venda.',
          code: 'FEE_EXCEEDS_AMOUNT',
          details: {
            valor_bruto: amount,
            total_taxas: totalTaxas
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique ORDER ID - this MUST be consistent throughout the entire flow
    // Format: RP + timestamp + random suffix
    const orderId = `RP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Sanitize coupon data
    const sanitizedCouponCode = coupon_code ? sanitizeString(coupon_code, 50)?.toUpperCase() : null;
    const sanitizedCampaignId = campaign_id ? String(campaign_id).slice(0, 36) : null;
    
    // Validate campaign_id is a valid UUID if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validCampaignId = sanitizedCampaignId && uuidRegex.test(sanitizedCampaignId) ? sanitizedCampaignId : null;

    // ============================================================
    // VALIDAÇÃO OBRIGATÓRIA DE CUPOM - REGRA DE NEGÓCIO CRÍTICA
    // Cupons só podem ser aplicados em produtos do próprio usuário
    // ou em produtos onde ele seja coprodutor
    // ============================================================
    if (validCampaignId && sanitizedCouponCode && sanitizedCouponDiscount > 0) {
      console.log('=== VALIDAÇÃO DE PROPRIEDADE DO CUPOM ===');
      
      // Buscar a campanha para verificar o produto associado
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, product_id, coupon_code, is_active')
        .eq('id', validCampaignId)
        .maybeSingle();

      if (campaignError || !campaign) {
        console.error('BLOQUEADO: Campanha não encontrada:', validCampaignId);
        
        // Log tentativa bloqueada (fire and forget)
        try {
          await supabase.from('checkout_logs').insert({
            event_type: 'coupon_checkout_blocked',
            product_id: sanitizedProductId,
            buyer_email: sanitizedBuyerEmail,
            metadata: {
              coupon_code: sanitizedCouponCode,
              campaign_id: validCampaignId,
              reason: 'CAMPAIGN_NOT_FOUND',
              message: 'Tentativa de usar campanha inexistente no checkout',
            },
          });
        } catch (logErr) { console.warn('Log error:', logErr); }

        return new Response(
          JSON.stringify({ 
            error: 'Este cupom não é válido para este produto.',
            code: 'INVALID_COUPON' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se o cupom é para este produto
      if (campaign.product_id !== sanitizedProductId) {
        console.error('BLOQUEADO: Cupom de outro produto');
        console.error('Campanha produto:', campaign.product_id);
        console.error('Produto checkout:', sanitizedProductId);

        try {
          await supabase.from('checkout_logs').insert({
            event_type: 'coupon_checkout_blocked',
            product_id: sanitizedProductId,
            buyer_email: sanitizedBuyerEmail,
            metadata: {
              coupon_code: sanitizedCouponCode,
              campaign_id: validCampaignId,
              campaign_product_id: campaign.product_id,
              checkout_product_id: sanitizedProductId,
              reason: 'PRODUCT_MISMATCH',
              message: 'Cupom pertence a outro produto',
            },
          });
        } catch (logErr) { console.warn('Log error:', logErr); }

        return new Response(
          JSON.stringify({ 
            error: 'Este cupom não é válido para este produto.',
            code: 'PRODUCT_MISMATCH' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se a campanha está ativa
      if (!campaign.is_active) {
        console.error('BLOQUEADO: Campanha inativa');

        try {
          await supabase.from('checkout_logs').insert({
            event_type: 'coupon_checkout_blocked',
            product_id: sanitizedProductId,
            buyer_email: sanitizedBuyerEmail,
            metadata: {
              coupon_code: sanitizedCouponCode,
              campaign_id: validCampaignId,
              reason: 'CAMPAIGN_INACTIVE',
              message: 'Cupom desativado',
            },
          });
        } catch (logErr) { console.warn('Log error:', logErr); }

        return new Response(
          JSON.stringify({ 
            error: 'Este cupom não está mais disponível.',
            code: 'INACTIVE_COUPON' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar o dono do produto da campanha
      const { data: campaignProduct, error: campaignProductError } = await supabase
        .from('products')
        .select('id, user_id')
        .eq('id', campaign.product_id)
        .maybeSingle();

      if (campaignProductError || !campaignProduct) {
        console.error('BLOQUEADO: Produto da campanha não encontrado');

        try {
          await supabase.from('checkout_logs').insert({
            event_type: 'coupon_checkout_blocked',
            product_id: sanitizedProductId,
            buyer_email: sanitizedBuyerEmail,
            metadata: {
              coupon_code: sanitizedCouponCode,
              campaign_id: validCampaignId,
              reason: 'CAMPAIGN_PRODUCT_NOT_FOUND',
              message: 'Produto da campanha não existe',
            },
          });
        } catch (logErr) { console.warn('Log error:', logErr); }

        return new Response(
          JSON.stringify({ 
            error: 'Este cupom não é válido para este produto.',
            code: 'INVALID_COUPON' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const campaignOwnerUserId = campaignProduct.user_id;
      const productOwnerId = product.user_id;

      // Verificar se o dono da campanha é o dono do produto
      const isProductOwner = campaignOwnerUserId === productOwnerId;

      // Se não for dono, verificar se é coprodutor
      let isCoProducer = false;
      if (!isProductOwner) {
        const { data: coProducerRecord } = await supabase
          .from('co_producers')
          .select('id, status')
          .eq('product_id', sanitizedProductId)
          .eq('user_id', campaignOwnerUserId)
          .eq('status', 'active')
          .maybeSingle();

        if (coProducerRecord) {
          isCoProducer = true;
        }
      }

      // Se não for dono nem coprodutor, bloquear
      if (!isProductOwner && !isCoProducer) {
        console.error('BLOQUEADO: Dono do cupom não tem relação com o produto');
        console.error('Campaign owner:', campaignOwnerUserId);
        console.error('Product owner:', productOwnerId);

        try {
          await supabase.from('checkout_logs').insert({
            event_type: 'coupon_checkout_blocked',
            product_id: sanitizedProductId,
            buyer_email: sanitizedBuyerEmail,
            metadata: {
              coupon_code: sanitizedCouponCode,
              campaign_id: validCampaignId,
              campaign_owner_id: campaignOwnerUserId,
              product_owner_id: productOwnerId,
              reason: 'NO_OWNERSHIP_RELATION',
              message: 'Cupom não pertence ao dono ou coprodutor do produto',
            },
          });
        } catch (logErr) { console.warn('Log error:', logErr); }

        return new Response(
          JSON.stringify({ 
            error: 'Este cupom não é válido para este produto.',
            code: 'OWNERSHIP_MISMATCH' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('=== CUPOM VALIDADO COM SUCESSO ===');
      console.log('É dono do produto:', isProductOwner);
      console.log('É coprodutor:', isCoProducer);
    }

    // Build metadata with UTM tracking parameters - CRITICAL for UTMify
    const saleMetadata: Record<string, any> = {
      ip_address: finalIp,
      user_agent: finalUserAgent,
    };
    
    // Add UTM tracking parameters if provided
    if (tracking_parameters && typeof tracking_parameters === 'object') {
      saleMetadata.utms = {
        utm_source: tracking_parameters.utm_source || null,
        utm_medium: tracking_parameters.utm_medium || null,
        utm_campaign: tracking_parameters.utm_campaign || null,
        utm_content: tracking_parameters.utm_content || null,
        utm_term: tracking_parameters.utm_term || null,
        src: tracking_parameters.src || null,
        sck: tracking_parameters.sck || null,
      };
      saleMetadata.tracking_parameters = saleMetadata.utms; // Alias for compatibility
      console.log('[process-checkout] UTMs saved to metadata:', JSON.stringify(saleMetadata.utms));
    } else {
      console.log('[process-checkout] No UTMs provided - sale will have empty tracking');
    }

    // Sanitize shipping address data
    const sanitizeShippingField = (value: unknown, maxLength: number = 100): string | null => {
      if (!value || typeof value !== 'string') return null;
      return value.trim().slice(0, maxLength).replace(/[<>]/g, '');
    };

    // Extract shipping address from request body if provided
    const shippingAddress = {
      shipping_cep: sanitizeShippingField(body.shipping_cep, 9),
      shipping_street: sanitizeShippingField(body.shipping_street, 200),
      shipping_number: sanitizeShippingField(body.shipping_number, 20),
      shipping_complement: sanitizeShippingField(body.shipping_complement, 100),
      shipping_neighborhood: sanitizeShippingField(body.shipping_neighborhood, 100),
      shipping_city: sanitizeShippingField(body.shipping_city, 100),
      shipping_state: sanitizeShippingField(body.shipping_state, 2),
    };

    console.log('Shipping address:', shippingAddress.shipping_cep ? 'Provided' : 'Not provided');

    // Create sale record with ALL fee details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        product_id: product.id,
        seller_user_id: product.user_id,
        buyer_name: sanitizedBuyerName,
        buyer_email: sanitizedBuyerEmail,
        buyer_document: sanitizedBuyerDocument,
        buyer_phone: sanitizedBuyerPhone, // Add phone to sale
        // Valores
        amount: amount, // Valor bruto
        net_amount: netAmount, // Valor líquido
        // Taxas
        payment_fee: paymentFee,
        payment_fee_percent: paymentFeePercent,
        platform_fee: platformFee,
        platform_fee_percent: platformFeePercent,
        // Comissão afiliado
        commission_amount: commissionAmount,
        affiliate_commission_percent: affiliateCommissionPercent,
        // Cupom de desconto
        campaign_id: validCampaignId,
        coupon_code: sanitizedCouponCode,
        coupon_discount: sanitizedCouponDiscount,
        // Outros
        payment_method: sanitizedPaymentMethod,
        status: 'pending', // ALWAYS start as pending - webhook updates status
        transaction_id: orderId, // Initially set to orderId, updated with PodPay ID
        affiliation_id: validatedAffiliateId, // Use validated affiliate ID
        // Metadata with UTMs - CRITICAL for UTMify
        metadata: saleMetadata,
        // Shipping address for physical products
        ...shippingAddress,
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return new Response(
        JSON.stringify({ error: 'Failed to create sale' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sale created - ID:', sale.id, 'OrderID:', orderId);

    // ============================================================
    // CREATE ORDER ITEMS (MAIN PRODUCT + ORDER BUMPS)
    // ============================================================
    const orderItems: any[] = [];

    // 1. Add main product as order item
    orderItems.push({
      sale_id: sale.id,
      product_id: product.id,
      item_type: 'main',
      order_bump_id: null,
      name: product.name,
      quantity: sanitizedQuantity,
      unit_price: unitAmount,
      subtotal: productSubtotal,
      delivery_status: 'pending',
    });

    // 2. Add order bumps as order items
    const sanitizedOrderBumpIds = order_bump_ids && Array.isArray(order_bump_ids) 
      ? order_bump_ids.map((id: string) => String(id).slice(0, 36))
      : [];

    // Store bump details for PodPay items
    let orderBumpItemsForGateway: Array<{ name: string; price: number }> = [];

    if (sanitizedOrderBumpIds.length > 0) {
      console.log('Processing order bumps:', sanitizedOrderBumpIds);
      
      // Fetch order bump details
      const { data: bumpDetails, error: bumpError } = await supabase
        .from('order_bumps')
        .select('id, name, price, discount_price, bump_product_id')
        .in('id', sanitizedOrderBumpIds)
        .eq('is_active', true);

      if (bumpError) {
        console.error('Error fetching order bumps:', bumpError);
      } else if (bumpDetails && bumpDetails.length > 0) {
        for (const bump of bumpDetails) {
          const bumpPrice = bump.discount_price ?? bump.price;
          // Use bump_product_id if available, otherwise use main product
          const bumpProductId = bump.bump_product_id || product.id;
          
          orderItems.push({
            sale_id: sale.id,
            product_id: bumpProductId,
            item_type: 'bump',
            order_bump_id: bump.id,
            name: bump.name,
            quantity: 1, // Order bumps always have quantity 1
            unit_price: bumpPrice,
            subtotal: bumpPrice,
            delivery_status: 'pending',
          });
          
          // Store for gateway
          orderBumpItemsForGateway.push({
            name: bump.name,
            price: bumpPrice,
          });
          
          console.log('Added order bump:', bump.name, 'Price:', bumpPrice, 'ProductId:', bumpProductId);
        }
      }
    }

    // Insert all order items
    if (orderItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Don't fail the checkout, just log the error
      } else {
        console.log('Order items created:', orderItems.length);
      }
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/podpay-webhook`;

    // For PIX payment
    if (sanitizedPaymentMethod === 'pix') {
      try {
        let pixCopiaCola: string;
        let podpayTransactionId: string | undefined;
        let expirationDate: string | undefined;

        // ============================================================
        // VALIDAÇÃO OBRIGATÓRIA DO PRODUTO ANTES DE CRIAR PIX
        // ============================================================
        
        // Use the calculated amount (with quantity) for validation
        const validation = validateProductForPix(
          { name: product.name, price: amount, description: product.name },
          orderId,
          0 // discount - pode ser passado se houver cupom
        );
        
        if (!validation.valid) {
          console.error('BLOQUEADO: Produto inválido para PIX');
          
          // Log detalhado dos erros para debug
          await supabase.from('webhook_logs').insert({
            event_type: 'pix_validation_failed',
            payload: {
              sale_id: sale.id,
              order_id: orderId,
              product_id: product.id,
              product_name: product.name,
              product_price: product.price,
              validation_errors: validation.errors,
              buyer_email: sanitizedBuyerEmail,
            },
            status: 'error',
            ip_address: finalIp,
            processed_at: new Date().toISOString(),
          });
          
          return new Response(
            JSON.stringify({ 
              error: 'Dados do produto inválidos para pagamento PIX',
              code: 'PIX_VALIDATION_FAILED',
              details: validation.errors,
              suggestion: 'Verifique o preço e descrição do produto'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Usar dados sanitizados da validação
        const validatedAmount = validation.sanitizedData!.amount;
        const validatedDescription = validation.sanitizedData!.description;
        
        // Log comparação para debug
        logProductComparison(
          { name: product.name, price: product.price },
          validation.sanitizedData!
        );

        // REGRA OBRIGATÓRIA: PIX DEVE ser gerado EXCLUSIVAMENTE via API PodPay
        // NÃO gerar QR Code localmente - usar APENAS os dados retornados pela PodPay
        if (!podpaySecretKey || !podpayPublicKey) {
          console.error('ERRO CRÍTICO: Chaves PodPay não configuradas - PIX não pode ser gerado');
          return new Response(
            JSON.stringify({ 
              error: 'Pagamento PIX não configurado. Entre em contato com o suporte.',
              code: 'PIX_NOT_CONFIGURED'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Criando transação PIX via API PodPay (produção)...');
        console.log('- Valor validado:', validatedAmount);
        console.log('- Descrição validada:', validatedDescription);
        
        const podpayResult = await createPodPayTransaction({
          publicKey: podpayPublicKey,
          secretKey: podpaySecretKey,
          saleId: sale.id,
          orderId: orderId,
          amount: validatedAmount, // Usar valor validado (já inclui quantidade + bumps)
          buyerName: sanitizedBuyerName,
          buyerEmail: sanitizedBuyerEmail,
          buyerDocument: sanitizedBuyerDocument,
          buyerPhone: sanitizedBuyerPhone,
          buyerIp: finalIp,
          productId: product.id,
          productName: validatedDescription, // Usar descrição sanitizada
          webhookUrl: webhookUrl,
          paymentMethod: 'pix',
          quantity: sanitizedQuantity,
          unitPriceCents: Math.round(unitAmount * 100),
          orderBumpItems: orderBumpItemsForGateway, // Include order bumps as separate items
        });

        // Verificar se PodPay retornou os dados do PIX
        if (!podpayResult.success) {
          console.error('Erro na API PodPay:', podpayResult.error);
          
          // Parse error message for better user feedback
          let userMessage = 'Falha ao criar pagamento PIX. Tente novamente em alguns instantes.';
          let statusCode = 502; // Bad Gateway - upstream error
          
          if (podpayResult.error?.includes('424') || podpayResult.error?.includes('adquirente')) {
            userMessage = 'O gateway de pagamento está temporariamente indisponível. Por favor, tente novamente em alguns minutos.';
            statusCode = 503; // Service Unavailable
          } else if (podpayResult.error?.includes('401') || podpayResult.error?.includes('403')) {
            userMessage = 'Erro de configuração do pagamento. Contate o suporte.';
            statusCode = 500;
          }
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: userMessage,
              code: 'PODPAY_API_ERROR',
              details: podpayResult.error,
              retry: true
            }),
            { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!podpayResult.hasPix || !podpayResult.pixData?.pix_copia_cola) {
          console.error('PodPay não retornou dados do PIX. Response:', JSON.stringify(podpayResult));
          return new Response(
            JSON.stringify({ 
              error: 'PodPay não retornou o código PIX. Tente novamente.',
              code: 'PODPAY_NO_PIX_DATA'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Usar EXCLUSIVAMENTE os dados retornados pela PodPay
        pixCopiaCola = podpayResult.pixData.pix_copia_cola;
        expirationDate = podpayResult.pixData.expiration_date;
        podpayTransactionId = podpayResult.transaction?.id;

        console.log('PIX recebido da PodPay com sucesso!');
        console.log('- Transaction ID:', podpayTransactionId);
        console.log('- Copia-Cola (primeiros 50 chars):', pixCopiaCola.substring(0, 50) + '...');
        console.log('- Expiration:', expirationDate);

        // NOTA: QR Code é gerado no FRONTEND usando qrcode.react
        // Isso evita problemas de codificação que causam "QR inválido" no Nubank
        // O backend retorna apenas o código EMV/copia-e-cola da PodPay

        // Atualizar venda com Transaction ID da PodPay
        await supabase
          .from('sales')
          .update({ 
            transaction_id: String(podpayTransactionId) || orderId 
          })
          .eq('id', sale.id);

        // Log evento de sucesso
        await supabase.from('webhook_logs').insert({
          event_type: 'pix_generated_podpay',
          payload: {
            sale_id: sale.id,
            order_id: orderId,
            transaction_id: podpayTransactionId || orderId,
            amount: amount,
            buyer_email: sanitizedBuyerEmail,
            buyer_ip: finalIp,
            pix_expiration: expirationDate,
            source: 'podpay_api', // Sempre via PodPay
          },
          status: 'success',
          ip_address: finalIp,
          processed_at: new Date().toISOString(),
        });

        // Retornar resposta com dados do PIX da PodPay
        // IMPORTANTE: Retornamos o código copia-e-cola EXATAMENTE como veio da PodPay
        return new Response(
          JSON.stringify({
            success: true,
            sale_id: sale.id,
            order_id: orderId,
            transaction_id: String(podpayTransactionId) || orderId,
            status: 'pending',
            pix: {
              // Código EMV/copia-e-cola válido retornado pela PodPay
              // IMPORTANTE: Este código é usado EXATAMENTE como veio da PodPay
              // O QR Code é gerado no frontend usando qrcode.react
              pix_copia_cola: pixCopiaCola,
              // Data de expiração
              expiration_date: expirationDate,
              // Tempo de expiração em minutos (calculado)
              expiration_minutes: 30,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (pixError) {
        console.error('Erro ao processar PIX:', pixError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao processar pagamento PIX. Tente novamente.',
            code: 'PIX_PROCESSING_ERROR',
            details: pixError instanceof Error ? pixError.message : 'Unknown error'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For Credit Card payment
    if (sanitizedPaymentMethod === 'credit_card' && card_token) {
      try {
        if (!podpaySecretKey || !podpayPublicKey) {
          console.error('PodPay keys not configured for credit card payment');
          return new Response(
            JSON.stringify({ error: 'Credit card payment not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Processing credit card payment...');
        
        const podpayResult = await createPodPayTransaction({
          publicKey: podpayPublicKey,
          secretKey: podpaySecretKey,
          saleId: sale.id,
          orderId: orderId,
          amount: amount,
          buyerName: sanitizedBuyerName,
          buyerEmail: sanitizedBuyerEmail,
          buyerDocument: sanitizedBuyerDocument,
          buyerPhone: sanitizedBuyerPhone,
          buyerIp: finalIp,
          productId: product.id,
          productName: product.name,
          webhookUrl: webhookUrl,
          paymentMethod: 'credit_card',
          cardToken: card_token,
          // Return URL for 3DS redirect - includes order_id for callback
          returnUrl: return_url ? `${return_url}?order_id=${orderId}&sale_id=${sale.id}` : undefined,
          installments: sanitizedInstallments,
          quantity: sanitizedQuantity,
          unitPriceCents: Math.round(unitAmount * 100),
          orderBumpItems: orderBumpItemsForGateway, // Include order bumps as separate items
        });

        if (podpayResult.success && podpayResult.transaction) {
          const podpayTransaction = podpayResult.transaction;
          const podpayTransactionId = podpayTransaction.id;
          
          console.log('Credit card transaction created - PodPayID:', podpayTransactionId, 'OrderID:', orderId);
          
          // Update sale with PodPay transaction ID
          // Status remains PENDING - webhook will update
          await supabase
            .from('sales')
            .update({ 
              transaction_id: podpayTransactionId || orderId,
            })
            .eq('id', sale.id);

          // Log event
          await supabase.from('webhook_logs').insert({
            event_type: 'credit_card_created',
            payload: {
              sale_id: sale.id,
              order_id: orderId,
              transaction_id: podpayTransactionId || orderId,
              amount: amount,
              buyer_email: sanitizedBuyerEmail,
              buyer_ip: finalIp,
              podpay_status: podpayTransaction.status,
            },
            status: 'success',
            ip_address: finalIp,
            processed_at: new Date().toISOString(),
          });

          // Return full transaction data for frontend to call finishThreeDS
          // CRITICAL: Frontend MUST call finishThreeDS with this transaction
          // disableRedirect MUST be false for PodPay tracking
          return new Response(
            JSON.stringify({
              success: true,
              sale_id: sale.id,
              order_id: orderId, // Include orderId for tracking
              transaction_id: podpayTransactionId || orderId,
              status: 'pending', // ALWAYS pending - webhook is source of truth
              // Full transaction data for finishThreeDS
              transaction: podpayTransaction,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.error('Credit card payment failed:', podpayResult.error);
          
          await supabase
            .from('sales')
            .update({ status: 'failed' })
            .eq('id', sale.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: podpayResult.error || 'Erro ao processar pagamento com cartão',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (cardError) {
        console.error('Error processing credit card:', cardError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao processar pagamento com cartão',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // For other payment methods
    return new Response(
      JSON.stringify({
        success: true,
        sale_id: sale.id,
        order_id: orderId,
        transaction_id: orderId,
        status: 'pending',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout processing error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// REMOVIDO: Função generateLocalPix
// PIX deve ser gerado EXCLUSIVAMENTE pela API da PodPay
// O QR Code é gerado no frontend usando qrcode.react a partir do EMV da PodPay
// Isso garante que o código seja aceito pelo Nubank e outros apps
