-- Create affiliate_sales table to track sales made by affiliates
CREATE TABLE public.affiliate_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliation_id UUID NOT NULL REFERENCES public.affiliations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  affiliate_user_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  owner_earnings NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliate_sales ENABLE ROW LEVEL SECURITY;

-- Policy: Affiliates can view their own sales
CREATE POLICY "Affiliates can view their own sales"
ON public.affiliate_sales
FOR SELECT
USING (auth.uid() = affiliate_user_id);

-- Policy: Product owners can view sales of their products
CREATE POLICY "Product owners can view sales of their products"
ON public.affiliate_sales
FOR SELECT
USING (auth.uid() = owner_user_id);

-- Policy: System can insert sales (for when sales happen)
CREATE POLICY "Authenticated users can insert sales"
ON public.affiliate_sales
FOR INSERT
WITH CHECK (auth.uid() = affiliate_user_id OR auth.uid() = owner_user_id);