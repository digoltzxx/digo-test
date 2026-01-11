-- Add indexes for optimized queries on delivery_logs table
-- These indexes improve performance for filtering, sorting, and searching

-- Index for created_at (used for ordering by date)
CREATE INDEX IF NOT EXISTS idx_delivery_logs_created_at ON public.delivery_logs (created_at DESC);

-- Index for user_email (used for search)
CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_email ON public.delivery_logs (user_email);

-- Index for delivery_status (used for filtering)
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON public.delivery_logs (delivery_status);

-- Index for delivery_type (used for filtering)
CREATE INDEX IF NOT EXISTS idx_delivery_logs_type ON public.delivery_logs (delivery_type);

-- Composite index for common query patterns (status + created_at)
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status_created ON public.delivery_logs (delivery_status, created_at DESC);