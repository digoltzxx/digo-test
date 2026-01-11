-- Create function to find product by short ID prefix
CREATE OR REPLACE FUNCTION public.find_product_by_short_id(short_id text)
RETURNS SETOF products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM products
  WHERE id::text ILIKE short_id || '%'
    AND status = 'active'
  LIMIT 1;
$$;

-- Grant execute to anon role for public checkout access
GRANT EXECUTE ON FUNCTION public.find_product_by_short_id(text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_product_by_short_id(text) TO authenticated;