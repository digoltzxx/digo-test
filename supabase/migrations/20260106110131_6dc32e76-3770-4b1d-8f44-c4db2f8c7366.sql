-- Adicionar campos para Back Redirect no checkout
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS back_redirect_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS back_redirect_url TEXT;