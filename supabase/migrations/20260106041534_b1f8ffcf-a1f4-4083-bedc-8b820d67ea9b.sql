-- Tabela de logs de auditoria financeira
CREATE TABLE public.financial_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT,
  sale_id UUID,
  user_id UUID,
  payment_method TEXT,
  status_received TEXT NOT NULL,
  status_allowed BOOLEAN NOT NULL DEFAULT false,
  action_taken TEXT NOT NULL, -- 'blocked', 'ignored', 'accepted', 'error'
  reason TEXT,
  amount NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all financial audit logs" 
ON public.financial_audit_logs 
FOR SELECT 
USING (public.is_admin_or_moderator(auth.uid()));

-- System can insert logs (via service role)
CREATE POLICY "System can insert financial audit logs" 
ON public.financial_audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for efficient querying
CREATE INDEX idx_financial_audit_logs_user_id ON public.financial_audit_logs(user_id);
CREATE INDEX idx_financial_audit_logs_sale_id ON public.financial_audit_logs(sale_id);
CREATE INDEX idx_financial_audit_logs_status_received ON public.financial_audit_logs(status_received);
CREATE INDEX idx_financial_audit_logs_action_taken ON public.financial_audit_logs(action_taken);
CREATE INDEX idx_financial_audit_logs_created_at ON public.financial_audit_logs(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE public.financial_audit_logs IS 'Audit logs for financial transactions - tracks status changes and blocked operations';