-- Create billing_periods table for monthly billing records
CREATE TABLE IF NOT EXISTS public.billing_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES auth.users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, period_start, period_end)
);

-- Create gateway_acquirers table to track main acquirer
CREATE TABLE IF NOT EXISTS public.gateway_acquirers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  api_key_encrypted TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing_line_items for detailed billing breakdown
CREATE TABLE IF NOT EXISTS public.billing_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_period_id UUID REFERENCES public.billing_periods(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL CHECK (category IN ('acquirer', 'banking', 'extensions', 'gateway_provider')),
  item_type TEXT NOT NULL,
  item_label TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_deduction BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create billing_summary for quick access to totals
CREATE TABLE IF NOT EXISTS public.billing_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billing_period_id UUID REFERENCES public.billing_periods(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID REFERENCES auth.users(id),
  gross_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  pre_chargeback DECIMAL(15,2) NOT NULL DEFAULT 0,
  acquirer_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  acquirer_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  withdrawal_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  anticipation_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  baas_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  banking_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  antifraud_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  pre_chargeback_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  kyc_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  extensions_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  gateway_provider_name TEXT,
  gateway_provider_fees DECIMAL(15,2) NOT NULL DEFAULT 0,
  gateway_provider_subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_acquirers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_summary ENABLE ROW LEVEL SECURITY;

-- RLS Policies allowing authenticated users to manage their data
CREATE POLICY "Users can manage billing periods" ON public.billing_periods
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage acquirers" ON public.gateway_acquirers
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage line items" ON public.billing_line_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage summaries" ON public.billing_summary
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Insert default global acquirer (ShieldTech as example)
INSERT INTO public.gateway_acquirers (tenant_id, name, display_name, is_active, is_primary)
VALUES (NULL, 'shieldtech', 'ShieldTech', true, true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_billing_periods_updated_at
  BEFORE UPDATE ON public.billing_periods
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER update_gateway_acquirers_updated_at
  BEFORE UPDATE ON public.gateway_acquirers
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

CREATE TRIGGER update_billing_summary_updated_at
  BEFORE UPDATE ON public.billing_summary
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

-- Enable realtime for billing tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gateway_acquirers;