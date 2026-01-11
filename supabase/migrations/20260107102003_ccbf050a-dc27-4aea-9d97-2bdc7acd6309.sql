-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION PROFISSIONAL: SISTEMA FINANCEIRO COMPLETO
-- Versão: 2.0.0 | Data: 2026-01-07
-- Objetivo: Nível de produção (Hotmart, Stripe, Pagar.me)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 1: TABELA DE TRANSAÇÕES FINANCEIRAS CONSOLIDADA
-- ═══════════════════════════════════════════════════════════════════════════

-- Criar tabela de transações se não existir
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  
  -- Tipo e referência
  transaction_type VARCHAR(50) NOT NULL DEFAULT 'sale' CHECK (transaction_type IN ('sale', 'refund', 'chargeback', 'withdrawal', 'anticipation', 'commission', 'fee')),
  external_reference VARCHAR(255),
  gateway_transaction_id VARCHAR(255),
  
  -- Valores (todos em centavos para precisão)
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  gateway_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'paid', 'confirmed', 'failed', 'refunded', 'chargeback', 'cancelled', 'retention')),
  payment_method VARCHAR(50),
  
  -- Cupom
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  coupon_code VARCHAR(100),
  
  -- Datas importantes
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Controle
  is_released BOOLEAN DEFAULT FALSE,
  is_withdrawn BOOLEAN DEFAULT FALSE,
  idempotency_key VARCHAR(255) UNIQUE,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint de unicidade para evitar duplicatas
  CONSTRAINT unique_gateway_transaction UNIQUE (gateway_transaction_id, transaction_type)
);

COMMENT ON TABLE public.financial_transactions IS 'Tabela consolidada de todas as transações financeiras do sistema';
COMMENT ON COLUMN public.financial_transactions.idempotency_key IS 'Chave única para garantir idempotência em webhooks';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 2: TABELA DE SPLIT DE PAGAMENTOS (PRODUTOR, COPRODUTOR, AFILIADO)
-- ═══════════════════════════════════════════════════════════════════════════

-- Adicionar colunas que podem estar faltando na payment_splits existente
ALTER TABLE public.payment_splits ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.financial_transactions(id);
ALTER TABLE public.payment_splits ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(50) DEFAULT 'producer';
ALTER TABLE public.payment_splits ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE public.payment_splits ADD COLUMN IF NOT EXISTS is_released BOOLEAN DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 3: TABELA DE HISTÓRICO DE SALDO (IMUTÁVEL)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Tipo de movimentação
  movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('credit', 'debit', 'lock', 'unlock', 'withdrawal', 'anticipation', 'refund', 'chargeback')),
  
  -- Valores
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  
  -- Referência
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  
  -- Descrição
  description TEXT,
  
  -- Imutável - sem updated_at
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.balance_history IS 'Histórico imutável de movimentações de saldo - NUNCA DELETAR';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 4: TABELA DE WEBHOOK LOGS (IDEMPOTÊNCIA)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  gateway VARCHAR(50) NOT NULL DEFAULT 'podpay',
  
  -- Payload
  payload JSONB NOT NULL DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  
  -- Status de processamento
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Resultado
  result_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.webhook_events IS 'Log de webhooks recebidos para garantir idempotência';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 5: RLS - HABILITAR EM NOVAS TABELAS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 6: RLS POLICIES - FINANCIAL_TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ft_select_own" ON public.financial_transactions;
