-- Add instructor role to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instructor';

-- Create instructor_permissions table for instructors
CREATE TABLE IF NOT EXISTS public.instructor_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.instructor_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for instructor_permissions
CREATE POLICY "Instructors can view their own permissions"
  ON public.instructor_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage instructor permissions"
  ON public.instructor_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to check if user is instructor for a product
CREATE OR REPLACE FUNCTION public.is_product_instructor(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses 
    WHERE product_id = p_product_id 
    AND seller_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM co_producers
    WHERE product_id = p_product_id
    AND user_id = p_user_id
    AND status = 'approved'
  )
$$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_instructor_permissions_user_id ON public.instructor_permissions(user_id);

-- Update students RLS to allow instructors to view students for their products
DROP POLICY IF EXISTS "Instructors can view students for their courses" ON public.students;
CREATE POLICY "Instructors can view students for their courses"
  ON public.students
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.product_id = students.product_id
      AND c.seller_user_id = auth.uid()
    )
  );

-- Update lesson_progress RLS to allow students to manage their own progress
DROP POLICY IF EXISTS "Students can manage their own progress" ON public.lesson_progress;
CREATE POLICY "Students can manage their own progress"
  ON public.lesson_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = lesson_progress.student_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s 
      WHERE s.id = lesson_progress.student_id
    )
  );

-- Create function to get student courses by email
CREATE OR REPLACE FUNCTION public.get_student_courses_by_email(p_email text)
RETURNS TABLE (
  course_id uuid,
  course_name text,
  enrollment_id uuid,
  enrollment_status text,
  total_lessons bigint,
  completed_lessons bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as course_id,
    c.name as course_name,
    e.id as enrollment_id,
    e.status as enrollment_status,
    (SELECT COUNT(*) FROM lessons l 
     JOIN course_modules m ON l.module_id = m.id 
     WHERE m.course_id = c.id AND l.is_active = true) as total_lessons,
    (SELECT COUNT(*) FROM lesson_progress lp 
     WHERE lp.enrollment_id = e.id AND lp.completed = true) as completed_lessons
  FROM enrollments e
  JOIN courses c ON e.course_id = c.id
  JOIN students s ON e.student_id = s.id
  WHERE s.email = p_email
  AND e.status = 'active';
END;
$$;