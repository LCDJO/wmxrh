
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for automation_rules"
  ON public.automation_rules FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE TABLE public.automation_rule_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  trigger_event TEXT NOT NULL,
  trigger_payload JSONB,
  conditions_met BOOLEAN NOT NULL,
  actions_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
  result TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rule_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for automation_rule_executions"
  ON public.automation_rule_executions FOR ALL
  USING (tenant_id IN (SELECT id FROM public.tenants));

CREATE INDEX idx_automation_rules_tenant ON public.automation_rules(tenant_id);
CREATE INDEX idx_automation_rules_trigger ON public.automation_rules(trigger_event);
CREATE INDEX idx_automation_rule_executions_rule ON public.automation_rule_executions(rule_id);
CREATE INDEX idx_automation_rule_executions_tenant ON public.automation_rule_executions(tenant_id);
