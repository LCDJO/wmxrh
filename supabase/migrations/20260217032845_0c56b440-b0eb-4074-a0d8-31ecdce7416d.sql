
-- ═══════════════════════════════════════════════════════════════
-- GOVERNANCE MODULE — Database Tables
-- ═══════════════════════════════════════════════════════════════

-- 1. GOVERNANCE AUDIT SNAPSHOTS
CREATE TABLE public.governance_audit_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  snapshot_type TEXT NOT NULL DEFAULT 'full',
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  role_count INTEGER NOT NULL DEFAULT 0,
  permission_count INTEGER NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_overlaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  excessive_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  orphan_nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  composition_time_ms NUMERIC(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_audit_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant audit snapshots"
  ON public.governance_audit_snapshots FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create audit snapshots for their tenant"
  ON public.governance_audit_snapshots FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_governance_audit_tenant_created
  ON public.governance_audit_snapshots(tenant_id, created_at DESC);

-- 2. COMPLIANCE RULES
CREATE TYPE public.compliance_rule_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.compliance_rule_status AS ENUM ('active', 'disabled', 'archived');

CREATE TABLE public.compliance_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  rule_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'access_control',
  severity public.compliance_rule_severity NOT NULL DEFAULT 'warning',
  status public.compliance_rule_status NOT NULL DEFAULT 'active',
  rule_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_remediate BOOLEAN NOT NULL DEFAULT false,
  remediation_action TEXT,
  last_evaluated_at TIMESTAMPTZ,
  last_violation_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, rule_code)
);

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant compliance rules"
  ON public.compliance_rules FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their tenant compliance rules"
  ON public.compliance_rules FOR ALL
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_compliance_rules_tenant_status
  ON public.compliance_rules(tenant_id, status);

-- 3. COMPLIANCE EVALUATIONS
CREATE TABLE public.compliance_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  rule_id UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  passed BOOLEAN NOT NULL,
  violation_count INTEGER NOT NULL DEFAULT 0,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  remediation_suggestions JSONB DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.compliance_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant evaluations"
  ON public.compliance_evaluations FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create evaluations for their tenant"
  ON public.compliance_evaluations FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_compliance_evaluations_rule_date
  ON public.compliance_evaluations(rule_id, evaluated_at DESC);

-- 4. RISK TREND SNAPSHOTS
CREATE TABLE public.risk_trend_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  signal_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,
  high_count INTEGER NOT NULL DEFAULT 0,
  medium_count INTEGER NOT NULL DEFAULT 0,
  low_count INTEGER NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,
  high_risk_users INTEGER NOT NULL DEFAULT 0,
  top_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  trend_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_forecast TEXT,
  forecast_risk_level TEXT,
  forecast_confidence NUMERIC(3,2) DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_trend_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant risk trends"
  ON public.risk_trend_snapshots FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create risk trend snapshots"
  ON public.risk_trend_snapshots FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_risk_trends_tenant_date
  ON public.risk_trend_snapshots(tenant_id, snapshot_at DESC);

-- TRIGGERS
CREATE TRIGGER update_compliance_rules_updated_at
  BEFORE UPDATE ON public.compliance_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