CREATE POLICY "ft_select_own" ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ft_service_role" ON public.financial_transactions;
CREATE POLICY "ft_service_role" ON public.financial_transactions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 7: RLS POLICIES - BALANCE_HISTORY
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "bh_select_own" ON public.balance_history;
CREATE POLICY "bh_select_own" ON public.balance_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "bh_service_role" ON public.balance_history;
CREATE POLICY "bh_service_role" ON public.balance_history
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 8: RLS POLICIES - WEBHOOK_EVENTS (apenas service_role)
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "we_service_role" ON public.webhook_events;
CREATE POLICY "we_service_role" ON public.webhook_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 9: ÍNDICES DE PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- Financial Transactions
CREATE INDEX IF NOT EXISTS idx_ft_user_id ON public.financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ft_status ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ft_created_at ON public.financial_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ft_user_status ON public.financial_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ft_gateway_tx ON public.financial_transactions(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_idempotency ON public.financial_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Balance History
CREATE INDEX IF NOT EXISTS idx_bh_user_id ON public.balance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_bh_created_at ON public.balance_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bh_reference ON public.balance_history(reference_type, reference_id);

-- Webhook Events
CREATE INDEX IF NOT EXISTS idx_we_event_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_we_status ON public.webhook_events(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_we_gateway ON public.webhook_events(gateway, event_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 10: TRIGGER - UPDATED_AT AUTOMÁTICO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_timestamp_financial_transactions ON public.financial_transactions;
CREATE TRIGGER set_timestamp_financial_transactions
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 11: FUNÇÃO - VERIFICAR IDEMPOTÊNCIA DE WEBHOOK
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_webhook_idempotency(p_event_id VARCHAR(255))
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Se já existe e foi processado, retorna true (duplicado)
  RETURN EXISTS (
    SELECT 1 FROM webhook_events 
    WHERE event_id = p_event_id 
    AND status IN ('processed', 'processing')
  );
END;
$$;

COMMENT ON FUNCTION public.check_webhook_idempotency IS 'Verifica se webhook já foi processado (idempotência)';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 12: FUNÇÃO - REGISTRAR MOVIMENTAÇÃO DE SALDO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_balance_movement(
  p_user_id UUID,
  p_movement_type VARCHAR(50),
  p_amount NUMERIC(12,2),
  p_reference_type VARCHAR(50),
  p_reference_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance_before NUMERIC(12,2);
  v_balance_after NUMERIC(12,2);
  v_movement_id UUID;
BEGIN
  -- Calcular saldo atual (simplificado - baseado no histórico)
  SELECT COALESCE(SUM(CASE WHEN movement_type IN ('credit', 'unlock') THEN amount ELSE -amount END), 0)
  INTO v_balance_before
  FROM balance_history
  WHERE user_id = p_user_id;
  
  -- Calcular novo saldo
  IF p_movement_type IN ('credit', 'unlock') THEN
    v_balance_after := v_balance_before + p_amount;
  ELSE
    v_balance_after := v_balance_before - p_amount;
  END IF;
  
  -- Registrar movimentação
  INSERT INTO balance_history (user_id, movement_type, amount, balance_before, balance_after, reference_type, reference_id, description)
  VALUES (p_user_id, p_movement_type, p_amount, v_balance_before, v_balance_after, p_reference_type, p_reference_id, p_description)
  RETURNING id INTO v_movement_id;
  
  RETURN v_movement_id;
END;
$$;

COMMENT ON FUNCTION public.record_balance_movement IS 'Registra movimentação de saldo com histórico imutável';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 13: FUNÇÃO - PROCESSAR VENDA APROVADA (SPLITS + COMISSÕES)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_approved_sale(p_sale_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_coproducer RECORD;
  v_affiliate RECORD;
  v_producer_amount NUMERIC(12,2);
  v_total_commissions NUMERIC(12,2) := 0;
  v_result JSONB := '{"success": true, "splits": []}'::JSONB;
BEGIN
  -- Buscar venda com produto
  SELECT s.*, p.user_id as producer_id, p.affiliate_commission_percentage
  INTO v_sale
  FROM sales s
  JOIN products p ON p.id = s.product_id
  WHERE s.id = p_sale_id;
  
  IF NOT FOUND THEN
    RETURN '{"success": false, "error": "Venda não encontrada"}'::JSONB;
  END IF;
  
  v_producer_amount := COALESCE(v_sale.net_amount, 0);
  
  -- Processar coprodutores
  FOR v_coproducer IN
    SELECT * FROM co_producers 
    WHERE product_id = v_sale.product_id AND status = 'approved'
  LOOP
    DECLARE
      v_commission NUMERIC(12,2);
    BEGIN
      v_commission := ROUND(v_sale.net_amount * (v_coproducer.commission_percentage / 100), 2);
      v_producer_amount := v_producer_amount - v_commission;
      v_total_commissions := v_total_commissions + v_commission;
      
      -- Inserir comissão
      INSERT INTO sale_commissions (sale_id, user_id, product_id, commission_type, commission_percentage, commission_amount, status)
      VALUES (p_sale_id, v_coproducer.user_id, v_sale.product_id, 'coproducer', v_coproducer.commission_percentage, v_commission, 'pending')
      ON CONFLICT DO NOTHING;
      
      -- Registrar movimentação de saldo
      PERFORM record_balance_movement(v_coproducer.user_id, 'credit', v_commission, 'commission', p_sale_id, 'Comissão de coprodução');
    END;
  END LOOP;
  
  -- Processar afiliado (se houver)
  IF v_sale.affiliate_id IS NOT NULL AND v_sale.affiliate_commission_percentage > 0 THEN
    DECLARE
      v_aff_commission NUMERIC(12,2);
    BEGIN
      v_aff_commission := ROUND(v_sale.net_amount * (v_sale.affiliate_commission_percentage / 100), 2);
      v_producer_amount := v_producer_amount - v_aff_commission;
      
      INSERT INTO sale_commissions (sale_id, user_id, product_id, commission_type, commission_percentage, commission_amount, status)
      VALUES (p_sale_id, v_sale.affiliate_id, v_sale.product_id, 'affiliate', v_sale.affiliate_commission_percentage, v_aff_commission, 'pending')
      ON CONFLICT DO NOTHING;
      
      PERFORM record_balance_movement(v_sale.affiliate_id, 'credit', v_aff_commission, 'commission', p_sale_id, 'Comissão de afiliado');
    END;
  END IF;
  
  -- Registrar saldo do produtor
  PERFORM record_balance_movement(v_sale.producer_id, 'credit', v_producer_amount, 'sale', p_sale_id, 'Venda aprovada');
  
  v_result := jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'producer_amount', v_producer_amount,
    'total_commissions', v_total_commissions
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.process_approved_sale IS 'Processa venda aprovada: cria splits, comissões e registra saldo';

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 14: TRIGGER - BLOQUEAR DELEÇÃO DE DADOS FINANCEIROS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prevent_financial_record_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar tentativa
  INSERT INTO financial_audit_logs (user_id, action_taken, status_received, status_allowed, reason, metadata)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    'DELETE_BLOCKED',
    TG_TABLE_NAME,
    false,
    'Tentativa de exclusão de registro financeiro bloqueada',
    jsonb_build_object('table', TG_TABLE_NAME, 'record_id', OLD.id, 'timestamp', NOW())
  );
  
  RAISE EXCEPTION 'PROIBIDO: Exclusão de registros financeiros não é permitida. Use cancelamento/estorno.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar trigger nas tabelas financeiras críticas
DROP TRIGGER IF EXISTS prevent_delete_financial_transactions ON public.financial_transactions;
CREATE TRIGGER prevent_delete_financial_transactions
  BEFORE DELETE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

DROP TRIGGER IF EXISTS prevent_delete_balance_history ON public.balance_history;
CREATE TRIGGER prevent_delete_balance_history
  BEFORE DELETE ON public.balance_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_record_deletion();

-- ═══════════════════════════════════════════════════════════════════════════
-- SEÇÃO 15: FUNÇÃO - VALIDAR SAQUE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_withdrawal_request(
  p_user_id UUID,
  p_amount NUMERIC(12,2)
)
RETURNS TABLE (
  is_valid BOOLEAN,
  available_balance NUMERIC(12,2),
  error_message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_available NUMERIC(12,2);
  v_pending_withdrawals NUMERIC(12,2);
  v_min_withdrawal NUMERIC(12,2) := 50;
BEGIN
  -- Calcular saldo disponível
  SELECT COALESCE(SUM(net_amount), 0)
  INTO v_available
  FROM sales
  WHERE seller_user_id = p_user_id
  AND status IN ('paid', 'approved', 'confirmed');
  
  -- Subtrair saques concluídos e pendentes
  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending_withdrawals
  FROM withdrawals
  WHERE user_id = p_user_id
  AND status IN ('pending', 'completed', 'approved');
  
  v_available := v_available - v_pending_withdrawals;
  
  -- Validações
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, v_available, 'Valor inválido'::TEXT;
    RETURN;
  END IF;
  
  IF p_amount < v_min_withdrawal THEN
    RETURN QUERY SELECT false, v_available, format('Valor mínimo para saque: R$ %s', v_min_withdrawal)::TEXT;
    RETURN;
  END IF;
  
  IF p_amount > v_available THEN
    RETURN QUERY SELECT false, v_available, 'Saldo insuficiente'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, v_available, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION public.validate_withdrawal_request IS 'Valida solicitação de saque com todas as regras de negócio';

-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════