-- Create subscription access logs table for audit
CREATE TABLE IF NOT EXISTS public.subscription_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  user_id UUID,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_access_logs ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all subscription access logs" 
ON public.subscription_access_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Sellers can see logs for their products
CREATE POLICY "Sellers can view logs for their product subscriptions" 
ON public.subscription_access_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.id = subscription_access_logs.subscription_id
    AND p.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscription_access_logs_subscription_id 
ON public.subscription_access_logs(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_access_logs_created_at 
ON public.subscription_access_logs(created_at DESC);

-- Function to log subscription access events
CREATE OR REPLACE FUNCTION public.log_subscription_access_event(
  p_subscription_id UUID,
  p_event_type TEXT,
  p_previous_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_user_id UUID;
BEGIN
  -- Get subscription details
  SELECT s.user_id INTO v_user_id
  FROM subscriptions s WHERE s.id = p_subscription_id;
  
  -- Try to find related student and enrollment
  SELECT st.id, e.id INTO v_student_id, v_enrollment_id
  FROM subscriptions sub
  JOIN products p ON sub.product_id = p.id
  LEFT JOIN students st ON st.product_id = p.id
  LEFT JOIN enrollments e ON e.student_id = st.id AND e.product_id = p.id
  WHERE sub.id = p_subscription_id
  LIMIT 1;
  
  INSERT INTO subscription_access_logs (
    subscription_id,
    student_id,
    enrollment_id,
    user_id,
    event_type,
    previous_status,
    new_status,
    reason,
    metadata
  )
  VALUES (
    p_subscription_id,
    v_student_id,
    v_enrollment_id,
    v_user_id,
    p_event_type,
    p_previous_status,
    p_new_status,
    p_reason,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to sync subscription status with enrollment access
CREATE OR REPLACE FUNCTION public.sync_subscription_enrollment_access(
  p_subscription_id UUID,
  p_action TEXT -- 'activate', 'suspend', 'revoke', 'expire'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription RECORD;
  v_course_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_previous_status TEXT;
  v_new_status TEXT;
  v_reason TEXT;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription
  FROM subscriptions WHERE id = p_subscription_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Subscription not found: %', p_subscription_id;
    RETURN FALSE;
  END IF;
  
  -- Get course for product
  SELECT id INTO v_course_id
  FROM courses WHERE product_id = v_subscription.product_id;
  
  IF v_course_id IS NULL THEN
    RAISE WARNING 'No course found for product: %', v_subscription.product_id;
    RETURN FALSE;
  END IF;
  
  -- Find student by email from profiles
  SELECT s.id INTO v_student_id
  FROM students s
  JOIN profiles p ON p.email = s.email
  WHERE p.user_id = v_subscription.user_id
  AND s.product_id = v_subscription.product_id
  LIMIT 1;
  
  -- If no student found by profile match, try to find by product
  IF v_student_id IS NULL THEN
    -- Get email from profile
    DECLARE
      v_email TEXT;
    BEGIN
      SELECT email INTO v_email FROM profiles WHERE user_id = v_subscription.user_id;
      SELECT id INTO v_student_id FROM students WHERE email = v_email AND product_id = v_subscription.product_id;
    END;
  END IF;
  
  IF v_student_id IS NULL THEN
    RAISE WARNING 'No student found for subscription: %', p_subscription_id;
    RETURN FALSE;
  END IF;
  
  -- Find enrollment
  SELECT id, status INTO v_enrollment_id, v_previous_status
  FROM enrollments
  WHERE student_id = v_student_id AND course_id = v_course_id;
  
  IF v_enrollment_id IS NULL THEN
    -- Create enrollment if action is activate
    IF p_action = 'activate' THEN
      INSERT INTO enrollments (student_id, course_id, product_id, status)
      VALUES (v_student_id, v_course_id, v_subscription.product_id, 'active')
      RETURNING id INTO v_enrollment_id;
      
      v_previous_status := NULL;
      v_new_status := 'active';
      v_reason := 'Assinatura ativada';
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    -- Update enrollment based on action
    CASE p_action
      WHEN 'activate' THEN
        v_new_status := 'active';
        v_reason := 'Pagamento de assinatura aprovado';
        UPDATE enrollments SET 
          status = 'active',
          access_revoked_at = NULL,
          revoke_reason = NULL,
          updated_at = now()
        WHERE id = v_enrollment_id;
        
      WHEN 'suspend' THEN
        v_new_status := 'suspended';
        v_reason := 'Pagamento de assinatura pendente';
        UPDATE enrollments SET 
          status = 'suspended',
          revoke_reason = v_reason,
          updated_at = now()
        WHERE id = v_enrollment_id;
        
      WHEN 'revoke' THEN
        v_new_status := 'revoked';
        v_reason := 'Assinatura cancelada';
        UPDATE enrollments SET 
          status = 'revoked',
          access_revoked_at = now(),
          revoke_reason = v_reason,
          updated_at = now()
        WHERE id = v_enrollment_id;
        
      WHEN 'expire' THEN
        v_new_status := 'expired';
        v_reason := 'Assinatura expirada';
        UPDATE enrollments SET 
          status = 'expired',
          access_revoked_at = now(),
          revoke_reason = v_reason,
          updated_at = now()
        WHERE id = v_enrollment_id;
    END CASE;
  END IF;
  
  -- Update student status if revoking/expiring
  IF p_action IN ('revoke', 'expire') THEN
    UPDATE students SET status = 'inactive', updated_at = now()
    WHERE id = v_student_id;
  ELSIF p_action = 'activate' THEN
    UPDATE students SET status = 'active', is_blocked = false, updated_at = now()
    WHERE id = v_student_id;
  END IF;
  
  -- Log the event
  PERFORM log_subscription_access_event(
    p_subscription_id,
    'enrollment_' || p_action,
    v_previous_status,
    v_new_status,
    v_reason,
    jsonb_build_object(
      'enrollment_id', v_enrollment_id,
      'student_id', v_student_id,
      'course_id', v_course_id
    )
  );
  
  RETURN TRUE;
END;
$$;

-- Function to handle subscription status changes
CREATE OR REPLACE FUNCTION public.handle_subscription_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Only proceed if status changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Log the status change
  PERFORM log_subscription_access_event(
    NEW.id,
    'status_change',
    OLD.status,
    NEW.status,
    CASE 
      WHEN NEW.status = 'active' THEN 'Pagamento aprovado'
      WHEN NEW.status = 'past_due' THEN 'Pagamento atrasado'
      WHEN NEW.status = 'canceled' THEN 'Assinatura cancelada'
      WHEN NEW.status = 'expired' THEN 'Assinatura expirada'
      ELSE 'Status alterado'
    END,
    jsonb_build_object(
      'cancel_at_period_end', NEW.cancel_at_period_end,
      'current_period_end', NEW.current_period_end
    )
  );
  
  -- Determine action based on new status
  CASE NEW.status
    WHEN 'active' THEN
      v_action := 'activate';
    WHEN 'past_due' THEN
      v_action := 'suspend';
    WHEN 'canceled' THEN
      -- Only revoke if period ended
      IF NEW.current_period_end <= now() THEN
        v_action := 'revoke';
      ELSE
        -- Access continues until period end
        RETURN NEW;
      END IF;
    WHEN 'expired' THEN
      v_action := 'expire';
    ELSE
      RETURN NEW;
  END CASE;
  
  -- Sync enrollment access
  PERFORM sync_subscription_enrollment_access(NEW.id, v_action);
  
  RETURN NEW;
END;
$$;

-- Create trigger for subscription status changes
DROP TRIGGER IF EXISTS subscription_status_change_trigger ON public.subscriptions;
CREATE TRIGGER subscription_status_change_trigger
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_subscription_status_change();

-- Function to check and expire subscriptions
CREATE OR REPLACE FUNCTION public.process_expired_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_subscription RECORD;
BEGIN
  -- Find subscriptions that need to be expired
  FOR v_subscription IN 
    SELECT id, status, current_period_end, cancel_at_period_end
    FROM subscriptions
    WHERE current_period_end < now()
    AND status IN ('active', 'past_due', 'canceled')
  LOOP
    -- Update subscription to expired
    UPDATE subscriptions 
    SET status = 'expired', updated_at = now()
    WHERE id = v_subscription.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Function to create enrollment for subscription
CREATE OR REPLACE FUNCTION public.create_enrollment_for_subscription(
  p_subscription_id UUID,
  p_student_email TEXT,
  p_student_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription RECORD;
  v_product RECORD;
  v_course_id UUID;
  v_student_id UUID;
  v_enrollment_id UUID;
  v_seller_id UUID;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription FROM subscriptions WHERE id = p_subscription_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
  
  -- Get product
  SELECT * INTO v_product FROM products WHERE id = v_subscription.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  v_seller_id := v_product.user_id;
  
  -- Get or create course
  SELECT id INTO v_course_id FROM courses WHERE product_id = v_product.id;
  IF v_course_id IS NULL THEN
    -- Create course if doesn't exist
    INSERT INTO courses (product_id, seller_user_id, name, status)
    VALUES (v_product.id, v_seller_id, v_product.name, 'active')
    RETURNING id INTO v_course_id;
    
    -- Create default module
    INSERT INTO course_modules (course_id, name, position)
    VALUES (v_course_id, 'Módulo 1', 0);
  END IF;
  
  -- Find or create student
  SELECT id INTO v_student_id FROM students 
  WHERE email = p_student_email AND product_id = v_product.id;
  
  IF v_student_id IS NULL THEN
    INSERT INTO students (email, name, product_id, seller_user_id, status)
    VALUES (p_student_email, p_student_name, v_product.id, v_seller_id, 'active')
    RETURNING id INTO v_student_id;
  ELSE
    -- Reactivate student if exists
    UPDATE students SET status = 'active', is_blocked = false, updated_at = now()
    WHERE id = v_student_id;
  END IF;
  
  -- Create or update enrollment
  SELECT id INTO v_enrollment_id FROM enrollments
  WHERE student_id = v_student_id AND course_id = v_course_id;
  
  IF v_enrollment_id IS NULL THEN
    INSERT INTO enrollments (student_id, course_id, product_id, status)
    VALUES (v_student_id, v_course_id, v_product.id, 'active')
    RETURNING id INTO v_enrollment_id;
  ELSE
    UPDATE enrollments SET 
      status = 'active',
      access_revoked_at = NULL,
      revoke_reason = NULL,
      updated_at = now()
    WHERE id = v_enrollment_id;
  END IF;
  
  -- Log the event
  PERFORM log_subscription_access_event(
    p_subscription_id,
    'enrollment_created',
    NULL,
    'active',
    'Assinatura ativada - acesso liberado',
    jsonb_build_object(
      'student_id', v_student_id,
      'course_id', v_course_id,
      'enrollment_id', v_enrollment_id
    )
  );
  
  RETURN v_enrollment_id;
END;
$$;

-- Add status column to enrollments if not exists for suspended state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'enrollment_status' AND e.enumlabel = 'suspended'
  ) THEN
    -- Add suspended and expired to possible statuses if using check constraint
    NULL; -- Status is already TEXT, no change needed
  END IF;
END $$;

-- Enable realtime for subscription access logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_access_logs;