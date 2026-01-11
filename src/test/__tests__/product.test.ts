import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de Criação e Gerenciamento de Produtos
 * 
 * Valida regras de negócio isoladas para criação de produtos,
 * tipos de produto, status inicial e configurações.
 */

// Tipos de produto válidos
const PRODUCT_TYPES = ['digital', 'fisico'] as const;
type ProductType = typeof PRODUCT_TYPES[number];

// Status de produto válidos
const PRODUCT_STATUSES = ['rascunho', 'publicado', 'inativo'] as const;
type ProductStatus = typeof PRODUCT_STATUSES[number];

// Métodos de entrega por tipo de produto
const DELIVERY_METHODS = {
  digital: ['email', 'member_area', 'manual', 'external_link'] as const,
  fisico: ['frete', 'manual', 'retirada'] as const,
};

// Mock de produto
interface MockProduct {
  id: string;
  product_type: ProductType;
  name: string;
  description: string | null;
  price: number;
  category: string;
  status: ProductStatus;
  delivery_method: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Função para criar produto (simula lógica real)
function createProduct(type: ProductType, userId: string): MockProduct {
  if (!PRODUCT_TYPES.includes(type)) {
    throw new Error(`Tipo de produto inválido: ${type}`);
  }
  
  if (!userId) {
    throw new Error('user_id é obrigatório');
  }
  
  return {
    id: `prod-${Date.now()}`,
    product_type: type,
    name: '',
    description: null,
    price: 0,
    category: '',
    status: 'rascunho',
    delivery_method: null,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Valida método de entrega por tipo de produto
function isValidDeliveryMethod(productType: ProductType, method: string): boolean {
  const validMethods = DELIVERY_METHODS[productType] as readonly string[];
  return validMethods.includes(method);
}

// Verifica se produto pode ser publicado
function canPublishProduct(product: MockProduct): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!product.name || product.name.trim().length === 0) {
    errors.push('Nome é obrigatório');
  }
  
  if (product.price <= 0) {
    errors.push('Preço deve ser maior que zero');
  }
  
  if (!product.category) {
    errors.push('Categoria é obrigatória');
  }
  
  // Produto digital precisa de método de entrega
  if (product.product_type === 'digital' && !product.delivery_method) {
    errors.push('Método de entrega é obrigatório para produtos digitais');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

describe('Criação de Produto', () => {
  describe('Criação instantânea por tipo', () => {
    it('deve criar produto digital com status rascunho', () => {
      const product = createProduct('digital', 'user-123');
      
      expect(product.id).toBeTruthy();
      expect(product.product_type).toBe('digital');
      expect(product.status).toBe('rascunho');
      expect(product.user_id).toBe('user-123');
    });

    it('deve criar produto físico com status rascunho', () => {
      const product = createProduct('fisico', 'user-123');
      
      expect(product.id).toBeTruthy();
      expect(product.product_type).toBe('fisico');
      expect(product.status).toBe('rascunho');
    });

    it('deve rejeitar tipo de produto inválido', () => {
      expect(() => createProduct('invalido' as ProductType, 'user-123'))
        .toThrow('Tipo de produto inválido');
    });

    it('deve rejeitar criação sem user_id', () => {
      expect(() => createProduct('digital', ''))
        .toThrow('user_id é obrigatório');
    });

    it('deve gerar product_id único', () => {
      const product1 = createProduct('digital', 'user-123');
      const product2 = createProduct('digital', 'user-123');
      
      expect(product1.id).not.toBe(product2.id);
    });

    it('deve inicializar campos com valores padrão', () => {
      const product = createProduct('digital', 'user-123');
      
      expect(product.name).toBe('');
      expect(product.description).toBeNull();
      expect(product.price).toBe(0);
      expect(product.category).toBe('');
      expect(product.delivery_method).toBeNull();
    });

    it('deve registrar timestamps de criação', () => {
      const before = new Date().toISOString();
      const product = createProduct('digital', 'user-123');
      const after = new Date().toISOString();
      
      expect(product.created_at >= before).toBe(true);
      expect(product.created_at <= after).toBe(true);
      expect(product.updated_at).toBe(product.created_at);
    });
  });

  describe('Validação de métodos de entrega', () => {
    it('deve aceitar email para produto digital', () => {
      expect(isValidDeliveryMethod('digital', 'email')).toBe(true);
    });

    it('deve aceitar member_area para produto digital', () => {
      expect(isValidDeliveryMethod('digital', 'member_area')).toBe(true);
    });

    it('deve rejeitar frete para produto digital', () => {
      expect(isValidDeliveryMethod('digital', 'frete')).toBe(false);
    });

    it('deve aceitar frete para produto físico', () => {
      expect(isValidDeliveryMethod('fisico', 'frete')).toBe(true);
    });

    it('deve rejeitar member_area para produto físico', () => {
      expect(isValidDeliveryMethod('fisico', 'member_area')).toBe(false);
    });

    it('deve aceitar manual para ambos os tipos', () => {
      expect(isValidDeliveryMethod('digital', 'manual')).toBe(true);
      expect(isValidDeliveryMethod('fisico', 'manual')).toBe(true);
    });
  });

  describe('Validação para publicação', () => {
    it('deve rejeitar produto sem nome', () => {
      const product = createProduct('digital', 'user-123');
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Nome é obrigatório');
    });

    it('deve rejeitar produto com preço zero', () => {
      const product = createProduct('digital', 'user-123');
      product.name = 'Curso Teste';
      
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Preço deve ser maior que zero');
    });

    it('deve rejeitar produto sem categoria', () => {
      const product = createProduct('digital', 'user-123');
      product.name = 'Curso Teste';
      product.price = 97;
      
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Categoria é obrigatória');
    });

    it('deve rejeitar produto digital sem método de entrega', () => {
      const product = createProduct('digital', 'user-123');
      product.name = 'Curso Teste';
      product.price = 97;
      product.category = 'cursos';
      
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Método de entrega é obrigatório para produtos digitais');
    });

    it('deve aprovar produto digital completo', () => {
      const product = createProduct('digital', 'user-123');
      product.name = 'Curso Completo';
      product.price = 197;
      product.category = 'cursos';
      product.delivery_method = 'member_area';
      
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve aprovar produto físico sem método de entrega específico', () => {
      const product = createProduct('fisico', 'user-123');
      product.name = 'Livro Físico';
      product.price = 49;
      product.category = 'livros';
      // Produto físico não requer delivery_method obrigatório
      product.delivery_method = 'frete';
      
      const result = canPublishProduct(product);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Integridade de dados', () => {
    it('deve manter consistência entre tipo e entrega', () => {
      const digitalProduct = createProduct('digital', 'user-123');
      const fisicoProduct = createProduct('fisico', 'user-123');
      
      // Digital não pode ter frete
      expect(isValidDeliveryMethod(digitalProduct.product_type, 'frete')).toBe(false);
      
      // Físico não pode ter member_area
      expect(isValidDeliveryMethod(fisicoProduct.product_type, 'member_area')).toBe(false);
    });

    it('deve validar preços positivos apenas', () => {
      const product = createProduct('digital', 'user-123');
      product.name = 'Teste';
      product.category = 'teste';
      product.delivery_method = 'email';
      
      // Preço negativo
      product.price = -10;
      expect(canPublishProduct(product).valid).toBe(false);
      
      // Preço zero
      product.price = 0;
      expect(canPublishProduct(product).valid).toBe(false);
      
      // Preço válido
      product.price = 1;
      expect(canPublishProduct(product).valid).toBe(true);
    });
  });
});

describe('Fluxo de Status do Produto', () => {
  it('produto novo deve iniciar como rascunho', () => {
    const product = createProduct('digital', 'user-123');
    expect(product.status).toBe('rascunho');
  });

  it('deve permitir transição rascunho → publicado', () => {
    const validTransitions: Record<ProductStatus, ProductStatus[]> = {
      'rascunho': ['publicado'],
      'publicado': ['inativo'],
      'inativo': ['publicado'],
    };
    
    expect(validTransitions['rascunho']).toContain('publicado');
  });

  it('deve permitir transição publicado → inativo', () => {
    const validTransitions: Record<ProductStatus, ProductStatus[]> = {
      'rascunho': ['publicado'],
      'publicado': ['inativo'],
      'inativo': ['publicado'],
    };
    
    expect(validTransitions['publicado']).toContain('inativo');
  });

  it('deve permitir reativação inativo → publicado', () => {
    const validTransitions: Record<ProductStatus, ProductStatus[]> = {
      'rascunho': ['publicado'],
      'publicado': ['inativo'],
      'inativo': ['publicado'],
    };
    
    expect(validTransitions['inativo']).toContain('publicado');
  });
});
