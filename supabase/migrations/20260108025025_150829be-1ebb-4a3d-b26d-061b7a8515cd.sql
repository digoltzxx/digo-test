-- Update the trigger function to save document info from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    email,
    document_type,
    document_number
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'document_type',
    new.raw_user_meta_data ->> 'document_number'
  );
  RETURN new;
END;
$$;

-- Create a policy to prevent updating document fields
-- First, drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new update policy that excludes document fields
CREATE POLICY "Users can update own profile limited"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Only allow update if document fields are not being changed
    -- by checking if the new values match the old values
    document_type IS NOT DISTINCT FROM (SELECT document_type FROM profiles WHERE user_id = auth.uid())
    AND document_number IS NOT DISTINCT FROM (SELECT document_number FROM profiles WHERE user_id = auth.uid())
  )
);