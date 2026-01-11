
-- =====================================================
-- CORREÇÃO DE RLS POLICIES PERMISSIVAS - PARTE 2
-- =====================================================

-- 4. FUNNEL_ORDERS - Restringir insert/update (usa seller_user_id)
DROP POLICY IF EXISTS "Service role can insert funnel orders" ON public.funnel_orders;
DROP POLICY IF EXISTS "Service role can update funnel orders" ON public.funnel_orders;

CREATE POLICY "Sellers can insert funnel orders"
ON public.funnel_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Sellers can update funnel orders"
ON public.funnel_orders FOR UPDATE
TO authenticated
USING (auth.uid() = seller_user_id);

-- 5. WEBHOOK_LOGS - Restringir update (usa user_id)
DROP POLICY IF EXISTS "Service role only update webhook logs" ON public.webhook_logs;

CREATE POLICY "Users can update own webhook logs"
ON public.webhook_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Criar função auxiliar para verificar ownership de produto (evita recursão)
CREATE OR REPLACE FUNCTION public.is_product_owner(_user_id uuid, _product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM products
    WHERE id = _product_id AND user_id = _user_id
  )
$$;

-- 7. Criar função para verificar se é seller de uma sale
CREATE OR REPLACE FUNCTION public.is_sale_seller(_user_id uuid, _sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sales
    WHERE id = _sale_id AND seller_user_id = _user_id
  )
$$;
