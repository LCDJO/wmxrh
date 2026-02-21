
-- Add active_version tracking and preview_url to meta_ad_campaigns
ALTER TABLE public.meta_ad_campaigns 
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active_version boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preview_url text;

-- Add preview_token to landing_pages for secure preview access
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS preview_token uuid DEFAULT gen_random_uuid();

-- Index for fast active version lookup
CREATE INDEX IF NOT EXISTS idx_meta_ad_campaigns_active 
  ON public.meta_ad_campaigns (landing_page_id, is_active_version) 
  WHERE is_active_version = true;
