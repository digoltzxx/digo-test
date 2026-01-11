-- Add policy to allow public access to active products for checkout
-- This is needed because checkout pages should work for unauthenticated users
CREATE POLICY "Anyone can view active products for checkout"
ON public.products
FOR SELECT
USING (status = 'active');