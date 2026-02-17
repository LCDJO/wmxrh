
-- Prevent DELETE on chat messages (immutable archive)
CREATE OR REPLACE FUNCTION public.prevent_chat_message_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Chat messages cannot be deleted. All messages are permanently archived for compliance.';
END;
$$;

CREATE TRIGGER trg_prevent_chat_message_delete
  BEFORE DELETE ON public.support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_chat_message_delete();

-- Prevent modification of message content (only read_at can be updated)
CREATE OR REPLACE FUNCTION public.prevent_chat_message_content_edit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.message_text IS DISTINCT FROM NEW.message_text
    OR OLD.sender_type IS DISTINCT FROM NEW.sender_type
    OR OLD.sender_id IS DISTINCT FROM NEW.sender_id
    OR OLD.attachments IS DISTINCT FROM NEW.attachments
    OR OLD.session_id IS DISTINCT FROM NEW.session_id
  THEN
    RAISE EXCEPTION 'Chat message content is immutable. Only read_at can be updated.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_chat_message_content_edit
  BEFORE UPDATE ON public.support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_chat_message_content_edit();

-- Prevent DELETE on chat sessions
CREATE OR REPLACE FUNCTION public.prevent_chat_session_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Chat sessions cannot be deleted. All sessions are permanently archived.';
END;
$$;

CREATE TRIGGER trg_prevent_chat_session_delete
  BEFORE DELETE ON public.support_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_chat_session_delete();
