-- Add show_banner column to checkout_settings
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS show_banner boolean DEFAULT false;