import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// ENUMS & TYPES (GraphQL-compatible)
// ============================================================

type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
const PHYSICAL_PRODUCT_TYPE: ProductType = 'PHYSICAL';

// Legacy type mapping for database compatibility
const LEGACY_TYPE_MAP: Record<string, ProductType> = {
  'physical': 'PHYSICAL',
  'digital': 'DIGITAL',
  'ebook': 'DIGITAL',
  'membership': 'SERVICE',
  'service': 'SERVICE',
};

const REVERSE_TYPE_MAP: Record<ProductType, string> = {
  'PHYSICAL': 'physical',
  'DIGITAL': 'digital',
  'SERVICE': 'service',
};

interface LogisticsInput {
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightG: number;
}

interface Logistics {
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightG: number;
}

interface ProductInput {
  name: string;
  description?: string;
  productType: ProductType;
  price: number;
  category?: string;
  payment_type?: string;
  delivery_method?: string;
  sales_page_url?: string;
  sac_name?: string;
  sac_phone?: string;
  sac_email?: string;
  image_url?: string;
  logistics?: LogisticsInput;
}

interface ApiError {
  code: string;
  message: string;
  field?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errors?: ApiError[];
}

// ============================================================
// VALIDATION FUNCTIONS (GraphQL Resolver-style)
// ============================================================

const LOGISTICS_LIMITS = {
  MIN_DIMENSION: 0.1,
  MAX_DIMENSION: 200,
  MAX_TOTAL_DIMENSIONS: 300,
  MIN_WEIGHT: 1,
  MAX_WEIGHT: 30000,
};

