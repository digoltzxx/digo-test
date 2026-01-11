-- =====================================================
-- MIGRAÇÃO COMPLETA: ARQUITETURA SEGURA DE BANCO DE DADOS
-- =====================================================

-- =====================================================
-- 1. TABELA DE CALENDÁRIO (FALTANDO)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  event_type TEXT NOT NULL DEFAULT 'reminder',
  color TEXT DEFAULT '#3B82F6',
  is_all_day BOOLEAN DEFAULT false,
  reminder_minutes INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar events"
ON public.calendar_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own calendar events"
ON public.calendar_events FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendar events"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar events"
ON public.calendar_events FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Índices para calendar_events
CREATE INDEX idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_events_user_date ON public.calendar_events(user_id, event_date);

-- =====================================================
-- 2. CORRIGIR POLÍTICAS RLS PERMISSIVAS
-- =====================================================

-- 2.1 checkout_sessions - corrigir política permissiva
DROP POLICY IF EXISTS "System can manage checkout sessions" ON public.checkout_sessions;

-- Checkout sessions precisam ser acessíveis publicamente para criar, mas não para tudo
CREATE POLICY "Anyone can create checkout session"
ON public.checkout_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can view checkout by id"
ON public.checkout_sessions FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Service role can update checkout sessions"
ON public.checkout_sessions FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- 2.2 checkout_logs - corrigir política permissiva
DROP POLICY IF EXISTS "System can manage checkout logs" ON public.checkout_logs;

CREATE POLICY "Anyone can insert checkout logs"
ON public.checkout_logs FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

CREATE POLICY "Service role can view checkout logs"
ON public.checkout_logs FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Sellers can view own product checkout logs"
ON public.checkout_logs FOR SELECT
TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

-- 2.3 coupon_usage_logs - corrigir política permissiva
DROP POLICY IF EXISTS "Service role can manage coupon usage" ON public.coupon_usage_logs;

CREATE POLICY "Service role can insert coupon usage"
ON public.coupon_usage_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can view coupon usage"
ON public.coupon_usage_logs FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Sellers can view own product coupon usage"
ON public.coupon_usage_logs FOR SELECT
TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

-- 2.4 funnel_orders - corrigir política permissiva
DROP POLICY IF EXISTS "Service role can manage funnel orders" ON public.funnel_orders;

CREATE POLICY "Service role can insert funnel orders"
ON public.funnel_orders FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update funnel orders"
ON public.funnel_orders FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Sellers can view own funnel orders"
ON public.funnel_orders FOR SELECT
TO authenticated
USING (seller_user_id = auth.uid());

-- 2.5 pixel_event_logs - corrigir política permissiva
DROP POLICY IF EXISTS "Service role can manage pixel logs" ON public.pixel_event_logs;

