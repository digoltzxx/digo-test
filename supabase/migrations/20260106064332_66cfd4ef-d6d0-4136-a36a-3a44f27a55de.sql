-- Tabela de Cursos (para área de membros)
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id)
);

-- Tabela de Módulos/Turmas
CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Aulas
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'video',
  content_url TEXT,
  duration_minutes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Matrículas (vincula aluno ao curso/produto)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id),
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  access_revoked_at TIMESTAMP WITH TIME ZONE,
  revoke_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Tabela de Progresso do Aluno
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courses
CREATE POLICY "Sellers can manage their courses" ON public.courses
  FOR ALL USING (auth.uid() = seller_user_id);

CREATE POLICY "Public can view active courses" ON public.courses
  FOR SELECT USING (status = 'active');

-- RLS Policies for course_modules
CREATE POLICY "Sellers can manage modules" ON public.course_modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = course_modules.course_id AND courses.seller_user_id = auth.uid())
  );

CREATE POLICY "Enrolled students can view modules" ON public.course_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e 
      JOIN public.students s ON e.student_id = s.id 
      WHERE e.course_id = course_modules.course_id 
      AND e.status = 'active'
    )
  );

-- RLS Policies for lessons
CREATE POLICY "Sellers can manage lessons" ON public.lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.course_modules m 
      JOIN public.courses c ON m.course_id = c.id 
      WHERE m.id = lessons.module_id AND c.seller_user_id = auth.uid()
    )
  );

CREATE POLICY "Enrolled students can view lessons" ON public.lessons
  FOR SELECT USING (
    is_free = true OR
    EXISTS (
      SELECT 1 FROM public.enrollments e 
      JOIN public.courses c ON e.course_id = c.id
      JOIN public.course_modules m ON m.course_id = c.id
      WHERE m.id = lessons.module_id AND e.status = 'active'
    )
  );

-- RLS Policies for enrollments
CREATE POLICY "Sellers can view enrollments" ON public.enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = enrollments.course_id AND courses.seller_user_id = auth.uid())
  );

CREATE POLICY "Sellers can manage enrollments" ON public.enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = enrollments.course_id AND courses.seller_user_id = auth.uid())
  );

-- RLS Policies for lesson_progress
CREATE POLICY "Students can manage their progress" ON public.lesson_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.students WHERE students.id = lesson_progress.student_id)
  );

CREATE POLICY "Sellers can view progress" ON public.lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e 
      JOIN public.courses c ON e.course_id = c.id 
      WHERE e.id = lesson_progress.enrollment_id AND c.seller_user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_modules_updated_at BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create enrollment after payment
CREATE OR REPLACE FUNCTION public.create_enrollment_after_payment(
  p_sale_id UUID,
  p_student_email TEXT,
  p_student_name TEXT,
  p_product_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student_id UUID;
  v_course_id UUID;
  v_enrollment_id UUID;
  v_seller_id UUID;
BEGIN
  -- Get seller and course info
  SELECT p.user_id, c.id INTO v_seller_id, v_course_id
  FROM products p
  LEFT JOIN courses c ON c.product_id = p.id
  WHERE p.id = p_product_id;

  -- If no course exists, return null
  IF v_course_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find or create student
  SELECT id INTO v_student_id FROM students 
  WHERE email = p_student_email AND product_id = p_product_id;
  
  IF v_student_id IS NULL THEN
    INSERT INTO students (email, name, product_id, seller_user_id, status)
    VALUES (p_student_email, p_student_name, p_product_id, v_seller_id, 'active')
    RETURNING id INTO v_student_id;
  END IF;

  -- Create enrollment
  INSERT INTO enrollments (student_id, course_id, product_id, sale_id, status)
  VALUES (v_student_id, v_course_id, p_product_id, p_sale_id, 'active')
  ON CONFLICT (student_id, course_id) DO UPDATE SET
    status = 'active',
    access_revoked_at = NULL,
    revoke_reason = NULL,
    updated_at = now()
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;

-- Function to revoke enrollment on refund/chargeback
CREATE OR REPLACE FUNCTION public.revoke_enrollment(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE enrollments
  SET 
    status = 'revoked',
    access_revoked_at = now(),
    revoke_reason = p_reason,
    updated_at = now()
  WHERE sale_id = p_sale_id;
  
  -- Also update student status
  UPDATE students s
  SET status = 'inactive', updated_at = now()
  FROM enrollments e
  WHERE e.sale_id = p_sale_id AND e.student_id = s.id;
END;
$$;