
-- Etapa 6: Archived Employee Profiles
CREATE TABLE public.archived_employee_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL,
  workflow_id UUID REFERENCES public.offboarding_workflows(id),
  
  employee_snapshot JSONB NOT NULL DEFAULT '{}',
  contracts_snapshot JSONB NOT NULL DEFAULT '[]',
  documents_snapshot JSONB NOT NULL DEFAULT '[]',
  addresses_snapshot JSONB NOT NULL DEFAULT '[]',
  dependents_snapshot JSONB NOT NULL DEFAULT '[]',
  
  disciplinary_snapshot JSONB NOT NULL DEFAULT '[]',
  agreements_snapshot JSONB NOT NULL DEFAULT '[]',
  sst_snapshot JSONB NOT NULL DEFAULT '[]',
  financial_snapshot JSONB NOT NULL DEFAULT '{}',
  benefits_snapshot JSONB NOT NULL DEFAULT '[]',
  
  rescission_result JSONB,
  offboarding_type TEXT NOT NULL,
  data_desligamento DATE NOT NULL,
  
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_by UUID,
  archive_reason TEXT NOT NULL DEFAULT 'offboarding_completed',
  
  anonymized_at TIMESTAMPTZ,
  anonymized_by UUID,
  anonymization_request_id UUID,
  is_anonymized BOOLEAN NOT NULL DEFAULT false,
  
  snapshot_hash TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_archived_profiles_tenant ON public.archived_employee_profiles(tenant_id);
CREATE INDEX idx_archived_profiles_employee ON public.archived_employee_profiles(employee_id);
CREATE INDEX idx_archived_profiles_workflow ON public.archived_employee_profiles(workflow_id);

ALTER TABLE public.archived_employee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for archived profiles"
  ON public.archived_employee_profiles
  FOR ALL
  USING (public.user_has_tenant_access(tenant_id, auth.uid()));

-- BLOCK hard deletes
CREATE OR REPLACE FUNCTION public.prevent_archived_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete of archived employee profiles is prohibited. Use anonymization instead (LGPD compliance).';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_archived_profile_delete
  BEFORE DELETE ON public.archived_employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_archived_profile_delete();

-- Prevent mutation of anonymized records
CREATE OR REPLACE FUNCTION public.prevent_anonymized_profile_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_anonymized = true THEN
    IF NEW.employee_snapshot IS DISTINCT FROM OLD.employee_snapshot
       OR NEW.contracts_snapshot IS DISTINCT FROM OLD.contracts_snapshot
       OR NEW.financial_snapshot IS DISTINCT FROM OLD.financial_snapshot
       OR NEW.documents_snapshot IS DISTINCT FROM OLD.documents_snapshot THEN
      RAISE EXCEPTION 'Cannot modify an anonymized archived profile.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_prevent_anonymized_profile_mutation
  BEFORE UPDATE ON public.archived_employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_anonymized_profile_mutation();

CREATE TRIGGER update_archived_profiles_updated_at
  BEFORE UPDATE ON public.archived_employee_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
