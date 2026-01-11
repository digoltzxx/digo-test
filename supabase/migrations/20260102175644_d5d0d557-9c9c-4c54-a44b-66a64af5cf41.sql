-- Add extended profile fields for address and business info
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'cpf',
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT,
ADD COLUMN IF NOT EXISTS neighborhood TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS mcc_category TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create co_producers table
CREATE TABLE IF NOT EXISTS public.co_producers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  commission_percentage NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Enable RLS on co_producers
ALTER TABLE public.co_producers ENABLE ROW LEVEL SECURITY;

-- RLS policies for co_producers
CREATE POLICY "Users can view their own co-productions"
ON public.co_producers
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Product owners can view co-producers"
ON public.co_producers
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products 
  WHERE products.id = co_producers.product_id 
  AND products.user_id = auth.uid()
));

CREATE POLICY "Product owners can manage co-producers"
ON public.co_producers
FOR ALL
USING (EXISTS (
  SELECT 1 FROM products 
  WHERE products.id = co_producers.product_id 
  AND products.user_id = auth.uid()
));

CREATE POLICY "Admins can view all co-producers"
ON public.co_producers
FOR SELECT
USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "Admins can manage all co-producers"
ON public.co_producers
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_co_producers_updated_at
BEFORE UPDATE ON public.co_producers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();