-- Create table to log deletion attempts for products with sales
CREATE TABLE public.product_deletion_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  user_id UUID NOT NULL,
  product_name TEXT,
  sales_count INTEGER NOT NULL DEFAULT 0,
  blocked_reason TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_deletion_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own logs
CREATE POLICY "Users can insert their own deletion logs"
ON public.product_deletion_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own logs
CREATE POLICY "Users can view their own deletion logs"
ON public.product_deletion_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.product_deletion_logs IS 'Logs de tentativas de exclusão de produtos com vendas para auditoria';