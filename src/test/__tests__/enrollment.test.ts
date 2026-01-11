import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Testes de Matrícula e Área de Membros
 * 
 * Valida:
 * - Criação de alunos
 * - Criação de matrículas
 * - Vinculação produto → curso
 * - Controle de acesso baseado em pagamento
 */

// Tipos e interfaces
interface Student {
  id: string;
  email: string;
  name: string;
  product_id: string;
  seller_user_id: string;
  status: 'active' | 'inactive';
  created_at: string;
}

interface Course {
  id: string;
  product_id: string;
  seller_user_id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  product_id: string;
  sale_id: string | null;
  status: 'active' | 'revoked' | 'expired';
  enrolled_at: string;
  access_revoked_at: string | null;
  revoke_reason: string | null;
}

// Mock de banco de dados em memória
let students: Student[] = [];
let courses: Course[] = [];
let enrollments: Enrollment[] = [];

// Função para criar aluno
function createStudent(
  email: string, 
  name: string, 
  productId: string, 
  sellerId: string
): Student {
  // Verifica se aluno já existe para esse produto
  const existing = students.find(s => s.email === email && s.product_id === productId);
  if (existing) {
    return existing;
  }
  
  const student: Student = {
    id: `student-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    email,
    name,
    product_id: productId,
    seller_user_id: sellerId,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  
  students.push(student);
  return student;
}

// Função para criar ou obter curso
function ensureCourse(productId: string, sellerId: string, courseName: string): Course {
  const existing = courses.find(c => c.product_id === productId);
  if (existing) {
    return existing;
  }
  
  const course: Course = {
    id: `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    product_id: productId,
    seller_user_id: sellerId,
    name: courseName,
    status: 'active',
  };
  
  courses.push(course);
  return course;
}

