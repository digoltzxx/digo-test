-- Create table for storing pixel configurations
CREATE TABLE public.checkout_pixels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pixel_type TEXT NOT NULL CHECK (pixel_type IN ('google_ads', 'google_analytics_4', 'google_analytics', 'facebook', 'tiktok', 'kwai', 'google_tag_manager')),
  title TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  measurement_id TEXT,
  conversion_id TEXT,
  conversion_label TEXT,
  access_token_encrypted TEXT,
  events_config JSONB NOT NULL DEFAULT '{"pageView": true, "viewContent": true, "initiateCheckout": true, "addPaymentInfo": true, "purchase": true}'::jsonb,
  conversion_on_pix BOOLEAN NOT NULL DEFAULT false,
  conversion_on_boleto BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checkout_pixels ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only manage their own pixels
CREATE POLICY "Users can view their own pixels"
  ON public.checkout_pixels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pixels"
  ON public.checkout_pixels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pixels"
  ON public.checkout_pixels
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pixels"
  ON public.checkout_pixels
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_checkout_pixels_product_id ON public.checkout_pixels(product_id);
CREATE INDEX idx_checkout_pixels_user_id ON public.checkout_pixels(user_id);
CREATE INDEX idx_checkout_pixels_active ON public.checkout_pixels(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_checkout_pixels_updated_at
  BEFORE UPDATE ON public.checkout_pixels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table for tracking pixel events (for logging and debugging)
CREATE TABLE public.pixel_event_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checkout_pixel_id UUID REFERENCES public.checkout_pixels(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  pixel_type TEXT NOT NULL,
  event_source TEXT NOT NULL CHECK (event_source IN ('browser', 'server')),
  event_id TEXT,
  transaction_id TEXT,
  value DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for logs
ALTER TABLE public.pixel_event_logs ENABLE ROW LEVEL SECURITY;

-- Allow insert from edge functions (service role)
CREATE POLICY "Service role can manage pixel logs"
  ON public.pixel_event_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for logs
CREATE INDEX idx_pixel_event_logs_sale_id ON public.pixel_event_logs(sale_id);
CREATE INDEX idx_pixel_event_logs_created_at ON public.pixel_event_logs(created_at DESC);