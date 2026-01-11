-- Tabela para metas de vendas dos usuários
CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_amount NUMERIC NOT NULL DEFAULT 10000,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly', 'custom')),
  custom_start_date DATE,
  custom_end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Apenas uma meta ativa por usuário por tipo de período
  UNIQUE(user_id, period_type, is_active)
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias metas
CREATE POLICY "Users can view their own goals"
ON public.sales_goals
FOR SELECT
USING (auth.uid() = user_id);

-- Usuários podem criar suas próprias metas
CREATE POLICY "Users can create their own goals"
ON public.sales_goals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Usuários podem atualizar suas próprias metas
CREATE POLICY "Users can update their own goals"
ON public.sales_goals
FOR UPDATE
USING (auth.uid() = user_id);

-- Usuários podem deletar suas próprias metas
CREATE POLICY "Users can delete their own goals"
ON public.sales_goals
FOR DELETE
USING (auth.uid() = user_id);

-- Admins podem ver todas as metas
CREATE POLICY "Admins can view all goals"
ON public.sales_goals
FOR SELECT
USING (public.is_admin_or_moderator(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sales_goals_updated_at
BEFORE UPDATE ON public.sales_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_sales_goals_user_active ON public.sales_goals(user_id, is_active);
CREATE INDEX idx_sales_goals_period ON public.sales_goals(period_type, is_active);

-- Habilitar realtime na tabela sales para atualizações em tempo real
ALTER TABLE public.sales REPLICA IDENTITY FULL;

-- Adicionar sales à publicação de realtime (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  END IF;
END $$;