import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes E2E (End-to-End) - Fluxos Completos
 * 
 * Simula cenários reais de usuário:
 * - Criação de produto → Pagamento → Área de membros
 * - Reembolso e revogação de acesso
 * - Validação de integridade de dados
 */

// ============= TIPOS =============

interface Product {
  id: string;
  user_id: string;
  product_type: 'digital' | 'fisico';
  name: string;
  price: number;
  category: string;
  status: 'rascunho' | 'publicado';
  delivery_method: string | null;
}

interface Sale {
  id: string;
  product_id: string;
  seller_user_id: string;
  buyer_email: string;
  buyer_name: string;
  amount: number;
  status: 'pending' | 'approved' | 'refused' | 'refunded' | 'chargeback';
  payment_method: string;
}

interface Course {
  id: string;
  product_id: string;
  seller_user_id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface Student {
  id: string;
  email: string;
  name: string;
  product_id: string;
  seller_user_id: string;
  status: 'active' | 'inactive';
}

interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  product_id: string;
  sale_id: string;
  status: 'active' | 'revoked';
  revoke_reason: string | null;
}

// ============= BANCO SIMULADO =============

let products: Product[] = [];
let sales: Sale[] = [];
let courses: Course[] = [];
let students: Student[] = [];
let enrollments: Enrollment[] = [];

function resetDatabase() {
  products = [];
  sales = [];
  courses = [];
  students = [];
  enrollments = [];
}

// ============= SERVIÇOS SIMULADOS =============

// Criar produto instantaneamente
function createProduct(type: 'digital' | 'fisico', userId: string): Product {
  const product: Product = {
    id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    user_id: userId,
    product_type: type,
    name: '',
    price: 0,
    category: '',
    status: 'rascunho',
    delivery_method: null,
  };
  products.push(product);
  return product;
}

// Atualizar produto
function updateProduct(productId: string, updates: Partial<Product>): Product | null {
  const product = products.find(p => p.id === productId);
  if (!product) return null;
  Object.assign(product, updates);
  return product;
}

// Criar venda
function createSale(
  productId: string,
  buyerEmail: string,
  buyerName: string,
  paymentMethod: string
): Sale | null {
  const product = products.find(p => p.id === productId);
  if (!product || product.status !== 'publicado') return null;

  const sale: Sale = {
    id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    product_id: productId,
    seller_user_id: product.user_id,
    buyer_email: buyerEmail,
    buyer_name: buyerName,
    amount: product.price,
    status: 'pending',
    payment_method: paymentMethod,
  };
  sales.push(sale);
  return sale;
}

// Processar pagamento (simula webhook)
function processPaymentWebhook(saleId: string, newStatus: Sale['status']): boolean {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) return false;

  const oldStatus = sale.status;
  sale.status = newStatus;

  // Se aprovado, processar matrícula
  if (newStatus === 'approved') {
    const product = products.find(p => p.id === sale.product_id);
    if (product?.delivery_method === 'member_area') {
      createEnrollmentForSale(sale, product);
    }
  }

  // Se reembolso ou chargeback, revogar acesso
  if (newStatus === 'refunded' || newStatus === 'chargeback') {
    revokeEnrollmentForSale(saleId, newStatus === 'refunded' ? 'Reembolso' : 'Chargeback');
  }

  return true;
}

// Criar matrícula após pagamento
function createEnrollmentForSale(sale: Sale, product: Product): Enrollment | null {
  // Garantir curso existe
  let course = courses.find(c => c.product_id === product.id);
  if (!course) {
    course = {
      id: `course-${Date.now()}`,
      product_id: product.id,
      seller_user_id: product.user_id,
      name: product.name,
      status: 'active',
    };
    courses.push(course);
  }

  // Criar ou obter aluno
  let student = students.find(s => s.email === sale.buyer_email && s.product_id === product.id);
  if (!student) {
    student = {
      id: `student-${Date.now()}`,
      email: sale.buyer_email,
      name: sale.buyer_name,
      product_id: product.id,
      seller_user_id: product.user_id,
      status: 'active',
    };
    students.push(student);
  }

  // Verificar idempotência
  const existingEnrollment = enrollments.find(
    e => e.student_id === student!.id && e.course_id === course!.id
  );
  if (existingEnrollment) {
    existingEnrollment.status = 'active';
    existingEnrollment.revoke_reason = null;
    return existingEnrollment;
  }

  // Criar matrícula
  const enrollment: Enrollment = {
    id: `enroll-${Date.now()}`,
    student_id: student.id,
    course_id: course.id,
    product_id: product.id,
    sale_id: sale.id,
    status: 'active',
    revoke_reason: null,
  };
  enrollments.push(enrollment);
  return enrollment;
}

