-- Adicionar colunas para registro detalhado de taxas nas vendas
-- Isso permite rastrear cada componente do valor final

-- Taxa da plataforma (calculada sobre o valor bruto)
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

-- Taxa do meio de pagamento (calculada sobre o valor bruto)
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_fee numeric NOT NULL DEFAULT 0;

-- Valor líquido final (valor bruto - todas as taxas)
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS net_amount numeric NOT NULL DEFAULT 0;

-- Percentual da taxa da plataforma aplicado (para histórico)
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS platform_fee_percent numeric NOT NULL DEFAULT 4.99;

-- Percentual da taxa do meio de pagamento aplicado
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_fee_percent numeric NOT NULL DEFAULT 0;

-- Percentual da comissão do afiliado aplicado (para histórico)
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS affiliate_commission_percent numeric NOT NULL DEFAULT 0;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.sales.platform_fee IS 'Taxa da plataforma em valor absoluto (R$)';
COMMENT ON COLUMN public.sales.payment_fee IS 'Taxa do meio de pagamento em valor absoluto (R$)';
COMMENT ON COLUMN public.sales.net_amount IS 'Valor líquido final após todas as taxas';
COMMENT ON COLUMN public.sales.platform_fee_percent IS 'Percentual da taxa da plataforma aplicado';
COMMENT ON COLUMN public.sales.payment_fee_percent IS 'Percentual da taxa do meio de pagamento aplicado';
COMMENT ON COLUMN public.sales.affiliate_commission_percent IS 'Percentual da comissão do afiliado aplicado';

-- Criar índice para consultas de relatório
CREATE INDEX IF NOT EXISTS idx_sales_net_amount ON public.sales(net_amount);
CREATE INDEX IF NOT EXISTS idx_sales_created_status ON public.sales(created_at, status);