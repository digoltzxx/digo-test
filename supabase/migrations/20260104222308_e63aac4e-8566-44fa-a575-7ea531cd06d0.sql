-- Fix 1: Replace vulnerable find_product_by_short_id function with secure version
-- This prevents ILIKE pattern injection by validating input format

CREATE OR REPLACE FUNCTION public.find_product_by_short_id(short_id text)
RETURNS SETOF products
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Strict validation: only allow 8-36 alphanumeric characters (UUID format)
  IF short_id IS NULL OR 
     length(short_id) < 8 OR
     length(short_id) > 36 OR
     short_id !~ '^[0-9a-fA-F-]+$' THEN
    RETURN; -- Return empty set for invalid input
  END IF;
  
  -- Use exact prefix match with validated input (no ILIKE)
  RETURN QUERY
  SELECT * FROM products
  WHERE id::text LIKE (short_id || '%')
    AND status = 'active'
  LIMIT 1;
END;
$$;

-- Fix 2: Restrict system_settings RLS to admins only for secret fields
-- First, drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read settings" ON system_settings;

-- Create new policy: non-secret settings can be read by authenticated users
CREATE POLICY "Authenticated users can read non-secret settings" 
ON system_settings
FOR SELECT TO authenticated
USING (
  key NOT LIKE '%secret%' AND 
  key NOT LIKE '%password%' AND
  key NOT LIKE '%api_key%'
);

-- Create policy: admins can read ALL settings including secrets
CREATE POLICY "Admins can read all settings"
ON system_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));