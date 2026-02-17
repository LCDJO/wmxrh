
-- Landing page version history (immutable snapshots)
CREATE TABLE public.landing_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_notes TEXT,
  UNIQUE (landing_page_id, version_number)
);

-- Enable RLS
ALTER TABLE public.landing_versions ENABLE ROW LEVEL SECURITY;

-- Platform users can view all versions
CREATE POLICY "Platform users can view landing versions"
  ON public.landing_versions FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Platform users can insert versions
CREATE POLICY "Platform users can insert landing versions"
  ON public.landing_versions FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_landing_versions_page ON public.landing_versions(landing_page_id, version_number DESC);
