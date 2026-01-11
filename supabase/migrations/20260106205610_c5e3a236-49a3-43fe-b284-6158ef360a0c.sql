-- ============================================
-- COMPREHENSIVE SECURITY FIX FOR ALL TABLES
-- ============================================

-- 1️⃣ PROFILES TABLE - Strict user-only access
-- Drop any existing permissive policies
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Block anonymous access explicitly
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2️⃣ ABANDONED_CARTS - Protect customer contact info
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Sellers can view abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can view abandoned carts" ON public.abandoned_carts;

-- Block anonymous access
CREATE POLICY "Block anonymous access to abandoned_carts"
ON public.abandoned_carts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Sellers can only see their own carts (with masked customer data in view)
CREATE POLICY "Sellers view own abandoned carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (auth.uid() = seller_user_id);

-- Sellers can manage their carts
CREATE POLICY "Sellers manage own abandoned carts"
ON public.abandoned_carts
FOR ALL
TO authenticated
USING (auth.uid() = seller_user_id)
WITH CHECK (auth.uid() = seller_user_id);

-- 3️⃣ MEMBER_ACCESS - Protect user emails
ALTER TABLE public.member_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own member access" ON public.member_access;
DROP POLICY IF EXISTS "Anyone can view member access" ON public.member_access;

-- Block anonymous access
CREATE POLICY "Block anonymous access to member_access"
ON public.member_access
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Users can only view their own access records
CREATE POLICY "Users view own access records"
ON public.member_access
FOR SELECT
TO authenticated
USING (
  user_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

-- Product owners can view access for their products
CREATE POLICY "Owners view product member access"
ON public.member_access
FOR SELECT
TO authenticated
USING (
  product_id IN (SELECT id FROM public.products WHERE user_id = auth.uid())
);

-- 4️⃣ SALES TABLE - Protect purchase history
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sales" ON public.sales;

-- Block anonymous access
CREATE POLICY "Block anonymous access to sales"
ON public.sales
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Sellers only see their own sales
CREATE POLICY "Sellers view own sales"
ON public.sales
FOR SELECT
TO authenticated
USING (auth.uid() = seller_user_id);

-- Buyers can see their own purchases (by email match)
CREATE POLICY "Buyers view own purchases"
ON public.sales
FOR SELECT
TO authenticated
USING (
  buyer_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid())
);

-- 5️⃣ WITHDRAWALS TABLE - Protect financial data
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view withdrawals" ON public.withdrawals;

-- Block anonymous access
CREATE POLICY "Block anonymous access to withdrawals"
ON public.withdrawals
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Users only see their own withdrawals
CREATE POLICY "Users view own withdrawals"
ON public.withdrawals
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can request their own withdrawals
CREATE POLICY "Users create own withdrawals"
ON public.withdrawals
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 6️⃣ SUBSCRIPTIONS - Protect subscription data
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view subscriptions" ON public.subscriptions;

-- Block anonymous access
CREATE POLICY "Block anonymous access to subscriptions"
ON public.subscriptions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Users view their own subscriptions
CREATE POLICY "Users view own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Product owners view subscriptions for their products
CREATE POLICY "Owners view product subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  product_id IN (SELECT id FROM public.products WHERE user_id = auth.uid())
);

-- 7️⃣ FUNNEL_ORDERS - Protect order data
ALTER TABLE public.funnel_orders ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to funnel_orders"
ON public.funnel_orders
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Sellers view their own funnel orders
CREATE POLICY "Sellers view own funnel orders"
ON public.funnel_orders
FOR SELECT
TO authenticated
USING (auth.uid() = seller_user_id);

-- 8️⃣ CHECKOUT_SESSIONS - Protect session data
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Block anonymous access (sessions created by edge functions)
CREATE POLICY "Block client access to checkout_sessions"
ON public.checkout_sessions
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 9️⃣ FINANCIAL_AUDIT_LOGS - Admin only
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Block all client access (service role only)
CREATE POLICY "Block client access to financial_audit_logs"
ON public.financial_audit_logs
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 🔟 DELIVERY_LOGS - Protect delivery info
ALTER TABLE public.delivery_logs ENABLE ROW LEVEL SECURITY;

-- Block anonymous access
CREATE POLICY "Block anonymous access to delivery_logs"
ON public.delivery_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Sellers view delivery logs for their products
CREATE POLICY "Sellers view own delivery logs"
ON public.delivery_logs
FOR SELECT
TO authenticated
USING (
  product_id IN (SELECT id FROM public.products WHERE user_id = auth.uid())
);