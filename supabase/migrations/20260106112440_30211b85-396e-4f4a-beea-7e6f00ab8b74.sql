-- Add quantity support to subscriptions and products
-- Following the business rules for subscription quantity modes

-- 1. Add quantity_mode to products for subscription quantity handling
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS subscription_quantity_mode TEXT DEFAULT 'single' CHECK (subscription_quantity_mode IN ('single', 'license', 'seat'));

COMMENT ON COLUMN public.products.subscription_quantity_mode IS 'Defines how quantity works: single=fixed at 1, license=multiple accesses, seat=multiple students';

-- 2. Add quantity columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 100),
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_recurring NUMERIC(10,2) GENERATED ALWAYS AS (unit_price * quantity) STORED;

COMMENT ON COLUMN public.subscriptions.quantity IS 'Number of licenses/seats for this subscription';
COMMENT ON COLUMN public.subscriptions.unit_price IS 'Price per unit (license/seat)';
COMMENT ON COLUMN public.subscriptions.total_recurring IS 'Total recurring amount (unit_price * quantity)';

-- 3. Create subscription_access table for tracking individual accesses
CREATE TABLE IF NOT EXISTS public.subscription_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    member_email TEXT NOT NULL,
    member_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
    access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    access_revoked_at TIMESTAMP WITH TIME ZONE,
    revoke_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(subscription_id, member_email)
);

-- Enable RLS on subscription_access
ALTER TABLE public.subscription_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_access
CREATE POLICY "Users can view their subscription accesses"
ON public.subscription_access
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage their subscription accesses"
ON public.subscription_access
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
);

-- Product owners can view accesses
CREATE POLICY "Product owners can view subscription accesses"
ON public.subscription_access
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.subscriptions s
        JOIN public.products p ON s.product_id = p.id
        WHERE s.id = subscription_id AND p.user_id = auth.uid()
    )
);

-- 4. Create function to validate subscription quantity
CREATE OR REPLACE FUNCTION public.validate_subscription_quantity(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quantity_mode TEXT;
BEGIN
    -- Get product quantity mode
    SELECT subscription_quantity_mode INTO v_quantity_mode
    FROM public.products WHERE id = p_product_id;
    
    -- If mode is 'single', quantity must be 1
    IF v_quantity_mode = 'single' AND p_quantity != 1 THEN
        RETURN FALSE;
    END IF;
    
    -- Validate quantity range
    IF p_quantity < 1 OR p_quantity > 100 THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- 5. Create function to sync subscription accesses based on quantity
CREATE OR REPLACE FUNCTION public.sync_subscription_accesses(
    p_subscription_id UUID,
    p_action TEXT DEFAULT 'activate'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Get subscription details
    SELECT s.*, p.subscription_quantity_mode 
    INTO v_subscription
    FROM public.subscriptions s
    JOIN public.products p ON s.product_id = p.id
    WHERE s.id = p_subscription_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Handle actions
    CASE p_action
        WHEN 'activate' THEN
            -- Reactivate all suspended accesses
            UPDATE public.subscription_access
            SET status = 'active', updated_at = now()
            WHERE subscription_id = p_subscription_id AND status = 'suspended';
            GET DIAGNOSTICS v_count = ROW_COUNT;
            
        WHEN 'suspend' THEN
            -- Suspend all active accesses
            UPDATE public.subscription_access
            SET status = 'suspended', updated_at = now()
            WHERE subscription_id = p_subscription_id AND status = 'active';
            GET DIAGNOSTICS v_count = ROW_COUNT;
            
        WHEN 'revoke' THEN
            -- Revoke all accesses
            UPDATE public.subscription_access
            SET status = 'revoked', 
                access_revoked_at = now(),
                revoke_reason = 'Assinatura cancelada/expirada',
                updated_at = now()
            WHERE subscription_id = p_subscription_id AND status IN ('active', 'suspended');
            GET DIAGNOSTICS v_count = ROW_COUNT;
    END CASE;
    
    RETURN v_count;
END;
$$;

-- 6. Create function to get subscription access stats
CREATE OR REPLACE FUNCTION public.get_subscription_access_stats(p_subscription_id UUID)
RETURNS TABLE(
    total_quantity INTEGER,
    used_slots BIGINT,
    available_slots BIGINT,
    active_accesses BIGINT,
    suspended_accesses BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.quantity as total_quantity,
        COUNT(sa.id) FILTER (WHERE sa.status IN ('active', 'suspended')) as used_slots,
        s.quantity - COUNT(sa.id) FILTER (WHERE sa.status IN ('active', 'suspended')) as available_slots,
        COUNT(sa.id) FILTER (WHERE sa.status = 'active') as active_accesses,
        COUNT(sa.id) FILTER (WHERE sa.status = 'suspended') as suspended_accesses
    FROM public.subscriptions s
    LEFT JOIN public.subscription_access sa ON s.id = sa.subscription_id
    WHERE s.id = p_subscription_id
    GROUP BY s.id, s.quantity;
END;
$$;

-- 7. Add index for performance
CREATE INDEX IF NOT EXISTS idx_subscription_access_subscription_id 
ON public.subscription_access(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_access_status 
ON public.subscription_access(status);

-- 8. Add trigger for updated_at
CREATE TRIGGER update_subscription_access_updated_at
BEFORE UPDATE ON public.subscription_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();