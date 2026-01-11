-- Add unique constraint on document_number (CPF/CNPJ)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_document_number_unique 
ON public.profiles (document_number) 
WHERE document_number IS NOT NULL AND document_number != '';

-- Add unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique 
ON public.profiles (email) 
WHERE email IS NOT NULL AND email != '';