-- Add session tracking to support_messages
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS session_id uuid DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Create index for faster session queries
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON public.support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_archived_at ON public.support_messages(archived_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_user_created ON public.support_messages(user_id, created_at DESC);

-- Create a view for archived conversations (for admin)
CREATE OR REPLACE VIEW public.support_conversations AS
SELECT 
  sm.user_id,
  sm.session_id,
  p.full_name as user_name,
  p.email as user_email,
  MIN(sm.created_at) as started_at,
  MAX(sm.created_at) as last_message_at,
  COUNT(*) as message_count,
  COUNT(CASE WHEN sm.is_from_user THEN 1 END) as user_messages,
  COUNT(CASE WHEN NOT sm.is_from_user THEN 1 END) as agent_messages,
  MAX(sm.archived_at) as archived_at,
  CASE WHEN MAX(sm.archived_at) IS NOT NULL THEN 'archived' ELSE 'active' END as status
FROM public.support_messages sm
LEFT JOIN public.profiles p ON p.user_id = sm.user_id
GROUP BY sm.user_id, sm.session_id, p.full_name, p.email
ORDER BY MAX(sm.created_at) DESC;