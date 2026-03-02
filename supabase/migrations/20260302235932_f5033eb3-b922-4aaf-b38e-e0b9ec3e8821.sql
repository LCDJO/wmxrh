
-- Create tenant_branding_profiles table
CREATE TABLE public.tenant_branding_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  system_display_name TEXT,
  primary_color TEXT DEFAULT '#0D9668',
  secondary_color TEXT DEFAULT '#1E293B',
  accent_color TEXT DEFAULT '#10B981',
  logo_url TEXT,
  favicon_url TEXT,
  custom_login_background TEXT,
  report_header_logo TEXT,
  report_footer_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version_id INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_branding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view branding" ON public.tenant_branding_profiles
  FOR SELECT USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert branding" ON public.tenant_branding_profiles
  FOR INSERT WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update branding" ON public.tenant_branding_profiles
  FOR UPDATE USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE TRIGGER update_tenant_branding_profiles_updated_at
  BEFORE UPDATE ON public.tenant_branding_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
