/**
 * Security Utilities Library
 * Provides secure data handling, validation, and protection functions
 */

// ===========================================
// SECURE TOKEN GENERATION
// ===========================================

/**
 * Generates a cryptographically secure random token
 * @param length - Length of the token in bytes (default 32)
 * @returns Hex-encoded secure token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a session ID for checkout
 * @returns Secure session ID with prefix
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = generateSecureToken(16);
  return `sess_${timestamp}_${randomPart}`;
}

/**
 * Generates an anonymous affiliate tracking ID
 * @returns Anonymized affiliate tracking token
 */
export function generateAffiliateTrackingId(): string {
  const prefix = 'aff';
  const timestamp = Date.now().toString(36);
  const random = generateSecureToken(8);
  return `${prefix}_${timestamp}_${random}`;
}

// ===========================================
// INPUT SANITIZATION
// ===========================================

/**
 * Sanitizes user input by removing potentially dangerous characters
 * @param input - Raw user input
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeInput(
  input: string,
  options: {
    maxLength?: number;
    allowNumbers?: boolean;
    allowSpaces?: boolean;
    allowSpecialChars?: boolean;
  } = {}
): string {
  const {
    maxLength = 255,
    allowNumbers = true,
    allowSpaces = true,
    allowSpecialChars = false,
  } = options;

  let sanitized = input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();

  if (!allowSpecialChars) {
    // Keep only alphanumeric, spaces, and basic punctuation
    let pattern = 'a-zA-ZÀ-ÿ';
    if (allowNumbers) pattern += '0-9';
    if (allowSpaces) pattern += '\\s';
    pattern += '.,\\-_@';
    const regex = new RegExp(`[^${pattern}]`, 'g');
    sanitized = sanitized.replace(regex, '');
  }

  return sanitized.slice(0, maxLength);
}

/**
 * Sanitizes email addresses
 * @param email - Raw email input
 * @returns Sanitized email
 */
export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>'"\\]/g, '')
    .slice(0, 255);
}

/**
 * Sanitizes document numbers (CPF/CNPJ)
 * @param document - Raw document input
 * @returns Numeric-only document
 */
export function sanitizeDocument(document: string): string {
  return document.replace(/\D/g, '').slice(0, 14);
}

/**
 * Sanitizes phone numbers
 * @param phone - Raw phone input
 * @returns Numeric-only phone
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 15);
}

// ===========================================
// SECURE DATA MASKING (for display)
// ===========================================

/**
 * Masks email address for display (security)
 * @param email - Full email address
 * @returns Masked email (e.g., "j***@g***.com")
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  
  const [local, domain] = email.split('@');
  const [domainName, ...rest] = domain.split('.');
  
  const maskedLocal = local.charAt(0) + '***';
  const maskedDomain = domainName.charAt(0) + '***';
  
  return `${maskedLocal}@${maskedDomain}.${rest.join('.')}`;
}

/**
 * Masks CPF/CNPJ for display
 * @param document - Full document number
 * @returns Masked document (e.g., "***.***.***-12")
 */
export function maskDocument(document: string): string {
  const cleaned = document.replace(/\D/g, '');
  
  if (cleaned.length === 11) {
    // CPF: show only last 2 digits
    return `***.***.***.${cleaned.slice(-2)}`;
  } else if (cleaned.length === 14) {
    // CNPJ: show only last 2 digits
    return `**.***.***/****-${cleaned.slice(-2)}`;
  }
  
  return '***';
}

/**
 * Masks phone number for display
 * @param phone - Full phone number
 * @returns Masked phone (e.g., "(**) *****-1234")
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length >= 10) {
    return `(**) *****-${cleaned.slice(-4)}`;
  }
  
  return '(**) *****-****';
}

/**
 * Masks credit card number for display
 * @param cardNumber - Full card number
 * @returns Masked card (e.g., "**** **** **** 1234")
 */
export function maskCardNumber(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 4) return '**** **** **** ****';
  return `**** **** **** ${cleaned.slice(-4)}`;
}

// ===========================================
// SECURE ERROR HANDLING
// ===========================================

/**
 * Creates a safe error message without exposing sensitive data
 * @param error - Original error
 * @param context - Error context for logging
 * @returns Safe error message for display
 */
