-- Add buyer_phone column to sales table
ALTER TABLE public.sales 
ADD COLUMN buyer_phone TEXT;