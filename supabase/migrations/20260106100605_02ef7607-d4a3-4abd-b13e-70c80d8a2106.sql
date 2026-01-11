-- Add timer expired text field to checkout_settings
ALTER TABLE public.checkout_settings
ADD COLUMN timer_expired_text text DEFAULT 'OFERTA ACABOU';