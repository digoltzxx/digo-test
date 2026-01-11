-- Add commission percentage to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS commission_percentage numeric DEFAULT 30;

-- Create affiliations table
CREATE TABLE public.affiliations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

-- Enable RLS
ALTER TABLE public.affiliations ENABLE ROW LEVEL SECURITY;

-- Users can view their own affiliations
CREATE POLICY "Users can view their own affiliations"
ON public.affiliations
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create affiliations for themselves
CREATE POLICY "Users can create affiliations"
ON public.affiliations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own affiliations
CREATE POLICY "Users can update their own affiliations"
ON public.affiliations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own affiliations
CREATE POLICY "Users can delete their own affiliations"
ON public.affiliations
FOR DELETE
USING (auth.uid() = user_id);

-- Product owners can view affiliations for their products
CREATE POLICY "Product owners can view product affiliations"
ON public.affiliations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = affiliations.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_affiliations_updated_at
BEFORE UPDATE ON public.affiliations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();