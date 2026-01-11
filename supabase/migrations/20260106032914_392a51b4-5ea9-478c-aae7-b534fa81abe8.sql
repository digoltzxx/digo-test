-- Tabela para armazenar histórico de alertas de meta
CREATE TABLE public.goal_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('50_percent', '80_percent', '100_percent')),
  goal_type TEXT NOT NULL DEFAULT 'award_plate' CHECK (goal_type IN ('award_plate', 'daily', 'weekly', 'monthly', 'custom')),
  plate_level INTEGER, -- 1, 2 ou 3 para placas de premiação
  threshold_amount NUMERIC NOT NULL, -- Valor da meta
  current_amount NUMERIC NOT NULL, -- Valor no momento do alerta
  percentage_reached NUMERIC NOT NULL, -- % atingido
  triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cycle_start_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Para controle do ciclo
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir apenas um alerta por tipo por ciclo
  UNIQUE(user_id, alert_type, goal_type, plate_level, cycle_start_date)
);

-- Enable RLS
ALTER TABLE public.goal_alerts ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver seus próprios alertas
CREATE POLICY "Users can view their own goal alerts"
ON public.goal_alerts
FOR SELECT
USING (auth.uid() = user_id);

-- Sistema pode inserir alertas (via service role ou trigger)
CREATE POLICY "System can insert goal alerts"
ON public.goal_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins podem ver todos os alertas
CREATE POLICY "Admins can view all goal alerts"
ON public.goal_alerts
FOR SELECT
USING (public.is_admin_or_moderator(auth.uid()));

-- Índices para performance
CREATE INDEX idx_goal_alerts_user_cycle ON public.goal_alerts(user_id, cycle_start_date);
CREATE INDEX idx_goal_alerts_triggered ON public.goal_alerts(triggered_at DESC);

-- Habilitar realtime para alertas
ALTER TABLE public.goal_alerts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'goal_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_alerts;
  END IF;
END $$;