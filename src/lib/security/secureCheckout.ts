/**
 * Secure Checkout Utilities
 * Handles secure form submission, validation, and data protection
 */

import { z } from 'zod';
import DOMPurify from 'dompurify';
import {
  sanitizeInput,
  sanitizeEmail,
  sanitizeDocument,
  sanitizePhone,
  generateSessionId,
  generateCSRFToken,
  validateCSRFToken,
  checkRateLimit,
  createSafeErrorMessage,
  maskEmail,
  maskDocument,
  maskCardNumber,
} from './index';

// ===========================================
// SECURE CHECKOUT SCHEMA
// ===========================================

/**
 * Comprehensive checkout validation schema with security rules
 */
export const secureCheckoutSchema = z.object({
  // Personal Information
  name: z
    .string()
    .transform(val => sanitizeInput(val, { maxLength: 100, allowSpecialChars: false }))
    .refine(val => val.length >= 3, 'Nome deve ter pelo menos 3 caracteres')
    .refine(val => /^[a-zA-ZÀ-ÿ\s]+$/.test(val), 'Nome deve conter apenas letras'),

  email: z
    .string()
    .transform(val => sanitizeEmail(val))
    .refine(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'E-mail inválido'),

  document: z
    .string()
    .optional()
    .transform(val => val ? sanitizeDocument(val) : undefined)
    .refine(val => !val || val.length === 11 || val.length === 14, 'Documento inválido'),

  phone: z
    .string()
    .optional()
    .transform(val => val ? sanitizePhone(val) : undefined)
    .refine(val => !val || (val.length >= 10 && val.length <= 11), 'Telefone inválido'),

  // Payment Information (card data never stored, only validated)
  paymentMethod: z.enum(['pix', 'credit_card', 'boleto']),

  // Session Security
  sessionId: z.string().min(20, 'Sessão inválida'),
  csrfToken: z.string().length(64, 'Token inválido'),

  // Cart Information
  productId: z.string().uuid('Produto inválido'),
  quantity: z.number().int().min(1).max(100),
  
  // Order Bumps (IDs only, prices validated server-side)
  orderBumpIds: z.array(z.string().uuid()).optional(),
});

export type SecureCheckoutData = z.infer<typeof secureCheckoutSchema>;

// ===========================================
// SECURE FORM HANDLER
// ===========================================

export interface SecureFormState {
  sessionId: string;
  csrfToken: string;
  isSubmitting: boolean;
  errors: Record<string, string>;
  lastSubmitTime: number;
}

/**
 * Creates a secure form state with session and CSRF protection
 */
export function createSecureFormState(): SecureFormState {
  return {
    sessionId: generateSessionId(),
    csrfToken: generateCSRFToken(),
    isSubmitting: false,
    errors: {},
    lastSubmitTime: 0,
  };
}

/**
 * Validates and prepares checkout data for submission
 */
export async function validateSecureCheckout(
  data: unknown,
  state: SecureFormState
): Promise<{
  valid: boolean;
  errors: Record<string, string>;
  sanitizedData?: SecureCheckoutData;
  errorMessage?: string;
}> {
  // Rate limit check
  const rateLimit = checkRateLimit('checkout_submit', 5, 60000);
  if (!rateLimit.allowed) {
    return {
      valid: false,
      errors: { _form: 'Muitas tentativas. Aguarde 1 minuto.' },
      errorMessage: `Muitas tentativas. Tente novamente em ${Math.ceil(rateLimit.resetIn / 1000)} segundos.`,
    };
  }

  // CSRF validation
  if (!(data as any).csrfToken || !validateCSRFToken((data as any).csrfToken)) {
    return {
      valid: false,
      errors: { _form: 'Sessão expirada. Atualize a página.' },
      errorMessage: 'Token de segurança inválido. Atualize a página.',
    };
  }

  // Schema validation
  try {
    const result = secureCheckoutSchema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const field = err.path.join('.');
        errors[field] = err.message;
      });
      return { valid: false, errors };
    }

    return {
      valid: true,
      errors: {},
      sanitizedData: result.data,
    };
  } catch (error) {
    return {
      valid: false,
      errors: { _form: 'Erro de validação. Tente novamente.' },
      errorMessage: createSafeErrorMessage(error, 'checkout_validation'),
    };
  }
}