function validateLogistics(logistics: LogisticsInput | undefined, productType: ProductType): ApiError[] {
  const errors: ApiError[] = [];

  // If not physical product, logistics should not be provided
  if (productType !== PHYSICAL_PRODUCT_TYPE) {
    return [];
  }

  // Physical product requires logistics
  if (!logistics) {
    errors.push({
      code: 'LOGISTICS_REQUIRED',
      message: 'Dados de logística são obrigatórios para produtos físicos',
      field: 'logistics',
    });
    return errors;
  }

  // Validate heightCm
  if (typeof logistics.heightCm !== 'number' || logistics.heightCm <= 0) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Altura deve ser um número maior que 0',
      field: 'logistics.heightCm',
    });
  } else if (logistics.heightCm < LOGISTICS_LIMITS.MIN_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Altura mínima é ${LOGISTICS_LIMITS.MIN_DIMENSION}cm`,
      field: 'logistics.heightCm',
    });
  } else if (logistics.heightCm > LOGISTICS_LIMITS.MAX_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Altura máxima é ${LOGISTICS_LIMITS.MAX_DIMENSION}cm`,
      field: 'logistics.heightCm',
    });
  }

  // Validate widthCm
  if (typeof logistics.widthCm !== 'number' || logistics.widthCm <= 0) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Largura deve ser um número maior que 0',
      field: 'logistics.widthCm',
    });
  } else if (logistics.widthCm < LOGISTICS_LIMITS.MIN_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Largura mínima é ${LOGISTICS_LIMITS.MIN_DIMENSION}cm`,
      field: 'logistics.widthCm',
    });
  } else if (logistics.widthCm > LOGISTICS_LIMITS.MAX_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Largura máxima é ${LOGISTICS_LIMITS.MAX_DIMENSION}cm`,
      field: 'logistics.widthCm',
    });
  }

  // Validate lengthCm
  if (typeof logistics.lengthCm !== 'number' || logistics.lengthCm <= 0) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Comprimento deve ser um número maior que 0',
      field: 'logistics.lengthCm',
    });
  } else if (logistics.lengthCm < LOGISTICS_LIMITS.MIN_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Comprimento mínimo é ${LOGISTICS_LIMITS.MIN_DIMENSION}cm`,
      field: 'logistics.lengthCm',
    });
  } else if (logistics.lengthCm > LOGISTICS_LIMITS.MAX_DIMENSION) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Comprimento máximo é ${LOGISTICS_LIMITS.MAX_DIMENSION}cm`,
      field: 'logistics.lengthCm',
    });
  }

  // Validate weightG
  if (typeof logistics.weightG !== 'number' || logistics.weightG <= 0) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Peso deve ser um número maior que 0',
      field: 'logistics.weightG',
    });
  } else if (logistics.weightG < LOGISTICS_LIMITS.MIN_WEIGHT) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Peso mínimo é ${LOGISTICS_LIMITS.MIN_WEIGHT}g`,
      field: 'logistics.weightG',
    });
  } else if (logistics.weightG > LOGISTICS_LIMITS.MAX_WEIGHT) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: `Peso máximo é ${LOGISTICS_LIMITS.MAX_WEIGHT / 1000}kg`,
      field: 'logistics.weightG',
    });
  }

  // Validate total dimensions
  if (logistics.heightCm && logistics.widthCm && logistics.lengthCm) {
    const total = logistics.heightCm + logistics.widthCm + logistics.lengthCm;
    if (total > LOGISTICS_LIMITS.MAX_TOTAL_DIMENSIONS) {
      errors.push({
        code: 'BAD_USER_INPUT',
        message: `Soma das dimensões não pode exceder ${LOGISTICS_LIMITS.MAX_TOTAL_DIMENSIONS}cm`,
        field: 'logistics',
      });
    }
  }

  return errors;
}

function validateProductInput(input: ProductInput): ApiError[] {
  const errors: ApiError[] = [];

  // Validate name
  if (!input.name || input.name.trim().length < 2) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Nome do produto deve ter pelo menos 2 caracteres',
      field: 'name',
    });
  }

  // Validate price
  if (typeof input.price !== 'number' || input.price < 0) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Preço deve ser um número positivo',
      field: 'price',
    });
  }

  // Validate type
  const validTypes: ProductType[] = ['PHYSICAL', 'DIGITAL', 'SERVICE'];
  if (!validTypes.includes(input.productType)) {
    errors.push({
      code: 'BAD_USER_INPUT',
      message: 'Tipo de produto inválido. Use: PHYSICAL, DIGITAL ou SERVICE',
      field: 'productType',
    });
  }

  // Validate logistics for physical products
  const logisticsErrors = validateLogistics(input.logistics, input.productType);
  errors.push(...logisticsErrors);

  return errors;
}

// ============================================================
// DATABASE HELPERS
// ============================================================

function normalizeProductType(dbType: string): ProductType {
  return LEGACY_TYPE_MAP[dbType] || 'DIGITAL';
}

function toDatabaseType(apiType: ProductType): string {
  return REVERSE_TYPE_MAP[apiType] || 'digital';
}

function dbLogisticsToApi(dbLogistics: { height_cm: number; width_cm: number; length_cm: number; weight_g: number }): Logistics {
  return {
    heightCm: dbLogistics.height_cm,
    widthCm: dbLogistics.width_cm,
    lengthCm: dbLogistics.length_cm,
    weightG: dbLogistics.weight_g,
  };
}

// ============================================================
// API HANDLERS (GraphQL Mutation equivalents)
// ============================================================

// deno-lint-ignore no-explicit-any
async function handleGetProduct(supabase: any, productId: string): Promise<ApiResponse> {
  console.log('[product-api] GET product:', productId);

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (productError) {
    console.error('[product-api] Error fetching product:', productError);
    return {
      success: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao buscar produto' }],
    };
  }

  if (!product) {
    return {
      success: false,
      errors: [{ code: 'NOT_FOUND', message: 'Produto não encontrado' }],
    };
  }

  const normalizedType = normalizeProductType(product.product_type);
  
  // Fetch logistics if physical product
  let logistics: Logistics | null = null;
  if (normalizedType === PHYSICAL_PRODUCT_TYPE) {
    const { data: logisticsData } = await supabase
      .from('product_logistics')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (logisticsData) {
      logistics = dbLogisticsToApi(logisticsData);
    }
  }

  return {
    success: true,
    data: {
      id: product.id,
      name: product.name,
      description: product.description,
      productType: normalizedType,
      price: product.price,
      logistics,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      // Include other fields for backwards compatibility
      ...product,
    },
  };
}

// deno-lint-ignore no-explicit-any
async function handleCreateProduct(
  supabase: any,
  input: ProductInput,
  userId: string
): Promise<ApiResponse> {
  console.log('[product-api] CREATE product:', input.name, 'productType:', input.productType);

  // Validate input
  const errors = validateProductInput(input);
  if (errors.length > 0) {
    console.error('[product-api] Validation errors:', errors);
    return { success: false, errors };
  }

  // Create product
  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      product_type: toDatabaseType(input.productType),
      price: input.price,
      category: input.category || 'outros',
      payment_type: input.payment_type || 'one_time',
      delivery_method: input.delivery_method || null,
      sales_page_url: input.sales_page_url || null,
      sac_name: input.sac_name || null,
      sac_phone: input.sac_phone || null,
      sac_email: input.sac_email || null,
      image_url: input.image_url || null,
      user_id: userId,
      status: 'draft',
    })
    .select()
    .single();

  if (productError || !product) {
    console.error('[product-api] Error creating product:', productError);
    return {
      success: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao criar produto' }],
    };
  }

  // If physical product, create logistics
  let logistics: Logistics | null = null;
  if (input.productType === PHYSICAL_PRODUCT_TYPE && input.logistics) {
    const { data: logisticsData, error: logisticsError } = await supabase
      .from('product_logistics')
      .insert({
        product_id: product.id,
        height_cm: input.logistics.heightCm,
        width_cm: input.logistics.widthCm,
        length_cm: input.logistics.lengthCm,
        weight_g: input.logistics.weightG,
      })
      .select()
      .single();

    if (logisticsError) {
      console.error('[product-api] Error creating logistics:', logisticsError);
      // Rollback: delete the product
      await supabase.from('products').delete().eq('id', product.id);
      return {
        success: false,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao salvar dados de logística' }],
      };
    }

    logistics = dbLogisticsToApi(logisticsData);
  }

  console.log('[product-api] Product created successfully:', product.id);

  return {
    success: true,
    data: {
      id: product.id,
      name: product.name,
      description: product.description,
      productType: input.productType,
      price: product.price,
      logistics,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    },
  };
}

// deno-lint-ignore no-explicit-any
async function handleUpdateProduct(
  supabase: any,
  productId: string,
  input: ProductInput,
  userId: string
): Promise<ApiResponse> {
  console.log('[product-api] UPDATE product:', productId, 'productType:', input.productType);

  // Check if product exists and belongs to user
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id, user_id, product_type')
    .eq('id', productId)
    .maybeSingle();

  if (!existingProduct) {
    return {
      success: false,
      errors: [{ code: 'NOT_FOUND', message: 'Produto não encontrado' }],
    };
  }

  if (existingProduct.user_id !== userId) {
    return {
      success: false,
      errors: [{ code: 'FORBIDDEN', message: 'Sem permissão para editar este produto' }],
    };
  }

  // Validate input
  const errors = validateProductInput(input);
  if (errors.length > 0) {
    console.error('[product-api] Validation errors:', errors);
    return { success: false, errors };
  }

  // Update product
  const { data: product, error: productError } = await supabase
    .from('products')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      product_type: toDatabaseType(input.productType),
      price: input.price,
      category: input.category || 'outros',
      payment_type: input.payment_type || 'one_time',
      delivery_method: input.delivery_method || null,
      sales_page_url: input.sales_page_url || null,
      sac_name: input.sac_name || null,
      sac_phone: input.sac_phone || null,
      sac_email: input.sac_email || null,
      image_url: input.image_url || null,
    })
    .eq('id', productId)
    .select()
    .single();

  if (productError || !product) {
    console.error('[product-api] Error updating product:', productError);
    return {
      success: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao atualizar produto' }],
    };
  }

  const existingNormalizedType = normalizeProductType(existingProduct.product_type);

  // Handle logistics
  let logistics: Logistics | null = null;
  if (input.productType === PHYSICAL_PRODUCT_TYPE && input.logistics) {
    // Upsert logistics (insert or update)
    const { data: logisticsData, error: logisticsError } = await supabase
      .from('product_logistics')
      .upsert({
        product_id: productId,
        height_cm: input.logistics.heightCm,
        width_cm: input.logistics.widthCm,
        length_cm: input.logistics.lengthCm,
        weight_g: input.logistics.weightG,
      }, { onConflict: 'product_id' })
      .select()
      .single();

    if (logisticsError) {
      console.error('[product-api] Error upserting logistics:', logisticsError);
      return {
        success: false,
        errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao salvar dados de logística' }],
      };
    }

    logistics = dbLogisticsToApi(logisticsData);
  } else if (input.productType !== PHYSICAL_PRODUCT_TYPE) {
    // If changed from physical to non-physical, delete logistics
    if (existingNormalizedType === PHYSICAL_PRODUCT_TYPE) {
      console.log('[product-api] Removing logistics (product type changed from physical)');
      await supabase
        .from('product_logistics')
        .delete()
        .eq('product_id', productId);
    }
  }

  console.log('[product-api] Product updated successfully:', productId);

  return {
    success: true,
    data: {
      id: product.id,
      name: product.name,
      description: product.description,
      productType: input.productType,
      price: product.price,
      logistics,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    },
  };
}

// deno-lint-ignore no-explicit-any
async function handleGetProductForCheckout(
  supabase: any,
  productId: string
): Promise<ApiResponse> {
  console.log('[product-api] GET product for checkout:', productId);

  // Fetch active product
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, description, price, product_type, image_url, user_id, payment_type, status')
    .eq('id', productId)
    .eq('status', 'active')
    .maybeSingle();

  if (productError) {
    console.error('[product-api] Error fetching product:', productError);
    return {
      success: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Erro ao buscar produto' }],
    };
  }

  if (!product) {
    return {
      success: false,
      errors: [{ code: 'NOT_FOUND', message: 'Produto não encontrado ou não está ativo' }],
    };
  }

  const normalizedType = normalizeProductType(product.product_type);
  
  // Fetch logistics if physical product
  let logistics: Logistics | null = null;
  if (normalizedType === PHYSICAL_PRODUCT_TYPE) {
    const { data: logisticsData } = await supabase
      .from('product_logistics')
      .select('*')
      .eq('product_id', productId)
      .maybeSingle();

    if (logisticsData) {
      logistics = dbLogisticsToApi(logisticsData);
    } else {
      // CRITICAL: Physical product without logistics - block checkout
      console.error('[product-api] LOGISTICS_REQUIRED - Physical product without logistics data');
      return {
        success: false,
        errors: [{
          code: 'LOGISTICS_REQUIRED',
          message: 'Não foi possível calcular o frete deste produto. Entre em contato com o vendedor.',
          field: 'logistics',
        }],
      };
    }
  }

  return {
    success: true,
    data: {
      id: product.id,
      name: product.name,
      description: product.description,
      productType: normalizedType,
      price: product.price,
      logistics,
      imageUrl: product.image_url,
      userId: product.user_id,
      paymentType: product.payment_type,
      status: product.status,
    },
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract auth token
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    console.log('[product-api] Request:', req.method, url.pathname, 'userId:', userId);

    // Route: GET /product-api/checkout/:id
    if (req.method === 'GET' && pathParts.length === 3 && pathParts[1] === 'checkout') {
      const productId = pathParts[2];
      const result = await handleGetProductForCheckout(supabase, productId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.errors?.[0]?.code === 'NOT_FOUND' ? 404 : 400),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: GET /product-api/:id
    if (req.method === 'GET' && pathParts.length === 2) {
      const productId = pathParts[1];
      const result = await handleGetProduct(supabase, productId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.errors?.[0]?.code === 'NOT_FOUND' ? 404 : 400),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authenticated routes
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, errors: [{ code: 'UNAUTHORIZED', message: 'Autenticação necessária' }] }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Route: POST /product-api (Create)
    if (req.method === 'POST' && pathParts.length === 1) {
      const input: ProductInput = await req.json();
      const result = await handleCreateProduct(supabase, input, userId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 201 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: PUT /product-api/:id (Update)
    if (req.method === 'PUT' && pathParts.length === 2) {
      const productId = pathParts[1];
      const input: ProductInput = await req.json();
      const result = await handleUpdateProduct(supabase, productId, input, userId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.errors?.[0]?.code === 'NOT_FOUND' ? 404 : 400),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Not found
    return new Response(
      JSON.stringify({ success: false, errors: [{ code: 'NOT_FOUND', message: 'Rota não encontrada' }] }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[product-api] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, errors: [{ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' }] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
