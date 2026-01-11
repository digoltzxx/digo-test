-- Criar tabela de sessões de checkout para rastreamento de estado
CREATE TABLE public.checkout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_email TEXT,
  buyer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'failed', 'expired')),
  payment_method TEXT,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  transaction_id TEXT,
  session_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_expires_at TIMESTAMP WITH TIME ZONE,
  payment_approved_at TIMESTAMP WITH TIME ZONE,
  payment_failed_at TIMESTAMP WITH TIME ZONE,
  session_expired_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_checkout_sessions_product ON public.checkout_sessions(product_id);
CREATE INDEX idx_checkout_sessions_status ON public.checkout_sessions(status);
CREATE INDEX idx_checkout_sessions_transaction ON public.checkout_sessions(transaction_id);
CREATE INDEX idx_checkout_sessions_expires ON public.checkout_sessions(session_expires_at) WHERE status = 'pending';

-- Trigger para updated_at
CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Política: Vendedores podem ver sessões dos seus produtos
CREATE POLICY "Sellers can view checkout sessions for their products"
  ON public.checkout_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = checkout_sessions.product_id
      AND p.user_id = auth.uid()
    )
  );

-- Política: Sistema pode criar sessões (via service role)
CREATE POLICY "System can manage checkout sessions"
  ON public.checkout_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Criar tabela de logs de checkout para auditoria
CREATE TABLE public.checkout_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  buyer_email TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'session_started', 
    'payment_initiated', 
    'payment_processing', 
    'payment_approved', 
    'payment_failed', 
    'session_expired',
    'enrollment_created',
    'access_granted'
  )),
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para logs
CREATE INDEX idx_checkout_logs_session ON public.checkout_logs(session_id);
CREATE INDEX idx_checkout_logs_product ON public.checkout_logs(product_id);
CREATE INDEX idx_checkout_logs_event ON public.checkout_logs(event_type);
CREATE INDEX idx_checkout_logs_created ON public.checkout_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.checkout_logs ENABLE ROW LEVEL SECURITY;

-- Política: Vendedores podem ver logs dos seus produtos
CREATE POLICY "Sellers can view checkout logs for their products"
  ON public.checkout_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = checkout_logs.product_id
      AND p.user_id = auth.uid()
    )
  );

-- Política: Sistema pode criar logs
CREATE POLICY "System can manage checkout logs"
  ON public.checkout_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Função para criar log de checkout
CREATE OR REPLACE FUNCTION public.log_checkout_event(
  p_session_id UUID,
  p_product_id UUID,
  p_buyer_email TEXT,
  p_event_type TEXT,
  p_previous_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.checkout_logs (
    session_id,
    product_id,
    buyer_email,
    event_type,
    previous_status,
    new_status,
    metadata
  )
  VALUES (
    p_session_id,
    p_product_id,
    p_buyer_email,
    p_event_type,
    p_previous_status,
    p_new_status,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Função para criar/atualizar sessão de checkout
CREATE OR REPLACE FUNCTION public.upsert_checkout_session(
  p_product_id UUID,
  p_buyer_email TEXT,
  p_amount NUMERIC,
  p_payment_method TEXT DEFAULT NULL,
  p_expires_in_minutes INTEGER DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Cria nova sessão
  INSERT INTO public.checkout_sessions (
    product_id,
    buyer_email,
    amount,
    payment_method,
    status,
    session_expires_at
  )
  VALUES (
    p_product_id,
    p_buyer_email,
    p_amount,
    p_payment_method,
    'pending',
    now() + (p_expires_in_minutes || ' minutes')::INTERVAL
  )
  RETURNING id INTO v_session_id;
  
  -- Log do evento
  PERFORM log_checkout_event(
    v_session_id,
    p_product_id,
    p_buyer_email,
    'session_started',
    NULL,
    'pending',
    jsonb_build_object('expires_in_minutes', p_expires_in_minutes)
  );
  
  RETURN v_session_id;
END;
$$;

-- Função para atualizar status do checkout com validações
CREATE OR REPLACE FUNCTION public.update_checkout_status(
  p_session_id UUID,
  p_new_status TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_old_status TEXT;
BEGIN
  -- Busca sessão atual
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_session_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_old_status := v_session.status;
  
  -- REGRA CRÍTICA: Se já aprovado, não pode mudar status
  IF v_old_status = 'approved' THEN
    RAISE WARNING 'Checkout session % already approved, cannot change status', p_session_id;
    RETURN FALSE;
  END IF;
  
  -- REGRA: Se está processando, só pode ir para approved ou failed
  IF v_old_status = 'processing' AND p_new_status NOT IN ('approved', 'failed') THEN
    RAISE WARNING 'Cannot change from processing to %', p_new_status;
    RETURN FALSE;
  END IF;
  
  -- Atualiza sessão
  UPDATE public.checkout_sessions
  SET 
    status = p_new_status,
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    payment_approved_at = CASE WHEN p_new_status = 'approved' THEN now() ELSE payment_approved_at END,
    payment_failed_at = CASE WHEN p_new_status = 'failed' THEN now() ELSE payment_failed_at END,
    session_expired_at = CASE WHEN p_new_status = 'expired' THEN now() ELSE session_expired_at END,
    metadata = checkout_sessions.metadata || p_metadata,
    updated_at = now()
  WHERE id = p_session_id;
  
  -- Log do evento
  PERFORM log_checkout_event(
    p_session_id,
    v_session.product_id,
    v_session.buyer_email,
    CASE p_new_status
      WHEN 'processing' THEN 'payment_processing'
      WHEN 'approved' THEN 'payment_approved'
      WHEN 'failed' THEN 'payment_failed'
      WHEN 'expired' THEN 'session_expired'
      ELSE 'payment_initiated'
    END,
    v_old_status,
    p_new_status,
    p_metadata
  );
  
  RETURN TRUE;
END;
$$;