-- Fix 1: Storage Bucket Path-Based Ownership Verification
-- Drop existing insecure policies
DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;

-- Create secure policies with path-based ownership verification
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 2: SQL Injection in Product Search Function
-- Replace with secure version using input validation and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.find_product_by_short_id(short_id text)
RETURNS SETOF products
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Validate input: only allow valid UUID prefix characters (hex + hyphens)
  -- Prevents pattern injection attacks
  IF short_id IS NULL OR short_id = '' THEN
    RETURN;
  END IF;
  
  -- Validate format: only hex characters and hyphens, max 36 chars
  IF short_id !~ '^[a-fA-F0-9-]{1,36}$' THEN
    RAISE EXCEPTION 'Invalid short_id format: must contain only hex characters and hyphens';
  END IF;
  
  -- Use LIKE with validated input (case-insensitive by lowercasing)
  RETURN QUERY
  SELECT *
  FROM products
  WHERE lower(id::text) LIKE lower(short_id) || '%'
    AND status = 'active'
  LIMIT 1;
END;
$$;