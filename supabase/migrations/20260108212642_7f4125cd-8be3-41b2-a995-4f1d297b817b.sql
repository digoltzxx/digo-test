-- Adicionar novos tipos de taxas ao enum
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'pix' AFTER 'anticipation';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'credit_card_2d' AFTER 'pix';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'credit_card_7d' AFTER 'credit_card_2d';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'credit_card_15d' AFTER 'credit_card_7d';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'credit_card_30d' AFTER 'credit_card_15d';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'boleto' AFTER 'credit_card_30d';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'acquirer' AFTER 'boleto';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'subscription' AFTER 'acquirer';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'chargeback' AFTER 'subscription';
ALTER TYPE fee_type ADD VALUE IF NOT EXISTS 'refund' AFTER 'chargeback';