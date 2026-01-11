-- ============================================
-- DELIVERY LOGS SYSTEM - COMPLETE MIGRATION
-- ============================================

-- 1. Criar enum para tipos de status (se não existir)
DO $$ BEGIN
  CREATE TYPE delivery_log_status AS ENUM ('sucesso', 'falha', 'pendente');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Criar a tabela delivery_logs_v2 com schema correto
CREATE TABLE IF NOT EXISTS public.delivery_logs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  email_destino TEXT NOT NULL,
  tipo_entrega TEXT NOT NULL,
  
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'falha', 'pendente')),
  
  erro_detalhado TEXT,
  codigo_erro TEXT,
  
  payload_referencia JSONB,
  metadata_adicional JSONB,
  
  tempo_processamento_ms INTEGER,
  tentativas INTEGER NOT NULL DEFAULT 1,
  
  correlation_id TEXT,
  
  -- Campos para auditoria
  seller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_id UUID
);

-- 3. Migrar dados existentes da tabela antiga (se existir)
INSERT INTO public.delivery_logs_v2 (
  id,
  created_at,
  email_destino,
  tipo_entrega,
  status,
  erro_detalhado,
  codigo_erro,
  payload_referencia,
  metadata_adicional,
  tempo_processamento_ms,
  tentativas,
  correlation_id,
  product_id
)
SELECT 
  id,
  created_at,
  COALESCE(user_email, 'unknown@email.com') as email_destino,
  delivery_type as tipo_entrega,
  CASE 
    WHEN delivery_status = 'completed' THEN 'sucesso'
    WHEN delivery_status = 'failed' THEN 'falha'
    WHEN delivery_status IN ('pending', 'processing') THEN 'pendente'
    ELSE 'pendente'
  END as status,
  error_message as erro_detalhado,
  codigo_erro,
  payload_referencia,
  metadata as metadata_adicional,
  tempo_processamento_ms,
  COALESCE(retry_count, 1) as tentativas,
  correlation_id,
  product_id
FROM public.delivery_logs
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_logs_v2 WHERE delivery_logs_v2.id = delivery_logs.id);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_created_at 
  ON public.delivery_logs_v2 (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_email 
  ON public.delivery_logs_v2 (email_destino);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_status 
  ON public.delivery_logs_v2 (status);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_correlation 
  ON public.delivery_logs_v2 (correlation_id);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_tipo_entrega 
  ON public.delivery_logs_v2 (tipo_entrega);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_seller 
  ON public.delivery_logs_v2 (seller_user_id);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_product 
  ON public.delivery_logs_v2 (product_id);

-- Índice composto para queries comuns
CREATE INDEX IF NOT EXISTS idx_delivery_logs_v2_status_created 
  ON public.delivery_logs_v2 (status, created_at DESC);

-- 5. Ativar Row Level Security
ALTER TABLE public.delivery_logs_v2 ENABLE ROW LEVEL SECURITY;

-- 6. Criar função auxiliar para verificar admin (security definer)
CREATE OR REPLACE FUNCTION public.is_admin_user(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'admin'
  )
$$;

-- 7. Políticas RLS

-- Política: Service role pode fazer tudo
CREATE POLICY "service_role_full_access_logs_v2"
ON public.delivery_logs_v2
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política: Admins podem ler todos os logs
CREATE POLICY "admins_can_read_all_logs_v2"
ON public.delivery_logs_v2
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
);

-- Política: Sellers podem ver logs dos seus produtos
CREATE POLICY "sellers_can_read_own_product_logs_v2"
ON public.delivery_logs_v2
FOR SELECT
TO authenticated
USING (
  seller_user_id = auth.uid()
  OR product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

-- Política: Sistema pode inserir logs (via service_role)
-- INSERT já coberto pela policy service_role_full_access

-- Política: Bloquear UPDATE para manter append-only
-- Não criar política de UPDATE significa que ninguém pode atualizar

-- Política: Bloquear DELETE para manter auditoria
-- Não criar política de DELETE significa que ninguém pode deletar

-- 8. Comentários na tabela para documentação
COMMENT ON TABLE public.delivery_logs_v2 IS 'Logs de entrega do sistema - append-only para auditoria';
COMMENT ON COLUMN public.delivery_logs_v2.email_destino IS 'Email do destinatário da entrega';
COMMENT ON COLUMN public.delivery_logs_v2.tipo_entrega IS 'Tipo: email, produto, webhook, notificação';
COMMENT ON COLUMN public.delivery_logs_v2.status IS 'Status: sucesso, falha, pendente';
COMMENT ON COLUMN public.delivery_logs_v2.erro_detalhado IS 'Mensagem de erro completa (se houver)';
COMMENT ON COLUMN public.delivery_logs_v2.codigo_erro IS 'Código de erro padronizado';
COMMENT ON COLUMN public.delivery_logs_v2.payload_referencia IS 'Dados de referência (mascarados se sensíveis)';
COMMENT ON COLUMN public.delivery_logs_v2.metadata_adicional IS 'Metadados extensíveis';
COMMENT ON COLUMN public.delivery_logs_v2.tempo_processamento_ms IS 'Tempo de processamento em milissegundos';
COMMENT ON COLUMN public.delivery_logs_v2.tentativas IS 'Número de tentativas de entrega';
COMMENT ON COLUMN public.delivery_logs_v2.correlation_id IS 'ID para correlação de logs distribuídos';