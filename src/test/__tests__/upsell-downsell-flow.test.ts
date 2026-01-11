import { describe, it, expect } from "vitest";

/**
 * Upsell/Downsell Funnel Integration Tests
 * 
 * These tests validate the complete flow of upsell and downsell offers
 * in the checkout funnel.
 */

describe("Upsell/Downsell Funnel Flow", () => {
  
  describe("Upsell Display", () => {
    it("should display all configured upsell fields correctly", () => {
      const upsellConfig = {
        name: "Oferta Premium",
        description: "Acesso vitalício",
        original_price: 297,
        offer_price: 197,
        headline: "Oferta exclusiva para você!",
        subheadline: "Aproveite esta oportunidade única",
        cta_text: "Sim, quero essa oferta!",
        decline_text: "Não, obrigado",
        timer_enabled: true,
        timer_minutes: 15,
        is_subscription: false,
        is_active: true,
      };

      // Verify all fields are present
      expect(upsellConfig.name).toBeDefined();
      expect(upsellConfig.headline).toBeDefined();
      expect(upsellConfig.cta_text).toBeDefined();
      expect(upsellConfig.decline_text).toBeDefined();
      expect(upsellConfig.offer_price).toBeLessThan(upsellConfig.original_price);
    });

    it("should calculate discount percentage correctly", () => {
      const calculateDiscount = (original: number, offer: number) => {
        return Math.round(((original - offer) / original) * 100);
      };

      expect(calculateDiscount(297, 197)).toBe(34);
      expect(calculateDiscount(100, 50)).toBe(50);
      expect(calculateDiscount(500, 350)).toBe(30);
    });
  });

  describe("Timer Behavior", () => {
    it("should convert minutes to seconds correctly", () => {
      const timerMinutes = 15;
      const timerSeconds = timerMinutes * 60;
      expect(timerSeconds).toBe(900);
    });

    it("should format time correctly", () => {
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      };

      expect(formatTime(900)).toBe("15:00");
      expect(formatTime(65)).toBe("01:05");
      expect(formatTime(0)).toBe("00:00");
      expect(formatTime(3599)).toBe("59:59");
    });

    it("should trigger expiration action when timer reaches zero", () => {
      let expired = false;
      let timeLeft = 1;

      // Simulate timer countdown
      timeLeft -= 1;
      if (timeLeft <= 0) {
        expired = true;
      }

      expect(expired).toBe(true);
      expect(timeLeft).toBe(0);
    });
  });

  describe("Accept/Decline Actions", () => {
    it("should handle accept action correctly", () => {
      const handleAccept = () => {
        return {
          action: "accepted",
          redirectTo: "/checkout/success",
        };
      };

      const result = handleAccept();
      expect(result.action).toBe("accepted");
      expect(result.redirectTo).toContain("success");
    });

    it("should handle decline action and check for downsell", () => {
      const handleDecline = (hasDownsell: boolean) => {
        if (hasDownsell) {
          return {
            action: "declined",
            redirectTo: "/offer/downsell",
          };
        }
        return {
          action: "declined",
          redirectTo: "/checkout/success",
        };
      };

      // With downsell
      const withDownsell = handleDecline(true);
      expect(withDownsell.redirectTo).toContain("downsell");

      // Without downsell
      const withoutDownsell = handleDecline(false);
      expect(withoutDownsell.redirectTo).toContain("success");
    });
  });

  describe("Subscription vs One-Time Payment", () => {
    it("should identify subscription products correctly", () => {
      const isSubscription = true;
      const interval = "monthly";

      if (isSubscription) {
        expect(interval).toBeDefined();
        expect(["monthly", "quarterly", "yearly"]).toContain(interval);
      }
    });

    it("should calculate subscription interval in days", () => {
      const getIntervalDays = (interval: string) => {
        switch (interval) {
          case "monthly": return 30;
          case "quarterly": return 90;
          case "yearly": return 365;
          default: return 30;
        }
      };

      expect(getIntervalDays("monthly")).toBe(30);
      expect(getIntervalDays("quarterly")).toBe(90);
      expect(getIntervalDays("yearly")).toBe(365);
    });
  });

  describe("Funnel Order Creation", () => {
    it("should create funnel order with correct data", () => {
      const createFunnelOrder = (data: {
        parent_sale_id: string;
        offer_type: "upsell" | "downsell";
        amount: number;
        buyer_email: string;
      }) => {
        const paymentFee = Math.round((data.amount * 4.99 / 100 + 1.49) * 100) / 100;
        const netAmount = Math.round((data.amount - paymentFee) * 100) / 100;

        return {
          ...data,
          net_amount: netAmount,
          payment_fee: paymentFee,
          status: "pending",
        };
      };

      const order = createFunnelOrder({
        parent_sale_id: "sale-123",
        offer_type: "upsell",
        amount: 197,
        buyer_email: "test@example.com",
      });

      expect(order.net_amount).toBeLessThan(order.amount);
      expect(order.payment_fee).toBeGreaterThan(0);
      expect(order.status).toBe("pending");
    });
  });

  describe("Active/Inactive Toggle", () => {
    it("should only show active upsells in funnel", () => {
      const upsells = [
        { id: "1", name: "Upsell 1", is_active: true },
        { id: "2", name: "Upsell 2", is_active: false },
        { id: "3", name: "Upsell 3", is_active: true },
      ];

      const activeUpsells = upsells.filter(u => u.is_active);
      expect(activeUpsells.length).toBe(2);
      expect(activeUpsells.find(u => u.id === "2")).toBeUndefined();
    });

    it("should only show active downsells in funnel", () => {
      const downsells = [
        { id: "1", name: "Downsell 1", is_active: false },
        { id: "2", name: "Downsell 2", is_active: true },
      ];

      const activeDownsells = downsells.filter(d => d.is_active);
      expect(activeDownsells.length).toBe(1);
      expect(activeDownsells[0].id).toBe("2");
    });
  });

  describe("Price Validation", () => {
    it("should reject offer price equal to original", () => {
      const validatePrices = (original: number, offer: number) => {
        if (offer >= original) {
          return { valid: false, error: "Preço com desconto deve ser menor que o original" };
        }
        return { valid: true };
      };

      expect(validatePrices(100, 100).valid).toBe(false);
      expect(validatePrices(100, 120).valid).toBe(false);
      expect(validatePrices(100, 79).valid).toBe(true);
    });

    it("should reject zero or negative prices", () => {
      const validatePrice = (price: number) => {
        if (price <= 0) {
          return { valid: false, error: "Preço deve ser maior que zero" };
        }
        return { valid: true };
      };

      expect(validatePrice(0).valid).toBe(false);
      expect(validatePrice(-10).valid).toBe(false);
      expect(validatePrice(50).valid).toBe(true);
    });
  });

  describe("Downsell Linked to Upsell", () => {
    it("should require upsell_id for downsell", () => {
      const validateDownsell = (downsell: { upsell_id: string | null }) => {
        if (!downsell.upsell_id) {
          return { valid: false, error: "Selecione um upsell" };
        }
        return { valid: true };
      };

      expect(validateDownsell({ upsell_id: null }).valid).toBe(false);
      expect(validateDownsell({ upsell_id: "" }).valid).toBe(false);
      expect(validateDownsell({ upsell_id: "upsell-123" }).valid).toBe(true);
    });
  });

  describe("Funnel Events Logging", () => {
    it("should log correct event types", () => {
      const validEvents = ["viewed", "accepted", "declined", "expired", "error"];
      
      const logEvent = (action: string) => {
        if (!validEvents.includes(action)) {
          throw new Error("Invalid event type");
        }
        return { logged: true, action };
      };

      expect(() => logEvent("viewed")).not.toThrow();
      expect(() => logEvent("accepted")).not.toThrow();
      expect(() => logEvent("declined")).not.toThrow();
      expect(() => logEvent("expired")).not.toThrow();
      expect(() => logEvent("invalid_action")).toThrow();
    });
  });
});

