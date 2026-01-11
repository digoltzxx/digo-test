-- Adicionar campos para o modal de Order Bump
ALTER TABLE public.order_bumps 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS sales_phrase TEXT,
ADD COLUMN IF NOT EXISTS auxiliary_phrase TEXT;