// Revogar acesso
function revokeEnrollmentForSale(saleId: string, reason: string): boolean {
  const enrollment = enrollments.find(e => e.sale_id === saleId);
  if (!enrollment) return false;

  enrollment.status = 'revoked';
  enrollment.revoke_reason = reason;

  const student = students.find(s => s.id === enrollment.student_id);
  if (student) {
    student.status = 'inactive';
  }

  return true;
}

// Verificar acesso do aluno
function studentHasAccess(email: string, productId: string): boolean {
  const student = students.find(
    s => s.email === email && s.product_id === productId && s.status === 'active'
  );
  if (!student) return false;

  const enrollment = enrollments.find(
    e => e.student_id === student.id && e.product_id === productId && e.status === 'active'
  );
  return !!enrollment;
}

// ============= TESTES =============

beforeEach(() => {
  resetDatabase();
});

describe('Cenário 1: Produto Digital + Área de Membros', () => {
  it('fluxo completo: criar produto → publicar → venda → matrícula', async () => {
    // 1. Criar produto digital
    const product = createProduct('digital', 'seller-1');
    expect(product.id).toBeTruthy();
    expect(product.status).toBe('rascunho');
    expect(product.product_type).toBe('digital');

    // 2. Configurar produto
    updateProduct(product.id, {
      name: 'Curso de Marketing',
      price: 297,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const updatedProduct = products.find(p => p.id === product.id)!;
    expect(updatedProduct.status).toBe('publicado');
    expect(updatedProduct.delivery_method).toBe('member_area');

    // 3. Simular venda
    const sale = createSale(
      product.id,
      'aluno@email.com',
      'João Silva',
      'pix'
    );
    expect(sale).not.toBeNull();
    expect(sale!.status).toBe('pending');

    // 4. Pagamento aprovado
    processPaymentWebhook(sale!.id, 'approved');

    // Verificações
    const finalSale = sales.find(s => s.id === sale!.id)!;
    expect(finalSale.status).toBe('approved');

    // 5. Verificar aluno criado
    expect(students.length).toBe(1);
    const student = students[0];
    expect(student.email).toBe('aluno@email.com');
    expect(student.status).toBe('active');

    // 6. Verificar matrícula criada
    expect(enrollments.length).toBe(1);
    const enrollment = enrollments[0];
    expect(enrollment.status).toBe('active');
    expect(enrollment.sale_id).toBe(sale!.id);

    // 7. Verificar curso criado
    expect(courses.length).toBe(1);
    const course = courses[0];
    expect(course.product_id).toBe(product.id);

    // 8. Verificar acesso
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(true);
  });

  it('não deve criar matrícula para pagamento pendente', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 97,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');
    
    // Pagamento ainda pendente - não processa webhook de aprovação
    expect(sale!.status).toBe('pending');
    expect(enrollments.length).toBe(0);
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(false);
  });

  it('não deve criar matrícula para produto sem área de membros', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'E-book',
      price: 47,
      category: 'ebooks',
      delivery_method: 'email', // Não é member_area
      status: 'publicado',
    });

    const sale = createSale(product.id, 'comprador@email.com', 'Comprador', 'pix');
    processPaymentWebhook(sale!.id, 'approved');

    expect(enrollments.length).toBe(0);
    expect(students.length).toBe(0);
  });
});

describe('Cenário 2: Reembolso', () => {
  it('deve revogar acesso após reembolso', () => {
    // Setup: produto com área de membros
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 297,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'credit_card');
    
    // Pagamento aprovado
    processPaymentWebhook(sale!.id, 'approved');
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(true);

    // Reembolso
    processPaymentWebhook(sale!.id, 'refunded');

    // Verificações
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(false);
    
    const enrollment = enrollments[0];
    expect(enrollment.status).toBe('revoked');
    expect(enrollment.revoke_reason).toBe('Reembolso');

    const student = students[0];
    expect(student.status).toBe('inactive');
  });

  it('deve manter registro de matrícula revogada', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 297,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');
    processPaymentWebhook(sale!.id, 'approved');
    processPaymentWebhook(sale!.id, 'refunded');

    // Matrícula deve existir mas estar revogada
    expect(enrollments.length).toBe(1);
    expect(enrollments[0].status).toBe('revoked');
    expect(enrollments[0].sale_id).toBe(sale!.id);
  });
});

