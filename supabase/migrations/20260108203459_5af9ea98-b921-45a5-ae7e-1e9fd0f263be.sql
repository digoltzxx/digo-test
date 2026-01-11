-- =====================================================
-- FIX REMAINING CRITICAL SECURITY VULNERABILITIES 
-- =====================================================

-- 1. ANTIFRAUD_ANALYSIS - Fix the policy to only allow users to view their own data
DROP POLICY IF EXISTS "Users view antifraud analysis" ON public.antifraud_analysis;

CREATE POLICY "Users can view own antifraud analysis"
ON public.antifraud_analysis FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Add admin access
CREATE POLICY "Admins can view all antifraud analysis"
ON public.antifraud_analysis FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Block anonymous access
CREATE POLICY "Block anonymous access to antifraud_analysis"
ON public.antifraud_analysis FOR ALL
TO anon
USING (false)
WITH CHECK (false);