-- Drop the old constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_type_check;

-- Add new constraint with all product types
ALTER TABLE public.products ADD CONSTRAINT products_product_type_check 
CHECK (product_type = ANY (ARRAY['digital'::text, 'physical'::text, 'ebook'::text, 'membership'::text, 'service'::text]));