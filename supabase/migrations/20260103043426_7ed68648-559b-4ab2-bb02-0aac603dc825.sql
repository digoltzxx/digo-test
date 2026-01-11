-- 1. Restrict webhook_logs INSERT to service role only
DROP POLICY IF EXISTS "System can insert webhook logs" ON webhook_logs;

-- 2. Create secure notification insertion function
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;
  IF p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
    RAISE EXCEPTION 'title cannot be empty';
  END IF;
  IF p_message IS NULL OR LENGTH(TRIM(p_message)) = 0 THEN
    RAISE EXCEPTION 'message cannot be empty';
  END IF;
  
  -- Limit input lengths
  IF LENGTH(p_title) > 255 THEN
    p_title := SUBSTRING(p_title, 1, 255);
  END IF;
  IF LENGTH(p_message) > 1000 THEN
    p_message := SUBSTRING(p_message, 1, 1000);
  END IF;
  
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (p_user_id, TRIM(p_title), TRIM(p_message), COALESCE(p_type, 'info'), p_link)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 3. Update notifications INSERT policy - remove public access
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- 4. Restrict system_settings visibility to authenticated users
DROP POLICY IF EXISTS "Anyone can read settings" ON system_settings;
CREATE POLICY "Authenticated users can read settings" ON system_settings
  FOR SELECT TO authenticated USING (true);

-- 5. Fix abandoned_carts INSERT - restrict to authenticated sellers
DROP POLICY IF EXISTS "System can insert abandoned carts" ON abandoned_carts;
CREATE POLICY "Authenticated sellers can insert abandoned carts" ON abandoned_carts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_user_id);

-- 6. Allow webhook_logs updates for edge functions (to update status)
CREATE POLICY "Service can update webhook logs" ON webhook_logs
  FOR UPDATE USING (true) WITH CHECK (true);