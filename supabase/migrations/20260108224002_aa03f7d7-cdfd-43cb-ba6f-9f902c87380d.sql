-- Tabela para sessões de impersonação (auditoria LGPD/GDPR)
CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  impersonated_user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '2 hours'),
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_impersonation_sessions_admin ON public.impersonation_sessions(admin_user_id);
CREATE INDEX idx_impersonation_sessions_impersonated ON public.impersonation_sessions(impersonated_user_id);
CREATE INDEX idx_impersonation_sessions_token ON public.impersonation_sessions(token);
CREATE INDEX idx_impersonation_sessions_status ON public.impersonation_sessions(status);

-- Habilitar RLS
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Apenas admins com roles específicas podem ver sessões
CREATE POLICY "Super admins podem ver sessões de impersonação"
ON public.impersonation_sessions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'admin_super') OR
  public.has_role(auth.uid(), 'admin')
);

-- Logs de ações durante impersonação
CREATE TABLE public.impersonation_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.impersonation_sessions(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL,
  impersonated_user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_impersonation_action_logs_session ON public.impersonation_action_logs(session_id);

ALTER TABLE public.impersonation_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins podem ver logs de ações"
ON public.impersonation_action_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR 
  public.has_role(auth.uid(), 'admin_super') OR
  public.has_role(auth.uid(), 'admin')
);

-- Função para verificar se usuário pode impersonar
CREATE OR REPLACE FUNCTION public.can_impersonate(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin_super')
  )
$$;