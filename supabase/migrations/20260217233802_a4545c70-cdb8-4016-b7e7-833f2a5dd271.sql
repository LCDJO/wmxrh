-- 1. Add support_chat_sessions to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_sessions;

-- 2. Make chat-attachments bucket public so files are viewable
UPDATE storage.buckets SET public = true WHERE id = 'chat-attachments';

-- 3. Allow platform agents to create chat sessions
CREATE POLICY "Platform agents can insert chat sessions"
ON public.support_chat_sessions
FOR INSERT
WITH CHECK (is_active_platform_user(auth.uid()));

-- 4. Allow tenant members to update their own chat messages (mark as read)
CREATE POLICY "Tenant members can update chat messages"
ON public.support_chat_messages
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM support_chat_sessions s
  WHERE s.id = support_chat_messages.session_id
  AND is_tenant_member(auth.uid(), s.tenant_id)
));