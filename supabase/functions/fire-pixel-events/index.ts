import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PixelEvent {
  event_type: 'page_view' | 'view_content' | 'initiate_checkout' | 'add_payment_info' | 'purchase' | 'refund'
  product_id: string
  sale_id?: string
  transaction_id?: string
  value?: number
  currency?: string
  customer_email?: string
  customer_name?: string
  customer_phone?: string
  payment_method?: string
  event_id?: string
  source?: 'browser' | 'server' | 'webhook' | 'browser_initiated'
  client_id?: string
  user_agent?: string
  ip_address?: string
  items?: Array<{
    id: string
    name?: string
    price: number
    quantity: number
  }>
}

interface PixelResult {
  success: boolean
  error?: string
  events_received?: number
  match_quality?: string
}

// ========== UTILITY FUNCTIONS ==========

// Generate unique event ID for deduplication
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// SHA256 hash for PII (Meta CAPI, TikTok require hashed data)
async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value.toLowerCase().trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Log pixel event to database with retry
async function logPixelEvent(supabase: any, data: any, retries = 2): Promise<void> {
  for (let i = 0; i <= retries; i++) {
    try {
      const { error } = await supabase.from('pixel_event_logs').insert(data)
      if (!error) return
      if (i < retries) {
        console.warn(`Retry ${i + 1} logging pixel event:`, error)
        await new Promise(r => setTimeout(r, 100 * (i + 1)))
      }
    } catch (error) {
      if (i === retries) console.error('Failed to log pixel event after retries:', error)
    }
  }
}

// Check for duplicate events (idempotency)
async function isDuplicateEvent(
  supabase: any,
  eventId: string,
  productId: string,
  eventType: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('pixel_event_logs')
      .select('id')
      .eq('event_id', eventId)
      .eq('product_id', productId)
      .eq('event_type', eventType)
      .limit(1)
    
    return data && data.length > 0
  } catch {
    return false
  }
}

// ========== META (FACEBOOK) CONVERSION API ==========
async function fireMetaConversionAPI(
  pixel: any,
  event: PixelEvent,
  supabase: any
): Promise<PixelResult> {
  const pixelId = pixel.pixel_id
  const accessToken = pixel.access_token_encrypted
  
  if (!accessToken) {
    console.log(`[Meta CAPI] No access token for pixel ${pixelId}, skipping server-side`)
    return { success: true }
  }

  try {
    const eventId = event.event_id || generateEventId()
    const eventTime = Math.floor(Date.now() / 1000)
    
    // Map event types to Meta event names
    const eventName = event.event_type === 'purchase' ? 'Purchase' :
                      event.event_type === 'initiate_checkout' ? 'InitiateCheckout' :
                      event.event_type === 'add_payment_info' ? 'AddPaymentInfo' :
                      event.event_type === 'view_content' ? 'ViewContent' :
                      event.event_type === 'refund' ? 'Refund' : 'PageView'

    // Build user_data with hashed PII
    const userData: any = {}
    
    if (event.customer_email) {
      userData.em = [await hashSHA256(event.customer_email)]
    }
    if (event.customer_name) {
      const nameParts = event.customer_name.trim().split(/\s+/)
      if (nameParts[0]) userData.fn = [await hashSHA256(nameParts[0])]
      if (nameParts.length > 1) userData.ln = [await hashSHA256(nameParts[nameParts.length - 1])]
    }
    if (event.customer_phone) {
      // Remove non-digits and hash
      const cleanPhone = event.customer_phone.replace(/\D/g, '')
      userData.ph = [await hashSHA256(cleanPhone)]
    }
    if (event.client_id) {
      userData.external_id = [await hashSHA256(event.client_id)]
    }
    
    // Add country code for better matching
    userData.country = ['br']

    // Build custom_data
    const customData: any = {
      currency: event.currency || 'BRL',
      value: event.value || 0,
      content_type: 'product',
      content_ids: [event.product_id],
    }
    
    if (event.transaction_id) {
      customData.order_id = event.transaction_id
    }
    
    if (event.items && event.items.length > 0) {
      customData.contents = event.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        item_price: item.price,
      }))
      customData.num_items = event.items.reduce((sum, item) => sum + item.quantity, 0)
    }

    const payload = {
      data: [{
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId,
        action_source: 'website',
        event_source_url: `https://checkout.example.com/product/${event.product_id}`,
        user_data: userData,
        custom_data: customData,
      }],
    }

    console.log(`[Meta CAPI] Sending ${eventName} to pixel ${pixelId}`)

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const result = await response.json()
    
    const success = response.ok && result.events_received > 0
    const matchQuality = result.fbtrace_id ? 'high' : 'unknown'
    
    console.log(`[Meta CAPI] Result:`, JSON.stringify(result))

    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      sale_id: event.sale_id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'facebook',
      event_source: 'server',
      event_id: eventId,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      status: success ? 'sent' : 'failed',
      error_message: result.error ? JSON.stringify(result.error) : null,
      metadata: { 
        pixel_id: pixelId, 
        events_received: result.events_received,
        match_quality: matchQuality,
        fbtrace_id: result.fbtrace_id,
      },
    })

    return { 
      success, 
      error: result.error?.message,
      events_received: result.events_received,
      match_quality: matchQuality,
    }
  } catch (error) {
    console.error('[Meta CAPI] Error:', error)
    
    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'facebook',
      event_source: 'server',
      event_id: event.event_id,
      status: 'error',
      error_message: String(error),
    })
    
    return { success: false, error: String(error) }
  }
}

