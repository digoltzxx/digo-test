-- Create A/B test events table for tracking metrics
CREATE TABLE public.ab_test_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  event_type TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  product_type TEXT,
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_ab_test_events_variant ON public.ab_test_events(variant);
CREATE INDEX idx_ab_test_events_event_type ON public.ab_test_events(event_type);
CREATE INDEX idx_ab_test_events_created_at ON public.ab_test_events(created_at);
CREATE INDEX idx_ab_test_events_session ON public.ab_test_events(session_id);

-- Enable RLS
ALTER TABLE public.ab_test_events ENABLE ROW LEVEL SECURITY;

-- Allow public insert for tracking (anonymous users can trigger events)
CREATE POLICY "Allow public insert for tracking"
ON public.ab_test_events
FOR INSERT
WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Only admins can read analytics"
ON public.ab_test_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'moderator')
  )
);

-- Create A/B test aggregated metrics view for dashboard
CREATE OR REPLACE VIEW public.ab_test_metrics AS
SELECT 
  variant,
  event_type,
  product_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  DATE_TRUNC('day', created_at) as event_date
FROM public.ab_test_events
GROUP BY variant, event_type, product_type, DATE_TRUNC('day', created_at);

-- Create function to calculate A/B test results
CREATE OR REPLACE FUNCTION public.get_ab_test_results(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT now() - interval '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS TABLE (
  variant TEXT,
  total_views BIGINT,
  cta_clicks BIGINT,
  cta_click_rate NUMERIC,
  abandonments BIGINT,
  abandonment_rate NUMERIC,
  avg_time_to_action_seconds NUMERIC,
  product_accesses BIGINT,
  product_access_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH variant_stats AS (
    SELECT 
      e.variant,
      COUNT(DISTINCT CASE WHEN e.event_type = 'page_view' THEN e.session_id END) as views,
      COUNT(DISTINCT CASE WHEN e.event_type = 'cta_click' THEN e.session_id END) as clicks,
      COUNT(DISTINCT CASE WHEN e.event_type = 'page_abandon' THEN e.session_id END) as abandons,
      COUNT(DISTINCT CASE WHEN e.event_type = 'product_access' THEN e.session_id END) as accesses,
      AVG(
        CASE WHEN e.event_type = 'cta_click' 
        THEN EXTRACT(EPOCH FROM (e.created_at - (
          SELECT MIN(e2.created_at) 
          FROM public.ab_test_events e2 
          WHERE e2.session_id = e.session_id AND e2.event_type = 'page_view'
        )))
        END
      ) as avg_time_to_action
    FROM public.ab_test_events e
    WHERE e.created_at BETWEEN p_start_date AND p_end_date
    GROUP BY e.variant
  )
  SELECT 
    vs.variant,
    vs.views as total_views,
    vs.clicks as cta_clicks,
    CASE WHEN vs.views > 0 THEN ROUND((vs.clicks::NUMERIC / vs.views) * 100, 2) ELSE 0 END as cta_click_rate,
    vs.abandons as abandonments,
    CASE WHEN vs.views > 0 THEN ROUND((vs.abandons::NUMERIC / vs.views) * 100, 2) ELSE 0 END as abandonment_rate,
    ROUND(COALESCE(vs.avg_time_to_action, 0), 2) as avg_time_to_action_seconds,
    vs.accesses as product_accesses,
    CASE WHEN vs.views > 0 THEN ROUND((vs.accesses::NUMERIC / vs.views) * 100, 2) ELSE 0 END as product_access_rate
  FROM variant_stats vs
  ORDER BY vs.variant;
END;
$$;