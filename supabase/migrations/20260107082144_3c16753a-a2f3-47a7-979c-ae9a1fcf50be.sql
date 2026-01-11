-- Add social_proof_title column to checkout_settings
ALTER TABLE public.checkout_settings 
ADD COLUMN IF NOT EXISTS social_proof_title TEXT DEFAULT 'O que dizem nossos clientes';