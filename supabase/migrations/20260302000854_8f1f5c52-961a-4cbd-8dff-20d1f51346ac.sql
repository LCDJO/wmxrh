
-- Tenant-configurable scoring weights for structural indicators
CREATE TABLE public.org_indicator_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  indicator_type TEXT NOT NULL, -- 'turnover_risk' | 'stability' | 'legal_exposure' | 'org_risk_map'
  weights JSONB NOT NULL DEFAULT '{}',
  thresholds JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, indicator_type)
);

ALTER TABLE public.org_indicator_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for org_indicator_configs"
  ON public.org_indicator_configs FOR ALL
  USING (tenant_id IN (SELECT t.id FROM tenants t WHERE t.id = tenant_id));

-- Computed indicator snapshots (time-series)
CREATE TABLE public.org_indicator_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  indicator_type TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  components JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'low',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  computed_by TEXT DEFAULT 'system'
);

ALTER TABLE public.org_indicator_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for org_indicator_snapshots"
  ON public.org_indicator_snapshots FOR ALL
  USING (tenant_id IN (SELECT t.id FROM tenants t WHERE t.id = tenant_id));

CREATE INDEX idx_org_indicator_snapshots_lookup
  ON public.org_indicator_snapshots(tenant_id, indicator_type, period_start DESC);

-- Trigger for updated_at on configs
CREATE TRIGGER update_org_indicator_configs_updated_at
  BEFORE UPDATE ON public.org_indicator_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