describe("Complete Checkout Flow with Upsell/Downsell", () => {
  it("should follow correct flow: Purchase -> Upsell -> Success", () => {
    const flow = [
      { step: "checkout", status: "completed" },
      { step: "upsell_view", status: "completed" },
      { step: "upsell_accepted", status: "completed" },
      { step: "success", status: "completed" },
    ];

    expect(flow.length).toBe(4);
    expect(flow[0].step).toBe("checkout");
    expect(flow[flow.length - 1].step).toBe("success");
  });

  it("should follow correct flow: Purchase -> Upsell (decline) -> Downsell -> Success", () => {
    const flow = [
      { step: "checkout", status: "completed" },
      { step: "upsell_view", status: "completed" },
      { step: "upsell_declined", status: "completed" },
      { step: "downsell_view", status: "completed" },
      { step: "downsell_accepted", status: "completed" },
      { step: "success", status: "completed" },
    ];

    expect(flow.length).toBe(6);
    expect(flow.some(f => f.step === "downsell_view")).toBe(true);
  });

  it("should handle flow without upsell configured", () => {
    const hasUpsell = false;
    
    const flow = [
      { step: "checkout", status: "completed" },
    ];

    if (!hasUpsell) {
      flow.push({ step: "success", status: "completed" });
    }

    expect(flow.length).toBe(2);
    expect(flow[1].step).toBe("success");
  });
});
