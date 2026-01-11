-- Drop existing table if it uses Portuguese naming
DROP TABLE IF EXISTS public.product_logistics;

-- Create product_logistics table with English naming
CREATE TABLE public.product_logistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  height_cm NUMERIC NOT NULL CHECK (height_cm > 0),
  width_cm NUMERIC NOT NULL CHECK (width_cm > 0),
  length_cm NUMERIC NOT NULL CHECK (length_cm > 0),
  weight_g NUMERIC NOT NULL CHECK (weight_g > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_logistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage logistics for their products"
ON public.product_logistics
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_logistics.product_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Public read logistics for active products"
ON public.product_logistics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_logistics.product_id
    AND p.status = 'active'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_product_logistics_updated_at
BEFORE UPDATE ON public.product_logistics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();