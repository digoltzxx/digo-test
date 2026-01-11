-- ================================================
-- TABELA: taxas_configuradas (Configuração de Taxas)
-- ================================================
CREATE TABLE IF NOT EXISTS public.taxas_configuradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  
  -- Valores
  valor DECIMAL(15,4) NOT NULL DEFAULT 0,
  tipo_valor VARCHAR(20) NOT NULL CHECK (tipo_valor IN ('percentual', 'fixo')),
  
  -- Classificação
  categoria_taxa VARCHAR(50) NOT NULL CHECK (categoria_taxa IN (
    'taxas_plataforma',
    'taxas_financeiras', 
    'taxas_disputa',
    'taxas_banking',
    'taxas_extensoes'
  )),
  
  -- Aplicabilidade
  tipo_transacao VARCHAR(50) NOT NULL CHECK (tipo_transacao IN (
    'pagamento',
    'saque',
    'antecipacao',
    'reembolso',
    'chargeback',
    'assinatura',
    'todos'
  )),
  
  -- Status
  ativa BOOLEAN DEFAULT true,
  
  -- Metadados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- TABELA: taxas_transacoes (Taxas Aplicadas por Transação)
-- ================================================
CREATE TABLE IF NOT EXISTS public.taxas_transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referências
  transacao_id UUID NOT NULL,
  taxa_configurada_id UUID REFERENCES public.taxas_configuradas(id),
  
  -- Identificação da taxa
  nome_taxa VARCHAR(100) NOT NULL,
  codigo_taxa VARCHAR(50) NOT NULL,
  categoria_taxa VARCHAR(50) NOT NULL,
  tipo_taxa VARCHAR(20) NOT NULL, -- 'percentual' ou 'fixo'
  
  -- Valores
  valor_base DECIMAL(15,2) NOT NULL,
  percentual_aplicado DECIMAL(10,4),
  valor_taxa DECIMAL(15,2) NOT NULL,
  valor_liquido_apos DECIMAL(15,2) NOT NULL,
  
  -- Auditoria
  calculado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- Adicionar status_financeiro na tabela transacoes
-- ================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transacoes' 
    AND column_name = 'status_financeiro'
  ) THEN
    ALTER TABLE public.transacoes ADD COLUMN status_financeiro VARCHAR(20) DEFAULT 'pendente';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transacoes' 
    AND column_name = 'valor_liquido'
  ) THEN
    ALTER TABLE public.transacoes ADD COLUMN valor_liquido DECIMAL(15,2);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transacoes' 
    AND column_name = 'total_taxas'
  ) THEN
    ALTER TABLE public.transacoes ADD COLUMN total_taxas DECIMAL(15,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transacoes' 
    AND column_name = 'tipo_transacao'
  ) THEN
    ALTER TABLE public.transacoes ADD COLUMN tipo_transacao VARCHAR(50) DEFAULT 'pagamento';
  END IF;
END $$;

-- ================================================
-- ÍNDICES
-- ================================================
CREATE INDEX IF NOT EXISTS idx_taxas_configuradas_ativa ON public.taxas_configuradas(ativa);
CREATE INDEX IF NOT EXISTS idx_taxas_configuradas_tipo ON public.taxas_configuradas(tipo_transacao);
CREATE INDEX IF NOT EXISTS idx_taxas_transacoes_transacao ON public.taxas_transacoes(transacao_id);
CREATE INDEX IF NOT EXISTS idx_taxas_transacoes_categoria ON public.taxas_transacoes(categoria_taxa);

-- ================================================
-- FUNÇÃO: calcular_taxas_transacao
-- Calcula todas as taxas aplicáveis a uma transação
-- ================================================
CREATE OR REPLACE FUNCTION public.calcular_taxas_transacao(
  p_transacao_id UUID,
  p_valor_bruto DECIMAL(15,2),
  p_tipo_transacao VARCHAR(50)
)
RETURNS TABLE(
  taxa_id UUID,
  nome VARCHAR,
  codigo VARCHAR,
  categoria VARCHAR,
  tipo VARCHAR,
  percentual DECIMAL,
  valor_calculado DECIMAL
) AS $$
DECLARE
  v_taxa RECORD;
  v_valor_taxa DECIMAL(15,2);
