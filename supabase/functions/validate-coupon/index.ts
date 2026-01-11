import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CouponValidationResult {
  valid: boolean
  message: string
  code: string
  discount?: {
    type: 'percentage' | 'fixed'
    value: number
    campaign_id: string
    campaign_name: string
    calculated_discount: number
    final_amount: number
    original_amount: number
  }
}

// Sanitize string input
function sanitizeString(input: string | null | undefined, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') return ''
  return input.trim().slice(0, maxLength)
}

// Sanitize amount
function sanitizeAmount(amount: unknown): number {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount))
  if (isNaN(num) || num < 0 || num > 999999999) return 0
  return Math.round(num * 100) / 100
}

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

Deno.serve(async (req) => {
  console.log('========================================')
  console.log('[Validate Coupon] Request received')
  console.log('Method:', req.method)
  console.log('========================================')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'Método não permitido',
        code: 'METHOD_NOT_ALLOWED' 
      } as CouponValidationResult),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()
    const { coupon_code, product_id, amount, order_bumps_total = 0, quantity = 1, is_preview = false } = body

    console.log('[Input] coupon_code:', coupon_code)
    console.log('[Input] product_id:', product_id)
    console.log('[Input] amount:', amount)
    console.log('[Input] order_bumps_total:', order_bumps_total)
    console.log('[Input] quantity:', quantity)
    console.log('[Input] is_preview:', is_preview)

    // Validate required fields
    if (!coupon_code || !product_id) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Código do cupom e ID do produto são obrigatórios',
          code: 'MISSING_PARAMS' 
        } as CouponValidationResult),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Sanitize inputs
    const sanitizedCode = sanitizeString(coupon_code, 50).toUpperCase()
    const sanitizedProductId = sanitizeString(product_id, 36)
    const sanitizedAmount = sanitizeAmount(amount)
    const sanitizedBumpsTotal = sanitizeAmount(order_bumps_total)
    const sanitizedQuantity = Math.max(1, Math.min(100, parseInt(String(quantity)) || 1))

    console.log('[Sanitized] code:', sanitizedCode)
    console.log('[Sanitized] product_id:', sanitizedProductId)

    // Validate product_id format
    if (!isValidUUID(sanitizedProductId)) {
      console.log('[Invalid] product_id format:', sanitizedProductId)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'ID do produto inválido',
          code: 'INVALID_PRODUCT_ID' 
        } as CouponValidationResult),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // STEP 1: Fetch product to get owner_user_id
    // ============================================================
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, user_id, name')
      .eq('id', sanitizedProductId)
      .maybeSingle()

    if (productError) {
      console.error('[DB Error] Fetching product:', productError)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Erro ao validar cupom',
          code: 'DATABASE_ERROR' 
        } as CouponValidationResult),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!product) {
      console.log('[Not Found] Product:', sanitizedProductId)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Produto não encontrado',
          code: 'PRODUCT_NOT_FOUND' 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const productOwnerId = product.user_id
    console.log('[Product] Owner ID:', productOwnerId)

    // ============================================================
    // STEP 2: Fetch campaign by coupon code and product
    // ============================================================
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('product_id', sanitizedProductId)
      .eq('coupon_code', sanitizedCode)
      .maybeSingle()

    if (error) {
      console.error('[DB Error]', error)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Erro ao validar cupom',
          code: 'DATABASE_ERROR' 
        } as CouponValidationResult),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Coupon not found for this product
    if (!campaign) {
      console.log('[Not Found] Coupon:', sanitizedCode, 'for product:', sanitizedProductId)
      
      // Log blocked attempt - coupon not found for this product
      try {
        await supabase.from('checkout_logs').insert({
          event_type: 'coupon_validation_blocked',
          product_id: sanitizedProductId,
          metadata: {
            coupon_code: sanitizedCode,
            reason: 'COUPON_NOT_FOUND_FOR_PRODUCT',
            message: 'Cupom não existe para este produto',
            product_owner_id: productOwnerId,
            is_preview,
          },
        })
      } catch (logError) {
        console.warn('[Log Error]', logError)
      }

      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Este cupom não é válido para este produto.',
          code: 'INVALID_COUPON' 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // STEP 3: CRITICAL - Validate ownership/co-producer relationship
    // The campaign must belong to a product owned by or co-produced by
    // the same user who created the campaign
    // ============================================================
    
    // Get the product that the campaign was created for
    const campaignProductId = campaign.product_id
    
    // Fetch the owner of the campaign's product
    const { data: campaignProduct, error: campaignProductError } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', campaignProductId)
      .maybeSingle()

    if (campaignProductError || !campaignProduct) {
      console.error('[DB Error] Fetching campaign product:', campaignProductError)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Erro ao validar cupom',
          code: 'DATABASE_ERROR' 
        } as CouponValidationResult),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const campaignOwnerUserId = campaignProduct.user_id
    console.log('[Campaign] Owner ID:', campaignOwnerUserId)

    // ============================================================
    // STEP 4: Check if the coupon owner is either:
    // a) The product owner, OR
    // b) A co-producer of the product
    // ============================================================

    // First check: Is the campaign owner the product owner?
    const isProductOwner = campaignOwnerUserId === productOwnerId
    console.log('[Validation] Is product owner:', isProductOwner)

    // Second check: Is the campaign owner a co-producer of this product?
    let isCoProducer = false
    if (!isProductOwner) {
      const { data: coProducerRecord, error: coProducerError } = await supabase
        .from('co_producers')
        .select('id, status')
        .eq('product_id', sanitizedProductId)
        .eq('user_id', campaignOwnerUserId)
        .eq('status', 'active')
        .maybeSingle()

      if (coProducerError) {
        console.error('[DB Error] Checking co-producer:', coProducerError)
      } else if (coProducerRecord) {
        isCoProducer = true
        console.log('[Validation] Is co-producer:', isCoProducer)
      }
    }

    // If neither owner nor co-producer, block the coupon
    if (!isProductOwner && !isCoProducer) {
      console.log('[BLOCKED] Coupon owner has no relation to product')
      console.log('[BLOCKED] Campaign owner:', campaignOwnerUserId)
      console.log('[BLOCKED] Product owner:', productOwnerId)
      
      // Log the blocked attempt for auditing
      try {
        await supabase.from('checkout_logs').insert({
          event_type: 'coupon_validation_blocked',
          product_id: sanitizedProductId,
          metadata: {
            coupon_code: sanitizedCode,
            campaign_id: campaign.id,
            reason: 'NO_OWNERSHIP_RELATION',
            message: 'Cupom não pertence ao dono ou coprodutor do produto',
            campaign_owner_id: campaignOwnerUserId,
            product_owner_id: productOwnerId,
            is_preview,
          },
        })
      } catch (logError) {
        console.warn('[Log Error]', logError)
      }

      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Este cupom não é válido para este produto.',
          code: 'OWNERSHIP_MISMATCH' 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Validation] Ownership verified successfully')

    // ============================================================
    // STEP 5: Standard coupon validations
    // ============================================================

    // Check if campaign is active
    if (!campaign.is_active) {
      console.log('[Inactive] Coupon:', sanitizedCode)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Cupom inválido',
          code: 'INACTIVE_COUPON' 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const now = new Date()

    // Check start date
    if (campaign.starts_at) {
      const startDate = new Date(campaign.starts_at)
      if (now < startDate) {
        console.log('[Not Started] Coupon starts at:', startDate.toISOString())
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Este cupom ainda não está válido',
            code: 'NOT_STARTED' 
          } as CouponValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check end date
    if (campaign.ends_at) {
      const endDate = new Date(campaign.ends_at)
      if (now > endDate) {
        console.log('[Expired] Coupon ended at:', endDate.toISOString())
        return new Response(
          JSON.stringify({ 
            valid: false, 
            message: 'Cupom expirado',
            code: 'EXPIRED' 
          } as CouponValidationResult),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check usage limit
    if (campaign.max_uses !== null && campaign.current_uses >= campaign.max_uses) {
      console.log('[Exhausted] Uses:', campaign.current_uses, '/', campaign.max_uses)
      return new Response(
        JSON.stringify({ 
          valid: false, 
          message: 'Cupom esgotado',
          code: 'EXHAUSTED' 
        } as CouponValidationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // STEP 6: Calculate discount
    // ============================================================
    // Subtotal = (product price * quantity) + order bumps
    const subtotal = sanitizedAmount * sanitizedQuantity + sanitizedBumpsTotal
    
    let discountAmount = 0
    if (subtotal > 0) {
      if (campaign.discount_type === 'percentage') {
        // Percentage discount
        discountAmount = Math.round((subtotal * campaign.discount_value / 100) * 100) / 100
      } else {
        // Fixed discount - can't discount more than the subtotal
        discountAmount = Math.min(campaign.discount_value, subtotal)
      }
    }

    // Final amount after discount (minimum 0.01)
    const finalAmount = Math.max(0.01, Math.round((subtotal - discountAmount) * 100) / 100)

    console.log('[Valid] Coupon:', sanitizedCode)
    console.log('[Discount] Type:', campaign.discount_type, 'Value:', campaign.discount_value)
    console.log('[Calculation] Subtotal:', subtotal, 'Discount:', discountAmount, 'Final:', finalAmount)

    // ============================================================
    // STEP 7: Log successful validation (for auditing)
    // ============================================================
    try {
      await supabase.from('checkout_logs').insert({
        event_type: 'coupon_validated',
        product_id: sanitizedProductId,
        metadata: {
          coupon_code: sanitizedCode,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          discount_type: campaign.discount_type,
          discount_value: campaign.discount_value,
          calculated_discount: discountAmount,
          subtotal,
          final_amount: finalAmount,
          is_preview,
          // Ownership info for auditing
          campaign_owner_id: campaignOwnerUserId,
          product_owner_id: productOwnerId,
          is_owner: isProductOwner,
          is_co_producer: isCoProducer,
        },
      })
    } catch (logError) {
      console.warn('[Log Error]', logError)
      // Don't fail validation due to logging error
    }

    return new Response(
      JSON.stringify({ 
        valid: true, 
        message: 'Cupom aplicado com sucesso!',
        code: 'SUCCESS',
        discount: {
          type: campaign.discount_type as 'percentage' | 'fixed',
          value: campaign.discount_value,
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          calculated_discount: discountAmount,
          final_amount: finalAmount,
          original_amount: subtotal,
        }
      } as CouponValidationResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Error]', error)
    return new Response(
      JSON.stringify({ 
        valid: false, 
        message: 'Erro ao validar cupom',
        code: 'UNKNOWN_ERROR' 
      } as CouponValidationResult),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
