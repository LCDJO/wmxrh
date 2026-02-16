
-- Feature flags table with hierarchical scoping
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Hierarchical scope: NULL = tenant-wide, set = scoped
  company_group_id UUID REFERENCES public.company_groups(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique per feature per scope level
  CONSTRAINT uq_feature_scope UNIQUE (tenant_id, feature_name, company_group_id, company_id)
);

-- Indexes
CREATE INDEX idx_feature_flags_tenant ON public.feature_flags(tenant_id);
CREATE INDEX idx_feature_flags_lookup ON public.feature_flags(tenant_id, feature_name, enabled);

-- RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view feature flags"
  ON public.feature_flags FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage feature flags"
  ON public.feature_flags FOR ALL
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_feature_flags
  AFTER INSERT OR UPDATE OR DELETE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
