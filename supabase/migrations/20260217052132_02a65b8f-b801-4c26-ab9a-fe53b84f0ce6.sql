
-- Add optional price override to plan_modules
ALTER TABLE public.plan_modules
ADD COLUMN module_price_override NUMERIC(12,2) DEFAULT NULL;

COMMENT ON COLUMN public.plan_modules.module_price_override IS 'Optional price override for this module in this plan. NULL means included in base price.';
