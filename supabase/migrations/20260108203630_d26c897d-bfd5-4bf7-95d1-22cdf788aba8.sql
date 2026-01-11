-- Remove the overly permissive checkout session policy
DROP POLICY IF EXISTS "Anyone can view checkout by id" ON public.checkout_sessions;