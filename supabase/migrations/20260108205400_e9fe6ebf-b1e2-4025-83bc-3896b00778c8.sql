-- ============================================
-- GATEWAY DASHBOARD - COMPLETE DATA MODEL
-- ============================================

-- 1. Tabela de tentativas de pagamento (para taxa de conversão real)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  seller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  buyer_email TEXT,
  buyer_document TEXT,
  
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL, -- pix, card, boleto
  
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'approved', 'declined', 'failed', 'cancelled')),
  
  error_code TEXT,
  error_message TEXT,
  
  gateway_response JSONB,
  metadata JSONB,
  
  ip_address TEXT,
  user_agent TEXT
);

-- Índices para payment_attempts
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON public.payment_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_seller ON public.payment_attempts(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_sale ON public.payment_attempts(sale_id);

-- RLS para payment_attempts
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_attempts"
ON public.payment_attempts FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "admins_can_read_attempts"
ON public.payment_attempts FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 2. Adicionar coluna de parcelas na tabela sales (se não existir)
DO $$ BEGIN
  ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Tabela de histórico de status (auditoria completa)
CREATE TABLE IF NOT EXISTS public.sale_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  
  previous_status TEXT,
  new_status TEXT NOT NULL,
  
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  change_reason TEXT,
  
  metadata JSONB
);

-- Índices para sale_status_history
CREATE INDEX IF NOT EXISTS idx_sale_status_history_sale ON public.sale_status_history(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_status_history_created ON public.sale_status_history(created_at DESC);

-- RLS para sale_status_history
ALTER TABLE public.sale_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_status_history"
ON public.sale_status_history FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "admins_can_read_status_history"
ON public.sale_status_history FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 4. Tabela de reembolsos (se não existir)
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  
  amount NUMERIC(12,2) NOT NULL,
  reason TEXT,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial')),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  gateway_refund_id TEXT,
  metadata JSONB
);

-- Índices para refunds
CREATE INDEX IF NOT EXISTS idx_refunds_sale ON public.refunds(sale_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON public.refunds(created_at DESC);

-- RLS para refunds
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_refunds"
ON public.refunds FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "admins_can_read_refunds"
ON public.refunds FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 5. Tabela de chargebacks
CREATE TABLE IF NOT EXISTS public.chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  
  amount NUMERIC(12,2) NOT NULL,
  reason_code TEXT,
  reason_description TEXT,
  
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'won', 'lost', 'cancelled')),
  
  deadline_date DATE,
  resolved_at TIMESTAMPTZ,
  
  evidence_submitted BOOLEAN DEFAULT false,
  evidence_data JSONB,
  
  gateway_chargeback_id TEXT,
  metadata JSONB
);

-- Índices para chargebacks
CREATE INDEX IF NOT EXISTS idx_chargebacks_sale ON public.chargebacks(sale_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON public.chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_created ON public.chargebacks(created_at DESC);

-- RLS para chargebacks
ALTER TABLE public.chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_chargebacks"
ON public.chargebacks FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "admins_can_read_chargebacks"
ON public.chargebacks FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 6. Função para registrar mudanças de status automaticamente
CREATE OR REPLACE FUNCTION public.log_sale_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.sale_status_history (sale_id, previous_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para log automático
DROP TRIGGER IF EXISTS trigger_log_sale_status ON public.sales;
CREATE TRIGGER trigger_log_sale_status
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sale_status_change();

-- 7. View agregada para métricas do gateway (performance)
CREATE OR REPLACE VIEW public.v_gateway_metrics AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE status IN ('approved', 'completed')) as approved_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status IN ('declined', 'failed', 'cancelled')) as failed_count,
  COUNT(*) FILTER (WHERE status = 'refunded') as refunded_count,
  COUNT(*) FILTER (WHERE status = 'chargeback') as chargeback_count,
  COUNT(*) as total_attempts,
  SUM(amount) FILTER (WHERE status IN ('approved', 'completed')) as approved_amount,
  SUM(amount) FILTER (WHERE status = 'pending') as pending_amount,
  SUM(amount) as total_amount,
  SUM(platform_fee) FILTER (WHERE status IN ('approved', 'completed')) as total_platform_fees,
  SUM(payment_fee) FILTER (WHERE status IN ('approved', 'completed')) as total_payment_fees,
  -- Por método de pagamento
  COUNT(*) FILTER (WHERE payment_method = 'pix' AND status IN ('approved', 'completed')) as pix_count,
  SUM(amount) FILTER (WHERE payment_method = 'pix' AND status IN ('approved', 'completed')) as pix_amount,
  COUNT(*) FILTER (WHERE payment_method IN ('card', 'cartao', 'credit_card') AND status IN ('approved', 'completed')) as card_count,
  SUM(amount) FILTER (WHERE payment_method IN ('card', 'cartao', 'credit_card') AND status IN ('approved', 'completed')) as card_amount,
  COUNT(*) FILTER (WHERE payment_method = 'boleto' AND status IN ('approved', 'completed')) as boleto_count,
  SUM(amount) FILTER (WHERE payment_method = 'boleto' AND status IN ('approved', 'completed')) as boleto_amount
FROM public.sales
GROUP BY DATE(created_at);

-- Comentários
COMMENT ON TABLE public.payment_attempts IS 'Registro de todas as tentativas de pagamento para cálculo de taxa de conversão';
COMMENT ON TABLE public.sale_status_history IS 'Histórico imutável de mudanças de status para auditoria';
COMMENT ON TABLE public.refunds IS 'Registro de reembolsos solicitados e processados';
COMMENT ON TABLE public.chargebacks IS 'Registro de chargebacks recebidos e seu status';