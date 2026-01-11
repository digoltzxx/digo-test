-- Fix function search path security issue
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
    (SELECT COUNT(*) FROM public.students WHERE product_id = p_product_id)::BIGINT as total_students,
    (SELECT COUNT(*) FROM public.students WHERE product_id = p_product_id AND status = 'active' AND (is_blocked IS NULL OR is_blocked = false))::BIGINT as active_students,
    (SELECT COUNT(*) FROM public.students WHERE product_id = p_product_id AND is_blocked = true)::BIGINT as blocked_students,
    (SELECT COUNT(*) FROM public.enrollments e JOIN public.courses c ON e.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_enrollments,
    (SELECT COUNT(*) FROM public.enrollments e JOIN public.courses c ON e.course_id = c.id WHERE c.product_id = p_product_id AND e.status = 'active')::BIGINT as active_enrollments,
    (SELECT COUNT(*) FROM public.course_modules m JOIN public.courses c ON m.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_modules,
    (SELECT COUNT(*) FROM public.lessons l JOIN public.course_modules m ON l.module_id = m.id JOIN public.courses c ON m.course_id = c.id WHERE c.product_id = p_product_id)::BIGINT as total_lessons;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;