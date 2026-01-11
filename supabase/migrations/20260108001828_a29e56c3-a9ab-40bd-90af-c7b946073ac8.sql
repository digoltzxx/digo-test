-- Create table for custom webhooks configuration
CREATE TABLE public.custom_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  token TEXT,
  product_filter TEXT NOT NULL DEFAULT 'all', -- 'all', 'producer', 'coproducer', or comma-separated product IDs
  product_ids UUID[] DEFAULT '{}',
  events_enabled TEXT[] NOT NULL DEFAULT ARRAY['payment_created', 'payment_approved', 'payment_refused', 'payment_refunded', 'chargeback_created', 'subscription_created', 'subscription_canceled'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own webhooks" 
ON public.custom_webhooks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own webhooks" 
ON public.custom_webhooks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks" 
ON public.custom_webhooks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhooks" 
ON public.custom_webhooks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_custom_webhooks_user_id ON public.custom_webhooks(user_id);
CREATE INDEX idx_custom_webhooks_active ON public.custom_webhooks(is_active) WHERE is_active = true;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_custom_webhooks_updated_at
BEFORE UPDATE ON public.custom_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();