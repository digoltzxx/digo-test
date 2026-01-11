import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Event types supported by the tracking system
type TrackingEventType = 
  | 'page_view' 
  | 'view_content' 
  | 'initiate_checkout' 
  | 'add_payment_info' 
  | 'purchase';

interface TrackingEventData {
  productId: string;
  saleId?: string;
  transactionId?: string;
  value?: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: string;
  items?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface TrackingResult {
  success: boolean;
  eventId: string;
  browserFired: boolean;
  serverQueued: boolean;
  errors?: string[];
}

// Generate unique event ID for deduplication
function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `evt_${timestamp}_${random}`;
}

// SHA-256 hash for PII data (browser-side)
async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if we're in preview mode (should not fire real events)
function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  return url.searchParams.has('preview') || 
         url.pathname.includes('/preview') ||
         url.hostname.includes('preview.');
}

// Get or create client ID for GA4
function getClientId(): string {
  if (typeof window === 'undefined') return generateEventId();
  
  let clientId = localStorage.getItem('_ga_client_id');
  if (!clientId) {
    clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('_ga_client_id', clientId);
  }
  return clientId;
}

// Store event ID for deduplication
function storeEventId(eventId: string, eventType: TrackingEventType): void {
  if (typeof window === 'undefined') return;
  
  const key = `_tracking_${eventType}_${Date.now()}`;
  sessionStorage.setItem(key, eventId);
  
  // Clean old entries (keep last 50)
  const keys = Object.keys(sessionStorage).filter(k => k.startsWith('_tracking_'));
  if (keys.length > 50) {
    keys.slice(0, keys.length - 50).forEach(k => sessionStorage.removeItem(k));
  }
}

// Check if event was already fired (prevent duplicates)
function wasEventFired(productId: string, eventType: TrackingEventType): boolean {
  if (typeof window === 'undefined') return false;
  
  // For purchase events, use localStorage to persist across sessions
  if (eventType === 'purchase') {
    const key = `_purchase_fired_${productId}`;
    return localStorage.getItem(key) !== null;
  }
  
  return false;
}

// Mark event as fired
function markEventFired(productId: string, eventType: TrackingEventType, eventId: string): void {
  if (typeof window === 'undefined') return;
  
  if (eventType === 'purchase') {
    const key = `_purchase_fired_${productId}`;
    localStorage.setItem(key, eventId);
  }
}

/**
 * Hook for server-side tracking with deduplication
 * 
 * This hook provides:
 * - Unique event_id generation for browser/server deduplication
 * - Browser-side pixel firing (Meta, TikTok, GA4, etc.)
 * - Server-side event queuing via edge function
 * - PII hashing for compliance
 * - Preview mode detection (no real events in preview)
 */
