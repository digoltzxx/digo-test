-- =====================================================
-- SECURITY FIX: OTP Codes Table Protection
-- =====================================================

-- Drop the overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage OTP codes" ON public.otp_codes;

-- Create restricted policy for service_role only (explicit)
CREATE POLICY "Service role manages OTP codes"
ON public.otp_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Block all direct client access (authenticated and anonymous users)
CREATE POLICY "Block direct client access to OTP codes"
ON public.otp_codes
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- SECURITY FIX: Verify abandoned_carts protection
-- (Already has correct policies, but ensure no public access)
-- =====================================================

-- Add explicit block for anonymous users on abandoned_carts
DROP POLICY IF EXISTS "Block anonymous access to abandoned carts" ON public.abandoned_carts;
CREATE POLICY "Block anonymous access to abandoned carts"
ON public.abandoned_carts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- SECURITY FIX: Affiliate clicks - ensure proper protection
-- =====================================================

-- Update service role policies to be explicit
DROP POLICY IF EXISTS "Allow insert via service role" ON public.affiliate_clicks;
CREATE POLICY "Service role can insert affiliate clicks"
ON public.affiliate_clicks
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update via service role" ON public.affiliate_clicks;
CREATE POLICY "Service role can update affiliate clicks"
ON public.affiliate_clicks
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Block anonymous access to affiliate clicks
DROP POLICY IF EXISTS "Block anonymous access to affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "Block anonymous access to affiliate clicks"
ON public.affiliate_clicks
FOR ALL
TO anon
USING (false)
WITH CHECK (false);