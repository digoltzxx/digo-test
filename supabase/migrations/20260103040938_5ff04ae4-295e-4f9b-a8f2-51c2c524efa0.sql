-- Create checkout_settings table for product checkout customization
CREATE TABLE public.checkout_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Appearance settings
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  background_color TEXT DEFAULT '#0f172a',
  button_text TEXT DEFAULT 'Finalizar Compra',
  
  -- Layout settings
  show_product_image BOOLEAN DEFAULT true,
  show_product_description BOOLEAN DEFAULT true,
  show_testimonials BOOLEAN DEFAULT false,
  show_guarantee BOOLEAN DEFAULT true,
  guarantee_days INTEGER DEFAULT 7,
  
  -- Form fields
  require_phone BOOLEAN DEFAULT false,
  require_document BOOLEAN DEFAULT false,
  require_address BOOLEAN DEFAULT false,
  
  -- Payment settings
  pix_enabled BOOLEAN DEFAULT true,
  credit_card_enabled BOOLEAN DEFAULT true,
  boleto_enabled BOOLEAN DEFAULT false,
  max_installments INTEGER DEFAULT 12,
  
  -- Timer/Urgency
  show_timer BOOLEAN DEFAULT false,
  timer_minutes INTEGER DEFAULT 15,
  timer_text TEXT DEFAULT 'Oferta expira em:',
  
  -- Custom texts
  headline TEXT,
  subheadline TEXT,
  footer_text TEXT,
  
  -- Redirect URLs
  success_url TEXT,
  cancel_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_product_checkout UNIQUE (product_id)
);

-- Enable RLS
ALTER TABLE public.checkout_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own product checkout settings
CREATE POLICY "Users can view their own checkout settings" 
ON public.checkout_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = checkout_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Users can create checkout settings for their own products
CREATE POLICY "Users can create checkout settings for their products" 
ON public.checkout_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = checkout_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Users can update their own checkout settings
CREATE POLICY "Users can update their own checkout settings" 
ON public.checkout_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = checkout_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Users can delete their own checkout settings
CREATE POLICY "Users can delete their own checkout settings" 
ON public.checkout_settings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = checkout_settings.product_id 
    AND products.user_id = auth.uid()
  )
);

-- Admins can manage all checkout settings
CREATE POLICY "Admins can manage all checkout settings" 
ON public.checkout_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for active products (needed for checkout page)
CREATE POLICY "Public can view checkout settings for active products" 
ON public.checkout_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.products 
    WHERE products.id = checkout_settings.product_id 
    AND products.status = 'active'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_checkout_settings_updated_at
BEFORE UPDATE ON public.checkout_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();