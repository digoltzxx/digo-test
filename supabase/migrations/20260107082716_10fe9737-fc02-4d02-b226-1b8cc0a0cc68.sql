-- Add additional columns for enhanced deliverables system
ALTER TABLE public.product_deliverables 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS max_downloads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_delivery_method TEXT DEFAULT 'both',
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- Add retry count and metadata to delivery logs
ALTER TABLE public.delivery_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_delivery_logs_product_status ON public.delivery_logs(product_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_product_deliverables_active ON public.product_deliverables(product_id, is_active);