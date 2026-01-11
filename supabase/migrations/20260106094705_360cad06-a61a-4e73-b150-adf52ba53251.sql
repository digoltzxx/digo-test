-- Add button color customization fields to checkout_settings
ALTER TABLE public.checkout_settings
ADD COLUMN IF NOT EXISTS button_background_color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS button_text_color TEXT DEFAULT '#ffffff';