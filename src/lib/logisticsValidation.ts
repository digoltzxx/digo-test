/**
 * Logistics Validation for Physical Products
 * API-first architecture with GraphQL-compatible naming
 * 
 * Uses product_logistics table (height_cm, width_cm, length_cm, weight_g)
 * Exposes GraphQL-style API (heightCm, widthCm, lengthCm, weightG)
 */

// Database format (snake_case)
export interface LogisticsData {
  height_cm: number | null;
  width_cm: number | null;
  length_cm: number | null;
  weight_grams: number | null;
}

// API/GraphQL format (camelCase)
export interface LogisticsInput {
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightG: number;
}

// API response format
export interface Logistics {
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightG: number;
}

export interface LogisticsValidationResult {
  valid: boolean;
  errors: LogisticsValidationError[];
  sanitizedData?: LogisticsPayload;
}

export interface LogisticsValidationError {
  field: string;
  message: string;
  code: string;
}

// Gateway payload format (freight calculation)
export interface LogisticsPayload {
  height: number;
  width: number;
  length: number;
  weight: number;
}

// ProductType enum (GraphQL-compatible)
export type ProductType = 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
export const PHYSICAL_PRODUCT_TYPE: ProductType = 'PHYSICAL';

// Gateway limits (Correios/Jadlog standard limits)
const LOGISTICS_LIMITS = {
  MIN_DIMENSION_CM: 0.1,
  MAX_DIMENSION_CM: 200, // Max 200cm per dimension
  MIN_WEIGHT_GRAMS: 1,
  MAX_WEIGHT_GRAMS: 30000, // Max 30kg
  MAX_TOTAL_DIMENSIONS_CM: 300, // Sum of L+W+H
};

/**
 * Validates if a product is physical
 */
export function isPhysicalProduct(productType: string | null | undefined): boolean {
  const normalizedType = productType?.toLowerCase();
  return normalizedType === 'physical' || productType === 'PHYSICAL';
}

/**
 * Converts database format to API format
 */
export function dbToApiLogistics(dbLogistics: {
  height_cm: number;
  width_cm: number;
  length_cm: number;
  weight_g: number;
}): Logistics {
  return {
    heightCm: dbLogistics.height_cm,
    widthCm: dbLogistics.width_cm,
    lengthCm: dbLogistics.length_cm,
    weightG: dbLogistics.weight_g,
  };
}

/**
 * Converts API format to database format
 */
export function apiToDbLogistics(apiLogistics: LogisticsInput): {
  height_cm: number;
  width_cm: number;
  length_cm: number;
  weight_g: number;
} {
  return {
    height_cm: apiLogistics.heightCm,
    width_cm: apiLogistics.widthCm,
    length_cm: apiLogistics.lengthCm,
    weight_g: apiLogistics.weightG,
  };
}

/**
 * Validates logistics data for a physical product
 */
