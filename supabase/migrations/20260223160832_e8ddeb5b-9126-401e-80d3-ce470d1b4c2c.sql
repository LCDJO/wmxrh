
-- Drop failed table first
DROP TABLE IF EXISTS public.hiring_processes;

-- Recreate with correct RLS reference
CREATE TABLE public.hiring_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  candidate_name TEXT NOT NULL,
  candidate_cpf TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','validation','exams_pending','documents_pending','sst_pending','ready_for_esocial','active','blocked','cancelled')),
  current_step TEXT NOT NULL DEFAULT 'personal_data',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  data_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hiring_processes_tenant ON public.hiring_processes(tenant_id);
CREATE INDEX idx_hiring_processes_status ON public.hiring_processes(tenant_id, status);
CREATE INDEX idx_hiring_processes_employee ON public.hiring_processes(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_hiring_processes_cpf ON public.hiring_processes(tenant_id, candidate_cpf);

ALTER TABLE public.hiring_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for hiring_processes"
  ON public.hiring_processes FOR ALL
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
  ));

CREATE TRIGGER update_hiring_processes_updated_at
  BEFORE UPDATE ON public.hiring_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
