
-- ══════════════════════════════════════════════
-- Governance Core Engine — Append-Only Event Store
-- ══════════════════════════════════════════════

-- 1. Immutable event log (event sourcing backbone)
CREATE TABLE public.governance_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  aggregate_type TEXT NOT NULL,          -- e.g. 'employee', 'policy', 'compliance_rule'
  aggregate_id TEXT NOT NULL,            -- entity id
  event_type TEXT NOT NULL,              -- e.g. 'EmployeeHired', 'PolicyPublished'
  event_version INT NOT NULL DEFAULT 1,
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',  -- correlation_id, caused_by, actor, ip, etc.
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast replay & projection
CREATE INDEX idx_gov_events_aggregate ON public.governance_events(tenant_id, aggregate_type, aggregate_id, occurred_at);
CREATE INDEX idx_gov_events_type ON public.governance_events(tenant_id, event_type, occurred_at);
CREATE INDEX idx_gov_events_occurred ON public.governance_events(occurred_at DESC);

-- 2. Projections table (materialized read models)
CREATE TABLE public.governance_projections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  projection_name TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  version INT NOT NULL DEFAULT 0,
  last_event_id UUID REFERENCES public.governance_events(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_gov_proj_unique ON public.governance_projections(tenant_id, projection_name, aggregate_type, aggregate_id);

-- 3. Immutability trigger — block UPDATE and DELETE on events
CREATE OR REPLACE FUNCTION public.governance_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'governance_events is append-only. UPDATE and DELETE are forbidden.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_governance_events_immutable
BEFORE UPDATE OR DELETE ON public.governance_events
FOR EACH ROW
EXECUTE FUNCTION public.governance_events_immutable();

-- 4. RLS
ALTER TABLE public.governance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_projections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - governance_events SELECT"
  ON public.governance_events FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - governance_events INSERT"
  ON public.governance_events FOR INSERT
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - governance_projections SELECT"
  ON public.governance_projections FOR SELECT
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - governance_projections INSERT"
  ON public.governance_projections FOR INSERT
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants));

CREATE POLICY "Tenant isolation - governance_projections UPDATE"
  ON public.governance_projections FOR UPDATE
  USING (tenant_id IN (SELECT id FROM public.tenants));