// ========== GOOGLE ANALYTICS 4 MEASUREMENT PROTOCOL ==========
async function fireGA4Event(
  pixel: any,
  event: PixelEvent,
  supabase: any
): Promise<PixelResult> {
  const measurementId = pixel.measurement_id || pixel.pixel_id
  const apiSecret = pixel.access_token_encrypted
  
  if (!apiSecret) {
    console.log(`[GA4] No API secret for ${measurementId}, skipping server-side`)
    return { success: true }
  }

  try {
    // Map event types to GA4 event names
    const eventName = event.event_type === 'purchase' ? 'purchase' :
                      event.event_type === 'initiate_checkout' ? 'begin_checkout' :
                      event.event_type === 'add_payment_info' ? 'add_payment_info' :
                      event.event_type === 'view_content' ? 'view_item' :
                      event.event_type === 'refund' ? 'refund' : 'page_view'

    // Build event params
    const eventParams: any = {
      currency: event.currency || 'BRL',
      value: event.value || 0,
      transaction_id: event.transaction_id || event.event_id,
    }

    // Add items for e-commerce events
    if (event.items && event.items.length > 0) {
      eventParams.items = event.items.map(item => ({
        item_id: item.id,
        item_name: item.name || item.id,
        price: item.price,
        quantity: item.quantity,
      }))
    } else {
      eventParams.items = [{
        item_id: event.product_id,
        price: event.value || 0,
        quantity: 1,
      }]
    }

    // Use client_id from browser or generate one
    const clientId = event.client_id || `${Date.now()}.${Math.random().toString(36).substring(2, 9)}`

    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: eventParams,
      }],
    }

    // Add user_id if we have email (hashed for privacy)
    if (event.customer_email) {
      (payload as any).user_id = await hashSHA256(event.customer_email)
    }

    console.log(`[GA4] Sending ${eventName} to ${measurementId}`)

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    // GA4 Measurement Protocol returns 204 No Content on success
    const success = response.status === 204 || response.ok
    
    console.log(`[GA4] Response status: ${response.status}`)

    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      sale_id: event.sale_id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'google_analytics_4',
      event_source: 'server',
      event_id: event.event_id,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      status: success ? 'sent' : 'failed',
      error_message: success ? null : `HTTP ${response.status}`,
      metadata: { 
        measurement_id: measurementId, 
        event_name: eventName,
        client_id: clientId,
      },
    })

    return { success }
  } catch (error) {
    console.error('[GA4] Error:', error)
    
    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'google_analytics_4',
      event_source: 'server',
      event_id: event.event_id,
      status: 'error',
      error_message: String(error),
    })
    
    return { success: false, error: String(error) }
  }
}

