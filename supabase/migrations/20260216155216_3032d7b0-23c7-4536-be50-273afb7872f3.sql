
-- Salary Rubric Templates — Biblioteca padrão de rubricas legais
CREATE TABLE public.salary_rubric_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('provento', 'desconto', 'informativo')),
  natureza_juridica TEXT NOT NULL CHECK (natureza_juridica IN ('salarial', 'indenizatoria')),
  integra_inss BOOLEAN NOT NULL DEFAULT false,
  integra_fgts BOOLEAN NOT NULL DEFAULT false,
  integra_irrf BOOLEAN NOT NULL DEFAULT false,
  exige_base_horaria BOOLEAN NOT NULL DEFAULT false,
  permite_percentual BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, codigo)
);

CREATE INDEX idx_salary_rubric_templates_tenant ON public.salary_rubric_templates(tenant_id);
CREATE INDEX idx_salary_rubric_templates_tipo ON public.salary_rubric_templates(tipo);

ALTER TABLE public.salary_rubric_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salary_rubric_templates_select" ON public.salary_rubric_templates
  FOR SELECT USING (public.user_has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "salary_rubric_templates_insert" ON public.salary_rubric_templates
  FOR INSERT WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "salary_rubric_templates_update" ON public.salary_rubric_templates
  FOR UPDATE USING (public.user_is_tenant_admin(auth.uid(), tenant_id));
CREATE POLICY "salary_rubric_templates_delete" ON public.salary_rubric_templates
  FOR DELETE USING (public.user_is_tenant_admin(auth.uid(), tenant_id) AND is_system = false);

CREATE TRIGGER update_salary_rubric_templates_updated_at
  BEFORE UPDATE ON public.salary_rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_salary_rubric_templates
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- Seed function
CREATE OR REPLACE FUNCTION public.seed_salary_rubric_templates(_tenant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.salary_rubric_templates (tenant_id, codigo, nome, tipo, natureza_juridica, integra_inss, integra_fgts, integra_irrf, exige_base_horaria, permite_percentual, is_system)
  VALUES
    (_tenant_id, 'SALARIO_BASE',              'Salário Base',              'provento',  'salarial',      true,  true,  true,  false, false, true),
    (_tenant_id, 'HORAS_EXTRAS_50',           'Horas Extras 50%',         'provento',  'salarial',      true,  true,  true,  true,  true,  true),
    (_tenant_id, 'HORAS_EXTRAS_100',          'Horas Extras 100%',        'provento',  'salarial',      true,  true,  true,  true,  true,  true),
    (_tenant_id, 'ADICIONAL_NOTURNO',         'Adicional Noturno',        'provento',  'salarial',      true,  true,  true,  true,  true,  true),
    (_tenant_id, 'ADICIONAL_INSALUBRIDADE',   'Adicional de Insalubridade','provento', 'salarial',      true,  true,  true,  false, true,  true),
    (_tenant_id, 'ADICIONAL_PERICULOSIDADE',  'Adicional de Periculosidade','provento','salarial',      true,  true,  true,  false, true,  true),
    (_tenant_id, 'ADICIONAL_PLANTAO',         'Adicional de Plantão',     'provento',  'salarial',      true,  true,  true,  true,  true,  true),
    (_tenant_id, 'ADICIONAL_SOBREAVISO',      'Adicional de Sobreaviso',  'provento',  'salarial',      false, false, false, true,  true,  true),
    (_tenant_id, 'GRATIFICACAO_FUNCAO',       'Gratificação de Função',   'provento',  'salarial',      true,  true,  true,  false, true,  true),
    (_tenant_id, 'DESCANSO_SEMANAL_REMUNERADO','DSR',                    'provento',  'salarial',      true,  true,  true,  false, false, true),
    (_tenant_id, 'DESCONTO_INSS',             'Desconto INSS',            'desconto',  'salarial',      false, false, false, false, true,  true),
    (_tenant_id, 'DESCONTO_IRRF',             'Desconto IRRF',            'desconto',  'salarial',      false, false, false, false, true,  true),
    (_tenant_id, 'VALE_ALIMENTACAO',          'Vale Alimentação',         'provento',  'indenizatoria', false, false, false, false, false, true),
    (_tenant_id, 'VALE_REFEICAO',             'Vale Refeição',            'provento',  'indenizatoria', false, false, false, false, false, true)
  ON CONFLICT (tenant_id, codigo) DO NOTHING;
END;
$$;

-- Auto-seed for new tenants
CREATE OR REPLACE FUNCTION public.auto_seed_salary_rubric_templates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_salary_rubric_templates(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_seed_salary_rubric_templates_on_tenant
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.auto_seed_salary_rubric_templates();
