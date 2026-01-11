-- Add social proof notification settings to checkout_settings table
ALTER TABLE public.checkout_settings
ADD COLUMN IF NOT EXISTS social_proof_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_proof_notification_1_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_proof_notification_1_text text DEFAULT '{quantidadePessoas} pessoas estão comprando {nomeProduto} **AGORA**.',
ADD COLUMN IF NOT EXISTS social_proof_notification_2_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_proof_notification_2_text text DEFAULT '{quantidadePessoas} pessoas compraram {nomeProduto} **HOJE**.',
ADD COLUMN IF NOT EXISTS social_proof_notification_3_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_proof_notification_3_text text DEFAULT '{nomeHomem} comprou {nomeProduto} **AGORA**.',
ADD COLUMN IF NOT EXISTS social_proof_notification_4_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS social_proof_notification_4_text text DEFAULT '{nomeMulher} comprou {nomeProduto} **AGORA**.',
ADD COLUMN IF NOT EXISTS social_proof_min_people integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS social_proof_max_people integer DEFAULT 27,
ADD COLUMN IF NOT EXISTS social_proof_initial_delay integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS social_proof_interval_min integer DEFAULT 20,
ADD COLUMN IF NOT EXISTS social_proof_interval_max integer DEFAULT 40,
ADD COLUMN IF NOT EXISTS social_proof_duration integer DEFAULT 6;