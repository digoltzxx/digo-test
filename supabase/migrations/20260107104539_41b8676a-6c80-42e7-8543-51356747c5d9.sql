-- =============================================
-- MÓDULO FINANCEIRO COMPLETO - POSTGRESQL
-- Taxa fixa 15.5%, imutável pelo frontend
-- =============================================

-- 1. ENUMs
DO $$ BEGIN
  CREATE TYPE transacao_status AS ENUM ('pendente', 'aprovado', 'cancelado', 'estornado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE saque_status AS ENUM ('pendente', 'processando', 'concluido', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE antecipacao_status AS ENUM ('pendente', 'concluida', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Adicionar constraint de valor mínimo para antecipação (R$50)
ALTER TABLE antecipacoes 
DROP CONSTRAINT IF EXISTS chk_valor_minimo_antecipacao;

ALTER TABLE antecipacoes 
ADD CONSTRAINT chk_valor_minimo_antecipacao 
CHECK (valor_bruto >= 50);

-- 3. Garantir constraint de taxa fixa 15.5%
ALTER TABLE antecipacoes 
DROP CONSTRAINT IF EXISTS chk_taxa_fixa;

ALTER TABLE antecipacoes 
ADD CONSTRAINT chk_taxa_fixa 
CHECK (taxa_percentual = 15.5);

-- 4. Garantir constraint sacado/antecipada exclusivos
ALTER TABLE transacoes 
DROP CONSTRAINT IF EXISTS chk_saque_antecipacao_exclusivo;

ALTER TABLE transacoes 
ADD CONSTRAINT chk_saque_antecipacao_exclusivo 
CHECK (NOT (sacado = TRUE AND antecipada = TRUE));

-- 5. VIEW — Saldo Consolidado por Usuário (drop e recria)
DROP VIEW IF EXISTS vw_saldo_usuario;

CREATE VIEW vw_saldo_usuario WITH (security_invoker = true) AS
SELECT
  t.user_id,
  
  -- Saldo disponível: aprovado, liberado, não sacado
  COALESCE(SUM(
    CASE
      WHEN t.status = 'aprovado'
       AND t.data_liberacao <= NOW()
       AND t.sacado = FALSE
       AND t.antecipada = FALSE
      THEN t.valor
      ELSE 0
    END
  ), 0)::DECIMAL(15,2) AS saldo_disponivel,

  -- Saldo em retenção: aprovado, ainda não liberado
  COALESCE(SUM(
    CASE
      WHEN t.status = 'aprovado'
       AND (t.data_liberacao IS NULL OR t.data_liberacao > NOW())
       AND t.antecipada = FALSE
      THEN t.valor
      ELSE 0
    END
  ), 0)::DECIMAL(15,2) AS saldo_em_retencao,

  -- Total já sacado
  COALESCE(SUM(
    CASE
      WHEN t.sacado = TRUE THEN t.valor
      ELSE 0
    END
  ), 0)::DECIMAL(15,2) AS total_sacado,

  -- Total já antecipado
  COALESCE(SUM(
    CASE
      WHEN t.antecipada = TRUE THEN t.valor
      ELSE 0
    END
  ), 0)::DECIMAL(15,2) AS total_antecipado,

  -- Saldo total (disponível + retenção)
  COALESCE(SUM(
    CASE
      WHEN t.status = 'aprovado'
       AND t.sacado = FALSE
       AND t.antecipada = FALSE
      THEN t.valor
      ELSE 0
    END
  ), 0)::DECIMAL(15,2) AS saldo_total

FROM transacoes t
GROUP BY t.user_id;

-- 6. Função para obter saldo do usuário autenticado
CREATE OR REPLACE FUNCTION fn_meu_saldo()
RETURNS TABLE (
  saldo_disponivel DECIMAL(15,2),
  saldo_em_retencao DECIMAL(15,2),
  total_sacado DECIMAL(15,2),
  total_antecipado DECIMAL(15,2),
  saldo_total DECIMAL(15,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.saldo_disponivel,
    v.saldo_em_retencao,
    v.total_sacado,
    v.total_antecipado,
    v.saldo_total
  FROM vw_saldo_usuario v
  WHERE v.user_id = auth.uid();
END;
$$;

-- 7. Função para processar antecipação com taxa fixa
CREATE OR REPLACE FUNCTION fn_processar_antecipacao_v2(
  p_transacao_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_valor_bruto DECIMAL(15,2);
  v_taxa_percentual DECIMAL(5,2) := 15.5; -- TAXA FIXA IMUTÁVEL
  v_valor_taxa DECIMAL(15,2);
  v_valor_liquido DECIMAL(15,2);
  v_antecipacao_id UUID;
BEGIN
  -- Obter user_id autenticado
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Calcular valor bruto das transações elegíveis
  SELECT COALESCE(SUM(valor), 0)
  INTO v_valor_bruto
  FROM transacoes
  WHERE id = ANY(p_transacao_ids)
    AND user_id = v_user_id
    AND status = 'aprovado'
    AND sacado = FALSE
    AND antecipada = FALSE
    AND (data_liberacao IS NULL OR data_liberacao > NOW());

  -- Validar valor mínimo
  IF v_valor_bruto < 50 THEN
    RAISE EXCEPTION 'Valor mínimo para antecipação é R$ 50,00';
  END IF;

  -- Calcular taxa e valor líquido (TAXA FIXA 15.5%)
  v_valor_taxa := ROUND(v_valor_bruto * (v_taxa_percentual / 100), 2);
  v_valor_liquido := v_valor_bruto - v_valor_taxa;

  -- Criar registro de antecipação
  INSERT INTO antecipacoes (
    user_id,
    valor_bruto,
    taxa_percentual,
    valor_taxa,
    valor_liquido,
    status,
    quantidade_transacoes,
    transacoes_ids
  ) VALUES (
    v_user_id,
    v_valor_bruto,
    v_taxa_percentual,
    v_valor_taxa,
    v_valor_liquido,
    'pendente',
    array_length(p_transacao_ids, 1),
    p_transacao_ids
  )
  RETURNING id INTO v_antecipacao_id;

  -- Marcar transações como antecipadas
  UPDATE transacoes
  SET antecipada = TRUE,
      updated_at = NOW()
  WHERE id = ANY(p_transacao_ids)
    AND user_id = v_user_id
    AND status = 'aprovado'
    AND sacado = FALSE
    AND antecipada = FALSE;

  -- Criar itens da antecipação
  INSERT INTO antecipacao_itens (
    antecipacao_id,
    transacao_id,
    valor_original,
    taxa_aplicada,
    valor_liquido
  )
  SELECT 
    v_antecipacao_id,
    t.id,
    t.valor,
    ROUND(t.valor * (v_taxa_percentual / 100), 2),
    t.valor - ROUND(t.valor * (v_taxa_percentual / 100), 2)
  FROM transacoes t
  WHERE t.id = ANY(p_transacao_ids)
    AND t.user_id = v_user_id;

  RETURN v_antecipacao_id;
END;
$$;

-- 8. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_sacado ON transacoes(sacado);
CREATE INDEX IF NOT EXISTS idx_transacoes_antecipada ON transacoes(antecipada);
CREATE INDEX IF NOT EXISTS idx_transacoes_user_status ON transacoes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_antecipacoes_status ON antecipacoes(status);