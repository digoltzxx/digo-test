-- Allow anyone to view products in marketplace
CREATE POLICY "Anyone can view marketplace products"
ON public.products
FOR SELECT
USING (marketplace_enabled = true AND status = 'active');