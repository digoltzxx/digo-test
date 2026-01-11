-- Fix search_path for security functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes
  WHERE expires_at < now() - INTERVAL '1 hour';
END;
$$;

CREATE OR REPLACE FUNCTION public.hash_otp(code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(digest(code, 'sha256'), 'hex');
END;
$$;