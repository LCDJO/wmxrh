
-- ══════════════════════════════════════════════
-- Organizational Intelligence Engine — Async Job Queue
-- ══════════════════════════════════════════════

-- Background job queue for async intelligence calculations
CREATE TABLE public.org_intelligence_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  job_type TEXT NOT NULL,            -- e.g. 'turnover_calc', 'risk_heatmap', 'absenteeism_index'
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed | cancelled
  priority INT NOT NULL DEFAULT 5,   -- 1 = highest, 10 = lowest
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oij_pending ON public.org_intelligence_jobs(status, priority, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_oij_tenant ON public.org_intelligence_jobs(tenant_id, job_type, created_at DESC);

-- Aggregated KPI snapshots (time-series)
CREATE TABLE public.org_intelligence_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  snapshot_type TEXT NOT NULL,       -- 'turnover', 'headcount', 'absenteeism', 'risk', 'performance'
  period_type TEXT NOT NULL DEFAULT 'monthly',  -- daily | weekly | monthly
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ois_unique ON public.org_intelligence_snapshots(tenant_id, snapshot_type, period_type, period_start);
CREATE INDEX idx_ois_query ON public.org_intelligence_snapshots(tenant_id, snapshot_type, period_start DESC);

-- RLS
ALTER TABLE public.org_intelligence_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - org_intelligence_jobs SELECT"
  ON public.org_intelligence_jobs FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - org_intelligence_jobs INSERT"
  ON public.org_intelligence_jobs FOR INSERT
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - org_intelligence_jobs UPDATE"
  ON public.org_intelligence_jobs FOR UPDATE
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - org_intelligence_snapshots SELECT"
  ON public.org_intelligence_snapshots FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - org_intelligence_snapshots INSERT"
  ON public.org_intelligence_snapshots FOR INSERT
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - org_intelligence_snapshots UPDATE"
  ON public.org_intelligence_snapshots FOR UPDATE
  USING (tenant_id IN (SELECT id FROM public.tenants));
