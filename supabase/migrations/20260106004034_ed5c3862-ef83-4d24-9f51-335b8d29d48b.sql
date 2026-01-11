-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_member_access_product_user 
ON public.member_access (product_id, user_email);

-- Create index for delivery_logs lookup
CREATE INDEX IF NOT EXISTS idx_delivery_logs_product_id 
ON public.delivery_logs (product_id);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_sale_id 
ON public.delivery_logs (sale_id);

-- Add trigger to update member_access.last_accessed_at
CREATE OR REPLACE FUNCTION public.update_member_last_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enable RLS on tables
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_deliverables ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Users can view their own member access" ON public.member_access;
DROP POLICY IF EXISTS "Product owners can view member access" ON public.member_access;
DROP POLICY IF EXISTS "Product owners can manage member access" ON public.member_access;
DROP POLICY IF EXISTS "Service role full access on member_access" ON public.member_access;
DROP POLICY IF EXISTS "Product owners can view delivery logs" ON public.delivery_logs;
DROP POLICY IF EXISTS "Service role full access on delivery_logs" ON public.delivery_logs;
DROP POLICY IF EXISTS "Anyone can view active deliverables" ON public.product_deliverables;
DROP POLICY IF EXISTS "Product owners can manage deliverables" ON public.product_deliverables;
DROP POLICY IF EXISTS "Service role full access on product_deliverables" ON public.product_deliverables;

-- Policy: Users can view their own access
CREATE POLICY "Users can view their own member access" 
ON public.member_access 
FOR SELECT 
USING (
  user_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

-- Policy: Product owners can view access for their products
CREATE POLICY "Product owners can view member access" 
ON public.member_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = member_access.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policy: Product owners can manage access for their products
CREATE POLICY "Product owners can manage member access" 
ON public.member_access 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = member_access.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policy: Product owners can view delivery logs
CREATE POLICY "Product owners can view delivery logs" 
ON public.delivery_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = delivery_logs.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Policy: Anyone can view active deliverables (for checkout)
CREATE POLICY "Anyone can view active deliverables" 
ON public.product_deliverables 
FOR SELECT 
USING (is_active = true);

-- Policy: Product owners can manage their deliverables
CREATE POLICY "Product owners can manage deliverables" 
ON public.product_deliverables 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = product_deliverables.product_id 
    AND products.user_id = auth.uid()
  )
);