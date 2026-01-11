
-- ============================================================
-- MIGRATION: MÓDULO FINANCEIRO COMPLETO
-- Versão: 2.0.0
-- Descrição: Saldo, Saques e Antecipação de Comissões
-- ============================================================

-- ============================================================
-- SEÇÃO 1: TABELA TRANSACOES (COMISSÕES/VENDAS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.transacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Valores monetários (SEMPRE DECIMAL 15,2)
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  
  -- Status e datas
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' 
    CHECK (status IN ('pendente', 'aprovado', 'cancelado', 'estornado')),
  data_pagamento TIMESTAMPTZ,
  data_liberacao TIMESTAMPTZ,
  
  -- Flags de controle
  sacado BOOLEAN NOT NULL DEFAULT false,
  antecipada BOOLEAN NOT NULL DEFAULT false,
  
  -- Referências opcionais
  sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
  commission_id UUID REFERENCES public.sale_commissions(id) ON DELETE RESTRICT,
  
  -- Metadados
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'comissao' 
    CHECK (tipo IN ('comissao', 'venda', 'bonus', 'ajuste')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- CONSTRAINT: sacado e antecipada nunca podem ser true ao mesmo tempo
  CONSTRAINT chk_sacado_antecipada_exclusivo 
    CHECK (NOT (sacado = true AND antecipada = true))
);

-- Comentários
COMMENT ON TABLE public.transacoes IS 'Registra todas as transações financeiras (vendas/comissões)';
COMMENT ON COLUMN public.transacoes.sacado IS 'Se true, valor já foi sacado e não entra em saldo disponível';
COMMENT ON COLUMN public.transacoes.antecipada IS 'Se true, valor já foi antecipado e não pode ser antecipado novamente';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON public.transacoes(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_data_liberacao ON public.transacoes(data_liberacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_status ON public.transacoes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_disponivel ON public.transacoes(user_id, status, sacado, antecipada) 
  WHERE status = 'aprovado' AND sacado = false AND antecipada = false;

-- ============================================================
-- SEÇÃO 2: TABELA SAQUES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Valores monetários
  valor DECIMAL(15,2) NOT NULL CHECK (valor > 0),
  taxa_saque DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (taxa_saque >= 0),
  valor_liquido DECIMAL(15,2) NOT NULL CHECK (valor_liquido > 0),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluido', 'falhou', 'cancelado')),
  
  -- Conta bancária
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  
  -- Datas
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Idempotência e auditoria
  idempotency_key VARCHAR(255) UNIQUE,
  erro_mensagem TEXT,
  gateway_reference VARCHAR(255),
  ip_address INET,
  
  -- CONSTRAINT: valor_liquido = valor - taxa_saque
  CONSTRAINT chk_valor_liquido CHECK (valor_liquido = valor - taxa_saque)
);

-- Comentários
COMMENT ON TABLE public.saques IS 'Controle completo de solicitações de saque';
COMMENT ON COLUMN public.saques.status IS 'pendente→processando→concluido/falhou';

-- Índices
CREATE INDEX IF NOT EXISTS idx_saques_user_id ON public.saques(user_id);
CREATE INDEX IF NOT EXISTS idx_saques_status ON public.saques(status);
CREATE INDEX IF NOT EXISTS idx_saques_user_status ON public.saques(user_id, status);
CREATE INDEX IF NOT EXISTS idx_saques_created_at ON public.saques(created_at DESC);

-- ============================================================
-- SEÇÃO 3: TABELA ANTECIPACOES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.antecipacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Valores monetários
  valor_bruto DECIMAL(15,2) NOT NULL CHECK (valor_bruto >= 50), -- Mínimo R$ 50
  taxa_percentual DECIMAL(5,2) NOT NULL DEFAULT 15.5 CHECK (taxa_percentual = 15.5),
  valor_taxa DECIMAL(15,2) NOT NULL CHECK (valor_taxa > 0),
  valor_liquido DECIMAL(15,2) NOT NULL CHECK (valor_liquido > 0),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'concluida', 'falhou', 'cancelada')),
  
  -- Datas
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Idempotência
  idempotency_key VARCHAR(255) UNIQUE,
  
  -- Metadados
  transacoes_ids UUID[] NOT NULL DEFAULT '{}',
  quantidade_transacoes INTEGER NOT NULL DEFAULT 0,
  
  -- CONSTRAINTS de cálculo
  CONSTRAINT chk_valor_taxa CHECK (valor_taxa = ROUND(valor_bruto * taxa_percentual / 100, 2)),
  CONSTRAINT chk_valor_liquido CHECK (valor_liquido = valor_bruto - valor_taxa)
);

