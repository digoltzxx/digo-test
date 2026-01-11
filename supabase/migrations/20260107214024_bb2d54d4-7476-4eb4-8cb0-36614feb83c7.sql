-- Add metadata column to sales table for UTM tracking and other contextual data
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for efficient querying of UTM data
CREATE INDEX IF NOT EXISTS idx_sales_metadata_utms ON public.sales USING gin (metadata jsonb_path_ops);

-- Add comment for documentation
COMMENT ON COLUMN public.sales.metadata IS 'Stores contextual data including UTM tracking parameters, IP address, and user agent';