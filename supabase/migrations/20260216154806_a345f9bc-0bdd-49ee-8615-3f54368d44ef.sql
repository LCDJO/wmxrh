
-- ============================================
-- LABOR RULES ENGINE — Core tables
-- Regras jurídicas trabalhistas brasileiras (CLT)
-- ============================================

-- 1. Conjuntos de regras trabalhistas (por CCT/sindicato)
CREATE TABLE public.labor_rule_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  name TEXT NOT NULL,
  description TEXT,
  -- CCT / Sindicato info
  union_name TEXT,
  union_code TEXT,
  cct_number TEXT,
  cct_valid_from DATE,
  cct_valid_until DATE,
  base_monthly_hours NUMERIC NOT NULL DEFAULT 220,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. Definições individuais de regras salariais/trabalhistas
CREATE TYPE public.labor_rule_category AS ENUM (
  'hora_extra',
  'adicional_noturno',
  'insalubridade',
  'periculosidade',
  'sobreaviso',
  'plantao',
  'intervalo_intrajornada',
  'dsr',
  'ferias',
  'decimo_terceiro',
  'aviso_previo',
  'fgts',
  'contribuicao_sindical',
  'vale_transporte',
  'salario_familia',
  'licenca_maternidade',
  'licenca_paternidade',
  'piso_salarial',
  'reajuste_anual',
  'banco_horas',
  'custom'
);

CREATE TYPE public.labor_rule_calc_type AS ENUM (
  'percentage',
  'fixed_value',
  'tiered',
  'formula',
  'reference_table'
);

CREATE TABLE public.labor_rule_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  rule_set_id UUID NOT NULL REFERENCES public.labor_rule_sets(id) ON DELETE CASCADE,
  category labor_rule_category NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  calc_type labor_rule_calc_type NOT NULL DEFAULT 'percentage',
  -- Calculation parameters (JSON for flexibility)
  base_percentage NUMERIC,
  fixed_value NUMERIC,
  tiered_config JSONB,       -- e.g. [{"from_hour":1,"to_hour":2,"pct":50},{"from_hour":2,"pct":100}]
  formula_expression TEXT,   -- e.g. "base_salary * 0.3" for insalubridade grau máximo
  -- Legal references
  clt_article TEXT,          -- e.g. "Art. 59 CLT"
  legal_basis TEXT,          -- Full legal citation
  esocial_rubric_code TEXT,  -- Mapped eSocial rubric
  -- Incidence flags
  integra_inss BOOLEAN NOT NULL DEFAULT false,
  integra_irrf BOOLEAN NOT NULL DEFAULT false,
  integra_fgts BOOLEAN NOT NULL DEFAULT false,
  integra_ferias BOOLEAN NOT NULL DEFAULT false,
  integra_13 BOOLEAN NOT NULL DEFAULT false,
  -- Validity
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3. Convenções Coletivas de Trabalho (CCT/ACT)
CREATE TABLE public.collective_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  rule_set_id UUID REFERENCES public.labor_rule_sets(id),
  agreement_type TEXT NOT NULL DEFAULT 'cct' CHECK (agreement_type IN ('cct', 'act')),
  registration_number TEXT,
  union_name TEXT NOT NULL,
  union_cnpj TEXT,
  employer_union_name TEXT,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  base_date_month INTEGER CHECK (base_date_month BETWEEN 1 AND 12),
  salary_floor NUMERIC,
  salary_ceiling NUMERIC,
  annual_readjustment_pct NUMERIC,
  document_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 4. Cláusulas específicas de CCT/ACT
