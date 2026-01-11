-- Add slug column to products table for main checkout URL customization
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug (allow nulls, but enforce uniqueness for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique 
ON public.products (slug) 
WHERE slug IS NOT NULL;