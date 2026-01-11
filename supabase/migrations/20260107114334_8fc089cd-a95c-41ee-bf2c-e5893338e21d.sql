-- ============================================
-- TABELA: utm_tracking
-- Armazena UTMs capturadas com rastreabilidade completa
-- Nunca sobrescreve dados históricos
-- ============================================

CREATE TABLE public.utm_tracking (
  -- Identificador único do registro
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Referências para rastreabilidade
  user_id UUID, -- ID do usuário (pode ser nulo para visitantes anônimos)
  checkout_session_id UUID REFERENCES public.checkout_sessions(id), -- Sessão de checkout associada
  sale_id UUID REFERENCES public.sales(id), -- Venda associada (preenchido após pagamento)
  transaction_id TEXT, -- ID da transação no gateway
  
  -- UTMs principais (padrão Google Analytics)
  utm_source TEXT, -- Origem do tráfego (google, facebook, instagram)
  utm_medium TEXT, -- Meio de marketing (cpc, email, social)
  utm_campaign TEXT, -- Nome da campanha
  utm_content TEXT, -- Conteúdo do anúncio (variação A/B)
  utm_term TEXT, -- Termo de busca pago
  
  -- Dados de contexto do acesso
  landing_page TEXT, -- URL de entrada do usuário
  referrer TEXT, -- URL de referência (de onde veio)
  ip_address INET, -- IP do visitante (para geolocalização)
  user_agent TEXT, -- Navegador/dispositivo
  session_id TEXT, -- ID da sessão do frontend
  
  -- Controle de envio para UTMify
  utmify_sent BOOLEAN DEFAULT false, -- Se já foi enviado para UTMify
  utmify_sent_at TIMESTAMPTZ, -- Quando foi enviado
  utmify_response JSONB, -- Resposta da API UTMify
  utmify_error TEXT, -- Erro caso falhe
  utmify_retry_count INTEGER DEFAULT 0, -- Quantidade de tentativas
  
  -- Auditoria e imutabilidade
  is_locked BOOLEAN DEFAULT false, -- Trava após pagamento confirmado
  locked_at TIMESTAMPTZ, -- Quando foi travado
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- Data de captura das UTMs
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_utm_tracking_user_id ON public.utm_tracking(user_id);
CREATE INDEX idx_utm_tracking_checkout_session_id ON public.utm_tracking(checkout_session_id);
CREATE INDEX idx_utm_tracking_sale_id ON public.utm_tracking(sale_id);
CREATE INDEX idx_utm_tracking_session_id ON public.utm_tracking(session_id);
CREATE INDEX idx_utm_tracking_utmify_sent ON public.utm_tracking(utmify_sent) WHERE utmify_sent = false;
CREATE INDEX idx_utm_tracking_created_at ON public.utm_tracking(created_at DESC);

-- Índice composto para campanhas
CREATE INDEX idx_utm_tracking_campaign ON public.utm_tracking(utm_source, utm_medium, utm_campaign);

-- Habilitar RLS
ALTER TABLE public.utm_tracking ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seus próprios dados
CREATE POLICY "Users can view their own utm tracking"
ON public.utm_tracking FOR SELECT
USING (auth.uid() = user_id);

-- Política: Sistema pode inserir (via service role)
CREATE POLICY "Service can insert utm tracking"
ON public.utm_tracking FOR INSERT
WITH CHECK (true);

-- Política: Sistema pode atualizar apenas se não estiver travado
CREATE POLICY "Service can update unlocked utm tracking"
ON public.utm_tracking FOR UPDATE
USING (is_locked = false);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_utm_tracking_updated_at
BEFORE UPDATE ON public.utm_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para impedir alteração após travamento
CREATE OR REPLACE FUNCTION public.prevent_utm_tracking_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_locked = true AND NEW.is_locked = true THEN
    -- Permite apenas atualização dos campos de envio UTMify
    IF (
      OLD.utm_source IS DISTINCT FROM NEW.utm_source OR
      OLD.utm_medium IS DISTINCT FROM NEW.utm_medium OR
      OLD.utm_campaign IS DISTINCT FROM NEW.utm_campaign OR
      OLD.utm_content IS DISTINCT FROM NEW.utm_content OR
      OLD.utm_term IS DISTINCT FROM NEW.utm_term OR
      OLD.landing_page IS DISTINCT FROM NEW.landing_page OR
      OLD.referrer IS DISTINCT FROM NEW.referrer
    ) THEN
      RAISE EXCEPTION 'UTM data cannot be modified after payment confirmation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_utm_modification
BEFORE UPDATE ON public.utm_tracking
FOR EACH ROW
EXECUTE FUNCTION public.prevent_utm_tracking_modification();

-- Função para travar UTMs após pagamento
CREATE OR REPLACE FUNCTION public.lock_utm_tracking_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE public.utm_tracking
    SET is_locked = true, locked_at = now()
    WHERE sale_id = NEW.id AND is_locked = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER lock_utm_on_sale_paid
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.lock_utm_tracking_on_payment();

-- Comentários explicativos
COMMENT ON TABLE public.utm_tracking IS 'Armazena UTMs capturadas para rastreamento de campanhas e integração com UTMify';
COMMENT ON COLUMN public.utm_tracking.id IS 'Identificador único do registro de UTM';
COMMENT ON COLUMN public.utm_tracking.user_id IS 'ID do usuário autenticado (nulo para visitantes anônimos)';
COMMENT ON COLUMN public.utm_tracking.checkout_session_id IS 'ID da sessão de checkout associada';
COMMENT ON COLUMN public.utm_tracking.sale_id IS 'ID da venda após confirmação de pagamento';
COMMENT ON COLUMN public.utm_tracking.transaction_id IS 'ID da transação no gateway de pagamento';
COMMENT ON COLUMN public.utm_tracking.utm_source IS 'Origem do tráfego (ex: google, facebook, instagram)';
COMMENT ON COLUMN public.utm_tracking.utm_medium IS 'Meio de marketing (ex: cpc, email, social, organic)';
COMMENT ON COLUMN public.utm_tracking.utm_campaign IS 'Nome identificador da campanha';
COMMENT ON COLUMN public.utm_tracking.utm_content IS 'Variação do conteúdo para testes A/B';
COMMENT ON COLUMN public.utm_tracking.utm_term IS 'Termo de busca pago (para Google Ads)';
COMMENT ON COLUMN public.utm_tracking.landing_page IS 'URL completa da página de entrada';
COMMENT ON COLUMN public.utm_tracking.referrer IS 'URL de onde o usuário veio';
COMMENT ON COLUMN public.utm_tracking.ip_address IS 'Endereço IP do visitante';
COMMENT ON COLUMN public.utm_tracking.user_agent IS 'Informações do navegador e dispositivo';
COMMENT ON COLUMN public.utm_tracking.session_id IS 'ID da sessão do frontend para correlação';
COMMENT ON COLUMN public.utm_tracking.utmify_sent IS 'Indica se os dados foram enviados para UTMify';
COMMENT ON COLUMN public.utm_tracking.utmify_sent_at IS 'Data/hora do envio para UTMify';
COMMENT ON COLUMN public.utm_tracking.utmify_response IS 'Resposta JSON da API UTMify';
COMMENT ON COLUMN public.utm_tracking.utmify_error IS 'Mensagem de erro caso o envio falhe';
COMMENT ON COLUMN public.utm_tracking.utmify_retry_count IS 'Número de tentativas de reenvio';
COMMENT ON COLUMN public.utm_tracking.is_locked IS 'Trava que impede alteração após pagamento';
COMMENT ON COLUMN public.utm_tracking.locked_at IS 'Data/hora em que o registro foi travado';