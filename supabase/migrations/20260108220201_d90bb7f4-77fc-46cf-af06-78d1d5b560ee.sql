-- Tabela: gateways
CREATE TABLE IF NOT EXISTS public.gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: adquirentes
CREATE TABLE IF NOT EXISTS public.adquirentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES public.gateways(id) ON DELETE CASCADE,
  nome_exibicao VARCHAR(150) NOT NULL,
  ativo BOOLEAN DEFAULT true,
  principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: adquirente_logs (auditoria)
CREATE TABLE IF NOT EXISTS public.adquirente_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id UUID NOT NULL REFERENCES public.gateways(id),
  adquirente_anterior UUID REFERENCES public.adquirentes(id),
  adquirente_nova UUID REFERENCES public.adquirentes(id),
  alterado_por UUID,
  motivo VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_adquirentes_gateway_id ON public.adquirentes(gateway_id);
CREATE INDEX IF NOT EXISTS idx_adquirentes_principal ON public.adquirentes(gateway_id, principal) WHERE principal = true;
CREATE INDEX IF NOT EXISTS idx_adquirente_logs_gateway ON public.adquirente_logs(gateway_id);

-- Função para garantir apenas 1 adquirente principal por gateway
CREATE OR REPLACE FUNCTION public.enforce_single_primary_acquirer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.principal = true THEN
    UPDATE public.adquirentes
    SET principal = false
    WHERE gateway_id = NEW.gateway_id
      AND id != NEW.id
      AND principal = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para garantir apenas 1 principal
DROP TRIGGER IF EXISTS trigger_single_primary_acquirer ON public.adquirentes;
CREATE TRIGGER trigger_single_primary_acquirer
BEFORE INSERT OR UPDATE OF principal ON public.adquirentes
FOR EACH ROW
WHEN (NEW.principal = true)
EXECUTE FUNCTION public.enforce_single_primary_acquirer();

-- Função para resolver adquirente principal com fallback
CREATE OR REPLACE FUNCTION public.resolve_primary_acquirer(p_gateway_id UUID)
RETURNS TABLE(id UUID, nome_exibicao VARCHAR) AS $$
BEGIN
  RETURN QUERY
  WITH principal AS (
    SELECT a.id, a.nome_exibicao
    FROM public.adquirentes a
    WHERE a.gateway_id = p_gateway_id
      AND a.ativo = true
      AND a.principal = true
    LIMIT 1
  ),
  fallback AS (
    SELECT a.id, a.nome_exibicao
    FROM public.adquirentes a
    WHERE a.gateway_id = p_gateway_id
      AND a.ativo = true
    ORDER BY a.created_at ASC
    LIMIT 1
  )
  SELECT * FROM principal
  UNION ALL
  SELECT * FROM fallback WHERE NOT EXISTS (SELECT 1 FROM principal)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para trocar adquirente principal com log
CREATE OR REPLACE FUNCTION public.change_primary_acquirer(
  p_gateway_id UUID,
  p_nova_adquirente_id UUID,
  p_user_id UUID,
  p_motivo VARCHAR DEFAULT 'Troca de adquirente principal'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_anterior_id UUID;
BEGIN
  SELECT id INTO v_anterior_id
  FROM public.adquirentes
  WHERE gateway_id = p_gateway_id AND principal = true;
  
  UPDATE public.adquirentes
  SET principal = false, updated_at = NOW()
  WHERE gateway_id = p_gateway_id AND principal = true;
  
  UPDATE public.adquirentes
  SET principal = true, updated_at = NOW()
  WHERE id = p_nova_adquirente_id;
  
  INSERT INTO public.adquirente_logs (
    gateway_id, adquirente_anterior, adquirente_nova, alterado_por, motivo
  ) VALUES (
    p_gateway_id, v_anterior_id, p_nova_adquirente_id, p_user_id, p_motivo
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE public.gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adquirentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adquirente_logs ENABLE ROW LEVEL SECURITY;

-- Políticas públicas para leitura (service role pode escrever)
CREATE POLICY "Public read gateways" ON public.gateways FOR SELECT USING (true);
CREATE POLICY "Public read adquirentes" ON public.adquirentes FOR SELECT USING (true);
CREATE POLICY "Public read adquirente_logs" ON public.adquirente_logs FOR SELECT USING (true);

-- Dados iniciais
INSERT INTO public.gateways (id, nome, ativo) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Royal Gateway', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.adquirentes (gateway_id, nome_exibicao, ativo, principal) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Cielo', true, true),
  ('11111111-1111-1111-1111-111111111111', 'Rede', true, false),
  ('11111111-1111-1111-1111-111111111111', 'Stone', true, false)
ON CONFLICT DO NOTHING;