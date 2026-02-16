
-- Payroll Simulation aggregate root
CREATE TABLE public.payroll_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  competencia TEXT NOT NULL, -- YYYY-MM
  salario_base NUMERIC NOT NULL DEFAULT 0,
  total_proventos NUMERIC NOT NULL DEFAULT 0,
  total_descontos NUMERIC NOT NULL DEFAULT 0,
  salario_liquido NUMERIC NOT NULL DEFAULT 0,
  inss_empregado NUMERIC NOT NULL DEFAULT 0,
  irrf NUMERIC NOT NULL DEFAULT 0,
  fgts NUMERIC NOT NULL DEFAULT 0,
  inss_patronal NUMERIC NOT NULL DEFAULT 0,
  rat NUMERIC NOT NULL DEFAULT 0,
  terceiros NUMERIC NOT NULL DEFAULT 0,
  provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  provisao_13 NUMERIC NOT NULL DEFAULT 0,
  provisao_multa_fgts NUMERIC NOT NULL DEFAULT 0,
  encargos_estimados NUMERIC NOT NULL DEFAULT 0,
  beneficios NUMERIC NOT NULL DEFAULT 0,
  custo_total_empresa NUMERIC NOT NULL DEFAULT 0,
  fator_custo NUMERIC NOT NULL DEFAULT 0,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubrics_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_competencia CHECK (competencia ~ '^\d{4}-(0[1-9]|1[0-2])$')
);

-- Index for employee + competencia lookups
CREATE INDEX idx_payroll_simulations_employee ON public.payroll_simulations(employee_id, competencia);
CREATE INDEX idx_payroll_simulations_tenant ON public.payroll_simulations(tenant_id, competencia);

-- Enable RLS
ALTER TABLE public.payroll_simulations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Compensation viewers can view simulations"
  ON public.payroll_simulations FOR SELECT
  USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));

CREATE POLICY "Compensation managers can insert simulations"
  ON public.payroll_simulations FOR INSERT
  WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));

CREATE POLICY "Compensation managers can delete simulations"
  ON public.payroll_simulations FOR DELETE
  USING (can_manage_compensation(auth.uid(), tenant_id));

-- No updates — simulations are immutable snapshots
CREATE POLICY "Block simulation updates"
  ON public.payroll_simulations FOR UPDATE
  USING (false);
