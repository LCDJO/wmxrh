
-- Create workforce_insights table
CREATE TABLE public.workforce_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  group_id UUID REFERENCES public.company_groups(id),
  company_id UUID REFERENCES public.companies(id),
  insight_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  descricao TEXT NOT NULL,
  dados_origem_json JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workforce_insights ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant members can view workforce insights"
  ON public.workforce_insights FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert workforce insights"
  ON public.workforce_insights FOR INSERT
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update workforce insights"
  ON public.workforce_insights FOR UPDATE
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete workforce insights"
  ON public.workforce_insights FOR DELETE
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX idx_workforce_insights_tenant ON public.workforce_insights(tenant_id);
CREATE INDEX idx_workforce_insights_type ON public.workforce_insights(tenant_id, insight_type);
CREATE INDEX idx_workforce_insights_severity ON public.workforce_insights(tenant_id, severity);
CREATE INDEX idx_workforce_insights_company ON public.workforce_insights(company_id) WHERE company_id IS NOT NULL;

-- Audit trigger
CREATE TRIGGER audit_workforce_insights
  AFTER INSERT OR UPDATE OR DELETE ON public.workforce_insights
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
