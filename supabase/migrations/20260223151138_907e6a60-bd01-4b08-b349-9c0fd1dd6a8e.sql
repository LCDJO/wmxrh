
-- ══════════════════════════════════════════════════════════
-- Employee Master Record: Aggregate Root + Personal Data
-- ══════════════════════════════════════════════════════════

-- Enum: employee record status
CREATE TYPE public.employee_record_status AS ENUM (
  'pre_admissao', 'ativo', 'afastado', 'desligado'
);

-- Enum: sexo
CREATE TYPE public.employee_sexo AS ENUM (
  'masculino', 'feminino', 'intersexo', 'nao_informado'
);

-- Enum: estado civil
CREATE TYPE public.employee_estado_civil AS ENUM (
  'solteiro', 'casado', 'divorciado', 'viuvo', 'separado', 'uniao_estavel', 'nao_informado'
);

-- ══════════════════════════════════════════
-- TABLE: employee_records (Aggregate Root)
-- ══════════════════════════════════════════
CREATE TABLE public.employee_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  matricula_interna TEXT NOT NULL,
  status public.employee_record_status NOT NULL DEFAULT 'pre_admissao',
  data_admissao DATE NOT NULL,
  data_desligamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, employee_id),
  UNIQUE(tenant_id, matricula_interna)
);

ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.employee_records
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_insert" ON public.employee_records
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_update" ON public.employee_records
  FOR UPDATE USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_delete" ON public.employee_records
  FOR DELETE USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

CREATE TRIGGER update_employee_records_updated_at
  BEFORE UPDATE ON public.employee_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════
-- TABLE: employee_personal_data
-- ══════════════════════════════════════════
CREATE TABLE public.employee_personal_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  nome_completo TEXT NOT NULL,
  nome_social TEXT,
  cpf TEXT NOT NULL,
  pis_pasep_nit TEXT,
  data_nascimento DATE NOT NULL,
  sexo public.employee_sexo NOT NULL DEFAULT 'nao_informado',
  estado_civil public.employee_estado_civil NOT NULL DEFAULT 'nao_informado',
  nacionalidade TEXT NOT NULL DEFAULT 'Brasileira',
  pais_nascimento TEXT NOT NULL DEFAULT 'Brasil',
  uf_nascimento TEXT,
  municipio_nascimento TEXT,
  nome_mae TEXT,
  nome_pai TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, employee_id),
  UNIQUE(tenant_id, cpf)
);

-- Unique PIS within tenant (when not null)
CREATE UNIQUE INDEX idx_employee_personal_data_pis_unique
  ON public.employee_personal_data (tenant_id, pis_pasep_nit)
  WHERE pis_pasep_nit IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.employee_personal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.employee_personal_data
  FOR SELECT USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_insert" ON public.employee_personal_data
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_update" ON public.employee_personal_data
  FOR UPDATE USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
CREATE POLICY "tenant_isolation_delete" ON public.employee_personal_data
  FOR DELETE USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

CREATE TRIGGER update_employee_personal_data_updated_at
  BEFORE UPDATE ON public.employee_personal_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════
-- VALIDATION TRIGGER: CPF format (11 digits)
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_cpf_format()
RETURNS TRIGGER AS $$
BEGIN
  -- Strip non-digits
  NEW.cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
  IF length(NEW.cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF deve conter exatamente 11 dígitos';
  END IF;
  -- Reject all-same-digit CPFs
  IF NEW.cpf ~ '^(\d)\1{10}$' THEN
    RAISE EXCEPTION 'CPF inválido (todos os dígitos iguais)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_cpf_before_insert_update
  BEFORE INSERT OR UPDATE OF cpf ON public.employee_personal_data
  FOR EACH ROW EXECUTE FUNCTION public.validate_cpf_format();

-- ══════════════════════════════════════════
-- VALIDATION TRIGGER: PIS format (11 digits)
-- ══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_pis_format()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.pis_pasep_nit IS NOT NULL THEN
    NEW.pis_pasep_nit := regexp_replace(NEW.pis_pasep_nit, '[^0-9]', '', 'g');
    IF length(NEW.pis_pasep_nit) <> 11 THEN
      RAISE EXCEPTION 'PIS/PASEP/NIT deve conter exatamente 11 dígitos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_pis_before_insert_update
  BEFORE INSERT OR UPDATE OF pis_pasep_nit ON public.employee_personal_data
  FOR EACH ROW EXECUTE FUNCTION public.validate_pis_format();
