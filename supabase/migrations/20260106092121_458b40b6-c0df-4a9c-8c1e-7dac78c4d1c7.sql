-- Add timer_color column to checkout_settings
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS timer_color TEXT DEFAULT '#ef4444';