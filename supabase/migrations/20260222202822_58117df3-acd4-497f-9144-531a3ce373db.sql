
-- ══════════════════════════════════════════════════════════
-- DisplaySession — Adjust live_display_tokens to match spec
-- ══════════════════════════════════════════════════════════

-- Create status enum
CREATE TYPE public.display_session_status AS ENUM ('pending', 'active', 'expired');

-- Rename token → token_temporario, expires_at → expira_em
ALTER TABLE public.live_display_tokens
  RENAME COLUMN token TO token_temporario;

ALTER TABLE public.live_display_tokens
  RENAME COLUMN expires_at TO expira_em;

-- Replace is_active boolean with status enum
ALTER TABLE public.live_display_tokens
  ADD COLUMN status public.display_session_status NOT NULL DEFAULT 'pending';

-- Migrate existing data: is_active=true → 'active', false → 'expired'
UPDATE public.live_display_tokens SET status = 'active' WHERE is_active = true AND paired_at IS NOT NULL;
UPDATE public.live_display_tokens SET status = 'pending' WHERE is_active = true AND paired_at IS NULL;
UPDATE public.live_display_tokens SET status = 'expired' WHERE is_active = false;

-- Drop old column
ALTER TABLE public.live_display_tokens DROP COLUMN is_active;
