-- Fix CRIT-1: Allow anonymous/public inserts on abandoned_carts for cart tracking
-- This is needed because buyers (not authenticated as sellers) create abandoned cart records

CREATE POLICY "Allow public insert for cart tracking"
ON public.abandoned_carts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- The existing policies already handle:
-- - Sellers can view their own abandoned carts
-- - Sellers can update their own abandoned carts
-- - Sellers can delete their own abandoned carts

-- ERR-1 Fix: Convert views to SECURITY INVOKER (default, safer)
-- Note: Views inherit the permissions of the querying user with SECURITY INVOKER

-- Drop and recreate views with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.ab_test_metrics;
DROP VIEW IF EXISTS public.vw_saldo_usuario;

-- Recreate ab_test_metrics as SECURITY INVOKER (safe - uses aggregated data)
CREATE OR REPLACE VIEW public.ab_test_metrics
WITH (security_invoker = true)
AS
SELECT 
    variant,
    product_id,
    COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
    COUNT(*) FILTER (WHERE event_type = 'checkout_started') as checkouts_started,
    COUNT(*) FILTER (WHERE event_type = 'purchase') as purchases,
    COUNT(DISTINCT session_id) as unique_sessions
FROM public.ab_test_events
GROUP BY variant, product_id;

-- Recreate vw_saldo_usuario as SECURITY INVOKER with proper filtering
CREATE OR REPLACE VIEW public.vw_saldo_usuario
WITH (security_invoker = true)
AS
SELECT 
    user_id,
    COALESCE(SUM(CASE WHEN movement_type = 'credit' THEN amount ELSE 0 END), 0) as total_credits,
    COALESCE(SUM(CASE WHEN movement_type = 'debit' THEN amount ELSE 0 END), 0) as total_debits,
    COALESCE(SUM(CASE WHEN movement_type = 'credit' THEN amount ELSE -amount END), 0) as balance
FROM public.balance_history
WHERE user_id = auth.uid()
GROUP BY user_id;