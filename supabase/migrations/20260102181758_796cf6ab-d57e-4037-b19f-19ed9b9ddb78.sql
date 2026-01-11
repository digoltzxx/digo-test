-- Create abandoned carts table
CREATE TABLE public.abandoned_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recovered BOOLEAN NOT NULL DEFAULT false,
  recovered_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Sellers can view their own abandoned carts" 
ON public.abandoned_carts 
FOR SELECT 
USING (auth.uid() = seller_user_id);

CREATE POLICY "System can insert abandoned carts" 
ON public.abandoned_carts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Sellers can update their own abandoned carts" 
ON public.abandoned_carts 
FOR UPDATE 
USING (auth.uid() = seller_user_id);

CREATE POLICY "Admins can view all abandoned carts" 
ON public.abandoned_carts 
FOR SELECT 
USING (is_admin_or_moderator(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_abandoned_carts_updated_at
BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();