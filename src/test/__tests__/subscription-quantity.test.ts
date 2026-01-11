import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Subscription Quantity Tests
 * 
 * Tests for subscription quantity functionality including:
 * - Quantity validation per product mode
 * - Price calculations
 * - Access management
 * - Renewal and cancellation flows
 */

// Mock types
interface Product {
  id: string;
  name: string;
  price: number;
  payment_type: 'one_time' | 'subscription';
  subscription_quantity_mode: 'single' | 'license' | 'seat';
}

interface Subscription {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_recurring: number;
  status: 'active' | 'past_due' | 'canceled' | 'expired';
}

interface SubscriptionAccess {
  id: string;
  subscription_id: string;
  member_email: string;
  status: 'active' | 'suspended' | 'revoked';
}

// Utility functions
const validateSubscriptionQuantity = (
  product: Product,
  quantity: number
): { valid: boolean; error?: string } => {
  // Quantity must be positive integer
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { valid: false, error: 'Quantidade deve ser um número inteiro positivo' };
  }

  // Maximum quantity check
  if (quantity > 100) {
    return { valid: false, error: 'Quantidade máxima é 100' };
  }

  // If mode is 'single', quantity must be 1
  if (product.subscription_quantity_mode === 'single' && quantity !== 1) {
    return { valid: false, error: 'Este produto não suporta múltiplas licenças' };
  }

  return { valid: true };
};

const calculateSubscriptionTotal = (
  unitPrice: number,
  quantity: number
): { subtotal: number; total: number } => {
  const subtotal = unitPrice * quantity;
  // Round to 2 decimal places
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
  };
};

const canAddAccess = (
  subscription: Subscription,
  currentAccessCount: number
): boolean => {
  return currentAccessCount < subscription.quantity;
};

describe('Subscription Quantity Validation', () => {
  const singleModeProduct: Product = {
    id: 'prod-single-1',
    name: 'Curso Individual',
    price: 99.90,
    payment_type: 'subscription',
    subscription_quantity_mode: 'single',
  };

  const licenseModeProduct: Product = {
    id: 'prod-license-1',
    name: 'Software License',
    price: 49.90,
    payment_type: 'subscription',
    subscription_quantity_mode: 'license',
  };

  const seatModeProduct: Product = {
    id: 'prod-seat-1',
    name: 'Team Access',
    price: 29.90,
    payment_type: 'subscription',
    subscription_quantity_mode: 'seat',
  };

  describe('Single Mode (quantity fixed at 1)', () => {
    it('should accept quantity = 1', () => {
      const result = validateSubscriptionQuantity(singleModeProduct, 1);
      expect(result.valid).toBe(true);
    });

    it('should reject quantity > 1', () => {
      const result = validateSubscriptionQuantity(singleModeProduct, 3);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não suporta múltiplas licenças');
    });

    it('should reject quantity = 0', () => {
      const result = validateSubscriptionQuantity(singleModeProduct, 0);
      expect(result.valid).toBe(false);
    });
  });

  describe('License Mode (multiple accesses)', () => {
    it('should accept quantity = 1', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, 1);
      expect(result.valid).toBe(true);
    });

    it('should accept quantity = 5', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, 5);
      expect(result.valid).toBe(true);
    });

    it('should accept quantity = 100 (max)', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, 100);
      expect(result.valid).toBe(true);
    });

    it('should reject quantity > 100', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, 101);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('máxima é 100');
    });

    it('should reject negative quantity', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, -1);
      expect(result.valid).toBe(false);
    });

    it('should reject decimal quantity', () => {
      const result = validateSubscriptionQuantity(licenseModeProduct, 2.5);
      expect(result.valid).toBe(false);
    });
  });

  describe('Seat Mode (multiple students)', () => {
    it('should accept quantity = 10', () => {
      const result = validateSubscriptionQuantity(seatModeProduct, 10);
      expect(result.valid).toBe(true);
    });

    it('should reject quantity = 0', () => {
      const result = validateSubscriptionQuantity(seatModeProduct, 0);
      expect(result.valid).toBe(false);
    });
  });
});

