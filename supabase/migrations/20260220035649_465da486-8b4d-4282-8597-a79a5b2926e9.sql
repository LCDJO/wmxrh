
-- Career & Legal Intelligence Engine — Database Schema

-- 1. Career Positions (PCCS structured positions)
CREATE TABLE public.career_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  company_group_id UUID REFERENCES public.company_groups(id),
  position_id UUID REFERENCES public.positions(id),
  nome TEXT NOT NULL,
  cbo_codigo TEXT,
  nivel TEXT NOT NULL DEFAULT 'pleno' CHECK (nivel IN ('junior','pleno','senior','lider','especialista')),
  descricao TEXT,
  faixa_salarial_min NUMERIC(12,2) DEFAULT 0,
  faixa_salarial_max NUMERIC(12,2) DEFAULT 0,
  formacao_minima TEXT,
  certificacoes_exigidas TEXT[] DEFAULT '{}',
  tempo_experiencia_meses INTEGER DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.career_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_positions" ON public.career_positions
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE INDEX idx_career_positions_tenant ON public.career_positions(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_career_positions_cbo ON public.career_positions(tenant_id, cbo_codigo) WHERE deleted_at IS NULL;

-- 2. Career Paths
CREATE TABLE public.career_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  trilha_tipo TEXT NOT NULL DEFAULT 'tecnica' CHECK (trilha_tipo IN ('tecnica','gestao','especialista','mista')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_paths" ON public.career_paths
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 3. Career Path Steps
CREATE TABLE public.career_path_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  career_path_id UUID NOT NULL REFERENCES public.career_paths(id) ON DELETE CASCADE,
  career_position_id UUID NOT NULL REFERENCES public.career_positions(id),
  ordem INTEGER NOT NULL DEFAULT 0,
  tempo_minimo_meses INTEGER DEFAULT 12,
  requisitos_transicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_path_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_path_steps" ON public.career_path_steps
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));
CREATE INDEX idx_career_path_steps_path ON public.career_path_steps(career_path_id, ordem);

-- 4. Career Legal Requirements
CREATE TABLE public.career_legal_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  career_position_id UUID NOT NULL REFERENCES public.career_positions(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nr_training','exame_medico','certificacao','licenca','epi','formacao')),
  codigo_referencia TEXT,
  descricao TEXT NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  periodicidade_meses INTEGER,
  base_legal TEXT,
  risco_nao_conformidade TEXT DEFAULT 'medio' CHECK (risco_nao_conformidade IN ('baixo','medio','alto','critico')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_legal_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_legal_requirements" ON public.career_legal_requirements
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));
CREATE INDEX idx_career_legal_req_position ON public.career_legal_requirements(career_position_id);

-- 5. Career Salary Benchmarks
CREATE TABLE public.career_salary_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  career_position_id UUID NOT NULL REFERENCES public.career_positions(id) ON DELETE CASCADE,
  fonte TEXT NOT NULL DEFAULT 'interno' CHECK (fonte IN ('interno','mercado','cct','piso_legal')),
  valor_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_mediano NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_maximo NUMERIC(12,2) NOT NULL DEFAULT 0,
  referencia_data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_salary_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_salary_benchmarks" ON public.career_salary_benchmarks
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));

-- 6. Career Risk Alerts
CREATE TABLE public.career_risk_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  career_position_id UUID REFERENCES public.career_positions(id),
  employee_id UUID REFERENCES public.employees(id),
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('salario_abaixo_piso','treinamento_vencido','exame_vencido','certificacao_ausente','epi_pendente','desvio_funcao')),
  severidade TEXT NOT NULL DEFAULT 'medio' CHECK (severidade IN ('baixo','medio','alto','critico')),
  descricao TEXT NOT NULL,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for career_risk_alerts" ON public.career_risk_alerts
  FOR ALL USING (tenant_id IN (SELECT tm.tenant_id FROM tenant_memberships tm WHERE tm.user_id = auth.uid()));
CREATE INDEX idx_career_risk_alerts_open ON public.career_risk_alerts(tenant_id, resolvido) WHERE resolvido = false;

-- Triggers
CREATE TRIGGER update_career_positions_updated_at BEFORE UPDATE ON public.career_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_career_paths_updated_at BEFORE UPDATE ON public.career_paths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_career_legal_requirements_updated_at BEFORE UPDATE ON public.career_legal_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
