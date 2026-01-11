-- Create support_messages table for chat messages
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_from_user BOOLEAN NOT NULL DEFAULT true,
  agent_id UUID NULL,
  agent_name TEXT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own messages
CREATE POLICY "Users can view their own messages"
ON public.support_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert their own messages"
ON public.support_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id AND is_from_user = true);

-- Account managers can view all messages
CREATE POLICY "Account managers can view all messages"
ON public.support_messages
FOR SELECT
USING (has_role(auth.uid(), 'account_manager') OR has_role(auth.uid(), 'admin'));

-- Account managers can insert responses
CREATE POLICY "Account managers can insert responses"
ON public.support_messages
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'account_manager') OR has_role(auth.uid(), 'admin')) 
  AND is_from_user = false
);

-- Account managers can update messages (mark as read)
CREATE POLICY "Account managers can update messages"
ON public.support_messages
FOR UPDATE
USING (has_role(auth.uid(), 'account_manager') OR has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_support_messages_updated_at
BEFORE UPDATE ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for support_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;