-- Adicionar campos para botão de WhatsApp no checkout
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS whatsapp_button_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_support_phone TEXT;