
-- Evolve usage_pricing_tiers into full UsagePricingRule
ALTER TABLE public.usage_pricing_tiers
  ADD COLUMN module_id TEXT,
  ADD COLUMN metric_type TEXT NOT NULL DEFAULT 'api_calls',
  ADD COLUMN price_per_unit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN overage_price NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX idx_usage_pricing_module ON public.usage_pricing_tiers(module_id, metric_type);
