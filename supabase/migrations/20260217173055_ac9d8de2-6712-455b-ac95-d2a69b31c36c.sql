
-- Website Pages table for institutional website management
CREATE TABLE public.website_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'published')),
  seo_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  version_id UUID NULL,
  parent_id UUID NULL REFERENCES public.website_pages(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,

  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;

-- Platform users can manage website pages
CREATE POLICY "Platform users can view website pages"
  ON public.website_pages FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can insert website pages"
  ON public.website_pages FOR INSERT
  WITH CHECK (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can update website pages"
  ON public.website_pages FOR UPDATE
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can delete website pages"
  ON public.website_pages FOR DELETE
  USING (public.is_active_platform_user(auth.uid()));

-- Published pages are publicly readable (for the website)
CREATE POLICY "Published pages are public"
  ON public.website_pages FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL AND is_visible = true);

-- Indexes
CREATE INDEX idx_website_pages_tenant ON public.website_pages(tenant_id);
CREATE INDEX idx_website_pages_slug ON public.website_pages(tenant_id, slug);
CREATE INDEX idx_website_pages_status ON public.website_pages(status);
CREATE INDEX idx_website_pages_parent ON public.website_pages(parent_id);

-- Auto-update updated_at
CREATE TRIGGER update_website_pages_updated_at
  BEFORE UPDATE ON public.website_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
