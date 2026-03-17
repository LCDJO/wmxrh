-- Add missing tracked_at column used by the top-conversions backend function
ALTER TABLE public.landing_metric_events
ADD COLUMN IF NOT EXISTS tracked_at TIMESTAMP WITH TIME ZONE;

-- Backfill historical events so analytics queries work immediately
UPDATE public.landing_metric_events
SET tracked_at = COALESCE(tracked_at, created_at, now())
WHERE tracked_at IS NULL;

-- Ensure future records always have a tracked timestamp
ALTER TABLE public.landing_metric_events
ALTER COLUMN tracked_at SET DEFAULT now();

ALTER TABLE public.landing_metric_events
ALTER COLUMN tracked_at SET NOT NULL;

-- Improve range filtering performance for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_landing_metric_events_tracked_at
ON public.landing_metric_events (tracked_at);

CREATE INDEX IF NOT EXISTS idx_landing_metric_events_page_tracked_at
ON public.landing_metric_events (landing_page_id, tracked_at DESC);