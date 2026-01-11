
-- ============================================================
-- MIGRATION: INFRAESTRUTURA FINANCEIRA - TRIGGERS E FUNCTIONS
-- ============================================================

-- SEÇÃO 1: CRIAR TABELA PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  gateway_fee DECIMAL(12,2) DEFAULT 0 CHECK (gateway_fee >= 0),
  platform_fee DECIMAL(12,2) DEFAULT 0 CHECK (platform_fee >= 0),
  net_amount DECIMAL(12,2) NOT NULL CHECK (net_amount >= 0),
  payment_method VARCHAR(50) NOT NULL,
  gateway VARCHAR(50) NOT NULL DEFAULT 'podpay',
  gateway_transaction_id VARCHAR(255),
  gateway_response JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  metadata JSONB DEFAULT '{}',
  idempotency_key VARCHAR(255) UNIQUE,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- SEÇÃO 2: ADICIONAR COLUNAS FALTANTES EM PAYMENT_SPLITS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'idempotency_key') THEN
    ALTER TABLE public.payment_splits ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'available_at') THEN
    ALTER TABLE public.payment_splits ADD COLUMN available_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'is_locked') THEN
    ALTER TABLE public.payment_splits ADD COLUMN is_locked BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payment_splits' AND column_name = 'metadata') THEN
    ALTER TABLE public.payment_splits ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- SEÇÃO 3: TABELA SOCIAL PROOF
CREATE TABLE IF NOT EXISTS public.social_proof_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proof_type VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  customer_location VARCHAR(255),
  message TEXT,
  is_real BOOLEAN DEFAULT true,
  display_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_proof_product ON public.social_proof_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_social_proof_active ON public.social_proof_entries(is_active) WHERE is_active = true;

-- SEÇÃO 4: FUNCTION - UPDATED_AT AUTOMÁTICO
CREATE OR REPLACE FUNCTION public.fn_auto_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SEÇÃO 5: FUNCTION - BLOQUEIO DE DELETE FINANCEIRO
CREATE OR REPLACE FUNCTION public.fn_block_financial_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, entity_type, entity_id, old_values,
    status_received, status_allowed, reason, source
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    'DELETE_BLOCKED', TG_TABLE_NAME, OLD.id, to_jsonb(OLD),
    'DELETE', false, 'Exclusão bloqueada por trigger', 'trigger'
  );
  RAISE EXCEPTION 'BLOQUEADO: DELETE em % não permitido', TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SEÇÃO 6: FUNCTION - PROCESSAMENTO DE PAGAMENTO APROVADO COM SPLITS
CREATE OR REPLACE FUNCTION public.fn_process_approved_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_product RECORD;
  v_coproducer RECORD;
  v_producer_amount DECIMAL(12,2);
  v_platform_fee DECIMAL(12,2);
  v_affiliate_amount DECIMAL(12,2) := 0;
  v_idempotency_key VARCHAR(255);
  v_split_exists BOOLEAN;
