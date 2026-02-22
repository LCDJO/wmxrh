
-- Allow null display_id for pending pairing sessions (TV-initiated, not yet linked)
ALTER TABLE public.live_display_tokens
  ALTER COLUMN display_id DROP NOT NULL;

-- Allow null tenant_id for pending pairing sessions
ALTER TABLE public.live_display_tokens
  ALTER COLUMN tenant_id DROP NOT NULL;
