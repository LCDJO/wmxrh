
-- ═══════════════════════════════════════════════════════════════
-- LABOR COMPLIANCE CONTEXT — CLT / eSocial Ready
-- ═══════════════════════════════════════════════════════════════

-- ── ENUMS ──

CREATE TYPE public.payroll_item_type AS ENUM ('provento', 'desconto');
CREATE TYPE public.payroll_item_nature AS ENUM ('fixed', 'variable', 'informational');
CREATE TYPE public.payroll_incidence AS ENUM ('inss', 'irrf', 'fgts', 'inss_irrf', 'inss_fgts', 'irrf_fgts', 'all', 'none');
CREATE TYPE public.benefit_type AS ENUM ('va', 'vr', 'vt', 'health', 'dental');
CREATE TYPE public.exam_type AS ENUM ('admissional', 'periodico', 'demissional', 'mudanca_funcao', 'retorno_trabalho');
CREATE TYPE public.exam_result AS ENUM ('apto', 'inapto', 'apto_restricao');
CREATE TYPE public.risk_category AS ENUM ('fisico', 'quimico', 'biologico', 'ergonomico', 'acidente');
CREATE TYPE public.health_program_type AS ENUM ('pcmso', 'pgr', 'ltcat', 'ppra');

-- ═══════════════════════════════════════════════════════════════
-- 1. PAYROLL ITEM CATALOG (Rubricas)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.payroll_item_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,                        -- Código da rubrica (ex: 1001)
  name TEXT NOT NULL,                        -- Nome (ex: Salário Base)
  description TEXT,
  item_type payroll_item_type NOT NULL,      -- provento ou desconto
  nature payroll_item_nature NOT NULL DEFAULT 'fixed',
  incidence payroll_incidence NOT NULL DEFAULT 'all',
  esocial_code TEXT,                         -- Código eSocial (tabela 03)
  is_system BOOLEAN NOT NULL DEFAULT false,  -- Rubricas padrão do sistema
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.payroll_item_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payroll items" ON public.payroll_item_catalog
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can insert payroll items" ON public.payroll_item_catalog
  FOR INSERT WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Admins can update payroll items" ON public.payroll_item_catalog
  FOR UPDATE USING (user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Admins can delete payroll items" ON public.payroll_item_catalog
  FOR DELETE USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_payroll_item_catalog_updated_at
  BEFORE UPDATE ON public.payroll_item_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 2. EMPLOYEE PAYROLL ITEMS (Vínculo rubrica ↔ funcionário)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.employee_payroll_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  catalog_item_id UUID NOT NULL REFERENCES public.payroll_item_catalog(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC,                        -- Para cálculos percentuais
  reference_value TEXT,                      -- Descrição/referência
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compensation viewers can view employee payroll items" ON public.employee_payroll_items
  FOR SELECT USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));
