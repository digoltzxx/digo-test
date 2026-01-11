-- Add security seals columns to checkout_settings
ALTER TABLE public.checkout_settings
ADD COLUMN IF NOT EXISTS security_seals_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS security_seal_secure_site boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS security_seal_secure_purchase boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS security_seal_guarantee boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS security_seal_secure_site_text text DEFAULT 'Site Protegido com Criptografia',
ADD COLUMN IF NOT EXISTS security_seal_secure_purchase_text text DEFAULT 'Compra 100% Segura',
ADD COLUMN IF NOT EXISTS security_seal_guarantee_text text DEFAULT 'Garantia Total de Satisfação',
ADD COLUMN IF NOT EXISTS checkout_animation_enabled boolean DEFAULT false;