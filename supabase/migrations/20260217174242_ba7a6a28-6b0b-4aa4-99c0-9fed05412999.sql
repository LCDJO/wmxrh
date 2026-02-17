
-- Website version snapshots for rollback support
CREATE TABLE public.website_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot_layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot_seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by UUID REFERENCES auth.users(id),
  published_by_email TEXT,
  notes TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(website_page_id, version_number)
);

-- Enable RLS
ALTER TABLE public.website_versions ENABLE ROW LEVEL SECURITY;

-- Platform users can read all versions
CREATE POLICY "Platform users can view website versions"
  ON public.website_versions FOR SELECT
  TO authenticated
  USING (
    public.is_active_platform_user(auth.uid())
  );

-- Platform users can insert versions
CREATE POLICY "Platform users can create website versions"
  ON public.website_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_platform_user(auth.uid())
  );

-- Platform users can update versions (for is_current toggle)
CREATE POLICY "Platform users can update website versions"
  ON public.website_versions FOR UPDATE
  TO authenticated
  USING (
    public.is_active_platform_user(auth.uid())
  );

-- Index for fast lookups
CREATE INDEX idx_website_versions_page ON public.website_versions(website_page_id, version_number DESC);
CREATE INDEX idx_website_versions_current ON public.website_versions(website_page_id) WHERE is_current = true;