describe('Subscription Price Calculations', () => {
  it('should calculate total for quantity = 1', () => {
    const result = calculateSubscriptionTotal(99.90, 1);
    expect(result.total).toBe(99.90);
  });

  it('should calculate total for quantity = 3', () => {
    const result = calculateSubscriptionTotal(49.90, 3);
    expect(result.total).toBe(149.70);
  });

  it('should calculate total for quantity = 10', () => {
    const result = calculateSubscriptionTotal(29.90, 10);
    expect(result.total).toBe(299.00);
  });

  it('should handle decimal precision correctly', () => {
    const result = calculateSubscriptionTotal(33.33, 3);
    expect(result.total).toBe(99.99);
  });

  it('should round to 2 decimal places', () => {
    const result = calculateSubscriptionTotal(10.555, 3);
    // 10.555 * 3 = 31.665 -> rounds to 31.67
    expect(result.total).toBe(31.67);
  });
});

describe('Subscription Access Management', () => {
  const subscription: Subscription = {
    id: 'sub-1',
    product_id: 'prod-1',
    quantity: 5,
    unit_price: 29.90,
    total_recurring: 149.50,
    status: 'active',
  };

  it('should allow adding access when slots available', () => {
    expect(canAddAccess(subscription, 0)).toBe(true);
    expect(canAddAccess(subscription, 3)).toBe(true);
    expect(canAddAccess(subscription, 4)).toBe(true);
  });

  it('should reject adding access when no slots available', () => {
    expect(canAddAccess(subscription, 5)).toBe(false);
    expect(canAddAccess(subscription, 10)).toBe(false);
  });

  it('should handle single quantity subscription', () => {
    const singleSub: Subscription = { ...subscription, quantity: 1 };
    expect(canAddAccess(singleSub, 0)).toBe(true);
    expect(canAddAccess(singleSub, 1)).toBe(false);
  });
});

describe('Subscription Status Transitions', () => {
  const mockSyncAccesses = (
    subscription: Subscription,
    action: 'activate' | 'suspend' | 'revoke',
    accesses: SubscriptionAccess[]
  ): SubscriptionAccess[] => {
    return accesses.map(access => {
      switch (action) {
        case 'activate':
          return access.status === 'suspended' 
            ? { ...access, status: 'active' as const } 
            : access;
        case 'suspend':
          return access.status === 'active' 
            ? { ...access, status: 'suspended' as const } 
            : access;
        case 'revoke':
          return access.status !== 'revoked' 
            ? { ...access, status: 'revoked' as const } 
            : access;
        default:
          return access;
      }
    });
  };

  const subscription: Subscription = {
    id: 'sub-1',
    product_id: 'prod-1',
    quantity: 3,
    unit_price: 49.90,
    total_recurring: 149.70,
    status: 'active',
  };

  const activeAccesses: SubscriptionAccess[] = [
    { id: 'acc-1', subscription_id: 'sub-1', member_email: 'user1@test.com', status: 'active' },
    { id: 'acc-2', subscription_id: 'sub-1', member_email: 'user2@test.com', status: 'active' },
  ];

  it('should suspend all active accesses on payment failure', () => {
    const result = mockSyncAccesses(subscription, 'suspend', activeAccesses);
    expect(result.every(a => a.status === 'suspended')).toBe(true);
  });

  it('should reactivate suspended accesses on payment success', () => {
    const suspendedAccesses = activeAccesses.map(a => ({ ...a, status: 'suspended' as const }));
    const result = mockSyncAccesses(subscription, 'activate', suspendedAccesses);
    expect(result.every(a => a.status === 'active')).toBe(true);
  });

  it('should revoke all accesses on cancellation', () => {
    const result = mockSyncAccesses(subscription, 'revoke', activeAccesses);
    expect(result.every(a => a.status === 'revoked')).toBe(true);
  });

  it('should keep revoked accesses revoked', () => {
    const revokedAccesses = activeAccesses.map(a => ({ ...a, status: 'revoked' as const }));
    const result = mockSyncAccesses(subscription, 'activate', revokedAccesses);
    // Revoked accesses stay revoked even on 'activate'
    expect(result.every(a => a.status === 'revoked')).toBe(true);
  });
});

