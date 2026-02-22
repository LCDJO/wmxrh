
-- Add pairing_code for TV-initiated pairing flow
ALTER TABLE public.live_display_tokens
  ADD COLUMN IF NOT EXISTS pairing_code VARCHAR(6) NULL;

-- Index for fast lookup by pairing_code
CREATE INDEX IF NOT EXISTS idx_live_display_tokens_pairing_code
  ON public.live_display_tokens (pairing_code) WHERE pairing_code IS NOT NULL;
