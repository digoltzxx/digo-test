/**
 * Checkout Payload Validation
 * Ensures PIX and payment payloads are valid before sending to gateway
 */

export interface OrderBumpItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CheckoutPayload {
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  orderBumps: OrderBumpItem[];
  totalAmount: number;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  buyer: {
    name: string;
    email: string;
    document?: string;
    phone?: string;
  };
  affiliateId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedPayload?: CheckoutPayload;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

/**
 * Validates the checkout payload before sending to the gateway
 */
export function validateCheckoutPayload(payload: Partial<CheckoutPayload>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // ========== PRODUCT VALIDATION ==========
  if (!payload.productId) {
    errors.push({
      field: 'productId',
      message: 'Product ID is required',
      code: 'MISSING_PRODUCT_ID',
    });
  }

  if (!payload.productName || payload.productName.trim().length === 0) {
    errors.push({
      field: 'productName',
      message: 'Product name is required',
      code: 'MISSING_PRODUCT_NAME',
    });
  }

  if (payload.productPrice === undefined || payload.productPrice === null) {
    errors.push({
      field: 'productPrice',
      message: 'Product price is required',
      code: 'MISSING_PRODUCT_PRICE',
    });
  } else if (payload.productPrice < 0) {
    errors.push({
      field: 'productPrice',
      message: 'Product price cannot be negative',
      code: 'NEGATIVE_PRODUCT_PRICE',
    });
  }

  // ========== QUANTITY VALIDATION ==========
  if (!payload.quantity || payload.quantity < 1) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be at least 1',
      code: 'INVALID_QUANTITY',
    });
  } else if (payload.quantity > 100) {
    warnings.push({
      field: 'quantity',
      message: 'Quantity is unusually high',
    });
  }

  // ========== ORDER BUMPS VALIDATION ==========
  if (payload.orderBumps && Array.isArray(payload.orderBumps)) {
    payload.orderBumps.forEach((bump, index) => {
      if (!bump.id) {
        errors.push({
          field: `orderBumps[${index}].id`,
          message: `Order bump ${index + 1}: ID is required`,
          code: 'MISSING_BUMP_ID',
        });
      }

      if (bump.price === undefined || bump.price === null) {
        errors.push({
          field: `orderBumps[${index}].price`,
          message: `Order bump ${index + 1}: Price is required`,
          code: 'MISSING_BUMP_PRICE',
        });
      } else if (bump.price < 0) {
        errors.push({
          field: `orderBumps[${index}].price`,
          message: `Order bump ${index + 1}: Price cannot be negative`,
          code: 'NEGATIVE_BUMP_PRICE',
        });
      }

      if (bump.quantity !== 1) {
        errors.push({
          field: `orderBumps[${index}].quantity`,
          message: `Order bump ${index + 1}: Quantity must be exactly 1`,
          code: 'INVALID_BUMP_QUANTITY',
        });
      }
    });
  }

  // ========== TOTAL AMOUNT VALIDATION ==========
  if (payload.totalAmount === undefined || payload.totalAmount === null) {
    errors.push({
      field: 'totalAmount',
      message: 'Total amount is required',
      code: 'MISSING_TOTAL_AMOUNT',
    });
  } else if (payload.totalAmount <= 0) {
    errors.push({
      field: 'totalAmount',
      message: 'Total amount must be greater than zero',
      code: 'INVALID_TOTAL_AMOUNT',
    });
  }

  // ========== TOTAL CONSISTENCY CHECK ==========
  if (payload.productPrice !== undefined && payload.quantity && payload.totalAmount !== undefined) {
    const productSubtotal = payload.productPrice * payload.quantity;
    const bumpsTotal = (payload.orderBumps || []).reduce((sum, b) => sum + (b.price || 0), 0);
    const expectedTotal = productSubtotal + bumpsTotal;

    // Allow small floating point differences
    if (Math.abs(payload.totalAmount - expectedTotal) > 0.01) {
      errors.push({
        field: 'totalAmount',
        message: `Total amount mismatch: expected ${expectedTotal.toFixed(2)}, got ${payload.totalAmount.toFixed(2)}`,
        code: 'TOTAL_MISMATCH',
      });
    }
  }

  // ========== BUYER VALIDATION ==========
  if (!payload.buyer) {
    errors.push({
      field: 'buyer',
      message: 'Buyer information is required',
      code: 'MISSING_BUYER',
    });
  } else {
    if (!payload.buyer.name || payload.buyer.name.trim().length < 2) {
      errors.push({
        field: 'buyer.name',
        message: 'Buyer name must be at least 2 characters',
        code: 'INVALID_BUYER_NAME',
      });
    }

    if (!payload.buyer.email) {
      errors.push({
        field: 'buyer.email',
        message: 'Buyer email is required',
        code: 'MISSING_BUYER_EMAIL',
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.buyer.email)) {
      errors.push({
        field: 'buyer.email',
        message: 'Invalid email format',
        code: 'INVALID_BUYER_EMAIL',
      });
    }
  }

  // ========== PAYMENT METHOD VALIDATION ==========
  if (!payload.paymentMethod) {
    errors.push({
      field: 'paymentMethod',
      message: 'Payment method is required',
      code: 'MISSING_PAYMENT_METHOD',
    });
  } else if (!['pix', 'credit_card', 'boleto'].includes(payload.paymentMethod)) {
    errors.push({
      field: 'paymentMethod',
      message: 'Invalid payment method',
      code: 'INVALID_PAYMENT_METHOD',
    });
  }

  // Build sanitized payload if valid
  let sanitizedPayload: CheckoutPayload | undefined;
  if (errors.length === 0) {
    sanitizedPayload = {
      productId: payload.productId!,
      productName: payload.productName!.trim(),
      productPrice: Math.round(payload.productPrice! * 100) / 100,
      quantity: Math.floor(payload.quantity!),
      orderBumps: (payload.orderBumps || []).map(bump => ({
        id: bump.id,
        name: bump.name?.trim() || '',
        price: Math.round(bump.price * 100) / 100,
        quantity: 1,
      })),
      totalAmount: Math.round(payload.totalAmount! * 100) / 100,
      paymentMethod: payload.paymentMethod!,
      buyer: {
        name: payload.buyer!.name.trim(),
        email: payload.buyer!.email.toLowerCase().trim(),
        document: payload.buyer!.document?.replace(/\D/g, ''),
        phone: payload.buyer!.phone?.replace(/\D/g, ''),
      },
      affiliateId: payload.affiliateId,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitizedPayload,
  };
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(e => `• ${e.message}`).join('\n');
}

/**
 * Logs validation result with debug info
 */
export function logValidationResult(result: ValidationResult, context: string = 'checkout'): void {
  const isDebug = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).get('debug') === 'true' ||
     localStorage.getItem('checkout_debug') === 'true');

  if (!isDebug) return;

  if (result.valid) {
    console.log(`%c[${context.toUpperCase()}] ✅ Payload validation passed`, 'color: #22c55e; font-weight: bold;');
  } else {
    console.group(`%c[${context.toUpperCase()}] ❌ Payload validation failed`, 'color: #ef4444; font-weight: bold;');
    result.errors.forEach(error => {
      console.error(`  ${error.field}: ${error.message} (${error.code})`);
    });
    console.groupEnd();
  }

  if (result.warnings.length > 0) {
    console.group(`%c[${context.toUpperCase()}] ⚠️ Warnings`, 'color: #f59e0b;');
    result.warnings.forEach(warning => {
      console.warn(`  ${warning.field}: ${warning.message}`);
    });
    console.groupEnd();
  }
}
