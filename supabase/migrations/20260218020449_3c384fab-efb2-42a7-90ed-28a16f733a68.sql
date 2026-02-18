
-- Support Module Version — layer-specific version tracking
CREATE TABLE public.support_module_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id TEXT NOT NULL DEFAULT 'support_module',
  module_version_id UUID REFERENCES public.module_versions(id),
  tenant_ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform_ui_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

-- Enable RLS
ALTER TABLE public.support_module_versions ENABLE ROW LEVEL SECURITY;

-- Platform users can read
CREATE POLICY "Platform users can read support module versions"
  ON public.support_module_versions FOR SELECT
  USING (public.is_active_platform_user(auth.uid()));

-- Platform admins can insert/update
CREATE POLICY "Platform admins can manage support module versions"
  ON public.support_module_versions FOR ALL
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));
