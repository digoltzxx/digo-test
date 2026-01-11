-- Add timer_text_color column to checkout_settings
ALTER TABLE public.checkout_settings 
ADD COLUMN timer_text_color TEXT DEFAULT '#ffffff';