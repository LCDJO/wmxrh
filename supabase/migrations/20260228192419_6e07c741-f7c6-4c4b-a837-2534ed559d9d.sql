
-- Add 'category' column with the required values
ALTER TABLE public.platform_policies
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'terms_of_use'
    CHECK (category IN ('terms_of_use', 'privacy', 'security', 'billing', 'conduct'));

-- Add 'applies_to' column
ALTER TABLE public.platform_policies
  ADD COLUMN IF NOT EXISTS applies_to TEXT NOT NULL DEFAULT 'tenant'
    CHECK (applies_to IN ('tenant', 'user', 'developer'));

-- Migrate existing policy_type values to category
UPDATE public.platform_policies SET category = CASE
  WHEN policy_type = 'terms_of_service' THEN 'terms_of_use'
  WHEN policy_type = 'privacy_policy' THEN 'privacy'
  WHEN policy_type = 'acceptable_use' THEN 'conduct'
  WHEN policy_type = 'data_processing' THEN 'privacy'
  WHEN policy_type = 'sla' THEN 'billing'
  ELSE 'terms_of_use'
END;

-- Index
CREATE INDEX IF NOT EXISTS idx_platform_policies_category ON public.platform_policies(category);
CREATE INDEX IF NOT EXISTS idx_platform_policies_applies_to ON public.platform_policies(applies_to);
