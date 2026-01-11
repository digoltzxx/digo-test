-- Add shipping address fields to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_cep TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_street TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_complement TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_neighborhood TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_city TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS shipping_state TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.sales.shipping_cep IS 'CEP do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_street IS 'Rua/Logradouro do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_number IS 'Número do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_complement IS 'Complemento do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_neighborhood IS 'Bairro do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_city IS 'Cidade do endereço de entrega';
COMMENT ON COLUMN public.sales.shipping_state IS 'Estado (UF) do endereço de entrega';