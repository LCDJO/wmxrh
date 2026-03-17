-- Add creative-level scheduling for banner validity windows
ALTER TABLE public.ads_creatives
ADD COLUMN starts_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE NULL;

-- Backfill existing creatives from their campaign schedule when available
UPDATE public.ads_creatives c
SET starts_at = camp.start_date,
    expires_at = camp.end_date
FROM public.ads_campaigns camp
WHERE camp.id = c.campaign_id
  AND c.starts_at IS NULL
  AND c.expires_at IS NULL;

-- Helpful indexes for ad delivery schedule filtering
CREATE INDEX IF NOT EXISTS idx_ads_creatives_starts_at ON public.ads_creatives (starts_at);
CREATE INDEX IF NOT EXISTS idx_ads_creatives_expires_at ON public.ads_creatives (expires_at);
CREATE INDEX IF NOT EXISTS idx_ads_creatives_campaign_active_schedule
  ON public.ads_creatives (campaign_id, is_active, starts_at, expires_at);