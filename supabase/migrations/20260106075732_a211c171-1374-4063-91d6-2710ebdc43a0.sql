-- Drop existing policies
DROP POLICY IF EXISTS "Product owners can manage settings" ON public.member_area_settings;
DROP POLICY IF EXISTS "Public can view active settings" ON public.member_area_settings;

-- Create proper policies with correct with_check clauses
CREATE POLICY "Owners can select settings" 
ON public.member_area_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = member_area_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert settings" 
ON public.member_area_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update settings" 
ON public.member_area_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = member_area_settings.product_id 
    AND products.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = member_area_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete settings" 
ON public.member_area_settings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = member_area_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policy for public viewing of active product settings
CREATE POLICY "Public can view active product settings" 
ON public.member_area_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = member_area_settings.product_id 
    AND products.status = 'active'
  )
);