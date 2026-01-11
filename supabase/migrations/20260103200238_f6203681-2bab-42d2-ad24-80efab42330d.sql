-- Create product_offers table to store offers with discounts and payment methods
CREATE TABLE public.product_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Oferta Principal',
  discount_type TEXT DEFAULT NULL, -- 'percentage' or 'fixed'
  discount_value NUMERIC DEFAULT 0,
  final_price NUMERIC NOT NULL,
  pix_enabled BOOLEAN DEFAULT true,
  credit_card_enabled BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

-- Users can view offers for products they own
CREATE POLICY "Users can view their own product offers"
ON public.product_offers
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM products WHERE products.id = product_offers.product_id AND products.user_id = auth.uid()
));

-- Users can create offers for their products
CREATE POLICY "Users can create offers for their products"
ON public.product_offers
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM products WHERE products.id = product_offers.product_id AND products.user_id = auth.uid()
));

-- Users can update their own product offers
CREATE POLICY "Users can update their own product offers"
ON public.product_offers
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM products WHERE products.id = product_offers.product_id AND products.user_id = auth.uid()
));

-- Users can delete their own product offers
CREATE POLICY "Users can delete their own product offers"
ON public.product_offers
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM products WHERE products.id = product_offers.product_id AND products.user_id = auth.uid()
));

-- Admins can manage all offers
CREATE POLICY "Admins can manage all product offers"
ON public.product_offers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can view active offers for active products (for checkout)
CREATE POLICY "Public can view active offers for checkout"
ON public.product_offers
FOR SELECT
USING (status = 'active' AND EXISTS (
  SELECT 1 FROM products WHERE products.id = product_offers.product_id AND products.status = 'active'
));

-- Create trigger for updated_at
CREATE TRIGGER update_product_offers_updated_at
BEFORE UPDATE ON public.product_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();