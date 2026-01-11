-- ===========================================
-- INTEGRATION ARCHITECTURE TABLES (Part 1)
-- ===========================================

-- Add columns to user_integrations
ALTER TABLE public.user_integrations 
  ADD COLUMN IF NOT EXISTS integration_type TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS credentials_encrypted JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS events_enabled TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retry_policy JSONB DEFAULT '{"max_retries": 3, "backoff_multiplier": 2, "initial_delay_ms": 1000}',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0;

-- Add user_id to webhook_logs if not exists
ALTER TABLE public.webhook_logs 
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS integration_id UUID,
  ADD COLUMN IF NOT EXISTS endpoint_url TEXT,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_status INT,
  ADD COLUMN IF NOT EXISTS response_body TEXT,
  ADD COLUMN IF NOT EXISTS response_headers JSONB,
  ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS hmac_signature TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- INTEGRATION EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  sale_id UUID,
  product_id UUID,
  customer_email TEXT,
  amount DECIMAL(12,2),
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'pending',
  provider_response JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- EMAIL MARKETING CONTACTS
CREATE TABLE IF NOT EXISTS public.email_marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  list_id TEXT,
  provider_contact_id TEXT,
  status TEXT DEFAULT 'active',
  synced_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider, email)
);

-- CRM DEALS TABLE
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  sale_id UUID,
  product_id UUID,
  provider_deal_id TEXT,
  contact_email TEXT,
  contact_name TEXT,
  deal_name TEXT,
  deal_value DECIMAL(12,2),
  stage TEXT DEFAULT 'new',
  pipeline_id TEXT,
  synced_at TIMESTAMPTZ,
  sync_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- TELEGRAM NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.telegram_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chat_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  message_id TEXT,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  sale_id UUID,
  amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- WHATSAPP MESSAGES
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  template_name TEXT,
  template_params JSONB DEFAULT '{}',
  message_type TEXT DEFAULT 'template',
  message_body TEXT,
  provider_message_id TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  sale_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ANALYTICS EVENTS (GA4)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  measurement_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_params JSONB NOT NULL,
  user_properties JSONB DEFAULT '{}',
  sale_id UUID,
  transaction_id TEXT,
  value DECIMAL(12,2),
  currency TEXT DEFAULT 'BRL',
  sent_at TIMESTAMPTZ,
  provider_response JSONB,
  error_message TEXT,
  deduplication_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ANTIFRAUD ANALYSIS
CREATE TABLE IF NOT EXISTS public.antifraud_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  sale_id UUID,
  checkout_session_id UUID,
  risk_score DECIMAL(5,2),
  risk_level TEXT,
  decision TEXT,
  provider_analysis_id TEXT,
  analysis_data JSONB DEFAULT '{}',
  ip_address TEXT,
  device_fingerprint TEXT,
  email TEXT,
  document TEXT,
  analyzed_at TIMESTAMPTZ,
  response_time_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ZAPIER TRIGGERS
CREATE TABLE IF NOT EXISTS public.zapier_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  zap_id TEXT,
  webhook_url TEXT NOT NULL,
  event_types TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- MONITORING ALERTS
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  alert_type TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB DEFAULT '{}',
  sentry_event_id TEXT,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);