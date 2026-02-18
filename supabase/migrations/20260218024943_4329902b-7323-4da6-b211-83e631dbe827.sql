-- 1) Add tags, module_reference, priority to support_chat_sessions
ALTER TABLE public.support_chat_sessions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS module_reference text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium';

-- 2) Create support_chat_notes (internal agent notes, invisible to tenants)
CREATE TABLE public.support_chat_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.support_chat_sessions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  note_text text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_chat_notes_session ON public.support_chat_notes(session_id);

-- Enable RLS
ALTER TABLE public.support_chat_notes ENABLE ROW LEVEL SECURITY;

-- Only platform users (agents) can CRUD notes
CREATE POLICY "Platform agents can view chat notes"
  ON public.support_chat_notes FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform agents can insert chat notes"
  ON public.support_chat_notes FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()) AND agent_id = auth.uid());

CREATE POLICY "Platform agents can update own notes"
  ON public.support_chat_notes FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()) AND agent_id = auth.uid());

CREATE POLICY "Platform agents can delete own notes"
  ON public.support_chat_notes FOR DELETE
  USING (public.is_active_platform_user(auth.uid()) AND agent_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_chat_notes_updated_at
  BEFORE UPDATE ON public.support_chat_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_notes;