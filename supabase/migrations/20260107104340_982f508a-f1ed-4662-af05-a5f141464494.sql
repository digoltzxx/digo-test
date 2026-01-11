
-- ============================================================
-- CORREÇÃO DE SEGURANÇA: Views e exposição de auth.users
-- ============================================================

-- Remover views que referenciam auth.users diretamente
DROP VIEW IF EXISTS public.v_saldo_consolidado;
DROP VIEW IF EXISTS public.v_transacoes_antecipacao;

-- ============================================================
-- VIEW SEGURA: Saldo Consolidado (sem auth.users)
-- ============================================================

CREATE OR REPLACE VIEW public.v_saldo_consolidado 
WITH (security_invoker = true) AS
SELECT 
  t.user_id,
  
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
  
  -- Quantidade de transações
  COUNT(t.id) FILTER (WHERE t.status = 'aprovado') as qtd_transacoes_aprovadas
  
FROM public.transacoes t
GROUP BY t.user_id;

-- ============================================================
-- VIEW SEGURA: Transações para Antecipação
-- ============================================================

CREATE OR REPLACE VIEW public.v_transacoes_antecipacao 
WITH (security_invoker = true) AS
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
    THEN GREATEST(EXTRACT(DAY FROM (t.data_liberacao - now()))::INTEGER, 0)
    ELSE 0 
  END as dias_para_liberacao
FROM public.transacoes t
WHERE 
  t.status = 'aprovado'
  AND t.sacado = false
  AND t.antecipada = false
  AND t.valor >= 50
  AND (t.data_liberacao IS NULL OR t.data_liberacao > now());

-- ============================================================
-- FUNCTION: Obter saldo consolidado do usuário autenticado
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_get_meu_saldo()
RETURNS TABLE(
  saldo_disponivel DECIMAL(15,2),
  saldo_em_retencao DECIMAL(15,2),
  saldo_pendente DECIMAL(15,2),
  total_aprovado DECIMAL(15,2),
  total_sacado DECIMAL(15,2),
  total_antecipado DECIMAL(15,2)
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT 
    -- Saldo disponível
    COALESCE(SUM(
      CASE 
        WHEN t.status = 'aprovado' AND t.sacado = false AND t.antecipada = false 
          AND (t.data_liberacao IS NULL OR t.data_liberacao <= now())
        THEN t.valor ELSE 0 
      END
    ), 0)::DECIMAL(15,2),
    
    -- Saldo em retenção
    COALESCE(SUM(
      CASE 
        WHEN t.status = 'aprovado' AND t.sacado = false AND t.antecipada = false 
          AND t.data_liberacao > now()
        THEN t.valor ELSE 0 
      END
    ), 0)::DECIMAL(15,2),
    
    -- Saldo pendente
    COALESCE(SUM(CASE WHEN t.status = 'pendente' THEN t.valor ELSE 0 END), 0)::DECIMAL(15,2),
    
    -- Total aprovado
    COALESCE(SUM(CASE WHEN t.status = 'aprovado' THEN t.valor ELSE 0 END), 0)::DECIMAL(15,2),
    
    -- Total sacado
    COALESCE((SELECT SUM(s.valor) FROM public.saques s WHERE s.user_id = v_user_id AND s.status = 'concluido'), 0)::DECIMAL(15,2),
    
    -- Total antecipado
    COALESCE((SELECT SUM(a.valor_liquido) FROM public.antecipacoes a WHERE a.user_id = v_user_id AND a.status = 'concluida'), 0)::DECIMAL(15,2)
    
  FROM public.transacoes t
  WHERE t.user_id = v_user_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.fn_get_meu_saldo() IS 'Retorna saldo consolidado do usuário autenticado';
