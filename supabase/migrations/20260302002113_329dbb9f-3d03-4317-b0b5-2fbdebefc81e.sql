
-- ATS: Job Requisitions
CREATE TABLE public.ats_requisitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  position_id UUID REFERENCES public.positions(id),
  department_id UUID REFERENCES public.departments(id),
  company_id UUID REFERENCES public.companies(id),
  title TEXT NOT NULL,
  description TEXT,
  headcount INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'medium',
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  target_start_date DATE,
  salary_range_min NUMERIC,
  salary_range_max NUMERIC,
  requirements TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_requisitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation ats_requisitions" ON public.ats_requisitions FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

-- ATS: Pipeline stage configs (tenant-configurable)
CREATE TABLE public.ats_pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  stage_key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, stage_key)
);

ALTER TABLE public.ats_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation ats_pipeline_stages" ON public.ats_pipeline_stages FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

-- ATS: Candidates
CREATE TABLE public.ats_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  requisition_id UUID NOT NULL REFERENCES public.ats_requisitions(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  stage TEXT NOT NULL DEFAULT 'applied',
  score NUMERIC,
  source TEXT,
  resume_url TEXT,
  notes TEXT,
  interview_feedback JSONB NOT NULL DEFAULT '[]',
  stage_history JSONB NOT NULL DEFAULT '[]',
  hired_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ats_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation ats_candidates" ON public.ats_candidates FOR ALL
  USING (tenant_id IN (SELECT id FROM tenants));

CREATE INDEX idx_ats_candidates_requisition ON public.ats_candidates(requisition_id, stage);
CREATE INDEX idx_ats_candidates_tenant ON public.ats_candidates(tenant_id, stage, created_at DESC);

CREATE TRIGGER update_ats_requisitions_updated_at
  BEFORE UPDATE ON public.ats_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ats_candidates_updated_at
  BEFORE UPDATE ON public.ats_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
