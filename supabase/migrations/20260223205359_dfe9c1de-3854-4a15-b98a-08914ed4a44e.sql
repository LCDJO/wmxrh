-- Assignment rules table: configurable rules for automatic agreement dispatch
CREATE TABLE public.agreement_assignment_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  template_id UUID NOT NULL REFERENCES public.agreement_templates(id) ON DELETE CASCADE,
  regra_tipo TEXT NOT NULL DEFAULT 'global',
  cargo_id UUID REFERENCES public.positions(id),
  cbo_codigo TEXT,
  agente_risco TEXT,
  departamento_id UUID,
  evento_disparo TEXT NOT NULL DEFAULT 'hiring',
  is_active BOOLEAN NOT NULL DEFAULT true,
  prioridade INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agreement_assignment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for assignment rules"
  ON public.agreement_assignment_rules
  FOR ALL
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE INDEX idx_aar_tenant ON public.agreement_assignment_rules(tenant_id);
CREATE INDEX idx_aar_template ON public.agreement_assignment_rules(template_id);
CREATE INDEX idx_aar_cargo ON public.agreement_assignment_rules(cargo_id) WHERE cargo_id IS NOT NULL;
CREATE INDEX idx_aar_evento ON public.agreement_assignment_rules(evento_disparo);
CREATE INDEX idx_aar_cbo ON public.agreement_assignment_rules(cbo_codigo) WHERE cbo_codigo IS NOT NULL;

COMMENT ON TABLE public.agreement_assignment_rules IS 'Configurable rules for automatic agreement dispatch based on events, cargo, CBO, or risk';
