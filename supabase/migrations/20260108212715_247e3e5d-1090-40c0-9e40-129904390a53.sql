-- Inserir todas as taxas padrão do sistema que estão sendo descontadas dos usuários

-- Taxa PIX (percentual + fixo)
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'pix', 4.99, 'percentage', 1.49, true, 'Taxa PIX - 4.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Cartão de Crédito 2 dias
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'credit_card_2d', 6.99, 'percentage', 1.49, true, 'Taxa Cartão 2 dias - 6.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Cartão de Crédito 7 dias
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'credit_card_7d', 6.99, 'percentage', 1.49, true, 'Taxa Cartão 7 dias - 6.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Cartão de Crédito 15 dias
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'credit_card_15d', 6.99, 'percentage', 1.49, true, 'Taxa Cartão 15 dias - 6.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Cartão de Crédito 30 dias
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'credit_card_30d', 4.99, 'percentage', 1.49, true, 'Taxa Cartão 30 dias - 4.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Boleto
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'boleto', 5.99, 'percentage', 1.49, true, 'Taxa Boleto - 5.99% + R$ 1.49 fixo', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa Adquirente (fixa por transação)
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'acquirer', 0.60, 'fixed', 0, true, 'Taxa da Adquirente - R$ 0.60 por transação aprovada', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa de Assinatura
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'subscription', 4.99, 'percentage', 0, true, 'Taxa de Assinatura Recorrente - 4.99%', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa de Chargeback
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'chargeback', 50.00, 'fixed', 0, true, 'Taxa de Chargeback - R$ 50.00 por disputa', 'BRL')
ON CONFLICT DO NOTHING;

-- Taxa de Reembolso
INSERT INTO platform_fees (tenant_id, fee_type, value, value_type, min_value, is_active, description, currency)
VALUES 
  (NULL, 'refund', 0, 'percentage', 0, true, 'Taxa de Reembolso - Sem taxa adicional', 'BRL')
ON CONFLICT DO NOTHING;