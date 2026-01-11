-- =====================================================
-- FIX PERMISSIVE RLS POLICIES (WITH CHECK = true)
-- Replace public INSERT policies with service_role only
-- =====================================================

-- 1. ab_test_events - Allow only service role for inserts
DROP POLICY IF EXISTS "Allow public insert for tracking" ON public.ab_test_events;
CREATE POLICY "Service role can insert ab test events" 
ON public.ab_test_events FOR INSERT 
TO service_role
WITH CHECK (true);

-- 2. abandoned_carts - Already has seller validation, just remove the public one
DROP POLICY IF EXISTS "Allow public insert for cart tracking" ON public.abandoned_carts;

-- 3. admin_audit_logs - Only service role should insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Service role can insert audit logs" 
ON public.admin_audit_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- 4. analytics_events - Only service role
DROP POLICY IF EXISTS "Service insert analytics events" ON public.analytics_events;
CREATE POLICY "Service role insert analytics events" 
ON public.analytics_events FOR INSERT 
TO service_role
WITH CHECK (true);

-- 5. antifraud_analysis - Only service role
DROP POLICY IF EXISTS "Service insert antifraud analysis" ON public.antifraud_analysis;
CREATE POLICY "Service role insert antifraud analysis" 
ON public.antifraud_analysis FOR INSERT 
TO service_role
WITH CHECK (true);

-- 6. checkout_logs - Only service role
DROP POLICY IF EXISTS "Anyone can insert checkout logs" ON public.checkout_logs;
CREATE POLICY "Service role can insert checkout logs" 
ON public.checkout_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- 7. checkout_sessions - Need to allow anon for checkout flow but with restrictions
DROP POLICY IF EXISTS "Anyone can create checkout session" ON public.checkout_sessions;
CREATE POLICY "Anon can create checkout session with product" 
ON public.checkout_sessions FOR INSERT 
TO anon, authenticated
WITH CHECK (
  product_id IS NOT NULL 
  AND EXISTS (SELECT 1 FROM products WHERE id = product_id AND status = 'active')
);

-- 8. financial_audit_logs - Only service role
DROP POLICY IF EXISTS "System can insert financial audit logs" ON public.financial_audit_logs;
CREATE POLICY "Service role can insert financial audit logs" 
ON public.financial_audit_logs FOR INSERT 
TO service_role
WITH CHECK (true);

-- 9. integration_events - Only service role
DROP POLICY IF EXISTS "Service insert integration events" ON public.integration_events;
CREATE POLICY "Service role insert integration events" 
ON public.integration_events FOR INSERT 
TO service_role
WITH CHECK (true);

-- 10. monitoring_alerts - Only service role
DROP POLICY IF EXISTS "Service insert monitoring alerts" ON public.monitoring_alerts;
CREATE POLICY "Service role insert monitoring alerts" 
ON public.monitoring_alerts FOR INSERT 
TO service_role
WITH CHECK (true);

-- 11. sales - Only service role (checkout processed by edge function)
DROP POLICY IF EXISTS "Service can insert sales" ON public.sales;
CREATE POLICY "Service role can insert sales" 
ON public.sales FOR INSERT 
TO service_role
WITH CHECK (true);

-- 12. sales_funnel_events - Only service role
DROP POLICY IF EXISTS "Service role can insert funnel events" ON public.sales_funnel_events;
CREATE POLICY "Service role insert funnel events" 
ON public.sales_funnel_events FOR INSERT 
TO service_role
WITH CHECK (true);

-- 13. subscriptions - Only service role
DROP POLICY IF EXISTS "Service can insert subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can insert subscriptions" 
ON public.subscriptions FOR INSERT 
TO service_role
WITH CHECK (true);

-- 14. telegram_notifications - Only service role
DROP POLICY IF EXISTS "Service insert telegram notifications" ON public.telegram_notifications;
CREATE POLICY "Service role insert telegram notifications" 
ON public.telegram_notifications FOR INSERT 
TO service_role
WITH CHECK (true);

-- 15. utm_tracking - Only service role
DROP POLICY IF EXISTS "Service can insert utm tracking" ON public.utm_tracking;
CREATE POLICY "Service role insert utm tracking" 
ON public.utm_tracking FOR INSERT 
TO service_role
WITH CHECK (true);

-- 16. whatsapp_messages - Only service role
DROP POLICY IF EXISTS "Service insert whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Service role insert whatsapp messages" 
ON public.whatsapp_messages FOR INSERT 
TO service_role
WITH CHECK (true);