describe('Cenário 3: Chargeback', () => {
  it('deve revogar acesso imediatamente após chargeback', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso Premium',
      price: 997,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'fraudador@email.com', 'Fraudador', 'credit_card');
    processPaymentWebhook(sale!.id, 'approved');
    
    expect(studentHasAccess('fraudador@email.com', product.id)).toBe(true);

    // Chargeback!
    processPaymentWebhook(sale!.id, 'chargeback');

    expect(studentHasAccess('fraudador@email.com', product.id)).toBe(false);
    expect(enrollments[0].revoke_reason).toBe('Chargeback');
  });
});

describe('Cenário 4: Produto Físico', () => {
  it('não deve criar aluno ou matrícula para produto físico', () => {
    const product = createProduct('fisico', 'seller-1');
    updateProduct(product.id, {
      name: 'Livro Impresso',
      price: 79,
      category: 'livros',
      delivery_method: 'frete',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'comprador@email.com', 'Comprador', 'pix');
    processPaymentWebhook(sale!.id, 'approved');

    // Venda aprovada mas sem área de membros
    expect(sales[0].status).toBe('approved');
    expect(students.length).toBe(0);
    expect(enrollments.length).toBe(0);
    expect(courses.length).toBe(0);
  });
});

describe('Validações de Integridade', () => {
  it('deve manter integridade referencial entre tabelas', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso Completo',
      price: 497,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno Teste', 'pix');
    processPaymentWebhook(sale!.id, 'approved');

    // Verificar relacionamentos
    const enrollment = enrollments[0];
    const student = students.find(s => s.id === enrollment.student_id);
    const course = courses.find(c => c.id === enrollment.course_id);
    const productRef = products.find(p => p.id === enrollment.product_id);

    expect(student).toBeTruthy();
    expect(course).toBeTruthy();
    expect(productRef).toBeTruthy();
    expect(course!.product_id).toBe(productRef!.id);
    expect(student!.product_id).toBe(productRef!.id);
  });

  it('não deve permitir venda de produto em rascunho', () => {
    const product = createProduct('digital', 'seller-1');
    // Produto permanece em rascunho

    const sale = createSale(product.id, 'comprador@email.com', 'Comprador', 'pix');
    expect(sale).toBeNull();
  });

  it('deve evitar duplicação em webhooks repetidos', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 197,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');

    // Simular múltiplos webhooks de aprovação
    processPaymentWebhook(sale!.id, 'approved');
    processPaymentWebhook(sale!.id, 'approved');
    processPaymentWebhook(sale!.id, 'approved');

    // Deve ter apenas um aluno e uma matrícula
    expect(students.length).toBe(1);
    expect(enrollments.length).toBe(1);
    expect(courses.length).toBe(1);
  });

  it('deve reativar matrícula se comprar novamente após reembolso', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 297,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    // Primeira compra
    const sale1 = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');
    processPaymentWebhook(sale1!.id, 'approved');
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(true);

    // Reembolso
    processPaymentWebhook(sale1!.id, 'refunded');
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(false);

    // Segunda compra (mesmo email)
    const sale2 = createSale(product.id, 'aluno@email.com', 'Aluno', 'credit_card');
    processPaymentWebhook(sale2!.id, 'approved');

    // Acesso deve ser restaurado
    expect(studentHasAccess('aluno@email.com', product.id)).toBe(true);
    expect(students.length).toBe(1); // Mesmo aluno
    expect(enrollments.length).toBe(1); // Matrícula reativada
  });
});

describe('Métricas e Logs', () => {
  it('todos os registros devem ter IDs únicos', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 97,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');
    processPaymentWebhook(sale!.id, 'approved');

    // Verificar unicidade de IDs
    const allIds = [
      ...products.map(p => p.id),
      ...sales.map(s => s.id),
      ...courses.map(c => c.id),
      ...students.map(s => s.id),
      ...enrollments.map(e => e.id),
    ];

    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('status devem ser valores válidos', () => {
    const product = createProduct('digital', 'seller-1');
    updateProduct(product.id, {
      name: 'Curso',
      price: 97,
      category: 'cursos',
      delivery_method: 'member_area',
      status: 'publicado',
    });

    const sale = createSale(product.id, 'aluno@email.com', 'Aluno', 'pix');
    processPaymentWebhook(sale!.id, 'approved');

    // Validar status
    expect(['rascunho', 'publicado']).toContain(product.status);
    expect(['pending', 'approved', 'refused', 'refunded', 'chargeback']).toContain(sale!.status);
    expect(['active', 'inactive']).toContain(students[0].status);
    expect(['active', 'revoked']).toContain(enrollments[0].status);
  });
});
