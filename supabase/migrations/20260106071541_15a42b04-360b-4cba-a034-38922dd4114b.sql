-- Create turmas (classes) table
CREATE TABLE public.turmas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_students INTEGER,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add turma reference to enrollments
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL;

-- Create member_area_settings table
CREATE TABLE public.member_area_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  area_name TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  custom_domain TEXT,
  welcome_message TEXT,
  access_duration_days INTEGER DEFAULT 0,
  allow_free_lessons BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT false,
  send_welcome_email BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add blocked status to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Enable RLS on new tables
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_area_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for turmas
CREATE POLICY "Sellers can manage turmas" ON public.turmas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM courses 
      WHERE courses.id = turmas.course_id 
      AND courses.seller_user_id = auth.uid()
    )
  );

CREATE POLICY "Enrolled students can view turmas" ON public.turmas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.id = turmas.course_id
      AND e.status = 'active'
    )
  );

-- RLS policies for member_area_settings
CREATE POLICY "Product owners can manage settings" ON public.member_area_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = member_area_settings.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active settings" ON public.member_area_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = member_area_settings.product_id 
      AND products.status = 'active'
    )
  );

-- Function to get student stats
CREATE OR REPLACE FUNCTION get_member_area_stats(p_product_id UUID)
RETURNS TABLE (
  total_students BIGINT,
  active_students BIGINT,
  blocked_students BIGINT,
  total_enrollments BIGINT,
  active_enrollments BIGINT,
  total_modules BIGINT,
  total_lessons BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM students WHERE product_id = p_product_id)::BIGINT as total_students,
    (SELECT COUNT(*) FROM students WHERE product_id = p_product_id AND status = 'active' AND (is_blocked IS NULL OR is_blocked = false))::BIGINT as active_students,
    (SELECT COUNT(*) FROM students WHERE product_id = p_product_id AND is_blocked = true)::BIGINT as blocked_students,
    (SELECT COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_enrollments,
    (SELECT COUNT(*) FROM enrollments e JOIN courses c ON e.course_id = c.id WHERE c.product_id = p_product_id AND e.status = 'active')::BIGINT as active_enrollments,
    (SELECT COUNT(*) FROM course_modules m JOIN courses c ON m.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_modules,
    (SELECT COUNT(*) FROM lessons l JOIN course_modules m ON l.module_id = m.id JOIN courses c ON m.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_lessons;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;