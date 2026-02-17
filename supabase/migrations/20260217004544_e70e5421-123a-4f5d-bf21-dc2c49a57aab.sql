
-- Add targeting columns for plan and feature flag filtering
ALTER TABLE public.tenant_announcements
  ADD COLUMN IF NOT EXISTS target_plan_id uuid,
  ADD COLUMN IF NOT EXISTS target_feature_flag text;

-- Index for targeting queries
CREATE INDEX IF NOT EXISTS idx_tenant_announcements_target_plan ON public.tenant_announcements (target_plan_id);
CREATE INDEX IF NOT EXISTS idx_tenant_announcements_target_flag ON public.tenant_announcements (target_feature_flag);
