-- Tabela de logs de envio para UTMify
CREATE TABLE public.utmify_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  payload JSONB NOT NULL,
  response JSONB,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_utmify_logs_sale_id ON public.utmify_logs(sale_id);
CREATE INDEX idx_utmify_logs_status ON public.utmify_logs(status);
CREATE INDEX idx_utmify_logs_order_id ON public.utmify_logs(order_id);
CREATE INDEX idx_utmify_logs_created_at ON public.utmify_logs(created_at DESC);

-- Índice único para idempotência (uma venda só pode ter um log "sent")
CREATE UNIQUE INDEX idx_utmify_logs_sale_sent ON public.utmify_logs(sale_id) 
  WHERE status = 'sent';

-- Enable RLS
ALTER TABLE public.utmify_logs ENABLE ROW LEVEL SECURITY;

-- Política RLS simples (service role pode tudo, admins podem ver)
CREATE POLICY "Service role full access on utmify_logs"
  ON public.utmify_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE public.utmify_logs IS 'Logs de envio de conversões para a UTMify';
COMMENT ON COLUMN public.utmify_logs.sale_id IS 'ID da venda associada';
COMMENT ON COLUMN public.utmify_logs.order_id IS 'ID do pedido enviado para UTMify';
COMMENT ON COLUMN public.utmify_logs.status IS 'Status do envio: pending, sent, failed, retrying';
COMMENT ON COLUMN public.utmify_logs.payload IS 'Payload enviado para a UTMify';
COMMENT ON COLUMN public.utmify_logs.response IS 'Resposta recebida da UTMify';
COMMENT ON COLUMN public.utmify_logs.attempts IS 'Número de tentativas de envio';