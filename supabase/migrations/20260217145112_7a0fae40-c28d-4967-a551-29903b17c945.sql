
-- ══════════════════════════════════════════════════════════════
-- Landing Pages — Platform Growth module
-- ══════════════════════════════════════════════════════════════

CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  target_plan_id UUID REFERENCES public.saas_plans(id) ON DELETE SET NULL,
  referral_program_id UUID DEFAULT NULL,
  gtm_container_id TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics JSONB NOT NULL DEFAULT '{"views":0,"uniqueVisitors":0,"conversions":0,"conversionRate":0,"avgTimeOnPage":0,"bounceRate":0,"topSources":[]}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Unique slug
CREATE UNIQUE INDEX idx_landing_pages_slug ON public.landing_pages(slug);

-- Enable RLS
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- Platform admins (authenticated users) can manage landing pages
CREATE POLICY "Authenticated users can view landing pages"
  ON public.landing_pages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create landing pages"
  ON public.landing_pages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update landing pages"
  ON public.landing_pages FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete landing pages"
  ON public.landing_pages FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Auto-update updated_at
CREATE TRIGGER update_landing_pages_updated_at
  BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
