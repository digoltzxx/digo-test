
-- =====================================================
-- CORREÇÃO FINAL DE RLS POLICIES PERMISSIVAS
-- Foco: tabelas financeiras e de usuário
-- =====================================================

-- 1. ABANDONED_CARTS - Remover policies públicas perigosas (se existirem)
DROP POLICY IF EXISTS "Anyone can delete abandoned carts by id" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can create abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can update abandoned carts by id" ON public.abandoned_carts;

-- 2. AFFILIATE_CLICKS - Remover policies service role (se existirem)
DROP POLICY IF EXISTS "Service role can insert affiliate clicks" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "Service role can update affiliate clicks" ON public.affiliate_clicks;

-- 3. CHECKOUT_SESSIONS - Remover policy service role (se existir)
DROP POLICY IF EXISTS "Service role can update checkout sessions" ON public.checkout_sessions;

-- 4. AB_TEST_EVENTS - Aceitar insert anônimo para tracking (mas sem auth.uid)
-- Esta é aceitável - é tracking público

-- 5. Logs e analytics - INSERT com service role são aceitáveis
-- admin_audit_logs, analytics_events, antifraud_analysis, 
-- checkout_logs, coupon_usage_logs, financial_audit_logs,
-- integration_events, monitoring_alerts, pixel_event_logs,
-- sales, sales_funnel_events, subscriptions, telegram_notifications,
-- utm_tracking, webhook_logs, whatsapp_messages
-- Esses são inseridos por edge functions (service role) - ACEITÁVEL

-- Verificar se policies corretas já existem
DO $$
BEGIN
  -- Apenas garantir que as policies duplicadas foram removidas
  RAISE NOTICE 'Policies permissivas de DELETE/UPDATE críticas removidas';
END $$;
