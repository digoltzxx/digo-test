-- Add highlight_color column to order_bumps table
ALTER TABLE public.order_bumps 
ADD COLUMN IF NOT EXISTS highlight_color TEXT DEFAULT '#ff00dd';