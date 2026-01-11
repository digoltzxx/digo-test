import { z } from 'zod';

// CPF validation
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;
  
  return true;
}

// CNPJ validation
function isValidCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Validate check digits
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  let digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  let digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleaned[13])) return false;
  
  return true;
}

// Phone validation (Brazilian format)
function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// Input masking utilities
export function maskCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCNPJ(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 14);
  return cleaned
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return cleaned
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// Base checkout form schema - name is always required
const baseSchema = {
  name: z
    .string()
    .trim()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
};

// Create schema with required fields based on settings
export function createCheckoutSchema(
  requireDocument: boolean, 
  requirePhone: boolean, 
  requireEmail: boolean = true,
  documentType: 'cpf' | 'cnpj' | 'both' = 'cpf',
  selectedDocType?: 'cpf' | 'cnpj' // For when both are enabled, which one user selected
) {
  // When both are allowed, use the selected type for validation
  const effectiveDocType = documentType === 'both' ? (selectedDocType || 'cpf') : documentType;
  const validateDocument = effectiveDocType === 'cnpj' ? isValidCNPJ : isValidCPF;
  const documentLabel = effectiveDocType === 'cnpj' ? 'CNPJ' : 'CPF';

  return z.object({
    ...baseSchema,
    email: requireEmail
      ? z.string().trim().email('E-mail inválido').max(255, 'E-mail deve ter no máximo 255 caracteres')
      : z.string().optional().refine((val) => !val || z.string().email().safeParse(val).success, 'E-mail inválido'),
    emailConfirm: z.string().optional(),
    document: requireDocument 
      ? z.string().min(1, `${documentLabel} é obrigatório`).refine(validateDocument, `${documentLabel} inválido. Digite um ${documentLabel} válido para continuar.`)
      : z.string().optional().refine((val) => !val || validateDocument(val), `${documentLabel} inválido. Digite um ${documentLabel} válido para continuar.`),
    phone: requirePhone
      ? z.string().min(1, 'Telefone é obrigatório').refine(isValidPhone, 'Telefone inválido')
      : z.string().optional().refine((val) => !val || isValidPhone(val), 'Telefone inválido'),
  });
}

export type CheckoutFormData = {
  name: string;
  email?: string;
  emailConfirm?: string;
  document?: string;
  phone?: string;
};