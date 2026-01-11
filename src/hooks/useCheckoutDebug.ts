import { useRef, useCallback, useMemo } from 'react';

// Types for debug events
export type CheckoutEventType = 
  | 'checkout_started'
  | 'product_loaded'
  | 'quantity_changed'
  | 'order_bump_toggled'
  | 'payment_method_changed'
  | 'total_recalculated'
  | 'form_validated'
  | 'pix_requested'
  | 'pix_payload_built'
  | 'pix_generated'
  | 'pix_failed'
  | 'card_payment_started'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'checkout_completed'
  | 'rollback_triggered';

export interface CheckoutEvent {
  id: string;
  type: CheckoutEventType;
  timestamp: number;
  step: number;
  data: Record<string, any>;
  previousValue?: any;
  newValue?: any;
  status: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface PayloadValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  payload?: Record<string, any>;
}

export interface CheckoutDebugState {
  sessionId: string;
  productId: string | null;
  startedAt: number;
  events: CheckoutEvent[];
  currentStep: number;
  lastValidatedPayload: Record<string, any> | null;
  validationErrors: string[];
}

// Check if debug mode is enabled
const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('debug') === 'true' || localStorage.getItem('checkout_debug') === 'true';
};

// Generate unique session ID
const generateSessionId = () => `debug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const useCheckoutDebug = (productId: string | null) => {
  const debugEnabled = useMemo(() => isDebugEnabled(), []);
  const stateRef = useRef<CheckoutDebugState>({
    sessionId: generateSessionId(),
    productId,
    startedAt: Date.now(),
    events: [],
    currentStep: 0,
    lastValidatedPayload: null,
    validationErrors: [],
  });

  // Log event with full context
  const logEvent = useCallback((
    type: CheckoutEventType,
    data: Record<string, any>,
    status: 'info' | 'success' | 'warning' | 'error' = 'info',
    previousValue?: any,
    newValue?: any
  ) => {
    if (!debugEnabled) return;

    const state = stateRef.current;
    state.currentStep += 1;

    const event: CheckoutEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type,
      timestamp: Date.now(),
      step: state.currentStep,
      data: { ...data, sessionId: state.sessionId },
      previousValue,
      newValue,
      status,
    };

    state.events.push(event);

    // Console output with styled groups
    const colors = {
      info: '#3b82f6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    };

    console.groupCollapsed(
      `%c[CHECKOUT DEBUG] Step ${state.currentStep}: ${type}`,
      `color: ${colors[status]}; font-weight: bold;`
    );
    console.log('%cTimestamp:', 'color: #9ca3af', new Date(event.timestamp).toISOString());
    console.log('%cSession ID:', 'color: #9ca3af', state.sessionId);
    console.log('%cData:', 'color: #9ca3af', event.data);
    if (previousValue !== undefined) {
      console.log('%cPrevious Value:', 'color: #f59e0b', previousValue);
    }
    if (newValue !== undefined) {
      console.log('%cNew Value:', 'color: #22c55e', newValue);
    }
    console.groupEnd();

    return event;
  }, [debugEnabled]);

  // Log checkout start
  const logStart = useCallback((product: { id: string; name: string; price: number }) => {
    stateRef.current.productId = product.id;
    return logEvent('checkout_started', {
      product,
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
    }, 'info');
  }, [logEvent]);

  // Log quantity change
  const logQuantityChange = useCallback((oldQty: number, newQty: number, unitPrice: number) => {
    return logEvent('quantity_changed', {
      unitPrice,
      oldTotal: oldQty * unitPrice,
      newTotal: newQty * unitPrice,
    }, 'info', oldQty, newQty);
  }, [logEvent]);

  // Log order bump toggle
  const logOrderBumpToggle = useCallback((
    bumpId: string,
    bumpName: string,
    bumpPrice: number,
    isSelected: boolean,
    allSelectedBumps: string[]
  ) => {
    return logEvent('order_bump_toggled', {
      bumpId,
      bumpName,
      bumpPrice,
      action: isSelected ? 'added' : 'removed',
      totalSelectedBumps: allSelectedBumps.length,
      selectedBumpIds: allSelectedBumps,
    }, isSelected ? 'success' : 'info', !isSelected, isSelected);
  }, [logEvent]);

  // Log total recalculation
  const logTotalRecalculation = useCallback((calculation: {
    basePrice: number;
    quantity: number;
    productSubtotal: number;
    orderBumpsTotal: number;
    selectedBumps: { id: string; name: string; price: number }[];
    grandTotal: number;
  }) => {
    // Validate calculation
    const expectedProductSubtotal = calculation.basePrice * calculation.quantity;
    const expectedBumpsTotal = calculation.selectedBumps.reduce((sum, b) => sum + b.price, 0);
    const expectedGrandTotal = expectedProductSubtotal + expectedBumpsTotal;

    const isValid = 
      Math.abs(calculation.productSubtotal - expectedProductSubtotal) < 0.01 &&
      Math.abs(calculation.orderBumpsTotal - expectedBumpsTotal) < 0.01 &&
      Math.abs(calculation.grandTotal - expectedGrandTotal) < 0.01;

    if (!isValid) {
      console.error('[CHECKOUT DEBUG] ⚠️ CALCULATION MISMATCH DETECTED!', {
        expected: { expectedProductSubtotal, expectedBumpsTotal, expectedGrandTotal },
        actual: calculation,
      });
    }

    return logEvent('total_recalculated', {
      ...calculation,
      validation: {
        isValid,
        expectedProductSubtotal,
        expectedBumpsTotal,
        expectedGrandTotal,
      },
    }, isValid ? 'success' : 'error');
  }, [logEvent]);

  // Validate PIX payload before sending
  const validatePixPayload = useCallback((payload: {
    productId: string;
    productName: string;
    amount: number;
    quantity: number;
    orderBumps?: { id: string; name: string; price: number; quantity: number }[];
    buyerEmail: string;
    buyerName: string;
    buyerDocument?: string;
  }): PayloadValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate basic fields
    if (!payload.productId) errors.push('Product ID is missing');
    if (!payload.productName) errors.push('Product name is missing');
    if (!payload.buyerEmail) errors.push('Buyer email is missing');
    if (!payload.buyerName) errors.push('Buyer name is missing');

    // 2. Validate amount
    if (payload.amount === null || payload.amount === undefined) {
      errors.push('Amount is null or undefined');
    } else if (payload.amount <= 0) {
      errors.push(`Amount is invalid: ${payload.amount}`);
    } else if (payload.amount < 1) {
      warnings.push(`Amount is very low: R$ ${payload.amount.toFixed(2)}`);
    }

    // 3. Validate quantity
    if (!payload.quantity || payload.quantity < 1) {
      errors.push(`Invalid quantity: ${payload.quantity}`);
    }

    // 4. Validate order bumps
    if (payload.orderBumps && payload.orderBumps.length > 0) {
      payload.orderBumps.forEach((bump, idx) => {
        if (!bump.id) errors.push(`Order bump ${idx + 1}: missing ID`);
        if (!bump.name) warnings.push(`Order bump ${idx + 1}: missing name`);
        if (bump.price === null || bump.price === undefined) {
          errors.push(`Order bump ${idx + 1}: price is null/undefined`);
        } else if (bump.price < 0) {
          errors.push(`Order bump ${idx + 1}: negative price (${bump.price})`);
        }
        if (bump.quantity !== 1) {
          errors.push(`Order bump ${idx + 1}: quantity must be 1, got ${bump.quantity}`);
        }
      });
    }

    // 5. Validate total matches items
    const productTotal = payload.amount;
    const bumpsTotal = (payload.orderBumps || []).reduce((sum, b) => sum + b.price, 0);
    
    // Log validation result
    logEvent('pix_payload_built', {
      payload,
      productTotal,
      bumpsTotal,
      calculatedTotal: productTotal + bumpsTotal,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    }, errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'success');

    stateRef.current.lastValidatedPayload = payload;
    stateRef.current.validationErrors = errors;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      payload: errors.length === 0 ? payload : undefined,
    };
  }, [logEvent]);

  // Log PIX generation attempt
  const logPixRequest = useCallback((payload: Record<string, any>) => {
    return logEvent('pix_requested', {
      payload,
      totalAmount: payload.amount,
      itemsCount: 1 + (payload.orderBumps?.length || 0),
    }, 'info');
  }, [logEvent]);

  // Log PIX success
  const logPixSuccess = useCallback((response: {
    transactionId: string;
    pixCode: string;
    expirationMinutes: number;
  }) => {
    return logEvent('pix_generated', {
      transactionId: response.transactionId,
      pixCodeLength: response.pixCode?.length || 0,
      expirationMinutes: response.expirationMinutes,
    }, 'success');
  }, [logEvent]);

  // Log PIX failure with rollback
  const logPixFailure = useCallback((error: {
    message: string;
    code?: string;
    details?: any;
  }) => {
    logEvent('pix_failed', {
      error: error.message,
      code: error.code,
      details: error.details,
      lastValidatedPayload: stateRef.current.lastValidatedPayload,
      validationErrors: stateRef.current.validationErrors,
    }, 'error');

    // Trigger rollback event
    logEvent('rollback_triggered', {
      reason: 'pix_generation_failed',
      affectedData: {
        sessionId: stateRef.current.sessionId,
        productId: stateRef.current.productId,
      },
    }, 'warning');
  }, [logEvent]);

  // Log payment confirmation
  const logPaymentConfirmed = useCallback((data: {
    transactionId: string;
    amount: number;
    method: string;
  }) => {
    return logEvent('payment_confirmed', data, 'success');
  }, [logEvent]);

  // Get debug summary
  const getDebugSummary = useCallback(() => {
    const state = stateRef.current;
    const duration = Date.now() - state.startedAt;
    const errorEvents = state.events.filter(e => e.status === 'error');
    const warningEvents = state.events.filter(e => e.status === 'warning');

    return {
      sessionId: state.sessionId,
      productId: state.productId,
      duration: `${(duration / 1000).toFixed(2)}s`,
      totalSteps: state.currentStep,
      events: state.events,
      errors: errorEvents,
      warnings: warningEvents,
      timeline: state.events.map(e => ({
        step: e.step,
        type: e.type,
        status: e.status,
        time: new Date(e.timestamp).toISOString(),
      })),
    };
  }, []);

  // Export debug data to console
  const exportDebugData = useCallback(() => {
    const summary = getDebugSummary();
    console.log('%c=== CHECKOUT DEBUG EXPORT ===', 'color: #3b82f6; font-size: 16px; font-weight: bold;');
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }, [getDebugSummary]);

  return {
    debugEnabled,
    sessionId: stateRef.current.sessionId,
    logStart,
    logQuantityChange,
    logOrderBumpToggle,
    logTotalRecalculation,
    validatePixPayload,
    logPixRequest,
    logPixSuccess,
    logPixFailure,
    logPaymentConfirmed,
    logEvent,
    getDebugSummary,
    exportDebugData,
  };
};

export default useCheckoutDebug;
