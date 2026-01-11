-- =============================================
-- MIGRATION: COMPLETE FINANCIAL INFRASTRUCTURE V3
-- =============================================

-- ===========================================
-- PART 1: ENHANCE WEBHOOK_EVENTS TABLE
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'gateway') THEN
    ALTER TABLE public.webhook_events ADD COLUMN gateway VARCHAR(50) DEFAULT 'podpay';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'signature') THEN
    ALTER TABLE public.webhook_events ADD COLUMN signature VARCHAR(500);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'processing_started_at') THEN
    ALTER TABLE public.webhook_events ADD COLUMN processing_started_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'retry_count') THEN
    ALTER TABLE public.webhook_events ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'webhook_events' AND column_name = 'transaction_id') THEN
    ALTER TABLE public.webhook_events ADD COLUMN transaction_id VARCHAR(255);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway ON public.webhook_events(gateway);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- ===========================================
-- PART 2: FINANCIAL AUDIT LOGS ENHANCEMENT
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'entity_type') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN entity_type VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'entity_id') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN entity_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'old_values') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN old_values JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'new_values') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN new_values JSONB;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'source') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN source VARCHAR(50) DEFAULT 'system';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financial_audit_logs' AND column_name = 'ip_address') THEN
    ALTER TABLE public.financial_audit_logs ADD COLUMN ip_address INET;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_entity ON public.financial_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_source ON public.financial_audit_logs(source);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_created_at ON public.financial_audit_logs(created_at DESC);

-- ===========================================
-- PART 3: COMMISSION TRACKING ENHANCEMENTS
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_commissions' AND column_name = 'idempotency_key') THEN
    ALTER TABLE public.sale_commissions ADD COLUMN idempotency_key VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_commissions' AND column_name = 'calculation_details') THEN
    ALTER TABLE public.sale_commissions ADD COLUMN calculation_details JSONB DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_commissions' AND column_name = 'released_at') THEN
    ALTER TABLE public.sale_commissions ADD COLUMN released_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_commissions' AND column_name = 'is_released') THEN
    ALTER TABLE public.sale_commissions ADD COLUMN is_released BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_commissions_idempotency ON public.sale_commissions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ===========================================
-- PART 4: CORE FINANCIAL FUNCTIONS
-- ===========================================

