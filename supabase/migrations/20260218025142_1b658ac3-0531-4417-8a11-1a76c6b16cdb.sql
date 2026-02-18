-- Add closure fields to support_chat_sessions
ALTER TABLE public.support_chat_sessions
  ADD COLUMN IF NOT EXISTS closure_summary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closure_category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closure_resolved boolean DEFAULT NULL;