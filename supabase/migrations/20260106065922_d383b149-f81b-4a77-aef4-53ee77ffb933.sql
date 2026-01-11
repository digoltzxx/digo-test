-- Create admin_audit_logs table for tracking all system actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- System can insert audit logs (via service role)
CREATE POLICY "System can insert audit logs" 
ON public.admin_audit_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_action_type ON public.admin_audit_logs (action_type);
CREATE INDEX idx_admin_audit_logs_entity_type ON public.admin_audit_logs (entity_type);

-- Add blocked status to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_blocked'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_blocked BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN blocked_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.profiles ADD COLUMN blocked_reason TEXT;
  END IF;
END $$;

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_user_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_logs (user_id, action_type, entity_type, entity_id, details)
  VALUES (p_user_id, p_action_type, p_entity_type, p_entity_id, p_details)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Create function to get admin emails for notifications
CREATE OR REPLACE FUNCTION public.get_admin_emails()
RETURNS TABLE(email TEXT, user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email::TEXT, ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'admin'
  AND p.email IS NOT NULL;
$$;

-- Create function to check if user is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_blocked, false)
  FROM public.profiles
  WHERE user_id = p_user_id;
$$;