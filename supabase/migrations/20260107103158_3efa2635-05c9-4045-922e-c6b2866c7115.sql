-- Add role column to sale_commissions if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_commissions' AND column_name = 'role') THEN
    ALTER TABLE public.sale_commissions ADD COLUMN role TEXT DEFAULT 'producer';
  END IF;
END $$;

-- Update existing records to set role based on commission_type
UPDATE public.sale_commissions 
SET role = CASE 
  WHEN commission_type = 'coproducer' THEN 'coproducer'
  WHEN commission_type = 'affiliate' THEN 'affiliate'
  ELSE 'producer'
END
WHERE role IS NULL OR role = 'producer';

-- Add index for anticipation queries
CREATE INDEX IF NOT EXISTS idx_sale_commissions_user_anticipated ON public.sale_commissions(user_id, anticipated_at) WHERE anticipated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sale_commissions_anticipation ON public.sale_commissions(anticipation_id) WHERE anticipation_id IS NOT NULL;

-- Add metadata column to commission_anticipations for idempotency
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commission_anticipations' AND column_name = 'metadata') THEN
    ALTER TABLE public.commission_anticipations ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create index for idempotency check
CREATE INDEX IF NOT EXISTS idx_commission_anticipations_metadata ON public.commission_anticipations USING GIN (metadata);

COMMENT ON TABLE public.commission_anticipations IS 'Stores commission anticipation requests with 15.5% fee';
COMMENT ON COLUMN public.sale_commissions.anticipated_at IS 'Timestamp when commission was anticipated';
COMMENT ON COLUMN public.sale_commissions.anticipation_id IS 'Reference to the anticipation that included this commission';