BEGIN
  -- Só processar quando status muda para approved/paid
  IF NEW.status NOT IN ('approved', 'paid') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Verificar idempotência
  v_idempotency_key := 'split_' || NEW.id::TEXT;
  SELECT EXISTS(SELECT 1 FROM public.payment_splits WHERE idempotency_key LIKE v_idempotency_key || '%') INTO v_split_exists;
  
  IF v_split_exists THEN
    RETURN NEW; -- Já processado
  END IF;
  
  -- Calcular taxa da plataforma (4.99% + R$1)
  v_platform_fee := ROUND((NEW.net_amount * 0.0499) + 1, 2);
  v_producer_amount := NEW.net_amount - v_platform_fee;
  
  -- Processar afiliado
  IF NEW.affiliate_id IS NOT NULL AND COALESCE(NEW.affiliate_commission_percentage, 0) > 0 THEN
    v_affiliate_amount := ROUND(NEW.net_amount * (NEW.affiliate_commission_percentage / 100), 2);
    v_producer_amount := v_producer_amount - v_affiliate_amount;
    
    INSERT INTO public.payment_splits (
      sale_id, user_id, role, recipient_type, gross_amount, net_amount, 
      fee_amount, platform_fee, split_percentage, status, idempotency_key
    ) VALUES (
      NEW.id, NEW.affiliate_id, 'affiliate', 'affiliate', v_affiliate_amount, 
      v_affiliate_amount, 0, 0, NEW.affiliate_commission_percentage, 'pending',
      v_idempotency_key || '_affiliate'
    );
    
    INSERT INTO public.sale_commissions (
      sale_id, user_id, product_id, commission_type, commission_percentage,
      commission_amount, status, role, idempotency_key
    ) VALUES (
      NEW.id, NEW.affiliate_id, NEW.product_id, 'affiliate',
      NEW.affiliate_commission_percentage, v_affiliate_amount, 'pending', 'affiliate',
      v_idempotency_key || '_comm_affiliate'
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  
  -- Processar coprodutores
  FOR v_coproducer IN
    SELECT * FROM public.co_producers WHERE product_id = NEW.product_id AND status = 'approved'
  LOOP
    DECLARE v_coproducer_amount DECIMAL(12,2);
    BEGIN
      v_coproducer_amount := ROUND(NEW.net_amount * (v_coproducer.commission_percentage / 100), 2);
      v_producer_amount := v_producer_amount - v_coproducer_amount;
      
      INSERT INTO public.payment_splits (
        sale_id, user_id, role, recipient_type, gross_amount, net_amount,
        fee_amount, platform_fee, split_percentage, status, idempotency_key
      ) VALUES (
        NEW.id, v_coproducer.user_id, 'coproducer', 'coproducer', v_coproducer_amount,
        v_coproducer_amount, 0, 0, v_coproducer.commission_percentage, 'pending',
        v_idempotency_key || '_coprod_' || v_coproducer.user_id
      );
      
      INSERT INTO public.sale_commissions (
        sale_id, user_id, product_id, commission_type, commission_percentage,
        commission_amount, status, role, idempotency_key
      ) VALUES (
        NEW.id, v_coproducer.user_id, NEW.product_id, 'coproducer',
        v_coproducer.commission_percentage, v_coproducer_amount, 'pending', 'coproducer',
        v_idempotency_key || '_comm_coprod_' || v_coproducer.user_id
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END;
  END LOOP;
  
  -- Split da plataforma
  INSERT INTO public.payment_splits (
    sale_id, user_id, role, recipient_type, gross_amount, net_amount,
    fee_amount, platform_fee, split_percentage, status, idempotency_key
  ) VALUES (
    NEW.id, '00000000-0000-0000-0000-000000000000', 'platform', 'platform',
    v_platform_fee, v_platform_fee, 0, 0, 0, 'available',
    v_idempotency_key || '_platform'
  );
  
  -- Split do produtor
  INSERT INTO public.payment_splits (
    sale_id, user_id, role, recipient_type, gross_amount, net_amount,
    fee_amount, platform_fee, split_percentage, status, idempotency_key
  ) VALUES (
    NEW.id, NEW.seller_user_id, 'producer', 'producer', v_producer_amount,
    v_producer_amount, 0, 0, 0, 'pending',
    v_idempotency_key || '_producer'
  );
  
  -- Comissão do produtor
  INSERT INTO public.sale_commissions (
    sale_id, user_id, product_id, commission_type, commission_percentage,
    commission_amount, status, role, idempotency_key
  ) VALUES (
    NEW.id, NEW.seller_user_id, NEW.product_id, 'producer', 100,
    v_producer_amount, 'pending', 'producer',
    v_idempotency_key || '_comm_producer'
  ) ON CONFLICT (idempotency_key) DO NOTHING;
  
  -- Registrar saldo
  PERFORM public.record_balance_movement(
    NEW.seller_user_id, 'credit', v_producer_amount, 'sale', NEW.id, 'Venda aprovada'
  );
  
  -- Auditoria
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, entity_type, entity_id, amount,
    status_received, status_allowed, reason, source, metadata
  ) VALUES (
    NEW.seller_user_id, 'PAYMENT_PROCESSED', 'sales', NEW.id, NEW.amount,
    NEW.status, true, 'Splits e comissões criados', 'trigger',
    jsonb_build_object('producer', v_producer_amount, 'platform', v_platform_fee, 'affiliate', v_affiliate_amount)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SEÇÃO 7: FUNCTION - VALIDAÇÃO DE SAQUE
CREATE OR REPLACE FUNCTION public.fn_validate_withdrawal()
RETURNS TRIGGER AS $$
DECLARE
  v_available DECIMAL(12,2);
  v_pending DECIMAL(12,2);
  v_has_bank BOOLEAN;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN movement_type IN ('credit','unlock') THEN amount ELSE -amount END), 0)
  INTO v_available FROM public.balance_history WHERE user_id = NEW.user_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM public.withdrawals WHERE user_id = NEW.user_id AND status IN ('pending','processing');
  
  v_available := v_available - v_pending;
  
  SELECT EXISTS(SELECT 1 FROM public.bank_accounts WHERE user_id = NEW.user_id AND status = 'approved') INTO v_has_bank;
  
  IF NOT v_has_bank THEN RAISE EXCEPTION 'Nenhuma conta bancária aprovada'; END IF;
  IF NEW.amount < 50 THEN RAISE EXCEPTION 'Valor mínimo: R$ 50,00'; END IF;
  IF NEW.amount > v_available THEN RAISE EXCEPTION 'Saldo insuficiente: R$ %', v_available; END IF;
  
  PERFORM public.record_balance_movement(NEW.user_id, 'withdrawal_pending', NEW.amount, 'withdrawal', NEW.id, 'Saque solicitado');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SEÇÃO 8: FUNCTION - WEBHOOK IDEMPOTENCY
