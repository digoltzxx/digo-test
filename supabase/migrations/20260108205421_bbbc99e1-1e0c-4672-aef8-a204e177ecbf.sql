-- Corrigir view com SECURITY INVOKER
DROP VIEW IF EXISTS public.v_gateway_metrics;

CREATE VIEW public.v_gateway_metrics
WITH (security_invoker = true)
AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status IN ('approved', 'completed')) as approved_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status IN ('declined', 'failed', 'cancelled')) as failed_count,
  COUNT(*) FILTER (WHERE status = 'refunded') as refunded_count,
  COUNT(*) FILTER (WHERE status = 'chargeback') as chargeback_count,
  COUNT(*) as total_attempts,
  COALESCE(SUM(amount) FILTER (WHERE status IN ('approved', 'completed')), 0) as approved_amount,
  COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
  COALESCE(SUM(amount), 0) as total_amount,
  COALESCE(SUM(platform_fee) FILTER (WHERE status IN ('approved', 'completed')), 0) as total_platform_fees,
  COALESCE(SUM(payment_fee) FILTER (WHERE status IN ('approved', 'completed')), 0) as total_payment_fees,
  COUNT(*) FILTER (WHERE payment_method = 'pix' AND status IN ('approved', 'completed')) as pix_count,
  COALESCE(SUM(amount) FILTER (WHERE payment_method = 'pix' AND status IN ('approved', 'completed')), 0) as pix_amount,
  COUNT(*) FILTER (WHERE payment_method IN ('card', 'cartao', 'credit_card') AND status IN ('approved', 'completed')) as card_count,
  COALESCE(SUM(amount) FILTER (WHERE payment_method IN ('card', 'cartao', 'credit_card') AND status IN ('approved', 'completed')), 0) as card_amount,
  COUNT(*) FILTER (WHERE payment_method = 'boleto' AND status IN ('approved', 'completed')) as boleto_count,
  COALESCE(SUM(amount) FILTER (WHERE payment_method = 'boleto' AND status IN ('approved', 'completed')), 0) as boleto_amount
FROM public.sales
GROUP BY DATE(created_at);