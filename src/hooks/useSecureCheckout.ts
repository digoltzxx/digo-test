/**
 * Secure Checkout Hook
 * Provides secure state management for checkout forms
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  generateSessionId, 
  generateCSRFToken,
  checkRateLimit,
  validateAffiliateRef,
  sanitizeEmail,
  sanitizeDocument,
  sanitizePhone,
  sanitizeInput,
  createSafeErrorMessage,
  secureStorage,
} from '@/lib/security';
import { createCheckoutSchema } from '@/lib/validation';
import { z } from 'zod';

export interface SecureCheckoutState {
  // Session security
  sessionId: string;
  csrfToken: string;
  
  // Form data (sanitized)
  formData: {
    name: string;
    email: string;
    document: string;
    phone: string;
  };
  
  // Validation state
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  
  // Submission state
  isSubmitting: boolean;
  submitAttempts: number;
  lastSubmitTime: number;
  isRateLimited: boolean;
  rateLimitResetIn: number;
  
  // Affiliate tracking (anonymized)
  affiliateRef: string | null;
}

export interface SecureCheckoutActions {
  updateField: (field: keyof SecureCheckoutState['formData'], value: string) => void;
  validateField: (field: keyof SecureCheckoutState['formData']) => boolean;
  validateAll: () => boolean;
  startSubmit: () => boolean;
  endSubmit: (success: boolean, error?: string) => void;
  resetForm: () => void;
  getSecurePayload: () => Record<string, unknown> | null;
}

export interface UseSecureCheckoutOptions {
  requireDocument?: boolean;
  requirePhone?: boolean;
  requireEmail?: boolean;
  documentType?: 'cpf' | 'cnpj' | 'both';
  affiliateRef?: string | null;
  onSubmitAttempt?: () => void;
  onRateLimited?: (resetIn: number) => void;
}

export function useSecureCheckout(
  options: UseSecureCheckoutOptions = {}
): [SecureCheckoutState, SecureCheckoutActions] {
  const {
    requireDocument = true,
    requirePhone = true,
    requireEmail = true,
    documentType = 'cpf',
    affiliateRef = null,
    onSubmitAttempt,
    onRateLimited,
  } = options;

  // Initialize secure session
  const [state, setState] = useState<SecureCheckoutState>(() => ({
    sessionId: generateSessionId(),
    csrfToken: generateCSRFToken(),
    formData: {
      name: '',
      email: '',
      document: '',
      phone: '',
    },
    errors: {},
    touched: {},
    isValid: false,
    isSubmitting: false,
    submitAttempts: 0,
    lastSubmitTime: 0,
    isRateLimited: false,
    rateLimitResetIn: 0,
    affiliateRef: validateAffiliateRef(affiliateRef),
  }));

  // Create validation schema
  const validationSchema = useMemo(
    () => createCheckoutSchema(requireDocument, requirePhone, requireEmail, documentType),
    [requireDocument, requirePhone, requireEmail, documentType]
  );

  // Store session ID securely
  useEffect(() => {
    secureStorage.setSessionId(state.sessionId);
  }, [state.sessionId]);

  // Rate limit check effect
  useEffect(() => {
    if (state.isRateLimited && state.rateLimitResetIn > 0) {
      const timer = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isRateLimited: false,
          rateLimitResetIn: 0,
        }));
      }, state.rateLimitResetIn);
      return () => clearTimeout(timer);
    }
  }, [state.isRateLimited, state.rateLimitResetIn]);

  // Update field with sanitization
  const updateField = useCallback((
    field: keyof SecureCheckoutState['formData'],
    value: string
  ) => {
    let sanitizedValue = value;

    // Apply field-specific sanitization
    switch (field) {
      case 'name':
        sanitizedValue = sanitizeInput(value, { 
          maxLength: 100, 
          allowNumbers: false 
        });
        break;
      case 'email':
        sanitizedValue = sanitizeEmail(value);
        break;
      case 'document':
        sanitizedValue = sanitizeDocument(value);
        break;
      case 'phone':
        sanitizedValue = sanitizePhone(value);
        break;
    }

    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [field]: sanitizedValue,
      },
      touched: {
        ...prev.touched,
        [field]: true,
      },
      // Clear field error on change
      errors: {
        ...prev.errors,
        [field]: undefined,
      },
    }));
  }, []);

  // Validate single field
  const validateField = useCallback((
    field: keyof SecureCheckoutState['formData']
  ): boolean => {
    try {
      const fieldSchema = (validationSchema.shape as Record<string, z.ZodType>)[field];
      if (!fieldSchema) return true;

      fieldSchema.parse(state.formData[field]);
      
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: undefined,
        },
      }));
      
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors[0]?.message || 'Campo inválido';
        setState(prev => ({
          ...prev,
          errors: {
            ...prev.errors,
            [field]: message,
          },
        }));
      }
      return false;
    }
  }, [state.formData, validationSchema]);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    try {
      validationSchema.parse(state.formData);
      
      setState(prev => ({
        ...prev,
        errors: {},
        isValid: true,
      }));
      
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach(err => {
          const field = err.path[0] as string;
          errors[field] = err.message;
        });
        
        setState(prev => ({
          ...prev,
          errors,
          isValid: false,
          touched: {
            name: true,
            email: true,
            document: true,
            phone: true,
          },
        }));
      }
      return false;
    }
  }, [state.formData, validationSchema]);

  // Start submission with rate limiting
  const startSubmit = useCallback((): boolean => {
    // Check rate limit
    const rateLimitKey = `checkout_${state.sessionId}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 60000);
    
    if (!rateLimit.allowed) {
      setState(prev => ({
        ...prev,
        isRateLimited: true,
        rateLimitResetIn: rateLimit.resetIn,
        errors: {
          ...prev.errors,
          _form: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        },
      }));
      onRateLimited?.(rateLimit.resetIn);
      return false;
    }

    // Validate all fields
    if (!validateAll()) {
      return false;
    }

    setState(prev => ({
      ...prev,
      isSubmitting: true,
      submitAttempts: prev.submitAttempts + 1,
      lastSubmitTime: Date.now(),
    }));

    onSubmitAttempt?.();
    return true;
  }, [state.sessionId, validateAll, onSubmitAttempt, onRateLimited]);

  // End submission
  const endSubmit = useCallback((success: boolean, error?: string) => {
    setState(prev => ({
      ...prev,
      isSubmitting: false,
      errors: error ? { ...prev.errors, _form: error } : prev.errors,
    }));

    if (success) {
      // Refresh CSRF token on successful submit
      setState(prev => ({
        ...prev,
        csrfToken: generateCSRFToken(),
      }));
    }
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    secureStorage.clearSession();
    
    setState({
      sessionId: generateSessionId(),
      csrfToken: generateCSRFToken(),
      formData: {
        name: '',
        email: '',
        document: '',
        phone: '',
      },
      errors: {},
      touched: {},
      isValid: false,
      isSubmitting: false,
      submitAttempts: 0,
      lastSubmitTime: 0,
      isRateLimited: false,
      rateLimitResetIn: 0,
      affiliateRef: validateAffiliateRef(affiliateRef),
    });
  }, [affiliateRef]);

  // Get secure payload for submission
  const getSecurePayload = useCallback((): Record<string, unknown> | null => {
    if (!state.isValid && !validateAll()) {
      return null;
    }

    return {
      sessionId: state.sessionId,
      csrfToken: state.csrfToken,
      buyer: {
        name: state.formData.name,
        email: state.formData.email,
        document: state.formData.document || undefined,
        phone: state.formData.phone || undefined,
      },
      affiliateRef: state.affiliateRef,
      timestamp: Date.now(),
    };
  }, [state, validateAll]);

  const actions: SecureCheckoutActions = useMemo(() => ({
    updateField,
    validateField,
    validateAll,
    startSubmit,
    endSubmit,
    resetForm,
    getSecurePayload,
  }), [updateField, validateField, validateAll, startSubmit, endSubmit, resetForm, getSecurePayload]);

  return [state, actions];
}

export default useSecureCheckout;
