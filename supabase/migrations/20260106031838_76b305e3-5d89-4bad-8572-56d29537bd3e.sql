-- Tabela para armazenar relatórios diários consolidados
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  seller_user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id),
  payment_method TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir apenas um relatório por combinação dia/vendedor/produto/método
  UNIQUE(report_date, seller_user_id, product_id, payment_method)
);

-- Enable RLS
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas seus próprios relatórios
CREATE POLICY "Users can view their own daily reports"
ON public.daily_reports
FOR SELECT
USING (auth.uid() = seller_user_id);

-- Admins podem ver todos os relatórios
CREATE POLICY "Admins can view all daily reports"
ON public.daily_reports
FOR SELECT
USING (public.is_admin_or_moderator(auth.uid()));

-- Apenas o sistema pode inserir relatórios (via service role)
CREATE POLICY "System can insert daily reports"
ON public.daily_reports
FOR INSERT
WITH CHECK (false); -- Apenas service role pode inserir

-- Índices para performance
CREATE INDEX idx_daily_reports_seller_date ON public.daily_reports(seller_user_id, report_date);
CREATE INDEX idx_daily_reports_date ON public.daily_reports(report_date);

-- Função para gerar relatório diário de um vendedor
CREATE OR REPLACE FUNCTION public.generate_daily_report(p_date DATE, p_seller_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_time TIMESTAMP WITH TIME ZONE;
  v_end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Definir período do dia
  v_start_time := p_date::TIMESTAMP WITH TIME ZONE;
  v_end_time := (p_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE;
  
  -- Inserir relatórios consolidados por produto e método de pagamento
  INSERT INTO public.daily_reports (
    report_date,
    seller_user_id,
    product_id,
    payment_method,
    total_amount,
    net_amount,
    sales_count,
    generated_at
  )
  SELECT 
    p_date,
    s.seller_user_id,
    s.product_id,
    s.payment_method,
    SUM(s.amount),
    SUM(s.net_amount),
    COUNT(*),
    now()
  FROM public.sales s
  WHERE s.created_at >= v_start_time
    AND s.created_at < v_end_time
    AND s.status = 'approved'
    AND (p_seller_id IS NULL OR s.seller_user_id = p_seller_id)
  GROUP BY s.seller_user_id, s.product_id, s.payment_method
  ON CONFLICT (report_date, seller_user_id, product_id, payment_method) 
  DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    net_amount = EXCLUDED.net_amount,
    sales_count = EXCLUDED.sales_count,
    generated_at = now();
END;
$$;

-- Função para gerar relatórios de todos os vendedores do dia anterior
CREATE OR REPLACE FUNCTION public.generate_all_daily_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Gerar relatório do dia anterior para todos os vendedores
  PERFORM public.generate_daily_report((CURRENT_DATE - INTERVAL '1 day')::DATE);
END;
$$;