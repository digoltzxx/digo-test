-- Create sales table to store all sales with buyer information
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE DEFAULT CONCAT('TXN', UPPER(SUBSTRING(gen_random_uuid()::text, 1, 10))),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_document TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'pending',
  affiliation_id UUID REFERENCES public.affiliations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Policy: Sellers can view their own sales
CREATE POLICY "Sellers can view their own sales"
ON public.sales
FOR SELECT
USING (auth.uid() = seller_user_id);

-- Policy: Sellers can update their own sales
CREATE POLICY "Sellers can update their own sales"
ON public.sales
FOR UPDATE
USING (auth.uid() = seller_user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();