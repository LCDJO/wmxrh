
-- Add whitelabel plan limit columns to saas_plans
ALTER TABLE public.saas_plans
  ADD COLUMN IF NOT EXISTS allow_whitelabel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_custom_reports BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_custom_domain BOOLEAN NOT NULL DEFAULT false;