CREATE TABLE public.collective_agreement_clauses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  agreement_id UUID NOT NULL REFERENCES public.collective_agreements(id) ON DELETE CASCADE,
  clause_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category labor_rule_category,
  -- Override values
  override_percentage NUMERIC,
  override_fixed_value NUMERIC,
  override_config JSONB,
  -- Mapping
  applies_to_rule_id UUID REFERENCES public.labor_rule_definitions(id),
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_labor_rule_sets_tenant ON public.labor_rule_sets(tenant_id);
CREATE INDEX idx_labor_rule_sets_company ON public.labor_rule_sets(company_id);
CREATE INDEX idx_labor_rule_definitions_rule_set ON public.labor_rule_definitions(rule_set_id);
CREATE INDEX idx_labor_rule_definitions_category ON public.labor_rule_definitions(category);
CREATE INDEX idx_collective_agreements_tenant ON public.collective_agreements(tenant_id);
CREATE INDEX idx_collective_agreements_validity ON public.collective_agreements(valid_from, valid_until);
CREATE INDEX idx_collective_agreement_clauses_agreement ON public.collective_agreement_clauses(agreement_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.labor_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_rule_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_agreement_clauses ENABLE ROW LEVEL SECURITY;

-- labor_rule_sets
CREATE POLICY "labor_rule_sets_select" ON public.labor_rule_sets
  FOR SELECT USING (public.user_has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_sets_insert" ON public.labor_rule_sets
  FOR INSERT WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_sets_update" ON public.labor_rule_sets
  FOR UPDATE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_sets_delete" ON public.labor_rule_sets
  FOR DELETE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- labor_rule_definitions
CREATE POLICY "labor_rule_definitions_select" ON public.labor_rule_definitions
  FOR SELECT USING (public.user_has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_definitions_insert" ON public.labor_rule_definitions
  FOR INSERT WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_definitions_update" ON public.labor_rule_definitions
  FOR UPDATE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "labor_rule_definitions_delete" ON public.labor_rule_definitions
  FOR DELETE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- collective_agreements
CREATE POLICY "collective_agreements_select" ON public.collective_agreements
  FOR SELECT USING (public.user_has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "collective_agreements_insert" ON public.collective_agreements
  FOR INSERT WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "collective_agreements_update" ON public.collective_agreements
  FOR UPDATE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "collective_agreements_delete" ON public.collective_agreements
  FOR DELETE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- collective_agreement_clauses
CREATE POLICY "collective_agreement_clauses_select" ON public.collective_agreement_clauses
  FOR SELECT USING (public.user_has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "collective_agreement_clauses_insert" ON public.collective_agreement_clauses
  FOR INSERT WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "collective_agreement_clauses_update" ON public.collective_agreement_clauses
  FOR UPDATE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "collective_agreement_clauses_delete" ON public.collective_agreement_clauses
  FOR DELETE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_labor_rule_sets_updated_at
  BEFORE UPDATE ON public.labor_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_labor_rule_definitions_updated_at
  BEFORE UPDATE ON public.labor_rule_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collective_agreements_updated_at
  BEFORE UPDATE ON public.collective_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collective_agreement_clauses_updated_at
  BEFORE UPDATE ON public.collective_agreement_clauses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_labor_rule_sets
  AFTER INSERT OR UPDATE OR DELETE ON public.labor_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_labor_rule_definitions
  AFTER INSERT OR UPDATE OR DELETE ON public.labor_rule_definitions
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_collective_agreements
  AFTER INSERT OR UPDATE OR DELETE ON public.collective_agreements
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ============================================
-- SEED: Default CLT rules for new tenants
-- ============================================
CREATE OR REPLACE FUNCTION public.seed_default_labor_rules(_tenant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _rule_set_id uuid;
BEGIN
  INSERT INTO public.labor_rule_sets (tenant_id, name, description, base_monthly_hours)
  VALUES (_tenant_id, 'CLT Padrão', 'Regras padrão da CLT brasileira sem CCT específica', 220)
  RETURNING id INTO _rule_set_id;

  INSERT INTO public.labor_rule_definitions (tenant_id, rule_set_id, category, name, calc_type, base_percentage, clt_article, legal_basis, integra_inss, integra_irrf, integra_fgts, integra_ferias, integra_13, is_mandatory)
  VALUES
    (_tenant_id, _rule_set_id, 'hora_extra', 'Hora Extra 50%', 'percentage', 50, 'Art. 59 §1º', 'CLT Art. 59 — mínimo 50% sobre hora normal', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'hora_extra', 'Hora Extra 100% (Domingos/Feriados)', 'percentage', 100, 'Art. 70', 'CLT Art. 70 — trabalho em domingos e feriados', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'adicional_noturno', 'Adicional Noturno 20%', 'percentage', 20, 'Art. 73 §1º', 'CLT Art. 73 — mínimo 20% sobre hora diurna (22h-5h)', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'insalubridade', 'Insalubridade Grau Mínimo (10%)', 'percentage', 10, 'Art. 192', 'CLT Art. 192 — 10% sobre salário mínimo', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'insalubridade', 'Insalubridade Grau Médio (20%)', 'percentage', 20, 'Art. 192', 'CLT Art. 192 — 20% sobre salário mínimo', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'insalubridade', 'Insalubridade Grau Máximo (40%)', 'percentage', 40, 'Art. 192', 'CLT Art. 192 — 40% sobre salário mínimo', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'periculosidade', 'Periculosidade 30%', 'percentage', 30, 'Art. 193 §1º', 'CLT Art. 193 — 30% sobre salário base', true, true, true, true, true, true),
    (_tenant_id, _rule_set_id, 'sobreaviso', 'Sobreaviso 1/3', 'percentage', 33.33, 'Art. 244 §2º', 'CLT Art. 244 — 1/3 da hora normal por hora de sobreaviso', false, false, false, false, false, false),
    (_tenant_id, _rule_set_id, 'dsr', 'Descanso Semanal Remunerado', 'formula', null, 'Art. 67', 'CLT Art. 67 — DSR obrigatório', true, true, true, false, false, true),
    (_tenant_id, _rule_set_id, 'ferias', 'Férias + 1/3 Constitucional', 'percentage', 33.33, 'Art. 129', 'CF Art. 7º XVII / CLT Art. 129 — 1/3 sobre férias', true, true, true, false, false, true),
    (_tenant_id, _rule_set_id, 'decimo_terceiro', '13º Salário', 'formula', null, 'Lei 4.090/62', 'Lei 4.090/62 — 1/12 por mês trabalhado', true, true, true, false, false, true),
    (_tenant_id, _rule_set_id, 'fgts', 'FGTS 8%', 'percentage', 8, 'Art. 15 Lei 8.036', 'Lei 8.036/90 Art. 15 — 8% sobre remuneração', false, false, false, false, false, true),
    (_tenant_id, _rule_set_id, 'vale_transporte', 'Desconto VT 6%', 'percentage', 6, 'Art. 4º Lei 7.418', 'Lei 7.418/85 — desconto até 6% do salário base', false, false, false, false, false, true),
    (_tenant_id, _rule_set_id, 'aviso_previo', 'Aviso Prévio Proporcional', 'tiered', null, 'Art. 487', 'CLT Art. 487 + Lei 12.506/11 — 30 dias + 3 dias/ano', false, false, false, false, false, true),
    (_tenant_id, _rule_set_id, 'banco_horas', 'Banco de Horas', 'formula', null, 'Art. 59 §2º', 'CLT Art. 59 §2º — compensação em até 6 meses (individual) ou 1 ano (CCT)', false, false, false, false, false, false);
END;
$$;

-- Auto-seed for new tenants
CREATE OR REPLACE FUNCTION public.auto_seed_labor_rules()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_labor_rules(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_seed_labor_rules_on_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.auto_seed_labor_rules();
