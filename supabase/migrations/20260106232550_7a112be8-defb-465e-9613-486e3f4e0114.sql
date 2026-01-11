-- Add short_code column to product_links for unique short checkout URLs
ALTER TABLE public.product_links 
ADD COLUMN IF NOT EXISTS short_code TEXT UNIQUE;

-- Create an index for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_links_short_code ON public.product_links(short_code) WHERE short_code IS NOT NULL;

-- Function to generate random short codes (8 characters alphanumeric)
CREATE OR REPLACE FUNCTION public.generate_short_code(length INTEGER DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$function$;

-- Function to find product link by short code
CREATE OR REPLACE FUNCTION public.find_product_link_by_code(code TEXT)
RETURNS TABLE(
  id UUID,
  product_id UUID,
  name TEXT,
  slug TEXT,
  custom_price NUMERIC,
  is_active BOOLEAN,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate input
  IF code IS NULL OR length(code) < 6 OR length(code) > 12 THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    pl.id,
    pl.product_id,
    pl.name,
    pl.slug,
    pl.custom_price,
    pl.is_active,
    pl.utm_source,
    pl.utm_medium,
    pl.utm_campaign
  FROM product_links pl
  WHERE pl.short_code = code
    AND pl.is_active = true
  LIMIT 1;
END;
$function$;