-- Comentários
COMMENT ON TABLE public.antecipacoes IS 'Registro de antecipações de comissões (taxa fixa 15.5%)';
COMMENT ON COLUMN public.antecipacoes.taxa_percentual IS 'Taxa fixa de 15.5% - NUNCA vem do frontend';

-- Índices
CREATE INDEX IF NOT EXISTS idx_antecipacoes_user_id ON public.antecipacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_antecipacoes_status ON public.antecipacoes(status);
CREATE INDEX IF NOT EXISTS idx_antecipacoes_created_at ON public.antecipacoes(created_at DESC);

-- ============================================================
-- SEÇÃO 4: TABELA ITENS DE ANTECIPAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.antecipacao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  antecipacao_id UUID NOT NULL REFERENCES public.antecipacoes(id) ON DELETE RESTRICT,
  transacao_id UUID NOT NULL REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  
  -- Valores
  valor_original DECIMAL(15,2) NOT NULL CHECK (valor_original > 0),
  taxa_aplicada DECIMAL(15,2) NOT NULL CHECK (taxa_aplicada > 0),
  valor_liquido DECIMAL(15,2) NOT NULL CHECK (valor_liquido > 0),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Cada transação só pode ser antecipada uma vez
  UNIQUE(transacao_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_antecipacao_itens_antecipacao ON public.antecipacao_itens(antecipacao_id);
CREATE INDEX IF NOT EXISTS idx_antecipacao_itens_transacao ON public.antecipacao_itens(transacao_id);

-- ============================================================
-- SEÇÃO 5: VIEW DE SALDO CONSOLIDADO
-- ============================================================

CREATE OR REPLACE VIEW public.v_saldo_consolidado AS
SELECT 
  u.id as user_id,
  
  -- Saldo disponível: aprovado, não sacado, não antecipado, já liberado
  COALESCE(SUM(
    CASE 
      WHEN t.status = 'aprovado' 
        AND t.sacado = false 
        AND t.antecipada = false 
        AND (t.data_liberacao IS NULL OR t.data_liberacao <= now())
      THEN t.valor 
      ELSE 0 
    END
  ), 0) as saldo_disponivel,
  
  -- Saldo em retenção: aprovado, não liberado ainda
  COALESCE(SUM(
    CASE 
      WHEN t.status = 'aprovado' 
        AND t.sacado = false 
        AND t.antecipada = false 
        AND t.data_liberacao > now()
      THEN t.valor 
      ELSE 0 
    END
  ), 0) as saldo_em_retencao,
  
  -- Saldo pendente: aguardando aprovação
  COALESCE(SUM(
    CASE WHEN t.status = 'pendente' THEN t.valor ELSE 0 END
  ), 0) as saldo_pendente,
  
  -- Total aprovado (bruto)
  COALESCE(SUM(
    CASE WHEN t.status = 'aprovado' THEN t.valor ELSE 0 END
  ), 0) as total_aprovado,
  
  -- Total sacado
  COALESCE((
    SELECT SUM(s.valor) FROM public.saques s 
    WHERE s.user_id = u.id AND s.status = 'concluido'
  ), 0) as total_sacado,
  
  -- Total antecipado (valor líquido)
  COALESCE((
    SELECT SUM(a.valor_liquido) FROM public.antecipacoes a 
    WHERE a.user_id = u.id AND a.status = 'concluida'
  ), 0) as total_antecipado,
  
  -- Quantidade de transações
  COUNT(t.id) FILTER (WHERE t.status = 'aprovado') as qtd_transacoes_aprovadas
  
FROM auth.users u
LEFT JOIN public.transacoes t ON t.user_id = u.id
GROUP BY u.id;

COMMENT ON VIEW public.v_saldo_consolidado IS 'Visão consolidada do saldo financeiro de cada usuário';

-- ============================================================
-- SEÇÃO 6: VIEW DE TRANSAÇÕES DISPONÍVEIS PARA ANTECIPAÇÃO
-- ============================================================

CREATE OR REPLACE VIEW public.v_transacoes_antecipacao AS
SELECT 
  t.id,
  t.user_id,
  t.valor,
  t.status,
  t.data_liberacao,
  t.created_at,
  -- Cálculo da taxa (15.5%)
  ROUND(t.valor * 0.155, 2) as taxa_antecipacao,
  -- Valor líquido após taxa
  ROUND(t.valor - (t.valor * 0.155), 2) as valor_liquido_antecipacao,
  -- Dias até liberação
  CASE 
    WHEN t.data_liberacao IS NOT NULL 
    THEN EXTRACT(DAY FROM (t.data_liberacao - now()))::INTEGER
    ELSE 0 
  END as dias_para_liberacao
FROM public.transacoes t
WHERE 
  t.status = 'aprovado'
  AND t.sacado = false
  AND t.antecipada = false
  AND t.valor >= 50 -- Mínimo para antecipação
  AND (t.data_liberacao IS NULL OR t.data_liberacao > now()); -- Ainda em retenção

COMMENT ON VIEW public.v_transacoes_antecipacao IS 'Transações elegíveis para antecipação';

-- ============================================================
-- SEÇÃO 7: FUNCTIONS DE CÁLCULO
-- ============================================================

-- Function para calcular saldo disponível
CREATE OR REPLACE FUNCTION public.fn_calcular_saldo_disponivel(p_user_id UUID)
RETURNS DECIMAL(15,2) AS $$
DECLARE
  v_saldo DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(valor), 0) INTO v_saldo
  FROM public.transacoes
  WHERE user_id = p_user_id
    AND status = 'aprovado'
    AND sacado = false
    AND antecipada = false
    AND (data_liberacao IS NULL OR data_liberacao <= now());
  
  RETURN v_saldo;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Function para calcular disponível para antecipação
