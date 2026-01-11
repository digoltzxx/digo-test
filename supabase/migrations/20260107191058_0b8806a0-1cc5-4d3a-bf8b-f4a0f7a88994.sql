-- Enable RLS on all new tables
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antifraud_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapier_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_events
CREATE POLICY "Users view own integration events" ON public.integration_events 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert integration events" ON public.integration_events 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for email_marketing_contacts
CREATE POLICY "Users manage email contacts" ON public.email_marketing_contacts 
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for crm_deals  
CREATE POLICY "Users manage CRM deals" ON public.crm_deals 
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for telegram_notifications
CREATE POLICY "Users view telegram notifications" ON public.telegram_notifications 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert telegram notifications" ON public.telegram_notifications 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users view whatsapp messages" ON public.whatsapp_messages 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert whatsapp messages" ON public.whatsapp_messages 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for analytics_events
CREATE POLICY "Users view analytics events" ON public.analytics_events 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert analytics events" ON public.analytics_events 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for antifraud_analysis
CREATE POLICY "Users view antifraud analysis" ON public.antifraud_analysis 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service insert antifraud analysis" ON public.antifraud_analysis 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for zapier_triggers
CREATE POLICY "Users manage zapier triggers" ON public.zapier_triggers 
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for monitoring_alerts
CREATE POLICY "Users view monitoring alerts" ON public.monitoring_alerts 
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service insert monitoring alerts" ON public.monitoring_alerts 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users update own monitoring alerts" ON public.monitoring_alerts 
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_integration_events_user ON public.integration_events(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_sale ON public.integration_events(sale_id);
CREATE INDEX IF NOT EXISTS idx_telegram_notifications_user ON public.telegram_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_zapier_triggers_user ON public.zapier_triggers(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_dedup ON public.analytics_events(deduplication_key);