-- Add coupon fields to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0;

-- Add index for campaign lookups
CREATE INDEX IF NOT EXISTS idx_sales_campaign_id ON public.sales(campaign_id) WHERE campaign_id IS NOT NULL;

-- Create coupon usage logs table for auditing
CREATE TABLE IF NOT EXISTS public.coupon_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL,
  discount_applied NUMERIC(10,2) NOT NULL,
  original_amount NUMERIC(10,2) NOT NULL,
  final_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on coupon usage logs
ALTER TABLE public.coupon_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for service role access
CREATE POLICY "Service role can manage coupon usage" 
ON public.coupon_usage_logs 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Index for coupon usage lookups
CREATE INDEX IF NOT EXISTS idx_coupon_usage_campaign_id ON public.coupon_usage_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_sale_id ON public.coupon_usage_logs(sale_id);

COMMENT ON COLUMN public.sales.campaign_id IS 'ID da campanha/cupom usado na venda';
COMMENT ON COLUMN public.sales.coupon_code IS 'Código do cupom usado';
COMMENT ON COLUMN public.sales.coupon_discount IS 'Valor do desconto aplicado';