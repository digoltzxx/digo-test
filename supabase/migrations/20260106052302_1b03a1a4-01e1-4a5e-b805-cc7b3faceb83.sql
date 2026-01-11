-- Tabela para rastrear cliques em links de afiliados
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliation_id UUID NOT NULL REFERENCES public.affiliations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  affiliate_user_id UUID NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer_url TEXT,
  landing_url TEXT,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_affiliate_clicks_affiliation ON public.affiliate_clicks(affiliation_id);
CREATE INDEX idx_affiliate_clicks_product ON public.affiliate_clicks(product_id);
CREATE INDEX idx_affiliate_clicks_session ON public.affiliate_clicks(session_id);
CREATE INDEX idx_affiliate_clicks_created ON public.affiliate_clicks(created_at DESC);

-- RLS
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Afiliados podem ver seus próprios cliques
CREATE POLICY "Affiliates can view their own clicks"
ON public.affiliate_clicks
FOR SELECT
USING (affiliate_user_id = auth.uid());

-- Donos do produto podem ver cliques do seu produto
CREATE POLICY "Product owners can view clicks on their products"
ON public.affiliate_clicks
FOR SELECT
USING (
  product_id IN (
    SELECT id FROM public.products WHERE user_id = auth.uid()
  )
);

-- Permitir inserção de cliques (via edge function com service role)
CREATE POLICY "Allow insert via service role"
ON public.affiliate_clicks
FOR INSERT
WITH CHECK (true);

-- Permitir update para conversão (via edge function com service role)
CREATE POLICY "Allow update via service role"
ON public.affiliate_clicks
FOR UPDATE
USING (true)
WITH CHECK (true);