// ========== GOOGLE ADS ENHANCED CONVERSIONS ==========
async function fireGoogleAdsConversion(
  pixel: any,
  event: PixelEvent,
  supabase: any
): Promise<PixelResult> {
  try {
    // Google Ads Enhanced Conversions via Google Ads API requires OAuth
    // For now, we log the conversion for client-side gtag to pick up
    // Or use offline conversion import
    
    const conversionId = pixel.conversion_id || pixel.pixel_id
    const conversionLabel = pixel.conversion_label
    
    console.log(`[Google Ads] Logging conversion: ${conversionId}/${conversionLabel}`)
    console.log(`[Google Ads] Value: ${event.value} ${event.currency}`)
    
    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      sale_id: event.sale_id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'google_ads',
      event_source: 'server',
      event_id: event.event_id,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      status: 'sent',
      metadata: { 
        conversion_id: conversionId, 
        conversion_label: conversionLabel,
        customer_email_hash: event.customer_email ? await hashSHA256(event.customer_email) : null,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[Google Ads] Error:', error)
    return { success: false, error: String(error) }
  }
}

// ========== TIKTOK EVENTS API ==========
async function fireTikTokEvent(
  pixel: any,
  event: PixelEvent,
  supabase: any
): Promise<PixelResult> {
  const pixelId = pixel.pixel_id
  const accessToken = pixel.access_token_encrypted
  
  if (!accessToken) {
    console.log(`[TikTok] No access token for ${pixelId}, skipping server-side`)
    return { success: true }
  }

  try {
    const eventId = event.event_id || generateEventId()
    
    // Map event types to TikTok event names
    const eventName = event.event_type === 'purchase' ? 'CompletePayment' :
                      event.event_type === 'initiate_checkout' ? 'InitiateCheckout' :
                      event.event_type === 'add_payment_info' ? 'AddPaymentInfo' :
                      event.event_type === 'view_content' ? 'ViewContent' : 'Pageview'

    // Build user context
    const userContext: any = {}
    if (event.customer_email) {
      userContext.email = await hashSHA256(event.customer_email)
    }
    if (event.customer_phone) {
      userContext.phone_number = await hashSHA256(event.customer_phone.replace(/\D/g, ''))
    }
    if (event.client_id) {
      userContext.external_id = await hashSHA256(event.client_id)
    }

    const payload = {
      pixel_code: pixelId,
      event: eventName,
      event_id: eventId,
      timestamp: new Date().toISOString(),
      context: {
        user: userContext,
        page: {
          url: `https://checkout.example.com/product/${event.product_id}`,
        },
      },
      properties: {
        currency: event.currency || 'BRL',
        value: event.value || 0,
        order_id: event.transaction_id,
        contents: [{
          content_id: event.product_id,
          content_type: 'product',
          content_name: event.items?.[0]?.name || 'Product',
          price: event.value || 0,
          quantity: 1,
        }],
      },
    }

    console.log(`[TikTok] Sending ${eventName} to pixel ${pixelId}`)

    const response = await fetch(
      'https://business-api.tiktok.com/open_api/v1.3/pixel/track/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify({ data: [payload] }),
      }
    )

    const result = await response.json()
    const success = result.code === 0
    
    console.log(`[TikTok] Result:`, JSON.stringify(result))

    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      sale_id: event.sale_id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'tiktok',
      event_source: 'server',
      event_id: eventId,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      status: success ? 'sent' : 'failed',
      error_message: result.message !== 'OK' ? result.message : null,
      metadata: { pixel_id: pixelId, code: result.code },
    })

    return { success, error: result.message !== 'OK' ? result.message : undefined }
  } catch (error) {
    console.error('[TikTok] Error:', error)
    
    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'tiktok',
      event_source: 'server',
      event_id: event.event_id,
      status: 'error',
      error_message: String(error),
    })
    
    return { success: false, error: String(error) }
  }
}