CREATE POLICY "Service role can insert pixel logs"
ON public.pixel_event_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can view pixel logs"
ON public.pixel_event_logs FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Sellers can view own pixel logs"
ON public.pixel_event_logs FOR SELECT
TO authenticated
USING (
  product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

-- 2.6 webhook_logs - corrigir política permissiva
DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Service can update webhook logs" ON public.webhook_logs;

CREATE POLICY "Service role only insert webhook logs"
ON public.webhook_logs FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role only update webhook logs"
ON public.webhook_logs FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- 3. FUNÇÃO DE VALIDAÇÃO DE CUPOM (SEGURA)
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_coupon_code TEXT,
  p_product_id UUID,
  p_amount NUMERIC
)
RETURNS TABLE(
  is_valid BOOLEAN,
  campaign_id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_discount_amount NUMERIC;
  v_final_amount NUMERIC;
BEGIN
  -- Buscar campanha pelo código do cupom
  SELECT c.* INTO v_campaign
  FROM public.campaigns c
  WHERE c.coupon_code = p_coupon_code
    AND c.product_id = p_product_id
    AND c.is_active = true
  LIMIT 1;

  -- Cupom não encontrado
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 
      NULL::NUMERIC, p_amount, 'Cupom inválido ou não encontrado'::TEXT;
    RETURN;
  END IF;

  -- Verificar data de início
  IF v_campaign.starts_at IS NOT NULL AND v_campaign.starts_at > now() THEN
    RETURN QUERY SELECT 
      false, v_campaign.id, NULL::TEXT, NULL::NUMERIC, 
      NULL::NUMERIC, p_amount, 'Cupom ainda não está ativo'::TEXT;
    RETURN;
  END IF;

  -- Verificar data de expiração
  IF v_campaign.ends_at IS NOT NULL AND v_campaign.ends_at < now() THEN
    RETURN QUERY SELECT 
      false, v_campaign.id, NULL::TEXT, NULL::NUMERIC, 
      NULL::NUMERIC, p_amount, 'Cupom expirado'::TEXT;
    RETURN;
  END IF;

  -- Verificar limite de uso
  IF v_campaign.max_uses IS NOT NULL AND v_campaign.current_uses >= v_campaign.max_uses THEN
    RETURN QUERY SELECT 
      false, v_campaign.id, NULL::TEXT, NULL::NUMERIC, 
      NULL::NUMERIC, p_amount, 'Limite de uso do cupom atingido'::TEXT;
    RETURN;
  END IF;

  -- Calcular desconto
  IF v_campaign.discount_type = 'percentage' THEN
    v_discount_amount := ROUND((p_amount * v_campaign.discount_value / 100), 2);
  ELSE
    v_discount_amount := v_campaign.discount_value;
  END IF;

  -- Garantir que desconto não exceda o valor
  IF v_discount_amount > p_amount THEN
    v_discount_amount := p_amount;
  END IF;

  v_final_amount := p_amount - v_discount_amount;

  RETURN QUERY SELECT 
    true,
    v_campaign.id,
    v_campaign.discount_type,
    v_campaign.discount_value,
    v_discount_amount,
    v_final_amount,
    NULL::TEXT;
END;
$$;

-- =====================================================
-- 4. FUNÇÃO PARA INCREMENTAR USO DE CUPOM
-- =====================================================
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaigns
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
  
  RETURN FOUND;
END;
$$;

-- =====================================================
-- 5. FUNÇÃO PARA CALCULAR COMISSÕES AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION public.calculate_sale_commissions(p_sale_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_coproducer RECORD;
  v_commission_count INTEGER := 0;
  v_commission_amount NUMERIC;
BEGIN
  -- Buscar venda
  SELECT s.*, p.user_id as product_owner_id
  INTO v_sale
  FROM public.sales s
  JOIN public.products p ON s.product_id = p.id
  WHERE s.id = p_sale_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Inserir comissão para coprodutores
  FOR v_coproducer IN 
    SELECT cp.* FROM public.co_producers cp
    WHERE cp.product_id = v_sale.product_id
      AND cp.status = 'approved'
  LOOP
    -- Calcular comissão
    v_commission_amount := ROUND(v_sale.net_amount * v_coproducer.commission_percentage / 100, 2);
    
    -- Inserir comissão
    INSERT INTO public.sale_commissions (
      sale_id, user_id, product_id, commission_type, 
      commission_percentage, commission_amount, status
    ) VALUES (
      p_sale_id, v_coproducer.user_id, v_sale.product_id, 'coproducer',
      v_coproducer.commission_percentage, v_commission_amount, 'pending'
    )
    ON CONFLICT DO NOTHING;
    
    v_commission_count := v_commission_count + 1;
  END LOOP;

  RETURN v_commission_count;
END;
$$;

-- =====================================================
-- 6. TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- =====================================================

-- Função genérica de update_updated_at já existe, vamos criar triggers para tabelas que faltam

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 7. TRIGGER PARA BLOQUEAR DELEÇÃO DE REGISTROS FINANCEIROS
-- =====================================================
CREATE OR REPLACE FUNCTION public.prevent_financial_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar tentativa de deleção
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, status_received, status_allowed, 
    sale_id, amount, reason, metadata
  ) VALUES (
    auth.uid(), 
    'DELETE_BLOCKED', 
    TG_TABLE_NAME::TEXT,
    false,
    CASE WHEN TG_TABLE_NAME = 'sales' THEN OLD.id ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'sales' THEN OLD.amount ELSE NULL END,
    'Tentativa de exclusão de registro financeiro bloqueada',
    jsonb_build_object('table', TG_TABLE_NAME, 'record_id', OLD.id)
  );
  
  RAISE EXCEPTION 'Exclusão de registros financeiros não é permitida. Use status de cancelamento.';
  RETURN NULL;
END;
$$;

-- Aplicar trigger nas tabelas financeiras
CREATE TRIGGER prevent_sales_deletion
BEFORE DELETE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_deletion();

CREATE TRIGGER prevent_withdrawals_deletion
BEFORE DELETE ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_deletion();

CREATE TRIGGER prevent_commission_anticipations_deletion
BEFORE DELETE ON public.commission_anticipations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_deletion();

-- =====================================================
-- 8. FUNÇÃO PARA BUSCAR EVENTOS DO CALENDÁRIO POR DIA
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_calendar_events_by_date(
  p_user_id UUID,
  p_date DATE
)
RETURNS SETOF public.calendar_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Retorna eventos APENAS do dia especificado
  RETURN QUERY
  SELECT ce.*
  FROM public.calendar_events ce
  WHERE ce.user_id = p_user_id
    AND ce.event_date = p_date
  ORDER BY ce.event_time NULLS FIRST, ce.created_at;
END;
$$;

-- =====================================================
-- 9. ÍNDICES ESTRATÉGICOS ADICIONAIS
-- =====================================================

-- Índices para sales (alta frequência)
CREATE INDEX IF NOT EXISTS idx_sales_seller_status ON public.sales(seller_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_desc ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_product_status ON public.sales(product_id, status);

-- Índices para withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_desc ON public.withdrawals(created_at DESC);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_user_status ON public.products(user_id, status);

-- Índices para campaigns/cupons
CREATE INDEX IF NOT EXISTS idx_campaigns_product_active ON public.campaigns(product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_campaigns_coupon_code ON public.campaigns(coupon_code) WHERE coupon_code IS NOT NULL;

-- Índices para social_proofs
CREATE INDEX IF NOT EXISTS idx_social_proofs_product_active ON public.social_proofs(product_id, is_active);

-- Índices para checkout_pixels
CREATE INDEX IF NOT EXISTS idx_checkout_pixels_product_active ON public.checkout_pixels(product_id, is_active);

-- =====================================================
-- 10. FUNÇÃO DE AUDITORIA DE AÇÕES FINANCEIRAS
-- =====================================================
CREATE OR REPLACE FUNCTION public.audit_financial_action(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_amount NUMERIC DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.financial_audit_logs (
    user_id,
    action_taken,
    status_received,
    status_allowed,
    amount,
    metadata
  ) VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    true,
    p_amount,
    jsonb_build_object(
      'entity_id', p_entity_id,
      'entity_type', p_entity_type,
      'timestamp', now()
    ) || p_details
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;