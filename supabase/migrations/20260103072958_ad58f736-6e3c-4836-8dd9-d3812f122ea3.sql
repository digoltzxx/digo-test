-- Allow service role to insert webhook logs (for edge functions)
DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.webhook_logs;
CREATE POLICY "Service can insert webhook logs"
ON public.webhook_logs
FOR INSERT
WITH CHECK (true);

-- Also ensure sellers can insert sales (for edge functions via service role)
DROP POLICY IF EXISTS "Service can insert sales" ON public.sales;
CREATE POLICY "Service can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (true);