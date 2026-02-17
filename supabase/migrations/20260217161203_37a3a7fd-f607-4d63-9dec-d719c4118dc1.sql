
-- Conversion metric events for landing pages / A/B variants
CREATE TABLE public.landing_metric_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id TEXT NOT NULL,
  variant_id UUID REFERENCES public.landing_variants(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view','cta_click','form_submit','signup','trial_start','purchase','referral_click','scroll_depth','custom')),
  referral_code TEXT,
  tenant_created BOOLEAN NOT NULL DEFAULT false,
  revenue_generated NUMERIC(12,2) NOT NULL DEFAULT 0,
  visitor_id TEXT,
  session_id TEXT,
  source TEXT DEFAULT 'direct',
  medium TEXT DEFAULT 'none',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.landing_metric_events ENABLE ROW LEVEL SECURITY;

-- Platform users can read all events
CREATE POLICY "Platform users view metric events"
  ON public.landing_metric_events FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Anyone can insert (anonymous visitor tracking)
CREATE POLICY "Anyone can insert metric events"
  ON public.landing_metric_events FOR INSERT
  WITH CHECK (true);

-- Indexes for analytics queries
CREATE INDEX idx_lme_landing_page ON public.landing_metric_events (landing_page_id, created_at DESC);
CREATE INDEX idx_lme_variant ON public.landing_metric_events (variant_id, event_type);
CREATE INDEX idx_lme_referral ON public.landing_metric_events (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_lme_event_type ON public.landing_metric_events (event_type, created_at DESC);
