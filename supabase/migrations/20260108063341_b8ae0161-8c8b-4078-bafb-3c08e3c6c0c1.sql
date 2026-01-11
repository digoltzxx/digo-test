-- Fix remaining SECURITY DEFINER view: support_conversations
DROP VIEW IF EXISTS public.support_conversations;

CREATE OR REPLACE VIEW public.support_conversations
WITH (security_invoker = true)
AS
SELECT 
    sm.user_id,
    sm.session_id,
    p.full_name AS user_name,
    p.email AS user_email,
    min(sm.created_at) AS started_at,
    max(sm.created_at) AS last_message_at,
    count(*) AS message_count,
    count(CASE WHEN sm.is_from_user THEN 1 ELSE NULL END) AS user_messages,
    count(CASE WHEN NOT sm.is_from_user THEN 1 ELSE NULL END) AS agent_messages,
    max(sm.archived_at) AS archived_at,
    CASE WHEN max(sm.archived_at) IS NOT NULL THEN 'archived' ELSE 'active' END AS status
FROM support_messages sm
LEFT JOIN profiles p ON p.user_id = sm.user_id
WHERE sm.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
GROUP BY sm.user_id, sm.session_id, p.full_name, p.email
ORDER BY max(sm.created_at) DESC;