CREATE OR REPLACE FUNCTION public.fn_register_webhook(
  p_event_id VARCHAR, p_event_type VARCHAR, p_gateway VARCHAR, p_payload JSONB
)
RETURNS UUID AS $$
DECLARE v_id UUID;
BEGIN
  IF EXISTS(SELECT 1 FROM public.webhook_events WHERE event_id = p_event_id AND status IN ('processed','processing')) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.webhook_events (event_id, event_type, gateway, payload, status, processing_started_at)
  VALUES (p_event_id, p_event_type, p_gateway, p_payload, 'processing', now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SEÇÃO 9: APLICAR TRIGGERS
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_updated_at();

DROP TRIGGER IF EXISTS trg_payments_block_delete ON public.payments;
CREATE TRIGGER trg_payments_block_delete BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_financial_delete();

DROP TRIGGER IF EXISTS trg_splits_block_delete ON public.payment_splits;
CREATE TRIGGER trg_splits_block_delete BEFORE DELETE ON public.payment_splits
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_financial_delete();

DROP TRIGGER IF EXISTS trg_sales_process_approved ON public.sales;
CREATE TRIGGER trg_sales_process_approved AFTER UPDATE OF status ON public.sales
  FOR EACH ROW WHEN (NEW.status IN ('approved','paid') AND OLD.status != NEW.status)
  EXECUTE FUNCTION public.fn_process_approved_payment();

DROP TRIGGER IF EXISTS trg_withdrawals_validate ON public.withdrawals;
CREATE TRIGGER trg_withdrawals_validate BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_withdrawal();

-- SEÇÃO 10: RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own payments" ON public.payments;
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages payments" ON public.payments;
CREATE POLICY "Service role manages payments" ON public.payments FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

ALTER TABLE public.social_proof_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone views active proofs" ON public.social_proof_entries;
CREATE POLICY "Anyone views active proofs" ON public.social_proof_entries FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Owners manage proofs" ON public.social_proof_entries;
CREATE POLICY "Owners manage proofs" ON public.social_proof_entries FOR ALL USING (auth.uid() = user_id);

-- SEÇÃO 11: ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_sales_seller_status ON public.sales(seller_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_user_status ON public.sale_commissions(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_splits_user_status ON public.payment_splits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status ON public.withdrawals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON public.financial_audit_logs(user_id, action_taken, created_at DESC);
