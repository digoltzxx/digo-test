import { z } from 'zod';

// Product validation schema
export const productSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .trim(),
  description: z.string()
    .max(5000, 'Descrição deve ter no máximo 5000 caracteres')
    .optional()
    .nullable(),
  price: z.number()
    .min(0, 'Preço não pode ser negativo')
    .max(1000000, 'Preço máximo é R$ 1.000.000'),
  category: z.string()
    .min(1, 'Categoria é obrigatória')
    .max(100, 'Categoria deve ter no máximo 100 caracteres'),
  product_type: z.enum(['digital', 'physical', 'membership', 'event']),
  payment_type: z.enum(['one_time', 'subscription']).default('one_time'),
  delivery_method: z.string().max(100).optional().nullable(),
  marketplace_enabled: z.boolean().default(false),
  sales_page_url: z.string().url('URL inválida').max(500).optional().nullable().or(z.literal('')),
  sac_name: z.string().max(100).optional().nullable(),
  sac_email: z.string().email('Email inválido').max(255).optional().nullable().or(z.literal('')),
  weight: z.number().min(0).max(10000).optional().nullable(),
  stock: z.number().int().min(0).max(999999).optional().nullable(),
  commission_percentage: z.number().min(0, 'Comissão mínima é 0%').max(100, 'Comissão máxima é 100%').optional().nullable(),
  affiliate_auto_approve: z.boolean().optional().nullable(),
});

// Bank account validation schema
export const bankAccountSchema = z.object({
  bank_name: z.string()
    .min(2, 'Nome do banco é obrigatório')
    .max(100, 'Nome do banco deve ter no máximo 100 caracteres')
    .trim(),
  account_type: z.enum(['checking', 'savings'], {
    errorMap: () => ({ message: 'Tipo de conta inválido' })
  }),
  account_number: z.string()
    .min(1, 'Número da conta é obrigatório')
    .max(30, 'Número da conta deve ter no máximo 30 caracteres')
    .regex(/^[0-9\-]+$/, 'Número da conta deve conter apenas números e hífens'),
  agency: z.string()
    .min(1, 'Agência é obrigatória')
    .max(10, 'Agência deve ter no máximo 10 caracteres')
    .regex(/^[0-9\-]+$/, 'Agência deve conter apenas números e hífens'),
  pix_key: z.string().max(100, 'Chave PIX deve ter no máximo 100 caracteres').optional().nullable(),
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']).optional().nullable(),
});

// Profile validation schema
export const profileSchema = z.object({
  full_name: z.string()
    .min(2, 'Nome completo é obrigatório')
    .max(200, 'Nome deve ter no máximo 200 caracteres')
    .trim()
    .optional()
    .nullable(),
  email: z.string()
    .email('Email inválido')
    .max(255, 'Email deve ter no máximo 255 caracteres')
    .optional()
    .nullable(),
  document_type: z.enum(['cpf', 'cnpj']).optional().nullable(),
  document_number: z.string()
    .max(18, 'Documento deve ter no máximo 18 caracteres')
    .regex(/^[0-9.\-/]*$/, 'Documento inválido')
    .optional()
    .nullable(),
  mcc_category: z.string().max(100).optional().nullable(),
  cep: z.string()
    .max(10, 'CEP deve ter no máximo 10 caracteres')
    .regex(/^[0-9\-]*$/, 'CEP inválido')
    .optional()
    .nullable(),
  street: z.string().max(255).optional().nullable(),
  street_number: z.string().max(20).optional().nullable(),
  complement: z.string().max(100).optional().nullable(),
  neighborhood: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
});

// Withdrawal validation schema
export const withdrawalSchema = z.object({
  amount: z.number()
    .min(10, 'Valor mínimo para saque é R$ 10,00')
    .max(100000, 'Valor máximo para saque é R$ 100.000,00'),
  bank_account_id: z.string().uuid('Conta bancária inválida'),
});

// Helper function to validate and get errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: Record<string, string> 
} {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = err.message;
        }
      });
      return { success: false, errors };
    }
    return { success: false, errors: { _form: 'Erro de validação desconhecido' } };
  }
}

// Safe number parsing
export function safeParseNumber(value: string | number | undefined | null, defaultValue = 0): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

// Safe integer parsing
export function safeParseInt(value: string | number | undefined | null, defaultValue = 0): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = typeof value === 'number' ? Math.round(value) : parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
}
