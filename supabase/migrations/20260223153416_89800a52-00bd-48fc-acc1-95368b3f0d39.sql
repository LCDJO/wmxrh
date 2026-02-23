
-- ═══════════════════════════════════════
-- LGPD Compliance Tables
-- ═══════════════════════════════════════

-- 1. Employee Data Access Logs (audit trail for LGPD Art. 37)
CREATE TABLE public.employee_data_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  accessed_by UUID NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'edit', 'export', 'print', 'anonymize')),
  data_scope TEXT NOT NULL DEFAULT 'full',
  accessed_fields TEXT[] DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_data_access_logs_employee ON public.employee_data_access_logs(employee_id);
CREATE INDEX idx_data_access_logs_tenant ON public.employee_data_access_logs(tenant_id);
CREATE INDEX idx_data_access_logs_accessed_by ON public.employee_data_access_logs(accessed_by);
CREATE INDEX idx_data_access_logs_created ON public.employee_data_access_logs(created_at DESC);

ALTER TABLE public.employee_data_access_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users of the same tenant can insert/view
CREATE POLICY "Tenant members can insert access logs"
  ON public.employee_data_access_logs FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY "Tenant members can view access logs"
  ON public.employee_data_access_logs FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

-- Immutable: no UPDATE or DELETE
CREATE POLICY "Access logs are immutable - no updates"
  ON public.employee_data_access_logs FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Access logs are immutable - no deletes"
  ON public.employee_data_access_logs FOR DELETE TO authenticated
  USING (false);

-- 2. LGPD Consent Records
CREATE TABLE public.lgpd_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('employment_management', 'compensation_processing', 'analytics', 'communication', 'data_sharing')),
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  legal_basis TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_consent_unique ON public.lgpd_consent_records(tenant_id, user_id, purpose);
CREATE INDEX idx_consent_tenant ON public.lgpd_consent_records(tenant_id);

ALTER TABLE public.lgpd_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage consent records"
  ON public.lgpd_consent_records FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

-- 3. LGPD Anonymization Requests
CREATE TABLE public.lgpd_anonymization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  requested_by UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  entity_type TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected')),
  reason TEXT,
  legal_basis TEXT NOT NULL DEFAULT 'LGPD Art. 18, IV',
  retention_end_date DATE,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anon_requests_tenant ON public.lgpd_anonymization_requests(tenant_id);
CREATE INDEX idx_anon_requests_employee ON public.lgpd_anonymization_requests(employee_id);

ALTER TABLE public.lgpd_anonymization_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage anonymization requests"
  ON public.lgpd_anonymization_requests FOR ALL TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

-- 4. Legal Basis for Data Processing (per employee field group)
CREATE TABLE public.lgpd_legal_basis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  data_category TEXT NOT NULL,
  legal_basis_type TEXT NOT NULL CHECK (legal_basis_type IN (
    'consent', 'legal_obligation', 'contract_execution', 
    'legitimate_interest', 'public_interest', 'vital_interest'
  )),
  lgpd_article TEXT NOT NULL,
  description TEXT NOT NULL,
  retention_period_months INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_legal_basis_unique ON public.lgpd_legal_basis(tenant_id, data_category);

ALTER TABLE public.lgpd_legal_basis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view legal basis"
  ON public.lgpd_legal_basis FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY "Tenant members can manage legal basis"
  ON public.lgpd_legal_basis FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );

CREATE POLICY "Tenant members can update legal basis"
  ON public.lgpd_legal_basis FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid())
  );
