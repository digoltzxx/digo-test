-- ============================================================
-- UPSELLS TABLE
-- Configuração de ofertas de upsell pós-compra
-- ============================================================
CREATE TABLE public.upsells (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    upsell_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    original_price NUMERIC(10,2) NOT NULL,
    offer_price NUMERIC(10,2) NOT NULL,
    discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value NUMERIC(10,2) DEFAULT 0,
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT DEFAULT 'Sim, quero essa oferta!',
    decline_text TEXT DEFAULT 'Não, obrigado',
    timer_enabled BOOLEAN DEFAULT false,
    timer_minutes INTEGER DEFAULT 15,
    is_subscription BOOLEAN DEFAULT false,
    subscription_interval TEXT CHECK (subscription_interval IN ('monthly', 'quarterly', 'yearly')),
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- DOWNSELLS TABLE
-- Configuração de ofertas de downsell (mostrado quando upsell é recusado)
-- ============================================================
CREATE TABLE public.downsells (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    upsell_id UUID NOT NULL REFERENCES public.upsells(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    downsell_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    original_price NUMERIC(10,2) NOT NULL,
    offer_price NUMERIC(10,2) NOT NULL,
    discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value NUMERIC(10,2) DEFAULT 0,
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT DEFAULT 'Sim, quero essa oferta!',
    decline_text TEXT DEFAULT 'Não, continuar',
    timer_enabled BOOLEAN DEFAULT false,
    timer_minutes INTEGER DEFAULT 10,
    is_subscription BOOLEAN DEFAULT false,
    subscription_interval TEXT CHECK (subscription_interval IN ('monthly', 'quarterly', 'yearly')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- SALES FUNNEL EVENTS TABLE
-- Rastreamento de eventos do funil de vendas
-- ============================================================
CREATE TABLE public.sales_funnel_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    user_email TEXT,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    step TEXT NOT NULL CHECK (step IN ('checkout', 'upsell', 'downsell', 'thank_you')),
    action TEXT NOT NULL CHECK (action IN ('viewed', 'accepted', 'declined', 'expired', 'error')),
    offer_id UUID,
    offer_type TEXT CHECK (offer_type IN ('upsell', 'downsell', 'order_bump')),
    amount NUMERIC(10,2),
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================
-- UPSELL/DOWNSELL ORDERS TABLE
-- Pedidos criados via upsell ou downsell
-- ============================================================
CREATE TABLE public.funnel_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    upsell_id UUID REFERENCES public.upsells(id) ON DELETE SET NULL,
    downsell_id UUID REFERENCES public.downsells(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL CHECK (order_type IN ('upsell', 'downsell')),
    amount NUMERIC(10,2) NOT NULL,
    net_amount NUMERIC(10,2) NOT NULL,
    payment_fee NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'failed', 'refunded')),
    transaction_id TEXT,
    buyer_name TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    seller_user_id UUID NOT NULL,
    payment_token_used BOOLEAN DEFAULT false,
    access_granted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for upsells
CREATE POLICY "Product owners can manage upsells" ON public.upsells
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = upsells.product_id 
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view active upsells" ON public.upsells
    FOR SELECT USING (is_active = true);

-- RLS Policies for downsells
CREATE POLICY "Product owners can manage downsells" ON public.downsells
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = downsells.product_id 
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view active downsells" ON public.downsells
    FOR SELECT USING (is_active = true);

-- RLS Policies for sales_funnel_events
CREATE POLICY "Product owners can view funnel events" ON public.sales_funnel_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE products.id = sales_funnel_events.product_id 
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert funnel events" ON public.sales_funnel_events
    FOR INSERT WITH CHECK (true);

-- RLS Policies for funnel_orders
CREATE POLICY "Sellers can view their funnel orders" ON public.funnel_orders
    FOR SELECT USING (seller_user_id = auth.uid());

CREATE POLICY "Service role can manage funnel orders" ON public.funnel_orders
    FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_upsells_product_id ON public.upsells(product_id);
CREATE INDEX idx_upsells_active ON public.upsells(is_active) WHERE is_active = true;
CREATE INDEX idx_downsells_upsell_id ON public.downsells(upsell_id);
CREATE INDEX idx_downsells_product_id ON public.downsells(product_id);
CREATE INDEX idx_funnel_events_sale_id ON public.sales_funnel_events(sale_id);
CREATE INDEX idx_funnel_events_session ON public.sales_funnel_events(session_id);
CREATE INDEX idx_funnel_events_step ON public.sales_funnel_events(step);
CREATE INDEX idx_funnel_orders_parent_sale ON public.funnel_orders(parent_sale_id);
CREATE INDEX idx_funnel_orders_seller ON public.funnel_orders(seller_user_id);

-- Triggers for updated_at
CREATE TRIGGER update_upsells_updated_at
    BEFORE UPDATE ON public.upsells
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_downsells_updated_at
    BEFORE UPDATE ON public.downsells
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_orders_updated_at
    BEFORE UPDATE ON public.funnel_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();