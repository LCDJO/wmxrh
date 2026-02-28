-- Add annual pricing columns to saas_plans
ALTER TABLE public.saas_plans 
  ADD COLUMN IF NOT EXISTS annual_price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS annual_discount_pct numeric(5,2) DEFAULT 0;

COMMENT ON COLUMN public.saas_plans.annual_price IS 'Annual price (total for 12 months, after discount). NULL = not available.';
COMMENT ON COLUMN public.saas_plans.annual_discount_pct IS 'Discount percentage for annual billing vs monthly.';