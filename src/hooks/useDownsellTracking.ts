import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DownsellTrackingData {
  downsell_id: string;
  product_id: string;
  origin_upsell_id: string;
  sale_id: string;
  session_id: string;
  offer_name: string;
  description?: string;
  headline?: string;
  subheadline?: string;
  cta_text: string;
  decline_text: string;
  original_price: number;
  discount_price: number;
  currency: string;
  discount_value: number;
  discount_percentage: number;
  is_subscription: boolean;
  subscription_interval?: string;
  payment_type: "recurring" | "one_time";
  timer_enabled: boolean;
  timer_minutes: number;
  is_active: boolean;
  buyer_email?: string;
  buyer_name?: string;
}

export type DownsellEventType = 
  | "downsell_viewed"
  | "downsell_accepted"
  | "downsell_declined"
  | "downsell_timeout"
  | "downsell_timer_started"
  | "downsell_timer_expired"
  | "downsell_error";

export const useDownsellTracking = () => {
  const trackedEvents = useRef<Set<string>>(new Set());

  const calculateDiscountPercentage = useCallback((original: number, discounted: number): number => {
    if (original <= 0) return 0;
    return Math.round(((original - discounted) / original) * 100);
  }, []);

  const trackEvent = useCallback(async (
    eventType: DownsellEventType,
    data: DownsellTrackingData,
    metadata: Record<string, unknown> = {}
  ) => {
    const eventKey = `${data.session_id}-${eventType}`;
    if (trackedEvents.current.has(eventKey)) {
      console.log(`Event already tracked: ${eventKey}`);
      return;
    }

    try {
      const { error } = await supabase.from("sales_funnel_events").insert({
        sale_id: data.sale_id,
        session_id: data.session_id,
        user_email: data.buyer_email,
        product_id: data.product_id,
        step: "downsell",
        action: eventType.replace("downsell_", ""),
        offer_id: data.downsell_id,
        offer_type: "downsell",
        amount: data.discount_price,
        metadata: {
          ...metadata,
          downsell_id: data.downsell_id,
          origin_upsell_id: data.origin_upsell_id,
          offer_name: data.offer_name,
          original_price: data.original_price,
          discount_price: data.discount_price,
          discount_percentage: data.discount_percentage,
          is_subscription: data.is_subscription,
          payment_type: data.payment_type,
          timer_enabled: data.timer_enabled,
          event_type: eventType,
          tracked_at: new Date().toISOString(),
        },
      });

      if (error) {
        console.error(`Error tracking ${eventType}:`, error);
        return;
      }

      trackedEvents.current.add(eventKey);
      console.log(`Event tracked: ${eventType}`);
    } catch (error) {
      console.error(`Error tracking ${eventType}:`, error);
    }
  }, []);

  const trackDownsellViewed = useCallback(async (data: DownsellTrackingData) => {
    await trackEvent("downsell_viewed", data, { view_timestamp: Date.now() });
  }, [trackEvent]);

  const trackDownsellAccepted = useCallback(async (data: DownsellTrackingData, funnelOrderId?: string) => {
    await trackEvent("downsell_accepted", data, { 
      acceptance_timestamp: Date.now(),
      funnel_order_id: funnelOrderId,
    });
  }, [trackEvent]);

  const trackDownsellDeclined = useCallback(async (data: DownsellTrackingData) => {
    await trackEvent("downsell_declined", data, { decline_timestamp: Date.now() });
  }, [trackEvent]);

  const trackDownsellTimeout = useCallback(async (data: DownsellTrackingData) => {
    await trackEvent("downsell_timeout", data, { timeout_timestamp: Date.now() });
  }, [trackEvent]);

  const trackTimerStarted = useCallback(async (data: DownsellTrackingData) => {
    await trackEvent("downsell_timer_started", data, { 
      timer_started_at: Date.now(),
      timer_duration_seconds: data.timer_minutes * 60,
    });
  }, [trackEvent]);

  const trackTimerExpired = useCallback(async (data: DownsellTrackingData) => {
    await trackEvent("downsell_timer_expired", data, { timer_expired_at: Date.now() });
  }, [trackEvent]);

  const trackError = useCallback(async (data: DownsellTrackingData, errorMessage: string) => {
    await trackEvent("downsell_error", data, { 
      error_timestamp: Date.now(),
      error_message: errorMessage,
    });
  }, [trackEvent]);

  const createTrackingData = useCallback((
    downsell: {
      id: string;
      upsell_id: string;
      downsell_product_id: string;
      name: string;
      description?: string | null;
      headline?: string | null;
      subheadline?: string | null;
      cta_text: string;
      decline_text: string;
      original_price: number;
      offer_price: number;
      is_subscription: boolean;
      subscription_interval?: string | null;
      timer_enabled: boolean;
      timer_minutes: number;
      is_active: boolean;
    },
    sale: {
      id: string;
      product_id: string;
      buyer_email?: string;
      buyer_name?: string;
    },
    sessionId: string
  ): DownsellTrackingData => {
    const discountValue = downsell.original_price - downsell.offer_price;
    const discountPercentage = calculateDiscountPercentage(downsell.original_price, downsell.offer_price);

    return {
      downsell_id: downsell.id,
      product_id: downsell.downsell_product_id,
      origin_upsell_id: downsell.upsell_id,
      sale_id: sale.id,
      session_id: sessionId,
      offer_name: downsell.name,
      description: downsell.description || undefined,
      headline: downsell.headline || undefined,
      subheadline: downsell.subheadline || undefined,
      cta_text: downsell.cta_text,
      decline_text: downsell.decline_text,
      original_price: downsell.original_price,
      discount_price: downsell.offer_price,
      currency: "BRL",
      discount_value: discountValue,
      discount_percentage: discountPercentage,
      is_subscription: downsell.is_subscription,
      subscription_interval: downsell.subscription_interval || undefined,
      payment_type: downsell.is_subscription ? "recurring" : "one_time",
      timer_enabled: downsell.timer_enabled,
      timer_minutes: downsell.timer_minutes,
      is_active: downsell.is_active,
      buyer_email: sale.buyer_email,
      buyer_name: sale.buyer_name,
    };
  }, [calculateDiscountPercentage]);

  return {
    trackDownsellViewed,
    trackDownsellAccepted,
    trackDownsellDeclined,
    trackDownsellTimeout,
    trackTimerStarted,
    trackTimerExpired,
    trackError,
    createTrackingData,
  };
};

export default useDownsellTracking;
