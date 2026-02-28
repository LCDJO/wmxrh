
-- Add policy_scope enum-like column to platform_policies
ALTER TABLE public.platform_policies
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';

-- Add index for scope filtering
CREATE INDEX IF NOT EXISTS idx_platform_policies_scope ON public.platform_policies(scope);

COMMENT ON COLUMN public.platform_policies.scope IS 'Policy scope: global (SaaS-wide), marketplace, api, billing, custom';
