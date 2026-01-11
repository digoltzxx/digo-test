-- Adicionar campo para seletor de quantidade no checkout
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS quantity_selector_enabled BOOLEAN DEFAULT false;