export function useServerSideTracking() {
  const firedEventsRef = useRef<Set<string>>(new Set());

  // Fire browser-side pixels
  const fireBrowserPixels = useCallback(async (
    eventType: TrackingEventType,
    eventId: string,
    data: TrackingEventData
  ): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    
    try {
      const w = window as any;
      
      // ========== META (FACEBOOK) PIXEL ==========
      if (w.fbq) {
        const eventName = eventType === 'purchase' ? 'Purchase' :
                          eventType === 'initiate_checkout' ? 'InitiateCheckout' :
                          eventType === 'add_payment_info' ? 'AddPaymentInfo' :
                          eventType === 'view_content' ? 'ViewContent' : 'PageView';
        
        const fbParams: any = {
          content_ids: [data.productId],
          content_type: 'product',
          currency: data.currency || 'BRL',
          value: data.value || 0,
        };
        
        if (data.transactionId) fbParams.order_id = data.transactionId;
        if (data.items) {
          fbParams.contents = data.items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            item_price: item.price,
          }));
          fbParams.num_items = data.items.reduce((sum, item) => sum + item.quantity, 0);
        }
        
        // Fire with event_id for deduplication with CAPI
        w.fbq('track', eventName, fbParams, { eventID: eventId });
        console.log(`[Browser] Meta pixel fired: ${eventName} (eventId: ${eventId})`);
      }
      
      // ========== GOOGLE ANALYTICS 4 ==========
      if (w.gtag) {
        const eventName = eventType === 'purchase' ? 'purchase' :
                          eventType === 'initiate_checkout' ? 'begin_checkout' :
                          eventType === 'add_payment_info' ? 'add_payment_info' :
                          eventType === 'view_content' ? 'view_item' : 'page_view';
        
        const ga4Params: any = {
          currency: data.currency || 'BRL',
          value: data.value || 0,
          transaction_id: data.transactionId || eventId,
        };
        
        if (data.items) {
          ga4Params.items = data.items.map(item => ({
            item_id: item.id,
            item_name: item.name,
            price: item.price,
            quantity: item.quantity,
          }));
        }
        
        w.gtag('event', eventName, ga4Params);
        console.log(`[Browser] GA4 event fired: ${eventName}`);
      }
      
      // ========== GOOGLE ADS ==========
      if (w.gtag && eventType === 'purchase') {
        // Google Ads conversion tracking
        // Conversion ID and Label should be set in the page
        w.gtag('event', 'conversion', {
          send_to: 'AW-CONVERSION_ID/CONVERSION_LABEL', // Will be replaced by actual values
          value: data.value || 0,
          currency: data.currency || 'BRL',
          transaction_id: data.transactionId || eventId,
        });
        console.log('[Browser] Google Ads conversion fired');
      }
      
      // ========== TIKTOK PIXEL ==========
      if (w.ttq) {
        const eventName = eventType === 'purchase' ? 'CompletePayment' :
                          eventType === 'initiate_checkout' ? 'InitiateCheckout' :
                          eventType === 'add_payment_info' ? 'AddPaymentInfo' :
                          eventType === 'view_content' ? 'ViewContent' : 'PageView';
        
        const ttParams: any = {
          content_id: data.productId,
          content_type: 'product',
          currency: data.currency || 'BRL',
          value: data.value || 0,
        };
        
        if (data.transactionId) ttParams.order_id = data.transactionId;
        
        w.ttq.track(eventName, ttParams, { event_id: eventId });
        console.log(`[Browser] TikTok pixel fired: ${eventName} (eventId: ${eventId})`);
      }
      
      // ========== KWAI PIXEL ==========
      if (w.kwaiq) {
        const eventName = eventType === 'purchase' ? 'purchase' :
                          eventType === 'initiate_checkout' ? 'initiate_checkout' :
                          eventType === 'view_content' ? 'view_content' : 'page_view';
        
        w.kwaiq.track(eventName, {
          content_id: data.productId,
          value: data.value || 0,
          currency: data.currency || 'BRL',
        });
        console.log(`[Browser] Kwai pixel fired: ${eventName}`);
      }
      
      // ========== GTM DATA LAYER ==========
      if (w.dataLayer) {
        w.dataLayer.push({
          event: eventType,
          event_id: eventId,
          ecommerce: {
            currency: data.currency || 'BRL',
            value: data.value || 0,
            transaction_id: data.transactionId,
            items: data.items || [{
              item_id: data.productId,
              price: data.value || 0,
              quantity: 1,
            }],
          },
        });
        console.log(`[Browser] GTM dataLayer pushed: ${eventType}`);
      }
      
      return true;
    } catch (error) {
      console.error('[Browser] Error firing pixels:', error);
      return false;
    }
  }, []);

  // Queue server-side event
  const queueServerEvent = useCallback(async (
    eventType: TrackingEventType,
    eventId: string,
    data: TrackingEventData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.functions.invoke('fire-pixel-events', {
        body: {
          event_type: eventType,
          event_id: eventId,
          product_id: data.productId,
          sale_id: data.saleId,
          transaction_id: data.transactionId,
          value: data.value,
          currency: data.currency || 'BRL',
          customer_email: data.customerEmail,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          payment_method: data.paymentMethod,
          source: 'browser_initiated',
          client_id: getClientId(),
          items: data.items,
        },
      });

      if (error) {
        console.error('[Server] Error queuing event:', error);
        return { success: false, error: error.message };
      }

      console.log(`[Server] Event queued: ${eventType} (eventId: ${eventId})`);
      return { success: true };
    } catch (error) {
      console.error('[Server] Error queuing event:', error);
      return { success: false, error: String(error) };
    }
  }, []);

  // Main tracking function
  const track = useCallback(async (
    eventType: TrackingEventType,
    data: TrackingEventData,
    options?: {
      skipBrowser?: boolean;
      skipServer?: boolean;
      forceEventId?: string;
    }
  ): Promise<TrackingResult> => {
    // Check preview mode
    if (isPreviewMode()) {
      console.log('[Tracking] Preview mode detected - skipping real events');
      return {
        success: true,
        eventId: 'preview_mode',
        browserFired: false,
        serverQueued: false,
      };
    }

    // Generate or use provided event ID
    const eventId = options?.forceEventId || generateEventId();
    
    // Check for duplicate purchase events
    if (eventType === 'purchase' && wasEventFired(data.productId, eventType)) {
      console.log('[Tracking] Purchase already fired for this product - skipping');
      return {
        success: true,
        eventId,
        browserFired: false,
        serverQueued: false,
        errors: ['Duplicate event prevented'],
      };
    }

    // Check if this exact event was already fired in this session
    const eventKey = `${eventType}_${data.productId}_${data.transactionId || 'no_tx'}`;
    if (firedEventsRef.current.has(eventKey)) {
      console.log(`[Tracking] Event already fired in this session: ${eventKey}`);
      return {
        success: true,
        eventId,
        browserFired: false,
        serverQueued: false,
        errors: ['Session duplicate prevented'],
      };
    }

    const errors: string[] = [];
    let browserFired = false;
    let serverQueued = false;

    // Fire browser pixels (except for purchase - that should come from webhook)
    if (!options?.skipBrowser && eventType !== 'purchase') {
      browserFired = await fireBrowserPixels(eventType, eventId, data);
      if (!browserFired) {
        errors.push('Browser pixels failed');
      }
    }

    // Queue server event (purchase is always server-only after webhook)
    if (!options?.skipServer) {
      const serverResult = await queueServerEvent(eventType, eventId, data);
      serverQueued = serverResult.success;
      if (!serverQueued && serverResult.error) {
        errors.push(`Server: ${serverResult.error}`);
      }
    }

    // Store event ID for reference
    storeEventId(eventId, eventType);
    firedEventsRef.current.add(eventKey);

    // Mark purchase as fired
    if (eventType === 'purchase') {
      markEventFired(data.productId, eventType, eventId);
    }

    return {
      success: browserFired || serverQueued,
      eventId,
      browserFired,
      serverQueued,
      errors: errors.length > 0 ? errors : undefined,
    };
  }, [fireBrowserPixels, queueServerEvent]);

  // Convenience methods for common events
  const trackPageView = useCallback((productId: string) => {
    return track('page_view', { productId });
  }, [track]);

  const trackViewContent = useCallback((productId: string, value?: number) => {
    return track('view_content', { productId, value });
  }, [track]);

  const trackInitiateCheckout = useCallback((data: TrackingEventData) => {
    return track('initiate_checkout', data);
  }, [track]);

  const trackAddPaymentInfo = useCallback((data: TrackingEventData) => {
    return track('add_payment_info', data);
  }, [track]);

  // NOTE: Purchase should only be called from server (webhook)
  // This is exposed for special cases only
  const trackPurchase = useCallback((data: TrackingEventData, eventId?: string) => {
    return track('purchase', data, { forceEventId: eventId, skipBrowser: true });
  }, [track]);

  // Hash PII for manual use
  const hashPII = useCallback(async (value: string) => {
    return hashSHA256(value);
  }, []);

  return {
    track,
    trackPageView,
    trackViewContent,
    trackInitiateCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    hashPII,
    generateEventId,
    isPreviewMode,
  };
}
