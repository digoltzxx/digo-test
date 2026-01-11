-- ============================================================
-- SISTEMA DE ANTECIPAÇÃO DE COMISSÕES E SPLIT AUTOMÁTICO
-- ============================================================

-- 1. Adicionar campos faltantes na tabela sale_commissions
ALTER TABLE public.sale_commissions 
ADD COLUMN IF NOT EXISTS anticipated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS anticipation_id uuid,
ADD COLUMN IF NOT EXISTS original_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_status text CHECK (refund_status IN ('none', 'pending_debt', 'cleared')) DEFAULT 'none';

-- Adicionar índice para antecipações
CREATE INDEX IF NOT EXISTS idx_sale_commissions_anticipated_at ON public.sale_commissions(anticipated_at);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_anticipation_id ON public.sale_commissions(anticipation_id);

-- 2. Criar tabela de antecipações
CREATE TABLE IF NOT EXISTS public.commission_anticipations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  total_original_amount numeric NOT NULL DEFAULT 0,
  total_anticipated_amount numeric NOT NULL DEFAULT 0,
  fee_percentage numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'cancelled', 'failed')),
  approved_at timestamp with time zone,
  processed_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancelled_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_anticipations_user_id ON public.commission_anticipations(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_anticipations_status ON public.commission_anticipations(status);
CREATE INDEX IF NOT EXISTS idx_commission_anticipations_created_at ON public.commission_anticipations(created_at DESC);

-- 3. Criar tabela de itens de antecipação (comissões individuais antecipadas)
CREATE TABLE IF NOT EXISTS public.anticipation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anticipation_id uuid NOT NULL REFERENCES public.commission_anticipations(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.sale_commissions(id) ON DELETE CASCADE,
  original_amount numeric NOT NULL DEFAULT 0,
  anticipated_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anticipation_items_anticipation_id ON public.anticipation_items(anticipation_id);
CREATE INDEX IF NOT EXISTS idx_anticipation_items_commission_id ON public.anticipation_items(commission_id);

-- 4. Criar tabela de splits de pagamento
CREATE TABLE IF NOT EXISTS public.payment_splits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('producer', 'coproducer', 'affiliate', 'platform')),
  gross_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  split_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'transferred', 'failed')),
  gateway_reference text,
  processed_at timestamp with time zone,
  transferred_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_sale_id ON public.payment_splits(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_user_id ON public.payment_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_splits_status ON public.payment_splits(status);

-- 5. Criar tabela de débitos de reembolso (para antecipações reembolsadas)
CREATE TABLE IF NOT EXISTS public.anticipation_debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  anticipation_id uuid NOT NULL REFERENCES public.commission_anticipations(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.sale_commissions(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  debt_amount numeric NOT NULL DEFAULT 0,
  cleared_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'cleared')),
  cleared_at timestamp with time zone,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anticipation_debts_user_id ON public.anticipation_debts(user_id);
CREATE INDEX IF NOT EXISTS idx_anticipation_debts_status ON public.anticipation_debts(status);

-- 6. Criar tabela de logs de auditoria financeira para antecipações
CREATE TABLE IF NOT EXISTS public.anticipation_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anticipation_id uuid REFERENCES public.commission_anticipations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anticipation_logs_anticipation_id ON public.anticipation_logs(anticipation_id);
CREATE INDEX IF NOT EXISTS idx_anticipation_logs_user_id ON public.anticipation_logs(user_id);

-- 7. Habilitar RLS em todas as tabelas
ALTER TABLE public.commission_anticipations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipation_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipation_logs ENABLE ROW LEVEL SECURITY;

-- 8. Políticas RLS para commission_anticipations
CREATE POLICY "Users can view their own anticipations" 
ON public.commission_anticipations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own anticipations" 
ON public.commission_anticipations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage anticipations" 
ON public.commission_anticipations 
FOR ALL 
USING (auth.role() = 'service_role');

-- 9. Políticas RLS para anticipation_items
CREATE POLICY "Users can view their own anticipation items" 
ON public.anticipation_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.commission_anticipations ca 
    WHERE ca.id = anticipation_items.anticipation_id 
    AND ca.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage anticipation items" 
ON public.anticipation_items 
FOR ALL 
USING (auth.role() = 'service_role');

-- 10. Políticas RLS para payment_splits
CREATE POLICY "Users can view their own splits" 
ON public.payment_splits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Producers can view all splits for their sales" 
ON public.payment_splits 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.id = payment_splits.sale_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage splits" 
ON public.payment_splits 
FOR ALL 
USING (auth.role() = 'service_role');

-- 11. Políticas RLS para anticipation_debts
CREATE POLICY "Users can view their own debts" 
ON public.anticipation_debts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage debts" 
ON public.anticipation_debts 
FOR ALL 
USING (auth.role() = 'service_role');

-- 12. Políticas RLS para anticipation_logs
CREATE POLICY "Users can view their own anticipation logs" 
ON public.anticipation_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage anticipation logs" 
ON public.anticipation_logs 
FOR ALL 
USING (auth.role() = 'service_role');

-- 13. Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_anticipation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_commission_anticipations_updated_at ON public.commission_anticipations;
CREATE TRIGGER update_commission_anticipations_updated_at
BEFORE UPDATE ON public.commission_anticipations
FOR EACH ROW
EXECUTE FUNCTION public.update_anticipation_updated_at();

DROP TRIGGER IF EXISTS update_payment_splits_updated_at ON public.payment_splits;
CREATE TRIGGER update_payment_splits_updated_at
BEFORE UPDATE ON public.payment_splits
FOR EACH ROW
EXECUTE FUNCTION public.update_anticipation_updated_at();

DROP TRIGGER IF EXISTS update_anticipation_debts_updated_at ON public.anticipation_debts;
CREATE TRIGGER update_anticipation_debts_updated_at
BEFORE UPDATE ON public.anticipation_debts
FOR EACH ROW
EXECUTE FUNCTION public.update_anticipation_updated_at();

-- 14. Adicionar realtime para tabelas principais
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_anticipations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.anticipation_debts;