export function validateLogisticsData(
  data: LogisticsData,
  productType: string
): LogisticsValidationResult {
  const errors: LogisticsValidationError[] = [];

  // Non-physical products don't need logistics validation
  if (!isPhysicalProduct(productType)) {
    return { valid: true, errors: [] };
  }

  // Height validation
  if (data.height_cm === null || data.height_cm === undefined || data.height_cm <= 0) {
    errors.push({
      field: 'heightCm',
      message: 'Altura é obrigatória para produtos físicos',
      code: 'MISSING_HEIGHT',
    });
  } else if (data.height_cm < LOGISTICS_LIMITS.MIN_DIMENSION_CM) {
    errors.push({
      field: 'heightCm',
      message: `Altura deve ser pelo menos ${LOGISTICS_LIMITS.MIN_DIMENSION_CM}cm`,
      code: 'HEIGHT_TOO_SMALL',
    });
  } else if (data.height_cm > LOGISTICS_LIMITS.MAX_DIMENSION_CM) {
    errors.push({
      field: 'heightCm',
      message: `Altura máxima é ${LOGISTICS_LIMITS.MAX_DIMENSION_CM}cm`,
      code: 'HEIGHT_TOO_LARGE',
    });
  }

  // Width validation
  if (data.width_cm === null || data.width_cm === undefined || data.width_cm <= 0) {
    errors.push({
      field: 'widthCm',
      message: 'Largura é obrigatória para produtos físicos',
      code: 'MISSING_WIDTH',
    });
  } else if (data.width_cm < LOGISTICS_LIMITS.MIN_DIMENSION_CM) {
    errors.push({
      field: 'widthCm',
      message: `Largura deve ser pelo menos ${LOGISTICS_LIMITS.MIN_DIMENSION_CM}cm`,
      code: 'WIDTH_TOO_SMALL',
    });
  } else if (data.width_cm > LOGISTICS_LIMITS.MAX_DIMENSION_CM) {
    errors.push({
      field: 'widthCm',
      message: `Largura máxima é ${LOGISTICS_LIMITS.MAX_DIMENSION_CM}cm`,
      code: 'WIDTH_TOO_LARGE',
    });
  }

  // Length validation
  if (data.length_cm === null || data.length_cm === undefined || data.length_cm <= 0) {
    errors.push({
      field: 'lengthCm',
      message: 'Comprimento é obrigatório para produtos físicos',
      code: 'MISSING_LENGTH',
    });
  } else if (data.length_cm < LOGISTICS_LIMITS.MIN_DIMENSION_CM) {
    errors.push({
      field: 'lengthCm',
      message: `Comprimento deve ser pelo menos ${LOGISTICS_LIMITS.MIN_DIMENSION_CM}cm`,
      code: 'LENGTH_TOO_SMALL',
    });
  } else if (data.length_cm > LOGISTICS_LIMITS.MAX_DIMENSION_CM) {
    errors.push({
      field: 'lengthCm',
      message: `Comprimento máximo é ${LOGISTICS_LIMITS.MAX_DIMENSION_CM}cm`,
      code: 'LENGTH_TOO_LARGE',
    });
  }

  // Weight validation
  if (data.weight_grams === null || data.weight_grams === undefined || data.weight_grams <= 0) {
    errors.push({
      field: 'weightG',
      message: 'Peso é obrigatório para produtos físicos',
      code: 'MISSING_WEIGHT',
    });
  } else if (data.weight_grams < LOGISTICS_LIMITS.MIN_WEIGHT_GRAMS) {
    errors.push({
      field: 'weightG',
      message: `Peso deve ser pelo menos ${LOGISTICS_LIMITS.MIN_WEIGHT_GRAMS}g`,
      code: 'WEIGHT_TOO_SMALL',
    });
  } else if (data.weight_grams > LOGISTICS_LIMITS.MAX_WEIGHT_GRAMS) {
    errors.push({
      field: 'weightG',
      message: `Peso máximo é ${LOGISTICS_LIMITS.MAX_WEIGHT_GRAMS / 1000}kg`,
      code: 'WEIGHT_TOO_LARGE',
    });
  }

  // Total dimensions check
  if (data.height_cm && data.width_cm && data.length_cm) {
    const totalDimensions = data.height_cm + data.width_cm + data.length_cm;
    if (totalDimensions > LOGISTICS_LIMITS.MAX_TOTAL_DIMENSIONS_CM) {
      errors.push({
        field: 'dimensions',
        message: `Soma das dimensões não pode exceder ${LOGISTICS_LIMITS.MAX_TOTAL_DIMENSIONS_CM}cm`,
        code: 'TOTAL_DIMENSIONS_EXCEEDED',
      });
    }
  }

  // Build sanitized payload if valid
  let sanitizedData: LogisticsPayload | undefined;
  if (errors.length === 0) {
    sanitizedData = {
      height: data.height_cm!,
      width: data.width_cm!,
      length: data.length_cm!,
      weight: data.weight_grams!,
    };
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * Validates LogisticsInput (API format)
 */
export function validateLogisticsInput(
  input: LogisticsInput | undefined,
  productType: string
): LogisticsValidationResult {
  if (!isPhysicalProduct(productType)) {
    return { valid: true, errors: [] };
  }

  if (!input) {
    return {
      valid: false,
      errors: [{
        field: 'logistics',
        message: 'Dados de logística são obrigatórios para produtos físicos',
        code: 'LOGISTICS_REQUIRED',
      }],
    };
  }

  // Convert to database format for validation
  const dbFormat: LogisticsData = {
    height_cm: input.heightCm,
    width_cm: input.widthCm,
    length_cm: input.lengthCm,
    weight_grams: input.weightG,
  };

  return validateLogisticsData(dbFormat, productType);
}

/**
 * Formats logistics errors for display
 */
export function formatLogisticsErrors(errors: LogisticsValidationError[]): string {
  return errors.map(e => `• ${e.message}`).join('\n');
}

/**
 * Gets the first error message for a specific field
 */
export function getFieldError(
  errors: LogisticsValidationError[],
  field: string
): string | null {
  const error = errors.find(e => e.field === field);
  return error ? error.message : null;
}

/**
 * Checks if a physical product has valid logistics data for checkout
 */
export function hasValidLogisticsForCheckout(
  productType: string | null | undefined,
  logisticsData: LogisticsData
): { canProceed: boolean; errorMessage?: string } {
  if (!isPhysicalProduct(productType)) {
    return { canProceed: true };
  }

  const result = validateLogisticsData(logisticsData, productType || '');
  
  if (!result.valid) {
    return {
      canProceed: false,
      errorMessage: 'Não foi possível calcular o frete deste produto. Entre em contato com o vendedor.',
    };
  }

  return { canProceed: true };
}

/**
 * Builds freight calculation payload from product logistics data
 */
export function buildFreightPayload(
  logisticsData: LogisticsData,
  quantity: number = 1
): LogisticsPayload | null {
  const result = validateLogisticsData(logisticsData, 'physical');
  
  if (!result.valid || !result.sanitizedData) {
    return null;
  }

  return {
    height: result.sanitizedData.height,
    width: result.sanitizedData.width,
    length: result.sanitizedData.length,
    weight: result.sanitizedData.weight * quantity,
  };
}

/**
 * Logs logistics validation for debugging
 */
export function logLogisticsValidation(
  result: LogisticsValidationResult,
  context: string = 'logistics'
): void {
  const isDebug = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).get('debug') === 'true' ||
     localStorage.getItem('checkout_debug') === 'true');

  if (!isDebug) return;

  if (result.valid) {
    console.log(`%c[${context.toUpperCase()}] ✅ Logistics validation passed`, 'color: #22c55e; font-weight: bold;');
  } else {
    console.group(`%c[${context.toUpperCase()}] ❌ Logistics validation failed`, 'color: #ef4444; font-weight: bold;');
    result.errors.forEach(error => {
      console.error(`  ${error.field}: ${error.message} (${error.code})`);
    });
    console.groupEnd();
  }
}