BEGIN
  FOR v_taxa IN
    SELECT 
      tc.id,
      tc.nome,
      tc.codigo,
      tc.categoria_taxa,
      tc.tipo_valor,
      tc.valor
    FROM public.taxas_configuradas tc
    WHERE tc.ativa = true
      AND (tc.tipo_transacao = p_tipo_transacao OR tc.tipo_transacao = 'todos')
    ORDER BY tc.categoria_taxa, tc.nome
  LOOP
    -- Calcular valor da taxa
    IF v_taxa.tipo_valor = 'percentual' THEN
      v_valor_taxa := ROUND(p_valor_bruto * (v_taxa.valor / 100), 2);
    ELSE
      v_valor_taxa := ROUND(v_taxa.valor, 2);
    END IF;
    
    -- Retornar linha
    taxa_id := v_taxa.id;
    nome := v_taxa.nome;
    codigo := v_taxa.codigo;
    categoria := v_taxa.categoria_taxa;
    tipo := v_taxa.tipo_valor;
    percentual := CASE WHEN v_taxa.tipo_valor = 'percentual' THEN v_taxa.valor ELSE NULL END;
    valor_calculado := v_valor_taxa;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- FUNÇÃO: processar_transacao_completa
-- Processa transação, calcula taxas e registra tudo
-- ================================================
CREATE OR REPLACE FUNCTION public.processar_transacao_completa(
  p_transacao_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transacao RECORD;
  v_taxa RECORD;
  v_total_taxas DECIMAL(15,2) := 0;
  v_valor_liquido DECIMAL(15,2);
  v_valor_atual DECIMAL(15,2);
  v_status_financeiro VARCHAR(20);
  v_lista_taxas JSONB := '[]'::JSONB;
BEGIN
  -- Buscar transação
  SELECT * INTO v_transacao
  FROM public.transacoes
  WHERE id = p_transacao_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transação não encontrada');
  END IF;
  
  -- Limpar taxas anteriores (para recálculo)
  DELETE FROM public.taxas_transacoes WHERE transacao_id = p_transacao_id;
  
  -- Valor inicial
  v_valor_atual := v_transacao.valor;
  
  -- Calcular e registrar cada taxa
  FOR v_taxa IN
    SELECT * FROM public.calcular_taxas_transacao(
      p_transacao_id,
      v_transacao.valor,
      COALESCE(v_transacao.tipo_transacao, 'pagamento')
    )
  LOOP
    -- Acumular total
    v_total_taxas := v_total_taxas + v_taxa.valor_calculado;
    v_valor_atual := v_valor_atual - v_taxa.valor_calculado;
    
    -- Registrar taxa aplicada
    INSERT INTO public.taxas_transacoes (
      transacao_id,
      taxa_configurada_id,
      nome_taxa,
      codigo_taxa,
      categoria_taxa,
      tipo_taxa,
      valor_base,
      percentual_aplicado,
      valor_taxa,
      valor_liquido_apos
    ) VALUES (
      p_transacao_id,
      v_taxa.taxa_id,
      v_taxa.nome,
      v_taxa.codigo,
      v_taxa.categoria,
      v_taxa.tipo,
      v_transacao.valor,
      v_taxa.percentual,
      v_taxa.valor_calculado,
      v_valor_atual
    );
    
    -- Adicionar à lista JSON
    v_lista_taxas := v_lista_taxas || jsonb_build_object(
      'nome', v_taxa.nome,
      'categoria', v_taxa.categoria,
      'tipo', v_taxa.tipo,
      'percentual', v_taxa.percentual,
      'valor', v_taxa.valor_calculado
    );
  END LOOP;
  
  -- Calcular valor líquido final
  v_valor_liquido := v_transacao.valor - v_total_taxas;
  
  -- Determinar status financeiro
  IF v_valor_liquido < 0 THEN
    v_status_financeiro := 'NEGATIVO';
  ELSIF v_valor_liquido = 0 THEN
    v_status_financeiro := 'ZERADO';
  ELSE
    v_status_financeiro := 'POSITIVO';
  END IF;
  
  -- Atualizar transação
  UPDATE public.transacoes
  SET 
    valor_liquido = v_valor_liquido,
    total_taxas = v_total_taxas,
    status_financeiro = v_status_financeiro
  WHERE id = p_transacao_id;
  
  -- Retornar resultado estruturado
  RETURN jsonb_build_object(
    'id_transacao', p_transacao_id,
    'valor_bruto', v_transacao.valor,
    'lista_de_taxas', v_lista_taxas,
    'total_taxas', v_total_taxas,
    'valor_liquido', v_valor_liquido,
    'data_hora', v_transacao.created_at,
    'status_financeiro', v_status_financeiro,
    'calculado_em', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ================================================
-- TRIGGER: Auto-processar transações aprovadas
-- ================================================
CREATE OR REPLACE FUNCTION public.trigger_processar_transacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Processar apenas transações aprovadas
  IF NEW.status = 'aprovada' AND (OLD IS NULL OR OLD.status != 'aprovada') THEN
    PERFORM public.processar_transacao_completa(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_processar_transacao ON public.transacoes;
CREATE TRIGGER trigger_auto_processar_transacao
AFTER INSERT OR UPDATE OF status ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_processar_transacao();

-- ================================================
-- RLS
-- ================================================
ALTER TABLE public.taxas_configuradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxas_transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read taxas_configuradas" ON public.taxas_configuradas FOR SELECT USING (true);
CREATE POLICY "Public read taxas_transacoes" ON public.taxas_transacoes FOR SELECT USING (true);

-- ================================================
-- DADOS INICIAIS: Taxas Padrão
-- ================================================
INSERT INTO public.taxas_configuradas (nome, codigo, descricao, valor, tipo_valor, categoria_taxa, tipo_transacao, ativa)
VALUES
  -- Taxas da Plataforma
  ('Taxa de Transação', 'taxa_transacao', 'Percentual sobre cada pagamento aprovado', 2.99, 'percentual', 'taxas_plataforma', 'pagamento', true),
  ('Taxa de Assinatura', 'taxa_assinatura', 'Percentual sobre assinaturas recorrentes', 1.99, 'percentual', 'taxas_plataforma', 'assinatura', true),
  
  -- Taxas Financeiras
  ('Taxa do Adquirente', 'taxa_adquirente', 'Valor fixo por transação aprovada', 0.30, 'fixo', 'taxas_financeiras', 'pagamento', true),
  ('Taxa de Saque', 'taxa_saque', 'Valor fixo por saque realizado', 3.67, 'fixo', 'taxas_financeiras', 'saque', true),
  ('Taxa de Antecipação', 'taxa_antecipacao', 'Percentual sobre valor antecipado', 2.99, 'percentual', 'taxas_financeiras', 'antecipacao', true),
  
  -- Taxas de Disputa
  ('Taxa de Chargeback', 'taxa_chargeback', 'Valor fixo por disputa', 15.00, 'fixo', 'taxas_disputa', 'chargeback', true),
  ('Taxa de Reembolso', 'taxa_reembolso', 'Percentual sobre valor reembolsado', 1.00, 'percentual', 'taxas_disputa', 'reembolso', true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  valor = EXCLUDED.valor,
  tipo_valor = EXCLUDED.tipo_valor,
  categoria_taxa = EXCLUDED.categoria_taxa,
  tipo_transacao = EXCLUDED.tipo_transacao,
  updated_at = NOW();