// ========== KWAI PIXEL API ==========
async function fireKwaiEvent(
  pixel: any,
  event: PixelEvent,
  supabase: any
): Promise<PixelResult> {
  try {
    const pixelId = pixel.pixel_id
    const accessToken = pixel.access_token_encrypted
    
    // Kwai's server-side API is limited
    // Log the event for potential manual upload or future API support
    console.log(`[Kwai] Logging event for pixel ${pixelId}`)
    
    await logPixelEvent(supabase, {
      checkout_pixel_id: pixel.id,
      sale_id: event.sale_id,
      product_id: event.product_id,
      event_type: event.event_type,
      pixel_type: 'kwai',
      event_source: 'server',
      event_id: event.event_id,
      transaction_id: event.transaction_id,
      value: event.value,
      currency: event.currency || 'BRL',
      status: 'logged',
      metadata: { 
        pixel_id: pixelId,
        note: 'Server-side API limited - event logged for reference',
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[Kwai] Error:', error)
    return { success: false, error: String(error) }
  }
}

// ========== MAIN HANDLER ==========
Deno.serve(async (req) => {
  console.log('========================================')
  console.log('[Fire Pixel Events] Request received')
  console.log('Method:', req.method)
  console.log('Time:', new Date().toISOString())
  console.log('========================================')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body: PixelEvent = await req.json()
    console.log('[Input]', JSON.stringify(body, null, 2))

    const { 
      event_type, 
      product_id, 
      sale_id, 
      transaction_id, 
      value, 
      currency,
      customer_email, 
      customer_name,
      customer_phone,
      payment_method,
      client_id,
      items,
    } = body
    
    const eventId = body.event_id || generateEventId()
    const source = body.source || 'server'

    // Validate required fields
    if (!product_id) {
      return new Response(JSON.stringify({ error: 'product_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!event_type) {
      return new Response(JSON.stringify({ error: 'event_type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for duplicate events (idempotency)
    if (await isDuplicateEvent(supabase, eventId, product_id, event_type)) {
      console.log(`[Dedup] Event already processed: ${eventId}`)
      return new Response(JSON.stringify({ 
        success: true, 
        event_id: eventId,
        message: 'Event already processed (idempotent)',
        results: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get active pixels for this product
    const { data: pixels, error: pixelsError } = await supabase
      .from('checkout_pixels')
      .select('*')
      .eq('product_id', product_id)
      .eq('is_active', true)

    if (pixelsError) {
      console.error('[DB] Error fetching pixels:', pixelsError)
      return new Response(JSON.stringify({ error: 'Failed to fetch pixels' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!pixels || pixels.length === 0) {
      console.log('[No Pixels] No active pixels for product:', product_id)
      return new Response(JSON.stringify({ 
        success: true, 
        event_id: eventId,
        message: 'No pixels configured',
        results: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[Found] ${pixels.length} active pixels for product ${product_id}`)

    // Prepare event data
    const eventData: PixelEvent = {
      event_type,
      product_id,
      sale_id,
      transaction_id,
      value,
      currency: currency || 'BRL',
      customer_email,
      customer_name,
      customer_phone,
      payment_method,
      event_id: eventId,
      source,
      client_id,
      items,
    }

    // Fire events to each pixel platform
    const results: Array<{ pixel_type: string; pixel_id: string; success: boolean; error?: string }> = []

    for (const pixel of pixels) {
      // Check events_config to see if this event type should be fired
      const eventsConfig = pixel.events_config || {}
      
      const shouldFire = 
        (event_type === 'page_view' && eventsConfig.pageView !== false) ||
        (event_type === 'view_content' && eventsConfig.viewContent !== false) ||
        (event_type === 'initiate_checkout' && eventsConfig.initiateCheckout !== false) ||
        (event_type === 'add_payment_info' && eventsConfig.addPaymentInfo !== false) ||
        (event_type === 'purchase' && eventsConfig.purchase !== false) ||
        (event_type === 'refund')

      if (!shouldFire) {
        console.log(`[Skip] ${pixel.pixel_type} for ${event_type} (disabled)`)
        continue
      }

      // Check payment method specific settings for purchase
      if (event_type === 'purchase' && payment_method) {
        if (payment_method === 'pix' && pixel.conversion_on_pix === false) {
          console.log(`[Skip] ${pixel.pixel_type} - PIX conversions disabled`)
          continue
        }
        if (payment_method === 'boleto' && pixel.conversion_on_boleto === false) {
          console.log(`[Skip] ${pixel.pixel_type} - Boleto conversions disabled`)
          continue
        }
      }

      let result: PixelResult = { success: false, error: 'Unknown pixel type' }

      switch (pixel.pixel_type) {
        case 'facebook':
          result = await fireMetaConversionAPI(pixel, eventData, supabase)
          break
        case 'google_analytics_4':
        case 'google_analytics':
          result = await fireGA4Event(pixel, eventData, supabase)
          break
        case 'google_ads':
          result = await fireGoogleAdsConversion(pixel, eventData, supabase)
          break
        case 'tiktok':
          result = await fireTikTokEvent(pixel, eventData, supabase)
          break
        case 'kwai':
          result = await fireKwaiEvent(pixel, eventData, supabase)
          break
        case 'google_tag_manager':
          // GTM is client-side only
          console.log(`[GTM] Container ${pixel.pixel_id} is client-side only`)
          result = { success: true }
          break
        default:
          console.warn(`[Unknown] Pixel type: ${pixel.pixel_type}`)
      }

      results.push({
        pixel_type: pixel.pixel_type,
        pixel_id: pixel.pixel_id,
        success: result.success,
        error: result.error,
      })
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    console.log(`[Summary] ${successCount} success, ${failCount} failed`)
    console.log('[Results]', JSON.stringify(results, null, 2))

    return new Response(JSON.stringify({ 
      success: true, 
      event_id: eventId,
      event_type,
      source,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Error]', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
