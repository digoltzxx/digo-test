-- Criar tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Dados da assinatura
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'canceled', 'expired', 'paused', 'past_due')),
  plan_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_interval IN ('monthly', 'yearly', 'weekly')),
  
  -- Valores
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  
  -- Período atual
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Datas importantes
  started_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  
  -- ID externo (gateway de pagamento)
  external_subscription_id TEXT,
  external_customer_id TEXT,
  payment_method TEXT DEFAULT 'credit_card',
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_product_id ON public.subscriptions(product_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE UNIQUE INDEX idx_subscriptions_external_id ON public.subscriptions(external_subscription_id) WHERE external_subscription_id IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (is_admin_or_moderator(auth.uid()));

CREATE POLICY "Admins can update all subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view subscriptions for their products"
  ON public.subscriptions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = subscriptions.product_id 
    AND products.user_id = auth.uid()
  ));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar acesso a produto por assinatura
CREATE OR REPLACE FUNCTION public.check_subscription_access(
  p_user_id UUID,
  p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND product_id = p_product_id
      AND status = 'active'
      AND current_period_end > now()
  );
END;
$$;

-- Função para obter assinatura ativa do usuário para um produto
CREATE OR REPLACE FUNCTION public.get_active_subscription(
  p_user_id UUID,
  p_product_id UUID
)
RETURNS TABLE(
  id UUID,
  status TEXT,
  plan_interval TEXT,
  amount NUMERIC,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.status,
    s.plan_interval,
    s.amount,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.product_id = p_product_id
    AND s.status IN ('active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;