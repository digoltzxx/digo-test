-- Add sac_phone column to products table for WhatsApp support
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sac_phone text;