// Função para criar matrícula
function createEnrollment(
  studentId: string,
  courseId: string,
  productId: string,
  saleId: string
): Enrollment {
  // Verifica idempotência - não duplicar matrícula
  const existing = enrollments.find(
    e => e.student_id === studentId && e.course_id === courseId
  );
  
  if (existing) {
    // Reativar se estava revogada
    if (existing.status === 'revoked') {
      existing.status = 'active';
      existing.access_revoked_at = null;
      existing.revoke_reason = null;
      existing.sale_id = saleId;
    }
    return existing;
  }
  
  const enrollment: Enrollment = {
    id: `enrollment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    student_id: studentId,
    course_id: courseId,
    product_id: productId,
    sale_id: saleId,
    status: 'active',
    enrolled_at: new Date().toISOString(),
    access_revoked_at: null,
    revoke_reason: null,
  };
  
  enrollments.push(enrollment);
  return enrollment;
}

// Função para revogar acesso
function revokeEnrollment(saleId: string, reason: string): boolean {
  const enrollment = enrollments.find(e => e.sale_id === saleId);
  if (!enrollment) return false;
  
  enrollment.status = 'revoked';
  enrollment.access_revoked_at = new Date().toISOString();
  enrollment.revoke_reason = reason;
  
  // Também inativar o aluno
  const student = students.find(s => s.id === enrollment.student_id);
  if (student) {
    student.status = 'inactive';
  }
  
  return true;
}

// Verifica se aluno tem acesso ao curso
function hasAccess(studentEmail: string, productId: string): boolean {
  const student = students.find(
    s => s.email === studentEmail && s.product_id === productId && s.status === 'active'
  );
  
  if (!student) return false;
  
  const enrollment = enrollments.find(
    e => e.student_id === student.id && e.product_id === productId && e.status === 'active'
  );
  
  return !!enrollment;
}

// Fluxo completo após pagamento aprovado
function processApprovedPayment(
  saleId: string,
  buyerEmail: string,
  buyerName: string,
  productId: string,
  sellerId: string,
  productName: string,
  hasDeliveryMemberArea: boolean
): { success: boolean; enrollmentId?: string } {
  if (!hasDeliveryMemberArea) {
    return { success: true }; // Produto não tem área de membros
  }
  
  // 1. Garantir que curso existe
  const course = ensureCourse(productId, sellerId, productName);
  
  // 2. Criar ou obter aluno
  const student = createStudent(buyerEmail, buyerName, productId, sellerId);
  
  // 3. Criar matrícula
  const enrollment = createEnrollment(student.id, course.id, productId, saleId);
  
  return { success: true, enrollmentId: enrollment.id };
}

// Reset do banco entre testes
beforeEach(() => {
  students = [];
  courses = [];
  enrollments = [];
});

describe('Criação de Alunos', () => {
  it('deve criar aluno com dados corretos', () => {
    const student = createStudent('joao@email.com', 'João Silva', 'prod-1', 'seller-1');
    
    expect(student.id).toBeTruthy();
    expect(student.email).toBe('joao@email.com');
    expect(student.name).toBe('João Silva');
    expect(student.product_id).toBe('prod-1');
    expect(student.seller_user_id).toBe('seller-1');
    expect(student.status).toBe('active');
  });

  it('não deve duplicar aluno para mesmo email e produto', () => {
    const student1 = createStudent('joao@email.com', 'João Silva', 'prod-1', 'seller-1');
    const student2 = createStudent('joao@email.com', 'João Silva', 'prod-1', 'seller-1');
    
    expect(student1.id).toBe(student2.id);
    expect(students.length).toBe(1);
  });

  it('deve permitir mesmo email em produtos diferentes', () => {
    const student1 = createStudent('joao@email.com', 'João Silva', 'prod-1', 'seller-1');
    const student2 = createStudent('joao@email.com', 'João Silva', 'prod-2', 'seller-1');
    
    expect(student1.id).not.toBe(student2.id);
    expect(students.length).toBe(2);
  });
});

describe('Vinculação Produto → Curso', () => {
  it('deve criar curso para produto', () => {
    const course = ensureCourse('prod-1', 'seller-1', 'Curso de Marketing');
    
    expect(course.id).toBeTruthy();
    expect(course.product_id).toBe('prod-1');
    expect(course.name).toBe('Curso de Marketing');
    expect(course.status).toBe('active');
  });

  it('não deve duplicar curso para mesmo produto', () => {
    const course1 = ensureCourse('prod-1', 'seller-1', 'Curso de Marketing');
    const course2 = ensureCourse('prod-1', 'seller-1', 'Outro Nome');
    
    expect(course1.id).toBe(course2.id);
    expect(courses.length).toBe(1);
  });

  it('deve permitir cursos diferentes para produtos diferentes', () => {
    const course1 = ensureCourse('prod-1', 'seller-1', 'Curso 1');
    const course2 = ensureCourse('prod-2', 'seller-1', 'Curso 2');
    
    expect(course1.id).not.toBe(course2.id);
    expect(courses.length).toBe(2);
  });
});

describe('Criação de Matrículas', () => {
  it('deve criar matrícula corretamente', () => {
    const course = ensureCourse('prod-1', 'seller-1', 'Curso');
    const student = createStudent('aluno@email.com', 'Aluno Teste', 'prod-1', 'seller-1');
    
    const enrollment = createEnrollment(student.id, course.id, 'prod-1', 'sale-1');
    
    expect(enrollment.id).toBeTruthy();
    expect(enrollment.student_id).toBe(student.id);
    expect(enrollment.course_id).toBe(course.id);
    expect(enrollment.sale_id).toBe('sale-1');
    expect(enrollment.status).toBe('active');
  });

  it('não deve duplicar matrícula existente', () => {
    const course = ensureCourse('prod-1', 'seller-1', 'Curso');
    const student = createStudent('aluno@email.com', 'Aluno Teste', 'prod-1', 'seller-1');
    
    const enrollment1 = createEnrollment(student.id, course.id, 'prod-1', 'sale-1');
    const enrollment2 = createEnrollment(student.id, course.id, 'prod-1', 'sale-2');
    
    expect(enrollment1.id).toBe(enrollment2.id);
    expect(enrollments.length).toBe(1);
  });

  it('deve reativar matrícula revogada', () => {
    const course = ensureCourse('prod-1', 'seller-1', 'Curso');
    const student = createStudent('aluno@email.com', 'Aluno Teste', 'prod-1', 'seller-1');
    
    const enrollment = createEnrollment(student.id, course.id, 'prod-1', 'sale-1');
    revokeEnrollment('sale-1', 'Reembolso');
    
    expect(enrollment.status).toBe('revoked');
    
    // Reativar com nova compra
    const reactivated = createEnrollment(student.id, course.id, 'prod-1', 'sale-2');
    
    expect(reactivated.status).toBe('active');
    expect(reactivated.sale_id).toBe('sale-2');
  });
});

describe('Controle de Acesso Baseado em Pagamento', () => {
  it('deve conceder acesso após pagamento aprovado', () => {
    const result = processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Curso Completo',
      true // tem área de membros
    );
    
    expect(result.success).toBe(true);
    expect(result.enrollmentId).toBeTruthy();
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(true);
  });

  it('não deve criar matrícula para produto sem área de membros', () => {
    const result = processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Produto Digital',
      false // não tem área de membros
    );
    
    expect(result.success).toBe(true);
    expect(result.enrollmentId).toBeUndefined();
    expect(enrollments.length).toBe(0);
  });

  it('deve revogar acesso após reembolso', () => {
    // Pagamento aprovado
    processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Curso',
      true
    );
    
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(true);
    
    // Reembolso
    revokeEnrollment('sale-1', 'Reembolso solicitado');
    
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(false);
  });

  it('deve revogar acesso após chargeback', () => {
    processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Curso',
      true
    );
    
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(true);
    
    revokeEnrollment('sale-1', 'Chargeback detectado');
    
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(false);
    
    const enrollment = enrollments.find(e => e.sale_id === 'sale-1');
    expect(enrollment?.status).toBe('revoked');
    expect(enrollment?.revoke_reason).toBe('Chargeback detectado');
  });

  it('deve registrar data de revogação', () => {
    processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Curso',
      true
    );
    
    const before = new Date().toISOString();
    revokeEnrollment('sale-1', 'Reembolso');
    const after = new Date().toISOString();
    
    const enrollment = enrollments.find(e => e.sale_id === 'sale-1');
    expect(enrollment?.access_revoked_at).toBeTruthy();
    expect(enrollment!.access_revoked_at! >= before).toBe(true);
    expect(enrollment!.access_revoked_at! <= after).toBe(true);
  });
});

describe('Regras Críticas de Segurança', () => {
  it('nunca deve liberar acesso sem pagamento aprovado', () => {
    // Sem processar pagamento
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(false);
  });

  it('nunca deve manter acesso após cancelamento', () => {
    processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno Teste',
      'prod-1',
      'seller-1',
      'Curso',
      true
    );
    
    revokeEnrollment('sale-1', 'Cancelamento');
    
    expect(hasAccess('aluno@email.com', 'prod-1')).toBe(false);
    
    const student = students.find(s => s.email === 'aluno@email.com');
    expect(student?.status).toBe('inactive');
  });

  it('produto físico não deve criar matrícula', () => {
    processApprovedPayment(
      'sale-1',
      'comprador@email.com',
      'Comprador',
      'prod-fisico',
      'seller-1',
      'Livro Físico',
      false // produto físico não tem área de membros
    );
    
    expect(enrollments.length).toBe(0);
    expect(students.length).toBe(0);
  });

  it('deve manter integridade referencial', () => {
    processApprovedPayment(
      'sale-1',
      'aluno@email.com',
      'Aluno',
      'prod-1',
      'seller-1',
      'Curso',
      true
    );
    
    const enrollment = enrollments[0];
    const student = students.find(s => s.id === enrollment.student_id);
    const course = courses.find(c => c.id === enrollment.course_id);
    
    expect(student).toBeTruthy();
    expect(course).toBeTruthy();
    expect(enrollment.product_id).toBe(course?.product_id);
  });
});

describe('Idempotência', () => {
  it('deve evitar duplicação de matrícula em webhook duplicado', () => {
    // Simula webhook duplicado
    processApprovedPayment('sale-1', 'aluno@email.com', 'Aluno', 'prod-1', 'seller-1', 'Curso', true);
    processApprovedPayment('sale-1', 'aluno@email.com', 'Aluno', 'prod-1', 'seller-1', 'Curso', true);
    processApprovedPayment('sale-1', 'aluno@email.com', 'Aluno', 'prod-1', 'seller-1', 'Curso', true);
    
    expect(enrollments.length).toBe(1);
    expect(students.length).toBe(1);
    expect(courses.length).toBe(1);
  });

  it('deve evitar duplicação de aluno', () => {
    createStudent('joao@email.com', 'João', 'prod-1', 'seller-1');
    createStudent('joao@email.com', 'João Silva', 'prod-1', 'seller-1');
    createStudent('joao@email.com', 'João da Silva', 'prod-1', 'seller-1');
    
    expect(students.length).toBe(1);
  });
});
