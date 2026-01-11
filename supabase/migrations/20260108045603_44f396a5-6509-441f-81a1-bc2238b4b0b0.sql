-- Add chat_type column to differentiate AI chat from Live Support chat
ALTER TABLE public.support_messages 
ADD COLUMN chat_type TEXT NOT NULL DEFAULT 'support';

-- Add index for better query performance
CREATE INDEX idx_support_messages_chat_type ON public.support_messages(chat_type);

-- Comment to explain the column
COMMENT ON COLUMN public.support_messages.chat_type IS 'Type of chat: ai (AI assistant) or support (live human support)';