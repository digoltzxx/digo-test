
-- ============================================================
-- SISTEMA DE COMISSÕES DE COPRODUTORES
-- ============================================================

-- 1. Adicionar campo commission_type à tabela co_producers
ALTER TABLE public.co_producers 
ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage';

-- Adicionar constraint para validar tipos de comissão
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'co_producers_commission_type_check') THEN
    ALTER TABLE public.co_producers 
    ADD CONSTRAINT co_producers_commission_type_check 
    CHECK (commission_type IN ('percentage', 'fixed'));
  END IF;
END $$;

-- 2. Criar tabela de comissões por transação
CREATE TABLE IF NOT EXISTS public.sale_commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('producer', 'coproducer', 'affiliate')),
  commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_percentage numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  sale_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sale_commissions_sale_id ON public.sale_commissions(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_user_id ON public.sale_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_status ON public.sale_commissions(status);
CREATE INDEX IF NOT EXISTS idx_sale_commissions_created_at ON public.sale_commissions(created_at DESC);

-- 3. Criar tabela de comissões por item (order bumps, upsells)
CREATE TABLE IF NOT EXISTS public.order_item_commissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  sale_commission_id uuid REFERENCES public.sale_commissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('producer', 'coproducer', 'affiliate')),
  commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_percentage numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  item_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_item_commissions_order_item_id ON public.order_item_commissions(order_item_id);
CREATE INDEX IF NOT EXISTS idx_order_item_commissions_user_id ON public.order_item_commissions(user_id);

-- 4. Habilitar RLS
ALTER TABLE public.sale_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_commissions ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para sale_commissions
-- Usuários podem ver suas próprias comissões
CREATE POLICY "Users can view their own commissions" 
ON public.sale_commissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Produtores podem ver todas as comissões de seus produtos
CREATE POLICY "Producers can view all commissions for their products" 
ON public.sale_commissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.id = sale_commissions.sale_id 
    AND p.user_id = auth.uid()
  )
);

-- Service role pode gerenciar (para webhooks)
CREATE POLICY "Service role can manage commissions" 
ON public.sale_commissions 
FOR ALL 
USING (auth.role() = 'service_role');

-- 6. Políticas RLS para order_item_commissions
CREATE POLICY "Users can view their own item commissions" 
ON public.order_item_commissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Producers can view all item commissions for their products" 
ON public.order_item_commissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.sales s ON oi.sale_id = s.id
    JOIN public.products p ON s.product_id = p.id
    WHERE oi.id = order_item_commissions.order_item_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage item commissions" 
ON public.order_item_commissions 
FOR ALL 
USING (auth.role() = 'service_role');

-- 7. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_sale_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_sale_commissions_updated_at ON public.sale_commissions;
CREATE TRIGGER update_sale_commissions_updated_at
BEFORE UPDATE ON public.sale_commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_sale_commissions_updated_at();

-- 8. Adicionar realtime para comissões
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_commissions;
