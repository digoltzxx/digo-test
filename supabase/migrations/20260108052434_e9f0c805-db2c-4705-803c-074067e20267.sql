-- Add logistics fields for physical products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS height_cm numeric NULL,
ADD COLUMN IF NOT EXISTS width_cm numeric NULL,
ADD COLUMN IF NOT EXISTS length_cm numeric NULL,
ADD COLUMN IF NOT EXISTS weight_grams numeric NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.height_cm IS 'Product height in centimeters (for physical products)';
COMMENT ON COLUMN public.products.width_cm IS 'Product width in centimeters (for physical products)';
COMMENT ON COLUMN public.products.length_cm IS 'Product length in centimeters (for physical products)';
COMMENT ON COLUMN public.products.weight_grams IS 'Product weight in grams (for physical products)';