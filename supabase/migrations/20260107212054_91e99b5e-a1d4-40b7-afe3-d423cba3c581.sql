-- ═══════════════════════════════════════════════════════════
-- MIGRAÇÃO: Suporte EdTech para Voxuy e Cademi
-- Adiciona campos de sincronização externa + tabela de webhook logs
-- ═══════════════════════════════════════════════════════════

-- 1. Adicionar campos de sincronização externa em STUDENTS
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_platform TEXT CHECK (external_platform IN ('voxuy', 'cademi', 'memberkit', 'astron')),
ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}';

-- Criar índice único para external_id + platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_external_unique 
ON public.students (external_id, external_platform) 
WHERE external_id IS NOT NULL;

-- 2. Adicionar campos de sincronização externa em COURSES
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_platform TEXT CHECK (external_platform IN ('voxuy', 'cademi', 'memberkit', 'astron')),
ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS external_metadata JSONB DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_external_unique 
ON public.courses (external_id, external_platform) 
WHERE external_id IS NOT NULL;

-- 3. Adicionar campos de sincronização em ENROLLMENTS
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS external_platform TEXT CHECK (external_platform IN ('voxuy', 'cademi', 'memberkit', 'astron')),
ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0;

-- 4. Criar tabela de WEBHOOK LOGS para EdTech
CREATE TABLE IF NOT EXISTS public.edtech_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('voxuy', 'cademi', 'memberkit', 'astron')),
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'error', 'skipped')),
  error_message TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_edtech_webhook_logs_user ON public.edtech_webhook_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_edtech_webhook_logs_platform ON public.edtech_webhook_logs (platform);
CREATE INDEX IF NOT EXISTS idx_edtech_webhook_logs_status ON public.edtech_webhook_logs (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edtech_webhook_idempotency ON public.edtech_webhook_logs (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 5. Criar tabela de TOKEN REFRESH para OAuth
CREATE TABLE IF NOT EXISTS public.integration_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  integration_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scopes TEXT[],
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, integration_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_tokens_expires ON public.integration_tokens (expires_at);

-- 6. RLS Policies
ALTER TABLE public.edtech_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

-- Webhook logs: usuários veem seus próprios logs
CREATE POLICY "Users can view their own webhook logs" 
ON public.edtech_webhook_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook logs" 
ON public.edtech_webhook_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Tokens: usuários gerenciam seus próprios tokens
CREATE POLICY "Users can manage their own tokens" 
ON public.integration_tokens FOR ALL 
USING (auth.uid() = user_id);

-- 7. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_integration_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_integration_tokens_updated_at
BEFORE UPDATE ON public.integration_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_integration_tokens_updated_at();