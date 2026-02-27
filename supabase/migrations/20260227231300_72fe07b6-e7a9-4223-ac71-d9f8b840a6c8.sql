
-- Chaos Engineering Engine Tables

-- Chaos scenarios (templates for experiments)
CREATE TABLE public.chaos_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  fault_type TEXT NOT NULL DEFAULT 'latency_injection',
  target_module TEXT,
  target_region TEXT,
  parameters JSONB NOT NULL DEFAULT '{}',
  safety_constraints JSONB NOT NULL DEFAULT '{}',
  blast_radius TEXT NOT NULL DEFAULT 'single_service',
  max_duration_minutes INTEGER NOT NULL DEFAULT 30,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chaos experiments (executions of scenarios)
CREATE TABLE public.chaos_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES public.chaos_scenarios(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  fault_type TEXT NOT NULL,
  target_module TEXT,
  target_region TEXT,
  parameters JSONB NOT NULL DEFAULT '{}',
  blast_radius TEXT NOT NULL DEFAULT 'single_service',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  aborted_at TIMESTAMPTZ,
  abort_reason TEXT,
  max_duration_minutes INTEGER NOT NULL DEFAULT 30,
  safety_stopped BOOLEAN NOT NULL DEFAULT false,
  safety_stop_reason TEXT,
  initiated_by TEXT,
  approved_by TEXT,
  -- SLA/RTO/RPO validation results
  sla_target_pct NUMERIC(5,2),
  sla_actual_pct NUMERIC(5,2),
  sla_met BOOLEAN,
  rto_target_minutes INTEGER,
  rto_actual_minutes INTEGER,
  rto_met BOOLEAN,
  rpo_target_minutes INTEGER,
  rpo_actual_minutes INTEGER,
  rpo_met BOOLEAN,
  -- Impact analysis
  affected_services TEXT[] DEFAULT '{}',
  affected_tenants TEXT[] DEFAULT '{}',
  error_rate_before NUMERIC(5,2),
  error_rate_during NUMERIC(5,2),
  latency_before_ms INTEGER,
  latency_during_ms INTEGER,
  -- Integration references
  incident_id TEXT,
  failover_id TEXT,
  self_healing_triggered BOOLEAN DEFAULT false,
  escalation_triggered BOOLEAN DEFAULT false,
  -- Results
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  impact_score NUMERIC(3,1),
  resilience_score NUMERIC(3,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chaos audit log
CREATE TABLE public.chaos_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID REFERENCES public.chaos_experiments(id),
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'info',
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chaos_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaos_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chaos_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies (platform ops only via service role; read for authenticated)
CREATE POLICY "Authenticated users can read chaos scenarios"
  ON public.chaos_scenarios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage chaos scenarios"
  ON public.chaos_scenarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read chaos experiments"
  ON public.chaos_experiments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage chaos experiments"
  ON public.chaos_experiments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read chaos audit log"
  ON public.chaos_audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert chaos audit log"
  ON public.chaos_audit_log FOR INSERT TO authenticated WITH CHECK (true);
