
-- 6) Add environment column to api_clients
ALTER TABLE public.api_clients ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production';
ALTER TABLE public.api_clients ADD CONSTRAINT api_clients_environment_check CHECK (environment IN ('production', 'sandbox'));

-- 7) Simplify api_usage_logs to match ApiRequestLog spec + add module column
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS module text;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS latency_ms numeric;

-- Copy response_time_ms to latency_ms for existing data
UPDATE public.api_usage_logs SET latency_ms = response_time_ms WHERE response_time_ms IS NOT NULL AND latency_ms IS NULL;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_module ON public.api_usage_logs (module);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_environment ON public.api_clients (environment);
