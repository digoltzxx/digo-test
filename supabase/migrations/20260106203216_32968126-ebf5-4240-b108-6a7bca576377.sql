-- Fix 1: order_items RLS policy - Restrict to service_role only
DROP POLICY IF EXISTS "Service role can manage order items" ON public.order_items;

CREATE POLICY "Service role can manage order items" 
ON public.order_items 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix 2: chat-attachments storage - Make bucket private and update policies
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-attachments';

-- Drop public access policy
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

-- Create policy for users to view their own attachments
CREATE POLICY "Users can view their own chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy for admins/moderators to view all attachments
CREATE POLICY "Admins can view all chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-attachments' AND
  is_admin_or_moderator(auth.uid())
);