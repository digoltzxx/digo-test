import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type EventType = 
  | 'page_view' 
  | 'cta_click' 
  | 'page_abandon' 
  | 'product_access'
  | 'time_on_page';

interface TrackEventParams {
  variant: string;
  eventType: EventType;
  productId?: string;
  productType?: string;
  paymentMethod?: string;
  metadata?: Json;
}

// Generate or retrieve session ID
const getSessionId = (): string => {
  const key = 'ab_test_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

export const useABTestTracking = () => {
  const pageLoadTime = useRef<number>(Date.now());
  const hasTrackedView = useRef<boolean>(false);
  const sessionId = useRef<string>(getSessionId());

  const trackEvent = useCallback(async ({
    variant,
    eventType,
    productId,
    productType,
    paymentMethod,
    metadata = {}
  }: TrackEventParams) => {
    try {
      const { error } = await supabase
        .from('ab_test_events')
        .insert({
          session_id: sessionId.current,
          variant,
          event_type: eventType,
          product_id: productId || null,
          product_type: productType || null,
          payment_method: paymentMethod || null,
          metadata: metadata as Json
        });

      if (error) {
        console.error('Failed to track A/B event:', error);
      }
    } catch (err) {
      console.error('Error tracking A/B event:', err);
    }
  }, []);

  const trackPageView = useCallback((variant: string, productId?: string, productType?: string, paymentMethod?: string) => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    pageLoadTime.current = Date.now();
    
    trackEvent({
      variant,
      eventType: 'page_view',
      productId,
      productType,
      paymentMethod
    });
  }, [trackEvent]);

  const trackCTAClick = useCallback((variant: string, ctaType: string, productId?: string, productType?: string) => {
    const timeOnPage = (Date.now() - pageLoadTime.current) / 1000;
    
    trackEvent({
      variant,
      eventType: 'cta_click',
      productId,
      productType,
      metadata: { 
        cta_type: ctaType,
        time_to_action_seconds: timeOnPage
      }
    });
  }, [trackEvent]);

  const trackProductAccess = useCallback((variant: string, productId?: string, productType?: string) => {
    trackEvent({
      variant,
      eventType: 'product_access',
      productId,
      productType
    });
  }, [trackEvent]);

  const trackPageAbandon = useCallback((variant: string, productId?: string, productType?: string) => {
    const timeOnPage = (Date.now() - pageLoadTime.current) / 1000;
    
    trackEvent({
      variant,
      eventType: 'page_abandon',
      productId,
      productType,
      metadata: { time_on_page_seconds: timeOnPage }
    });
  }, [trackEvent]);

  // Track abandonment on page unload
  const setupAbandonTracking = useCallback((variant: string, productId?: string, productType?: string) => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable tracking on page close
      const data = JSON.stringify({
        session_id: sessionId.current,
        variant,
        event_type: 'page_abandon',
        product_id: productId,
        product_type: productType,
        metadata: { time_on_page_seconds: (Date.now() - pageLoadTime.current) / 1000 }
      });
      
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ab_test_events`,
        new Blob([data], { type: 'application/json' })
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    trackPageView,
    trackCTAClick,
    trackProductAccess,
    trackPageAbandon,
    setupAbandonTracking,
    sessionId: sessionId.current
  };
};

// Hook to get A/B test results (admin only)
export const useABTestResults = () => {
  const getResults = useCallback(async (startDate?: Date, endDate?: Date) => {
    try {
      const { data, error } = await supabase.rpc('get_ab_test_results', {
        p_start_date: startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: endDate?.toISOString() || new Date().toISOString()
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching A/B test results:', err);
      return null;
    }
  }, []);

  return { getResults };
};
