-- Add new columns for banner management
ALTER TABLE public.banner_slides 
ADD COLUMN IF NOT EXISTS link_url TEXT,
ADD COLUMN IF NOT EXISTS alt_text TEXT;