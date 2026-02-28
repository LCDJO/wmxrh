
ALTER TABLE public.platform_policy_versions
  ADD COLUMN IF NOT EXISTS requires_reacceptance BOOLEAN NOT NULL DEFAULT false;