export function createSafeErrorMessage(error: unknown, context: string = 'operation'): string {
  // Log full error securely (server-side only in production)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}] Error:`, error);
  }

  // Return generic messages to user
  const errorMessages: Record<string, string> = {
    'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet e tente novamente.',
    'VALIDATION_ERROR': 'Dados inválidos. Verifique as informações e tente novamente.',
    'PAYMENT_DECLINED': 'Pagamento recusado. Verifique os dados do cartão.',
    'SESSION_EXPIRED': 'Sua sessão expirou. Atualize a página e tente novamente.',
    'RATE_LIMITED': 'Muitas tentativas. Aguarde alguns minutos.',
    'SERVER_ERROR': 'Erro no servidor. Tente novamente em instantes.',
  };

  if (error instanceof Error) {
    // Check for known error codes
    const code = (error as any).code;
    if (code && errorMessages[code]) {
      return errorMessages[code];
    }
  }

  return 'Ocorreu um erro. Tente novamente.';
}

// ===========================================
// RATE LIMITING (Client-side)
// ===========================================

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Checks if an action is rate limited
 * @param key - Unique key for the action
 * @param limit - Maximum attempts
 * @param windowMs - Time window in milliseconds
 * @returns Whether the action is allowed
 */
export function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetIn: windowMs };
  }

  if (record.count >= limit) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: record.resetTime - now 
    };
  }

  record.count++;
  return { 
    allowed: true, 
    remaining: limit - record.count, 
    resetIn: record.resetTime - now 
  };
}

// ===========================================
// SECURE STORAGE
// ===========================================

/**
 * Securely stores checkout session data
 * Never stores sensitive data like passwords or full card numbers
 */
export const secureStorage = {
  setSessionId: (sessionId: string) => {
    try {
      sessionStorage.setItem('checkout_session_id', sessionId);
    } catch {
      // Handle storage disabled
    }
  },

  getSessionId: (): string | null => {
    try {
      return sessionStorage.getItem('checkout_session_id');
    } catch {
      return null;
    }
  },

  clearSession: () => {
    try {
      sessionStorage.removeItem('checkout_session_id');
      sessionStorage.removeItem('checkout_cart');
    } catch {
      // Handle storage disabled
    }
  },

  // Store cart with only non-sensitive data
  setCart: (cart: { productId: string; quantity: number; orderBumps: string[] }) => {
    try {
      sessionStorage.setItem('checkout_cart', JSON.stringify(cart));
    } catch {
      // Handle storage disabled
    }
  },

  getCart: (): { productId: string; quantity: number; orderBumps: string[] } | null => {
    try {
      const data = sessionStorage.getItem('checkout_cart');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
};

// ===========================================
// AFFILIATE TRACKING SECURITY
// ===========================================

/**
 * Validates and sanitizes affiliate reference
 * @param ref - Affiliate reference from URL
 * @returns Validated affiliate ID or null
 */
export function validateAffiliateRef(ref: string | null): string | null {
  if (!ref) return null;

  // Only allow alphanumeric and specific characters
  const sanitized = ref.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Validate format and length
  if (sanitized.length < 5 || sanitized.length > 64) {
    return null;
  }

  return sanitized;
}

/**
 * Creates a secure affiliate click payload
 * Anonymizes user data for tracking
 */
export function createSecureAffiliatePayload(affiliateId: string) {
  return {
    affiliateId,
    trackingId: generateAffiliateTrackingId(),
    timestamp: Date.now(),
    // No IP, user agent, or personal data stored client-side
  };
}

// ===========================================
// CSRF PROTECTION
// ===========================================

/**
 * Generates a CSRF token for form submission
 * @returns CSRF token
 */
export function generateCSRFToken(): string {
  const token = generateSecureToken(32);
  try {
    sessionStorage.setItem('csrf_token', token);
  } catch {
    // Handle storage disabled
  }
  return token;
}

/**
 * Validates a CSRF token
 * @param token - Token to validate
 * @returns Whether token is valid
 */
export function validateCSRFToken(token: string): boolean {
  try {
    const storedToken = sessionStorage.getItem('csrf_token');
    return storedToken === token && token.length === 64;
  } catch {
    return false;
  }
}

// ===========================================
// EXPORT ALL UTILITIES
// ===========================================

export const security = {
  generateSecureToken,
  generateSessionId,
  generateAffiliateTrackingId,
  sanitizeInput,
  sanitizeEmail,
  sanitizeDocument,
  sanitizePhone,
  maskEmail,
  maskDocument,
  maskPhone,
  maskCardNumber,
  createSafeErrorMessage,
  checkRateLimit,
  secureStorage,
  validateAffiliateRef,
  createSecureAffiliatePayload,
  generateCSRFToken,
  validateCSRFToken,
};

export default security;
