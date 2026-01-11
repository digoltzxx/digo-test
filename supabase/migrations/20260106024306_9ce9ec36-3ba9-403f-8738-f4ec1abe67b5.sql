-- Fix security definer view by adding security_invoker
DROP VIEW IF EXISTS public.ab_test_metrics;

CREATE VIEW public.ab_test_metrics 
WITH (security_invoker = true)
AS
SELECT 
  variant,
  event_type,
  product_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  DATE_TRUNC('day', created_at) as event_date
FROM public.ab_test_events
GROUP BY variant, event_type, product_type, DATE_TRUNC('day', created_at);