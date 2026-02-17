
-- Add module_id and metric_type to usage_records
ALTER TABLE public.usage_records
  ADD COLUMN module_id TEXT,
  ADD COLUMN metric_type TEXT NOT NULL DEFAULT 'api_calls';

-- Add index for metric_type queries
CREATE INDEX idx_usage_records_metric_type ON public.usage_records(tenant_id, metric_type);
