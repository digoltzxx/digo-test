-- =====================================================
-- ENHANCE DELIVERY_LOGS TABLE
-- =====================================================

-- First drop the existing check constraint
ALTER TABLE public.delivery_logs 
DROP CONSTRAINT IF EXISTS delivery_logs_delivery_status_check;

-- Add missing columns
ALTER TABLE public.delivery_logs 
ADD COLUMN IF NOT EXISTS codigo_erro VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS payload_referencia JSONB NULL,
ADD COLUMN IF NOT EXISTS tempo_processamento_ms INTEGER NULL,
ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(100) NULL;

-- Add new check constraint with all valid status values
ALTER TABLE public.delivery_logs 
ADD CONSTRAINT delivery_logs_delivery_status_check 
CHECK (delivery_status IN ('pending', 'processing', 'completed', 'failed', 'sucesso', 'falha', 'pendente', 'skipped'));

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_logs_correlation 
ON public.delivery_logs (correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_logs_codigo_erro 
ON public.delivery_logs (codigo_erro) WHERE codigo_erro IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_logs_status_type_created 
ON public.delivery_logs (delivery_status, delivery_type, created_at DESC);

-- RLS policies for append-only audit
DROP POLICY IF EXISTS "Service role can insert delivery logs" ON public.delivery_logs;
CREATE POLICY "Service role can insert delivery logs"
ON public.delivery_logs FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Block updates on delivery logs" ON public.delivery_logs;
CREATE POLICY "Block updates on delivery logs"
ON public.delivery_logs FOR UPDATE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Block deletes on delivery logs" ON public.delivery_logs;
CREATE POLICY "Block deletes on delivery logs"
ON public.delivery_logs FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Admins can update delivery logs" ON public.delivery_logs;
CREATE POLICY "Admins can update delivery logs"
ON public.delivery_logs FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete delivery logs" ON public.delivery_logs;
CREATE POLICY "Admins can delete delivery logs"
ON public.delivery_logs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));