// ===========================================
// CREDIT CARD SECURITY
// ===========================================

/**
 * Credit card validation schema (data never stored)
 */
export const creditCardSchema = z.object({
  number: z
    .string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length >= 13 && val.length <= 19, 'Número do cartão inválido')
    .refine(val => luhnCheck(val), 'Número do cartão inválido'),

  holder: z
    .string()
    .transform(val => sanitizeInput(val.toUpperCase(), { maxLength: 50 }))
    .refine(val => val.length >= 3, 'Nome do titular inválido'),

  expiry: z
    .string()
    .refine(val => /^\d{2}\/\d{2}$/.test(val), 'Data de validade inválida')
    .refine(val => {
      const [month, year] = val.split('/').map(Number);
      const now = new Date();
      const expDate = new Date(2000 + year, month - 1);
      return expDate > now;
    }, 'Cartão expirado'),

  cvv: z
    .string()
    .refine(val => /^\d{3,4}$/.test(val), 'CVV inválido'),

  installments: z.number().int().min(1).max(12).optional(),
});

/**
 * Luhn algorithm for card number validation
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Prepares card data for tokenization (NEVER send raw card to backend)
 * This would typically integrate with a PCI-compliant gateway
 */
export function prepareCardForTokenization(cardData: z.infer<typeof creditCardSchema>) {
  // Return only what's needed for display/confirmation
  return {
    lastFour: cardData.number.slice(-4),
    brand: detectCardBrand(cardData.number),
    expiry: cardData.expiry,
    holderName: cardData.holder,
    // NEVER include full number or CVV
  };
}

/**
 * Detects card brand from number
 */
function detectCardBrand(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  if (/^6(?:011|5)/.test(cleaned)) return 'discover';
  if (/^(?:2131|1800|35\d{3})/.test(cleaned)) return 'jcb';
  if (/^3(?:0[0-5]|[68])/.test(cleaned)) return 'diners';
  if (/^(?:5066|4011|4576)/.test(cleaned)) return 'elo';
  if (/^606282/.test(cleaned)) return 'hipercard';
  
  return 'unknown';
}

// ===========================================
// SECURE ERROR DISPLAY
// ===========================================

/**
 * Creates a safe error component props
 * Never exposes sensitive data in error messages
 */
export function createSecureErrorProps(
  field: string,
  error: string | undefined,
  value?: string
): {
  hasError: boolean;
  errorMessage: string;
  maskedValue?: string;
} {
  if (!error) {
    return { hasError: false, errorMessage: '' };
  }

  // Never include actual values in error messages
  const safeError = error
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, maskEmail(value || ''))
    .replace(/\b\d{11,14}\b/g, maskDocument(value || ''))
    .replace(/\b\d{13,19}\b/g, maskCardNumber(value || ''));

  return {
    hasError: true,
    errorMessage: DOMPurify.sanitize(safeError),
    maskedValue: value ? getMaskedValue(field, value) : undefined,
  };
}

function getMaskedValue(field: string, value: string): string {
  switch (field) {
    case 'email':
      return maskEmail(value);
    case 'document':
      return maskDocument(value);
    case 'cardNumber':
      return maskCardNumber(value);
    default:
      return value;
  }
}

// ===========================================
// EXPORTS
// ===========================================

export const secureCheckout = {
  createSecureFormState,
  validateSecureCheckout,
  secureCheckoutSchema,
  creditCardSchema,
  prepareCardForTokenization,
  createSecureErrorProps,
  detectCardBrand,
};

export default secureCheckout;