CREATE OR REPLACE FUNCTION public.log_financial_audit(
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_source VARCHAR DEFAULT 'system',
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID);
  
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, entity_type, entity_id, 
    old_values, new_values, source, reason,
    status_received, status_allowed, metadata
  )
  VALUES (
    v_user_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values, p_source, p_reason,
    COALESCE(p_new_values->>'status', 'unknown'), true,
    jsonb_build_object('timestamp', now(), 'action', p_action)
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_webhook_event(
  p_event_id VARCHAR,
  p_event_type VARCHAR,
  p_gateway VARCHAR,
  p_payload JSONB,
  p_signature VARCHAR DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, webhook_id UUID, is_duplicate BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook_id UUID;
  v_existing_id UUID;
  v_existing_status VARCHAR;
BEGIN
  SELECT id, status INTO v_existing_id, v_existing_status
  FROM public.webhook_events WHERE event_id = p_event_id;
  
  IF v_existing_id IS NOT NULL THEN
    IF v_existing_status IN ('processed', 'processing') THEN
      RETURN QUERY SELECT true, v_existing_id, true, 'Already processed'::TEXT;
      RETURN;
    END IF;
    
    IF v_existing_status = 'failed' THEN
      UPDATE public.webhook_events
      SET status = 'processing', processing_started_at = now(), 
          retry_count = COALESCE(retry_count, 0) + 1, updated_at = now()
      WHERE id = v_existing_id RETURNING id INTO v_webhook_id;
      RETURN QUERY SELECT true, v_webhook_id, false, 'Retrying'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  INSERT INTO public.webhook_events (event_id, event_type, gateway, payload, signature, status, processing_started_at)
  VALUES (p_event_id, p_event_type, p_gateway, p_payload, p_signature, 'processing', now())
  RETURNING id INTO v_webhook_id;
  
  RETURN QUERY SELECT true, v_webhook_id, false, 'Registered'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_webhook_processing(
  p_webhook_id UUID, p_success BOOLEAN, p_sale_id UUID DEFAULT NULL, p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_events
  SET status = CASE WHEN p_success THEN 'processed' ELSE 'failed' END,
      processed_at = CASE WHEN p_success THEN now() ELSE NULL END,
      sale_id = COALESCE(p_sale_id, sale_id),
      error_message = p_error_message, updated_at = now()
  WHERE id = p_webhook_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_sale_commissions_v2(p_sale_id UUID)
RETURNS TABLE(success BOOLEAN, commissions_created INTEGER, total_commission_amount NUMERIC, producer_net_amount NUMERIC, details JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_coproducer RECORD;
  v_commission_count INTEGER := 0;
  v_total_commissions NUMERIC(12,2) := 0;
  v_producer_amount NUMERIC(12,2);
  v_commission_amount NUMERIC(12,2);
  v_idempotency_key VARCHAR;
  v_details JSONB := '[]'::JSONB;
  v_affiliate_user_id UUID;
  v_aff_commission_pct NUMERIC;
BEGIN
  SELECT s.*, p.user_id as producer_id, p.affiliate_commission_percentage as product_aff_commission
  INTO v_sale
  FROM public.sales s JOIN public.products p ON p.id = s.product_id WHERE s.id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0::NUMERIC, 0::NUMERIC, '{"error": "Not found"}'::JSONB;
    RETURN;
  END IF;
  
  IF v_sale.status NOT IN ('approved', 'paid', 'confirmed') THEN
    RETURN QUERY SELECT false, 0, 0::NUMERIC, v_sale.net_amount, jsonb_build_object('error', 'Invalid status');
    RETURN;
  END IF;
  
  v_producer_amount := COALESCE(v_sale.net_amount, 0);
  
  -- Process co-producers
  FOR v_coproducer IN
    SELECT * FROM public.co_producers WHERE product_id = v_sale.product_id AND status = 'approved'
  LOOP
    v_commission_amount := ROUND(v_sale.net_amount * (v_coproducer.commission_percentage / 100), 2);
    v_idempotency_key := 'coproducer_' || p_sale_id::TEXT || '_' || v_coproducer.user_id::TEXT;
    
    IF NOT EXISTS (SELECT 1 FROM public.sale_commissions WHERE idempotency_key = v_idempotency_key) THEN
      INSERT INTO public.sale_commissions (
        sale_id, user_id, product_id, commission_type, commission_percentage, 
        commission_amount, status, idempotency_key, calculation_details
      ) VALUES (
        p_sale_id, v_coproducer.user_id, v_sale.product_id, 'coproducer',
        v_coproducer.commission_percentage, v_commission_amount, 'pending', v_idempotency_key,
        jsonb_build_object('net', v_sale.net_amount, 'pct', v_coproducer.commission_percentage)
      );
      
      v_commission_count := v_commission_count + 1;
      v_total_commissions := v_total_commissions + v_commission_amount;
      v_producer_amount := v_producer_amount - v_commission_amount;
      
      PERFORM record_balance_movement(v_coproducer.user_id, 'credit', v_commission_amount, 'commission', p_sale_id, 'Comissão coprod');
      v_details := v_details || jsonb_build_object('type', 'coproducer', 'user_id', v_coproducer.user_id, 'amount', v_commission_amount);
    END IF;
  END LOOP;
  
  -- Process affiliate using affiliation_id
  IF v_sale.affiliation_id IS NOT NULL THEN
    SELECT a.user_id, COALESCE(v_sale.product_aff_commission, 10) INTO v_affiliate_user_id, v_aff_commission_pct
    FROM public.affiliations a WHERE a.id = v_sale.affiliation_id;
    
    IF v_affiliate_user_id IS NOT NULL AND v_aff_commission_pct > 0 THEN
      v_commission_amount := ROUND(v_sale.net_amount * (v_aff_commission_pct / 100), 2);
      v_idempotency_key := 'affiliate_' || p_sale_id::TEXT || '_' || v_affiliate_user_id::TEXT;
      
      IF NOT EXISTS (SELECT 1 FROM public.sale_commissions WHERE idempotency_key = v_idempotency_key) THEN
        INSERT INTO public.sale_commissions (
          sale_id, user_id, product_id, commission_type, commission_percentage,
          commission_amount, status, idempotency_key, calculation_details
        ) VALUES (
          p_sale_id, v_affiliate_user_id, v_sale.product_id, 'affiliate',
          v_aff_commission_pct, v_commission_amount, 'pending', v_idempotency_key,
          jsonb_build_object('net', v_sale.net_amount, 'pct', v_aff_commission_pct)
        );
        
        v_commission_count := v_commission_count + 1;
        v_total_commissions := v_total_commissions + v_commission_amount;
        v_producer_amount := v_producer_amount - v_commission_amount;
        
        PERFORM record_balance_movement(v_affiliate_user_id, 'credit', v_commission_amount, 'commission', p_sale_id, 'Comissão afiliado');
        v_details := v_details || jsonb_build_object('type', 'affiliate', 'user_id', v_affiliate_user_id, 'amount', v_commission_amount);
      END IF;
    END IF;
  END IF;
  
  IF v_producer_amount > 0 THEN
    PERFORM record_balance_movement(v_sale.producer_id, 'credit', v_producer_amount, 'sale', p_sale_id, 'Venda aprovada');
  END IF;
  
  RETURN QUERY SELECT true, v_commission_count, v_total_commissions, v_producer_amount, jsonb_build_object('splits', v_details);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_payment_confirmation(
  p_sale_id UUID, p_transaction_id VARCHAR, p_gateway_data JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, message TEXT, commissions_created INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_old_status VARCHAR;
  v_commission_result RECORD;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Not found'::TEXT, 0;
    RETURN;
  END IF;
  
  v_old_status := v_sale.status;
  
  IF v_sale.status IN ('approved', 'paid', 'confirmed') THEN
    RETURN QUERY SELECT true, 'Already approved'::TEXT, 0;
    RETURN;
  END IF;
  
  IF v_sale.status IN ('refunded', 'chargeback', 'canceled') THEN
    RETURN QUERY SELECT false, 'Cannot approve: ' || v_sale.status, 0;
    RETURN;
  END IF;
  
  UPDATE public.sales
  SET status = 'approved', transaction_id = COALESCE(p_transaction_id, transaction_id), paid_at = now(), updated_at = now()
  WHERE id = p_sale_id;
  
  SELECT * INTO v_commission_result FROM calculate_sale_commissions_v2(p_sale_id);
  
  RETURN QUERY SELECT true, 'Processed'::TEXT, COALESCE(v_commission_result.commissions_created, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_withdrawal_request_v2(
  p_user_id UUID, p_amount NUMERIC, p_bank_account_id UUID DEFAULT NULL
)
RETURNS TABLE(is_valid BOOLEAN, available_balance NUMERIC, pending_withdrawals NUMERIC, error_code VARCHAR, error_message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_available NUMERIC(12,2);
  v_pending NUMERIC(12,2);
  v_min NUMERIC(12,2) := 50.00;
  v_bank RECORD;
BEGIN
  SELECT COALESCE(SUM(net_amount), 0) INTO v_available FROM public.sales
  WHERE seller_user_id = p_user_id AND status IN ('approved', 'paid', 'confirmed');
  
  SELECT COALESCE(SUM(amount), 0) INTO v_pending FROM public.withdrawals
  WHERE user_id = p_user_id AND status IN ('pending', 'processing', 'completed', 'approved');
  
  v_available := v_available - v_pending;
  
  IF p_amount <= 0 THEN RETURN QUERY SELECT false, v_available, v_pending, 'INVALID'::VARCHAR, 'Valor inválido'::TEXT; RETURN; END IF;
  IF p_amount < v_min THEN RETURN QUERY SELECT false, v_available, v_pending, 'MIN'::VARCHAR, format('Mínimo: R$ %s', v_min)::TEXT; RETURN; END IF;
  IF p_amount > v_available THEN RETURN QUERY SELECT false, v_available, v_pending, 'INSUF'::VARCHAR, 'Saldo insuficiente'::TEXT; RETURN; END IF;
  
  IF p_bank_account_id IS NOT NULL THEN
    SELECT * INTO v_bank FROM public.bank_accounts WHERE id = p_bank_account_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN QUERY SELECT false, v_available, v_pending, 'BANK'::VARCHAR, 'Conta inválida'::TEXT; RETURN; END IF;
    IF v_bank.status != 'approved' THEN RETURN QUERY SELECT false, v_available, v_pending, 'BANK_PEND'::VARCHAR, 'Conta não aprovada'::TEXT; RETURN; END IF;
  END IF;
  
  RETURN QUERY SELECT true, v_available, v_pending, NULL::VARCHAR, NULL::TEXT;
END;
$$;

-- ===========================================
-- PART 5: TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION public.trigger_auto_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.trigger_block_financial_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_audit_logs (user_id, action_taken, entity_type, entity_id, old_values, status_received, status_allowed, reason, source)
  VALUES (COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), 'DELETE_BLOCKED', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), 'DELETE', false, 'Blocked', 'trigger');
  RAISE EXCEPTION 'Cannot delete from %', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_updated_at_sales ON public.sales;
CREATE TRIGGER trigger_auto_updated_at_sales BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION trigger_auto_updated_at();

DROP TRIGGER IF EXISTS trigger_block_delete_sales ON public.sales;
CREATE TRIGGER trigger_block_delete_sales BEFORE DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION trigger_block_financial_deletion();

DROP TRIGGER IF EXISTS trigger_auto_updated_at_withdrawals ON public.withdrawals;
CREATE TRIGGER trigger_auto_updated_at_withdrawals BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION trigger_auto_updated_at();

DROP TRIGGER IF EXISTS trigger_block_delete_withdrawals ON public.withdrawals;
CREATE TRIGGER trigger_block_delete_withdrawals BEFORE DELETE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION trigger_block_financial_deletion();

DROP TRIGGER IF EXISTS trigger_auto_updated_at_commissions ON public.sale_commissions;
CREATE TRIGGER trigger_auto_updated_at_commissions BEFORE UPDATE ON public.sale_commissions FOR EACH ROW EXECUTE FUNCTION trigger_auto_updated_at();

DROP TRIGGER IF EXISTS trigger_block_delete_commissions ON public.sale_commissions;
CREATE TRIGGER trigger_block_delete_commissions BEFORE DELETE ON public.sale_commissions FOR EACH ROW EXECUTE FUNCTION trigger_block_financial_deletion();

-- ===========================================
-- PART 6: RLS POLICIES
-- ===========================================

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access webhook_events" ON public.webhook_events;
CREATE POLICY "Service role access webhook_events" ON public.webhook_events FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role access audit_logs" ON public.financial_audit_logs;
CREATE POLICY "Service role access audit_logs" ON public.financial_audit_logs FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view own audit_logs" ON public.financial_audit_logs;
CREATE POLICY "Users view own audit_logs" ON public.financial_audit_logs FOR SELECT USING (user_id = auth.uid());

-- ===========================================
-- PART 7: PERFORMANCE INDEXES
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_sales_seller_status_date ON public.sales(seller_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_product_status ON public.sales(product_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_affiliation ON public.sales(affiliation_id) WHERE affiliation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_user_status ON public.sale_commissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_sale ON public.sale_commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_co_producers_product_status ON public.co_producers(product_id, status);
CREATE INDEX IF NOT EXISTS idx_balance_history_user_date ON public.balance_history(user_id, created_at DESC);

COMMENT ON FUNCTION public.log_financial_audit IS 'Logs financial operations with full audit trail';
COMMENT ON FUNCTION public.process_webhook_event IS 'Processes webhooks with idempotency';
COMMENT ON FUNCTION public.calculate_sale_commissions_v2 IS 'Calculates commissions with idempotency';
COMMENT ON FUNCTION public.process_payment_confirmation IS 'Processes payment and triggers commissions';
COMMENT ON FUNCTION public.validate_withdrawal_request_v2 IS 'Validates withdrawal requests';