
-- Add idp_source to federation_sessions for tracking origin
ALTER TABLE public.federation_sessions
  ADD COLUMN IF NOT EXISTS idp_source TEXT;

-- Add refresh_token and token metadata
ALTER TABLE public.federation_sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';
