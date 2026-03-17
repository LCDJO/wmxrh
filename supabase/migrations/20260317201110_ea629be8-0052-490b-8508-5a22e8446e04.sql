-- Create canonical ad slots registry
CREATE TABLE public.ads_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  location_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ads_slots_location_type_check CHECK (location_type IN ('login', 'saas', 'tenant', 'site', 'module'))
);

ALTER TABLE public.ads_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can manage slots"
ON public.ads_slots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users
    WHERE platform_users.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users
    WHERE platform_users.user_id = auth.uid()
  )
);

-- Extend placements to reference canonical slots and support module-aware delivery
ALTER TABLE public.ads_placements
ADD COLUMN slot_id UUID,
ADD COLUMN location_type TEXT,
ADD COLUMN module_key TEXT;

ALTER TABLE public.ads_placements
ADD CONSTRAINT ads_placements_slot_id_fkey
FOREIGN KEY (slot_id) REFERENCES public.ads_slots(id) ON DELETE SET NULL;

CREATE INDEX idx_ads_placements_slot_id ON public.ads_placements(slot_id);
CREATE INDEX idx_ads_placements_location_type ON public.ads_placements(location_type);
CREATE INDEX idx_ads_placements_module_key ON public.ads_placements(module_key) WHERE module_key IS NOT NULL;

-- Advanced targeting by module
ALTER TABLE public.ads_targeting
ADD COLUMN module_key TEXT;

CREATE INDEX idx_ads_targeting_module_key ON public.ads_targeting(module_key) WHERE module_key IS NOT NULL;

-- Plan-level ad control
ALTER TABLE public.saas_plans
ADD COLUMN ads_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_saas_plans_ads_enabled ON public.saas_plans(ads_enabled);

-- Delivery performance indexes
CREATE INDEX idx_ads_campaigns_status_dates_priority
ON public.ads_campaigns(status, start_date, end_date, priority);

CREATE INDEX idx_ads_metrics_placement_created_at
ON public.ads_metrics(placement, created_at DESC);

CREATE INDEX idx_ads_metrics_campaign_event_created_at
ON public.ads_metrics(campaign_id, event_type, created_at DESC);

CREATE INDEX idx_ads_frequency_caps_user_campaign
ON public.ads_frequency_caps(user_id, campaign_id);

CREATE INDEX idx_ads_creatives_campaign_active
ON public.ads_creatives(campaign_id, is_active);

COMMENT ON TABLE public.ads_slots IS 'Canonical registry of global ad slots rendered across login, SaaS, tenant, site, and module surfaces.';
COMMENT ON COLUMN public.ads_placements.slot_id IS 'Canonical slot associated with this placement record.';
COMMENT ON COLUMN public.ads_targeting.module_key IS 'Optional module identifier to target ads to a specific module or route family.';
COMMENT ON COLUMN public.saas_plans.ads_enabled IS 'Controls whether tenants on this plan should see monetization or communication ads by default.';