CREATE POLICY "Compensation managers can insert employee payroll items" ON public.employee_payroll_items
  FOR INSERT WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can update employee payroll items" ON public.employee_payroll_items
  FOR UPDATE USING (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can delete employee payroll items" ON public.employee_payroll_items
  FOR DELETE USING (can_manage_compensation(auth.uid(), tenant_id));

CREATE TRIGGER update_employee_payroll_items_updated_at
  BEFORE UPDATE ON public.employee_payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 3. TAX BRACKETS (Tabelas progressivas INSS/IRRF)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.tax_brackets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  tax_type TEXT NOT NULL,                     -- 'inss' ou 'irrf'
  bracket_order INT NOT NULL,
  min_value NUMERIC NOT NULL,
  max_value NUMERIC,                          -- NULL = sem teto
  rate NUMERIC NOT NULL,                      -- Alíquota em %
  deduction NUMERIC NOT NULL DEFAULT 0,       -- Parcela a deduzir (IRRF)
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_brackets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tax brackets" ON public.tax_brackets
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage tax brackets" ON public.tax_brackets
  FOR ALL USING (user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_tax_brackets_updated_at
  BEFORE UPDATE ON public.tax_brackets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 4. BENEFIT PLANS (Planos de benefícios)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.benefit_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  benefit_type benefit_type NOT NULL,
  name TEXT NOT NULL,                         -- Nome do plano
  provider TEXT,                              -- Operadora/fornecedor
  plan_code TEXT,                             -- Código do plano na ANS
  base_value NUMERIC NOT NULL DEFAULT 0,      -- Valor base mensal
  employer_percentage NUMERIC DEFAULT 100,    -- % pago pela empresa
  employee_discount_percentage NUMERIC DEFAULT 0, -- % descontado do func.
  has_coparticipation BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.benefit_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view benefit plans" ON public.benefit_plans
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can insert benefit plans" ON public.benefit_plans
  FOR INSERT WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Admins can update benefit plans" ON public.benefit_plans
  FOR UPDATE USING (user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "Admins can delete benefit plans" ON public.benefit_plans
  FOR DELETE USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_benefit_plans_updated_at
  BEFORE UPDATE ON public.benefit_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 5. EMPLOYEE BENEFITS (Benefícios atribuídos ao funcionário)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.employee_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  benefit_plan_id UUID NOT NULL REFERENCES public.benefit_plans(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  custom_value NUMERIC,                       -- Valor personalizado (override)
  dependents_count INT DEFAULT 0,
  card_number TEXT,                            -- Número do cartão VA/VR
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  cancellation_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Compensation viewers can view employee benefits" ON public.employee_benefits
  FOR SELECT USING (can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id));
CREATE POLICY "Compensation managers can insert employee benefits" ON public.employee_benefits
  FOR INSERT WITH CHECK (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can update employee benefits" ON public.employee_benefits
  FOR UPDATE USING (can_manage_compensation(auth.uid(), tenant_id));
CREATE POLICY "Compensation managers can delete employee benefits" ON public.employee_benefits
  FOR DELETE USING (can_manage_compensation(auth.uid(), tenant_id));

CREATE TRIGGER update_employee_benefits_updated_at
  BEFORE UPDATE ON public.employee_benefits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 6. OCCUPATIONAL RISK FACTORS (Fatores de risco)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.occupational_risk_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code TEXT NOT NULL,                         -- Código do agente
  name TEXT NOT NULL,                         -- Nome do agente (ex: Ruído)
  category risk_category NOT NULL,
  esocial_code TEXT,                          -- Tabela 23 eSocial
  description TEXT,
  exposure_limit TEXT,                        -- Limite de tolerância (NR-15)
  measurement_unit TEXT,                      -- Unidade (dB, ppm, etc.)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.occupational_risk_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view risk factors" ON public.occupational_risk_factors
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Admins can manage risk factors" ON public.occupational_risk_factors
  FOR ALL USING (user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_risk_factors_updated_at
  BEFORE UPDATE ON public.occupational_risk_factors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 7. HOMOGENEOUS EXPOSURE GROUPS (GHE)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.exposure_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  name TEXT NOT NULL,                         -- Nome do GHE
  code TEXT NOT NULL,                         -- Código do GHE
  description TEXT,
  cbo_code TEXT,                              -- CBO do cargo associado
  environment TEXT,                           -- Ambiente de trabalho
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, company_id, code)
);

ALTER TABLE public.exposure_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view exposure groups" ON public.exposure_groups
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers can insert exposure groups" ON public.exposure_groups
  FOR INSERT WITH CHECK (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Managers can update exposure groups" ON public.exposure_groups
  FOR UPDATE USING (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Managers can delete exposure groups" ON public.exposure_groups
  FOR DELETE USING (can_manage_employees(auth.uid(), tenant_id));

CREATE TRIGGER update_exposure_groups_updated_at
  BEFORE UPDATE ON public.exposure_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 8. GHE ↔ RISK FACTORS (N:N)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.exposure_group_risks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exposure_group_id UUID NOT NULL REFERENCES public.exposure_groups(id) ON DELETE CASCADE,
  risk_factor_id UUID NOT NULL REFERENCES public.occupational_risk_factors(id) ON DELETE CASCADE,
  intensity TEXT,                             -- Intensidade medida
  measurement_date DATE,
  control_measures TEXT,                      -- Medidas de controle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exposure_group_id, risk_factor_id)
);

ALTER TABLE public.exposure_group_risks ENABLE ROW LEVEL SECURITY;

-- Use join to parent for RLS
CREATE POLICY "Members can view exposure group risks" ON public.exposure_group_risks
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.exposure_groups eg
    WHERE eg.id = exposure_group_risks.exposure_group_id
    AND is_tenant_member(auth.uid(), eg.tenant_id)
  ));
CREATE POLICY "Managers can insert exposure group risks" ON public.exposure_group_risks
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.exposure_groups eg
    WHERE eg.id = exposure_group_risks.exposure_group_id
    AND can_manage_employees(auth.uid(), eg.tenant_id)
  ));
CREATE POLICY "Managers can update exposure group risks" ON public.exposure_group_risks
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.exposure_groups eg
    WHERE eg.id = exposure_group_risks.exposure_group_id
    AND can_manage_employees(auth.uid(), eg.tenant_id)
  ));
CREATE POLICY "Managers can delete exposure group risks" ON public.exposure_group_risks
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.exposure_groups eg
    WHERE eg.id = exposure_group_risks.exposure_group_id
    AND can_manage_employees(auth.uid(), eg.tenant_id)
  ));

