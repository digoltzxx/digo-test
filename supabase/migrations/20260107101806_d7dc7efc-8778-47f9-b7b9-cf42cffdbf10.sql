-- MIGRATION SIMPLIFICADA: Melhorias de índices e funções

-- Índices de performance para tabelas existentes
CREATE INDEX IF NOT EXISTS idx_sales_seller_status ON public.sales(seller_user_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_created_desc ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_product_active ON public.campaigns(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON public.calendar_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_co_producers_product ON public.co_producers(product_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_checkout_pixels_product ON public.checkout_pixels(product_id) WHERE is_active = true;

-- Colunas adicionais para campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS max_discount_value NUMERIC(12,2) DEFAULT NULL;

-- Função de validação de cupom
CREATE OR REPLACE FUNCTION public.validate_coupon_full(
  p_code VARCHAR(100),
  p_product_id UUID,
  p_amount NUMERIC(12,2)
)
RETURNS TABLE (is_valid BOOLEAN, campaign_id UUID, discount_type VARCHAR(50), discount_value NUMERIC(12,2), discount_amount NUMERIC(12,2), final_amount NUMERIC(12,2), error_msg TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_camp RECORD; v_disc NUMERIC(12,2);
BEGIN
  SELECT * INTO v_camp FROM campaigns WHERE LOWER(coupon_code) = LOWER(p_code) AND product_id = p_product_id AND is_active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'Cupom inválido'::TEXT; RETURN; END IF;
  IF v_camp.starts_at IS NOT NULL AND v_camp.starts_at > NOW() THEN RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'Cupom não ativo'::TEXT; RETURN; END IF;
  IF v_camp.ends_at IS NOT NULL AND v_camp.ends_at < NOW() THEN RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'Cupom expirado'::TEXT; RETURN; END IF;
  IF v_camp.max_uses IS NOT NULL AND v_camp.current_uses >= v_camp.max_uses THEN RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 'Limite atingido'::TEXT; RETURN; END IF;
  IF v_camp.discount_type = 'percentage' THEN v_disc := ROUND(p_amount * (v_camp.discount_value / 100), 2); ELSE v_disc := LEAST(v_camp.discount_value, p_amount); END IF;
  RETURN QUERY SELECT true, v_camp.id, v_camp.discount_type::VARCHAR, v_camp.discount_value, v_disc, GREATEST(p_amount - v_disc, 0), NULL::TEXT;
END;
$$;

-- Função de log financeiro
CREATE OR REPLACE FUNCTION public.log_financial_event(p_action VARCHAR(100), p_sale_id UUID DEFAULT NULL, p_user_id UUID DEFAULT NULL, p_amount NUMERIC(12,2) DEFAULT NULL, p_status VARCHAR(50) DEFAULT NULL, p_reason TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO financial_audit_logs (action_taken, sale_id, user_id, amount, status_received, status_allowed, reason)
  VALUES (p_action, p_sale_id, p_user_id, p_amount, COALESCE(p_status, 'unknown'), true, p_reason)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;