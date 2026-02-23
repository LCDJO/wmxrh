
-- ══════════════════════════════════════════════════════════
-- Employee Master Record Engine — Satellite Tables
-- Ficha Completa do Trabalhador (CLT, Portaria 671/2021, eSocial)
-- ══════════════════════════════════════════════════════════

-- ── 1. Document Types Enum ──
CREATE TYPE public.employee_document_type AS ENUM (
  'rg', 'ctps', 'pis_pasep', 'titulo_eleitor', 'cnh',
  'certidao_nascimento', 'certidao_casamento', 'reservista',
  'passaporte', 'crnm', 'outros'
);

CREATE TYPE public.employee_dependent_type AS ENUM (
  'conjuge', 'filho', 'enteado', 'pai_mae', 'tutelado', 'outros'
);

CREATE TYPE public.contract_type AS ENUM (
  'clt_indeterminado', 'clt_determinado', 'clt_intermitente',
  'clt_temporario', 'clt_aprendiz', 'estagio', 'autonomo'
);

CREATE TYPE public.work_regime AS ENUM (
  'clt', 'estatutario', 'temporario', 'avulso', 'cooperado', 'estagiario'
);

CREATE TYPE public.fgts_regime AS ENUM (
  'optante', 'nao_optante', 'retroativo'
);

CREATE TYPE public.esocial_category AS ENUM (
  '101', '102', '103', '104', '105', '106', '107', '108', '111',
  '201', '202', '301', '302', '303', '304', '305', '306',
  '401', '410', '501', '701', '711', '712', '721', '722', '723',
  '731', '734', '738', '741', '751', '761', '771', '781', '901', '902'
);

-- ── 2. Employee Documents ──
CREATE TABLE public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type public.employee_document_type NOT NULL,
  document_number TEXT NOT NULL,
  issuing_authority TEXT,
  issuing_state TEXT,
  issue_date DATE,
  expiry_date DATE,
  series TEXT,            -- série (CTPS)
  zone TEXT,              -- zona (título eleitor)
  section TEXT,           -- seção (título eleitor)
  category TEXT,          -- categoria (CNH)
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_documents"
  ON public.employee_documents FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE INDEX idx_employee_documents_employee ON public.employee_documents(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employee_documents_type ON public.employee_documents(employee_id, document_type) WHERE deleted_at IS NULL;

-- ── 3. Employee Addresses ──
CREATE TABLE public.employee_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  address_type TEXT NOT NULL DEFAULT 'residential', -- residential, commercial
  cep TEXT,
  logradouro TEXT NOT NULL,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  pais TEXT NOT NULL DEFAULT 'BR',
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_addresses"
  ON public.employee_addresses FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE INDEX idx_employee_addresses_employee ON public.employee_addresses(employee_id) WHERE deleted_at IS NULL;

-- ── 4. Employee Dependents ──
CREATE TABLE public.employee_dependents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship public.employee_dependent_type NOT NULL,
  birth_date DATE,
  cpf TEXT,
  is_ir_dependent BOOLEAN NOT NULL DEFAULT false,
  is_benefit_dependent BOOLEAN NOT NULL DEFAULT false,
  has_disability BOOLEAN NOT NULL DEFAULT false,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_dependents"
  ON public.employee_dependents FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE INDEX idx_employee_dependents_employee ON public.employee_dependents(employee_id) WHERE deleted_at IS NULL;

-- ── 5. Employee Contracts (Dados Contratuais CLT) ──
CREATE TABLE public.employee_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id),
  
  -- Tipo & Regime
  contract_type public.contract_type NOT NULL DEFAULT 'clt_indeterminado',
  work_regime public.work_regime NOT NULL DEFAULT 'clt',
  fgts_regime public.fgts_regime NOT NULL DEFAULT 'optante',
  esocial_category public.esocial_category,
  esocial_matricula TEXT,              -- matrícula eSocial
  
  -- Datas
  admission_date DATE NOT NULL,
  contract_end_date DATE,              -- p/ contrato determinado
  experience_end_date DATE,            -- fim período experiência
  
  -- Jornada
  weekly_hours NUMERIC(5,2) NOT NULL DEFAULT 44,
  shift_description TEXT,              -- turno
  is_night_shift BOOLEAN NOT NULL DEFAULT false,
  
  -- Sindicato / CCT
  union_name TEXT,
  union_code TEXT,
  collective_agreement_id UUID REFERENCES public.collective_agreements(id),
  
  -- CBO
  cbo_code TEXT,
  job_function TEXT,                   -- função exercida
  
  -- Controle
  is_current BOOLEAN NOT NULL DEFAULT true,
  started_at DATE NOT NULL,
  ended_at DATE,
  end_reason TEXT,                     -- motivo encerramento
  
  -- Auditoria
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for employee_contracts"
  ON public.employee_contracts FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ))
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE INDEX idx_employee_contracts_employee ON public.employee_contracts(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employee_contracts_current ON public.employee_contracts(employee_id) WHERE is_current = true AND deleted_at IS NULL;

-- ── 6. Updated_at trigger for all new tables ──
CREATE TRIGGER update_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_addresses_updated_at
  BEFORE UPDATE ON public.employee_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_dependents_updated_at
  BEFORE UPDATE ON public.employee_dependents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_contracts_updated_at
  BEFORE UPDATE ON public.employee_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