CREATE OR REPLACE FUNCTION public.fn_calcular_disponivel_antecipacao(p_user_id UUID)
RETURNS TABLE(
  valor_disponivel DECIMAL(15,2),
  quantidade INTEGER,
  valor_liquido_estimado DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.valor), 0)::DECIMAL(15,2) as valor_disponivel,
    COUNT(t.id)::INTEGER as quantidade,
    COALESCE(SUM(ROUND(t.valor * 0.845, 2)), 0)::DECIMAL(15,2) as valor_liquido_estimado
  FROM public.transacoes t
  WHERE t.user_id = p_user_id
    AND t.status = 'aprovado'
    AND t.sacado = false
    AND t.antecipada = false
    AND t.valor >= 50
    AND (t.data_liberacao IS NULL OR t.data_liberacao > now());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- SEÇÃO 8: FUNCTION DE PROCESSAR SAQUE
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_processar_saque(
  p_user_id UUID,
  p_valor DECIMAL(15,2),
  p_bank_account_id UUID,
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_saldo_disponivel DECIMAL(15,2);
  v_saque_id UUID;
  v_taxa DECIMAL(15,2) := 0;
  v_valor_liquido DECIMAL(15,2);
BEGIN
  -- Verificar idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_saque_id FROM public.saques 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_saque_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solicitação duplicada', 'saque_id', v_saque_id);
    END IF;
  END IF;

  -- Validar valor mínimo
  IF p_valor < 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor mínimo para saque: R$ 50,00');
  END IF;
  
  -- Calcular saldo disponível
  v_saldo_disponivel := public.fn_calcular_saldo_disponivel(p_user_id);
  
  -- Validar saldo
  IF p_valor > v_saldo_disponivel THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Saldo insuficiente',
      'saldo_disponivel', v_saldo_disponivel,
      'valor_solicitado', p_valor
    );
  END IF;
  
  -- Verificar conta bancária
  IF NOT EXISTS(SELECT 1 FROM public.bank_accounts WHERE id = p_bank_account_id AND user_id = p_user_id AND status = 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta bancária inválida ou não aprovada');
  END IF;
  
  -- Calcular valor líquido
  v_valor_liquido := p_valor - v_taxa;
  
  -- Criar saque
  INSERT INTO public.saques (
    user_id, valor, taxa_saque, valor_liquido, status,
    bank_account_id, idempotency_key
  ) VALUES (
    p_user_id, p_valor, v_taxa, v_valor_liquido, 'pendente',
    p_bank_account_id, p_idempotency_key
  )
  RETURNING id INTO v_saque_id;
  
  -- Auditoria
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, entity_type, entity_id, amount,
    status_received, status_allowed, reason, source
  ) VALUES (
    p_user_id, 'SAQUE_SOLICITADO', 'saques', v_saque_id, p_valor,
    'pendente', true, 'Solicitação de saque criada', 'fn_processar_saque'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'saque_id', v_saque_id,
    'valor', p_valor,
    'taxa', v_taxa,
    'valor_liquido', v_valor_liquido
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- SEÇÃO 9: FUNCTION DE PROCESSAR ANTECIPAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_processar_antecipacao(
  p_user_id UUID,
  p_transacao_ids UUID[],
  p_idempotency_key VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_total_bruto DECIMAL(15,2);
  v_total_taxa DECIMAL(15,2);
  v_total_liquido DECIMAL(15,2);
  v_antecipacao_id UUID;
  v_transacao RECORD;
  v_taxa_percentual DECIMAL(5,2) := 15.5;
BEGIN
  -- Verificar idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_antecipacao_id FROM public.antecipacoes 
    WHERE idempotency_key = p_idempotency_key;
    
    IF v_antecipacao_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solicitação duplicada');
    END IF;
  END IF;
  
  -- Validar transações
  IF array_length(p_transacao_ids, 1) IS NULL OR array_length(p_transacao_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma transação selecionada');
  END IF;
  
  -- Verificar se todas as transações são elegíveis
  IF EXISTS(
    SELECT 1 FROM unnest(p_transacao_ids) tid
    WHERE NOT EXISTS(
      SELECT 1 FROM public.transacoes t
      WHERE t.id = tid
        AND t.user_id = p_user_id
        AND t.status = 'aprovado'
        AND t.sacado = false
        AND t.antecipada = false
        AND t.valor >= 50
    )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Uma ou mais transações não são elegíveis');
  END IF;
  
  -- Calcular totais
  SELECT 
    SUM(valor),
    SUM(ROUND(valor * v_taxa_percentual / 100, 2)),
    SUM(ROUND(valor * (100 - v_taxa_percentual) / 100, 2))
  INTO v_total_bruto, v_total_taxa, v_total_liquido
  FROM public.transacoes
  WHERE id = ANY(p_transacao_ids);
  
  -- Validar valor mínimo
  IF v_total_bruto < 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor mínimo para antecipação: R$ 50,00');
  END IF;
  
  -- Criar antecipação
  INSERT INTO public.antecipacoes (
    user_id, valor_bruto, taxa_percentual, valor_taxa, valor_liquido,
    status, idempotency_key, transacoes_ids, quantidade_transacoes, completed_at
  ) VALUES (
    p_user_id, v_total_bruto, v_taxa_percentual, v_total_taxa, v_total_liquido,
    'concluida', p_idempotency_key, p_transacao_ids, array_length(p_transacao_ids, 1), now()
  )
  RETURNING id INTO v_antecipacao_id;
  
  -- Criar itens e marcar transações
  FOR v_transacao IN 
    SELECT id, valor FROM public.transacoes WHERE id = ANY(p_transacao_ids)
  LOOP
    -- Inserir item
    INSERT INTO public.antecipacao_itens (
      antecipacao_id, transacao_id, valor_original,
      taxa_aplicada, valor_liquido
    ) VALUES (
      v_antecipacao_id, v_transacao.id, v_transacao.valor,
      ROUND(v_transacao.valor * v_taxa_percentual / 100, 2),
      ROUND(v_transacao.valor * (100 - v_taxa_percentual) / 100, 2)
    );
    
    -- Marcar transação como antecipada
    UPDATE public.transacoes
    SET antecipada = true, updated_at = now()
    WHERE id = v_transacao.id;
  END LOOP;
  
  -- Registrar crédito no saldo
  INSERT INTO public.balance_history (
    user_id, movement_type, amount, balance_before, balance_after,
    reference_type, reference_id, description
  ) VALUES (
    p_user_id, 'credit', v_total_liquido, 0, v_total_liquido,
    'antecipacao', v_antecipacao_id, 
    'Antecipação de ' || array_length(p_transacao_ids, 1) || ' transação(ões)'
  );
  
  -- Auditoria
  INSERT INTO public.financial_audit_logs (
    user_id, action_taken, entity_type, entity_id, amount,
    status_received, status_allowed, reason, source, metadata
  ) VALUES (
    p_user_id, 'ANTECIPACAO_PROCESSADA', 'antecipacoes', v_antecipacao_id, v_total_liquido,
    'concluida', true, 'Antecipação processada com sucesso', 'fn_processar_antecipacao',
    jsonb_build_object(
      'valor_bruto', v_total_bruto,
      'taxa_percentual', v_taxa_percentual,
      'valor_taxa', v_total_taxa,
      'quantidade', array_length(p_transacao_ids, 1)
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'antecipacao_id', v_antecipacao_id,
    'valor_bruto', v_total_bruto,
    'taxa_percentual', v_taxa_percentual,
    'valor_taxa', v_total_taxa,
    'valor_liquido', v_total_liquido,
    'quantidade', array_length(p_transacao_ids, 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- SEÇÃO 10: TRIGGERS
-- ============================================================

-- Trigger updated_at para transacoes
DROP TRIGGER IF EXISTS trg_transacoes_updated_at ON public.transacoes;
CREATE TRIGGER trg_transacoes_updated_at
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_updated_at();

-- Trigger para bloquear DELETE em tabelas financeiras
DROP TRIGGER IF EXISTS trg_transacoes_block_delete ON public.transacoes;
CREATE TRIGGER trg_transacoes_block_delete
  BEFORE DELETE ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_financial_delete();

DROP TRIGGER IF EXISTS trg_saques_block_delete ON public.saques;
CREATE TRIGGER trg_saques_block_delete
  BEFORE DELETE ON public.saques
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_financial_delete();

DROP TRIGGER IF EXISTS trg_antecipacoes_block_delete ON public.antecipacoes;
CREATE TRIGGER trg_antecipacoes_block_delete
  BEFORE DELETE ON public.antecipacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_financial_delete();

-- ============================================================
-- SEÇÃO 11: RLS POLICIES
-- ============================================================

-- Transações
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own transacoes" ON public.transacoes;
CREATE POLICY "Users view own transacoes" ON public.transacoes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages transacoes" ON public.transacoes;
CREATE POLICY "Service role manages transacoes" ON public.transacoes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Saques
ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own saques" ON public.saques;
CREATE POLICY "Users view own saques" ON public.saques
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create own saques" ON public.saques;
CREATE POLICY "Users create own saques" ON public.saques
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages saques" ON public.saques;
CREATE POLICY "Service role manages saques" ON public.saques
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Antecipações
ALTER TABLE public.antecipacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own antecipacoes" ON public.antecipacoes;
CREATE POLICY "Users view own antecipacoes" ON public.antecipacoes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages antecipacoes" ON public.antecipacoes;
CREATE POLICY "Service role manages antecipacoes" ON public.antecipacoes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Itens de antecipação
ALTER TABLE public.antecipacao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own antecipacao_itens" ON public.antecipacao_itens;
CREATE POLICY "Users view own antecipacao_itens" ON public.antecipacao_itens
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.antecipacoes a WHERE a.id = antecipacao_id AND a.user_id = auth.uid())
  );
