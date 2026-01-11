-- Add total_value_color column to checkout_settings
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS total_value_color text DEFAULT '#22c55e';