-- ═══════════════════════════════════════════════════════════════
-- 9. OCCUPATIONAL HEALTH PROGRAMS (PCMSO, PGR, LTCAT)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.health_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  program_type health_program_type NOT NULL,
  name TEXT NOT NULL,
  responsible_name TEXT,                      -- Médico/Engenheiro responsável
  responsible_registration TEXT,              -- CRM/CREA
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  document_url TEXT,                          -- Link para documento
  status TEXT NOT NULL DEFAULT 'active',      -- active, expired, draft
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.health_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view health programs" ON public.health_programs
  FOR SELECT USING (is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "Managers can insert health programs" ON public.health_programs
  FOR INSERT WITH CHECK (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Managers can update health programs" ON public.health_programs
  FOR UPDATE USING (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Managers can delete health programs" ON public.health_programs
  FOR DELETE USING (can_manage_employees(auth.uid(), tenant_id));

CREATE TRIGGER update_health_programs_updated_at
  BEFORE UPDATE ON public.health_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 10. EMPLOYEE HEALTH EXAMS (ASOs)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.employee_health_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  health_program_id UUID REFERENCES public.health_programs(id),
  exam_type exam_type NOT NULL,
  exam_date DATE NOT NULL,
  expiry_date DATE,                           -- Validade do ASO
  result exam_result NOT NULL DEFAULT 'apto',
  physician_name TEXT,
  physician_crm TEXT,
  observations TEXT,
  cbo_code TEXT,                              -- CBO na data do exame
  risk_factors_evaluated TEXT[],              -- Riscos avaliados
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_health_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scoped managers can view health exams" ON public.employee_health_exams
  FOR SELECT USING (can_manage_employees_scoped(auth.uid(), tenant_id, company_id, company_group_id));
CREATE POLICY "Managers can insert health exams" ON public.employee_health_exams
  FOR INSERT WITH CHECK (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Managers can update health exams" ON public.employee_health_exams
  FOR UPDATE USING (can_manage_employees(auth.uid(), tenant_id));
CREATE POLICY "Block health exam deletes" ON public.employee_health_exams
  FOR DELETE USING (false);

CREATE TRIGGER update_employee_health_exams_updated_at
  BEFORE UPDATE ON public.employee_health_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- 11. ADD CBO TO POSITIONS TABLE
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS cbo_code TEXT;

-- ═══════════════════════════════════════════════════════════════
-- 12. ADD EXPOSURE GROUP TO EMPLOYEES
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS exposure_group_id UUID REFERENCES public.exposure_groups(id);

-- ═══════════════════════════════════════════════════════════════
-- 13. SIMULATED CALCULATION FUNCTION (INSS + IRRF + FGTS)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_payroll_simulation(
  _tenant_id UUID,
  _base_salary NUMERIC,
  _reference_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inss NUMERIC := 0;
  _irrf NUMERIC := 0;
  _fgts NUMERIC := 0;
  _inss_remaining NUMERIC;
  _irrf_base NUMERIC;
  _bracket RECORD;
  _bracket_amount NUMERIC;
BEGIN
  -- ── INSS (Progressive) ──
  _inss_remaining := _base_salary;
  FOR _bracket IN
    SELECT * FROM public.tax_brackets
    WHERE tenant_id = _tenant_id AND tax_type = 'inss'
    AND effective_from <= _reference_date
    AND (effective_until IS NULL OR effective_until >= _reference_date)
    ORDER BY bracket_order
  LOOP
    IF _inss_remaining <= 0 THEN EXIT; END IF;
    _bracket_amount := LEAST(
      _inss_remaining,
      COALESCE(_bracket.max_value, _inss_remaining) - _bracket.min_value
    );
    IF _bracket_amount > 0 THEN
      _inss := _inss + (_bracket_amount * _bracket.rate / 100);
      _inss_remaining := _inss_remaining - _bracket_amount;
    END IF;
  END LOOP;

  -- ── IRRF (Progressive with deduction) ──
  _irrf_base := _base_salary - _inss;
  FOR _bracket IN
    SELECT * FROM public.tax_brackets
    WHERE tenant_id = _tenant_id AND tax_type = 'irrf'
    AND effective_from <= _reference_date
    AND (effective_until IS NULL OR effective_until >= _reference_date)
    AND min_value <= _irrf_base
    ORDER BY bracket_order DESC
    LIMIT 1
  LOOP
    _irrf := (_irrf_base * _bracket.rate / 100) - _bracket.deduction;
    IF _irrf < 0 THEN _irrf := 0; END IF;
  END LOOP;

  -- ── FGTS (8%) ──
  _fgts := _base_salary * 0.08;

  RETURN jsonb_build_object(
    'base_salary', _base_salary,
    'inss', ROUND(_inss, 2),
    'irrf', ROUND(_irrf, 2),
    'fgts', ROUND(_fgts, 2),
    'net_salary', ROUND(_base_salary - _inss - _irrf, 2),
    'total_employer_cost', ROUND(_base_salary + _fgts, 2),
    'reference_date', _reference_date
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 14. INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_payroll_catalog_tenant ON public.payroll_item_catalog(tenant_id);
CREATE INDEX idx_employee_payroll_items_employee ON public.employee_payroll_items(employee_id);
CREATE INDEX idx_employee_payroll_items_tenant ON public.employee_payroll_items(tenant_id);
CREATE INDEX idx_employee_benefits_employee ON public.employee_benefits(employee_id);
CREATE INDEX idx_employee_benefits_tenant ON public.employee_benefits(tenant_id);
CREATE INDEX idx_health_exams_employee ON public.employee_health_exams(employee_id);
CREATE INDEX idx_health_exams_tenant ON public.employee_health_exams(tenant_id);
CREATE INDEX idx_health_programs_company ON public.health_programs(company_id);
CREATE INDEX idx_exposure_groups_company ON public.exposure_groups(company_id);
CREATE INDEX idx_tax_brackets_tenant_type ON public.tax_brackets(tenant_id, tax_type);
