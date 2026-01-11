-- Create product_logistics table (separate from products)
CREATE TABLE public.product_logistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  altura_cm NUMERIC NOT NULL CHECK (altura_cm > 0),
  largura_cm NUMERIC NOT NULL CHECK (largura_cm > 0),
  comprimento_cm NUMERIC NOT NULL CHECK (comprimento_cm > 0),
  peso_g NUMERIC NOT NULL CHECK (peso_g > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_product_logistics_product_id ON public.product_logistics(product_id);

-- Enable RLS
ALTER TABLE public.product_logistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage logistics for their own products
CREATE POLICY "Users can view logistics for their products"
ON public.product_logistics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_logistics.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert logistics for their products"
ON public.product_logistics
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_logistics.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update logistics for their products"
ON public.product_logistics
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_logistics.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete logistics for their products"
ON public.product_logistics
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_logistics.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Public read for checkout (anonymous users need to see logistics for freight calculation)
CREATE POLICY "Anyone can view logistics for active products"
ON public.product_logistics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_logistics.product_id 
    AND products.status = 'active'
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_product_logistics_updated_at
BEFORE UPDATE ON public.product_logistics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.product_logistics IS 'Logistics data for physical products (dimensions and weight for freight calculation)';
COMMENT ON COLUMN public.product_logistics.altura_cm IS 'Product height in centimeters';
COMMENT ON COLUMN public.product_logistics.largura_cm IS 'Product width in centimeters';
COMMENT ON COLUMN public.product_logistics.comprimento_cm IS 'Product length in centimeters';
COMMENT ON COLUMN public.product_logistics.peso_g IS 'Product weight in grams';