-- Add discount type and subscription bump fields to order_bumps
ALTER TABLE public.order_bumps 
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_interval TEXT CHECK (subscription_interval IN ('monthly', 'quarterly', 'yearly'));

-- Add comment for clarity
COMMENT ON COLUMN public.order_bumps.discount_type IS 'Type of discount: fixed (R$) or percentage (%)';
COMMENT ON COLUMN public.order_bumps.discount_value IS 'Discount value (amount for fixed, percentage for percentage type)';
COMMENT ON COLUMN public.order_bumps.is_subscription IS 'Whether this bump creates a subscription';
COMMENT ON COLUMN public.order_bumps.subscription_interval IS 'Billing interval for subscription bumps';