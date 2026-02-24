
-- LGPD: Access log for ex-employee data + auto-anonymization functions

-- 1. Access log table
CREATE TABLE IF NOT EXISTS public.lgpd_ex_employee_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  accessed_by UUID NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'view',
  resource_type TEXT NOT NULL DEFAULT 'archived_profile',
  resource_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  purpose TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lgpd_ex_employee_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can insert access logs"
  ON public.lgpd_ex_employee_access_logs FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Tenant members can view access logs"
  ON public.lgpd_ex_employee_access_logs FOR SELECT
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()
  ));

CREATE INDEX idx_lgpd_access_logs_employee ON public.lgpd_ex_employee_access_logs(tenant_id, employee_id);
CREATE INDEX idx_lgpd_access_logs_date ON public.lgpd_ex_employee_access_logs(created_at);

-- 2. Function: anonymize an archived employee profile
CREATE OR REPLACE FUNCTION public.anonymize_archived_profile(
  p_archive_id UUID,
  p_tenant_id UUID,
  p_anonymized_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anonymized_snapshot JSONB;
BEGIN
  v_anonymized_snapshot := jsonb_build_object(
    'personalData', jsonb_build_object(
      'nome_completo', 'DADOS ANONIMIZADOS',
      'cpf', '***.***.***-**',
      'rg', '**********',
      'email', 'anonimizado@removed.lgpd',
      'telefone', '(**) *****-****',
      'data_nascimento', null
    ),
    'record', jsonb_build_object(
      'anonymized', true,
      'anonymized_at', now()
    )
  );

  UPDATE public.archived_employee_profiles
  SET
    employee_snapshot = v_anonymized_snapshot,
    addresses_snapshot = '[]'::jsonb,
    dependents_snapshot = '[]'::jsonb,
    documents_snapshot = '[]'::jsonb,
    financial_snapshot = '{}'::jsonb,
    is_anonymized = true,
    anonymized_at = now(),
    anonymized_by = p_anonymized_by,
    updated_at = now()
  WHERE id = p_archive_id
    AND tenant_id = p_tenant_id
    AND is_anonymized = false;

  RETURN FOUND;
END;
$$;

-- 3. Function: find profiles eligible for auto-anonymization
CREATE OR REPLACE FUNCTION public.find_profiles_for_anonymization(p_tenant_id UUID)
RETURNS TABLE(
  archive_id UUID,
  employee_id UUID,
  data_desligamento TIMESTAMPTZ,
  retention_months INT,
  retention_end_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id AS archive_id,
    a.employee_id,
    a.data_desligamento::timestamptz,
    COALESCE(
      (SELECT MAX(lb.retention_period_months)
       FROM public.lgpd_legal_basis lb
       WHERE lb.tenant_id = p_tenant_id AND lb.is_active = true),
      60
    ) AS retention_months,
    (a.data_desligamento::timestamptz + 
     (COALESCE(
       (SELECT MAX(lb.retention_period_months)
        FROM public.lgpd_legal_basis lb
        WHERE lb.tenant_id = p_tenant_id AND lb.is_active = true),
       60
     ) || ' months')::interval
    ) AS retention_end_date
  FROM public.archived_employee_profiles a
  WHERE a.tenant_id = p_tenant_id
    AND a.is_anonymized = false
    AND (a.data_desligamento::timestamptz + 
         (COALESCE(
           (SELECT MAX(lb.retention_period_months)
            FROM public.lgpd_legal_basis lb
            WHERE lb.tenant_id = p_tenant_id AND lb.is_active = true),
           60
         ) || ' months')::interval
        ) <= now();
$$;
