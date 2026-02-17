-- Landing Page Versions: immutable snapshots for post-approval editing
CREATE TABLE public.landing_page_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  fab_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  seo_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'published')),
  created_by UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (landing_page_id, version_number)
);

-- Indexes
CREATE INDEX idx_lpv_landing_page ON public.landing_page_versions(landing_page_id);
CREATE INDEX idx_lpv_status ON public.landing_page_versions(status);

-- Auto-update updated_at
CREATE TRIGGER update_landing_page_versions_updated_at
  BEFORE UPDATE ON public.landing_page_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;

-- Platform users can read all versions
CREATE POLICY "Platform users can view versions"
  ON public.landing_page_versions FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Platform users can insert versions
CREATE POLICY "Platform users can create versions"
  ON public.landing_page_versions FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Platform users can update versions
CREATE POLICY "Platform users can update versions"
  ON public.landing_page_versions FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()));