describe('Checkout Integration with Subscription Quantity', () => {
  interface CheckoutData {
    product_id: string;
    quantity: number;
    unit_price: number;
    payment_method: string;
    is_subscription: boolean;
  }

  interface CheckoutResult {
    success: boolean;
    error?: string;
    total: number;
    subscription_id?: string;
  }

  const mockProcessCheckout = (data: CheckoutData): CheckoutResult => {
    // Validate quantity
    if (data.quantity < 1 || data.quantity > 100) {
      return { success: false, error: 'Quantidade inválida', total: 0 };
    }

    // Calculate total
    const total = Math.round(data.unit_price * data.quantity * 100) / 100;

    if (total <= 0) {
      return { success: false, error: 'Valor inválido', total: 0 };
    }

    return {
      success: true,
      total,
      subscription_id: data.is_subscription ? `sub_${Date.now()}` : undefined,
    };
  };

  it('should process subscription with quantity = 1', () => {
    const result = mockProcessCheckout({
      product_id: 'prod-1',
      quantity: 1,
      unit_price: 99.90,
      payment_method: 'pix',
      is_subscription: true,
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(99.90);
    expect(result.subscription_id).toBeDefined();
  });

  it('should process subscription with quantity = 5', () => {
    const result = mockProcessCheckout({
      product_id: 'prod-1',
      quantity: 5,
      unit_price: 49.90,
      payment_method: 'credit_card',
      is_subscription: true,
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(249.50);
  });

  it('should reject subscription with invalid quantity', () => {
    const result = mockProcessCheckout({
      product_id: 'prod-1',
      quantity: 0,
      unit_price: 99.90,
      payment_method: 'pix',
      is_subscription: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Quantidade inválida');
  });

  it('should reject subscription with quantity > 100', () => {
    const result = mockProcessCheckout({
      product_id: 'prod-1',
      quantity: 150,
      unit_price: 10,
      payment_method: 'pix',
      is_subscription: true,
    });

    expect(result.success).toBe(false);
  });
});

describe('Gateway Value Consistency', () => {
  interface PaymentValues {
    frontend: { quantity: number; unit_price: number; total: number };
    backend: { quantity: number; unit_price: number; total: number };
    gateway: { amount: number; quantity: number };
  }

  const validateValueConsistency = (values: PaymentValues): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Frontend total should match quantity * unit_price
    const expectedFrontendTotal = Math.round(values.frontend.quantity * values.frontend.unit_price * 100) / 100;
    if (values.frontend.total !== expectedFrontendTotal) {
      errors.push(`Frontend: total (${values.frontend.total}) != quantity * unit_price (${expectedFrontendTotal})`);
    }

    // Backend should match frontend
    if (values.frontend.quantity !== values.backend.quantity) {
      errors.push(`Quantity mismatch: frontend=${values.frontend.quantity}, backend=${values.backend.quantity}`);
    }

    if (values.frontend.unit_price !== values.backend.unit_price) {
      errors.push(`Unit price mismatch: frontend=${values.frontend.unit_price}, backend=${values.backend.unit_price}`);
    }

    // Gateway amount should match backend total (in cents)
    const expectedGatewayAmount = Math.round(values.backend.total * 100);
    if (values.gateway.amount !== expectedGatewayAmount) {
      errors.push(`Gateway amount (${values.gateway.amount}) != expected (${expectedGatewayAmount})`);
    }

    return { valid: errors.length === 0, errors };
  };

  it('should validate consistent values across all layers', () => {
    const values: PaymentValues = {
      frontend: { quantity: 3, unit_price: 49.90, total: 149.70 },
      backend: { quantity: 3, unit_price: 49.90, total: 149.70 },
      gateway: { amount: 14970, quantity: 3 },
    };

    const result = validateValueConsistency(values);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect frontend calculation error', () => {
    const values: PaymentValues = {
      frontend: { quantity: 3, unit_price: 49.90, total: 100 }, // Wrong!
      backend: { quantity: 3, unit_price: 49.90, total: 149.70 },
      gateway: { amount: 14970, quantity: 3 },
    };

    const result = validateValueConsistency(values);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Frontend'))).toBe(true);
  });

  it('should detect quantity mismatch', () => {
    const values: PaymentValues = {
      frontend: { quantity: 5, unit_price: 49.90, total: 249.50 },
      backend: { quantity: 3, unit_price: 49.90, total: 149.70 }, // Different quantity!
      gateway: { amount: 14970, quantity: 3 },
    };

    const result = validateValueConsistency(values);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Quantity mismatch'))).toBe(true);
  });

  it('should detect gateway amount mismatch', () => {
    const values: PaymentValues = {
      frontend: { quantity: 3, unit_price: 49.90, total: 149.70 },
      backend: { quantity: 3, unit_price: 49.90, total: 149.70 },
      gateway: { amount: 10000, quantity: 3 }, // Wrong amount!
    };

    const result = validateValueConsistency(values);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Gateway amount'))).toBe(true);
  });
});
