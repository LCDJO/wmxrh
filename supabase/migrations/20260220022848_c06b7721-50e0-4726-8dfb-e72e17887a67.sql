
-- Create enum for workflow type
CREATE TYPE public.safety_workflow_type AS ENUM (
  'nr_expirada',
  'exame_vencido',
  'risco_critico',
  'falta_epi',
  'treinamento_obrigatorio'
);

-- Create enum for workflow status
CREATE TYPE public.safety_workflow_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'cancelled'
);

-- Create enum for workflow priority
CREATE TYPE public.safety_workflow_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Create safety_workflows table
CREATE TABLE public.safety_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  company_id UUID REFERENCES public.companies(id),
  tipo_workflow public.safety_workflow_type NOT NULL,
  origem_evento JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.safety_workflow_status NOT NULL DEFAULT 'open',
  prioridade public.safety_workflow_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID,
  employee_id UUID REFERENCES public.employees(id),
  description TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.safety_workflows ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view safety workflows"
  ON public.safety_workflows FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert safety workflows"
  ON public.safety_workflows FOR INSERT
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update safety workflows"
  ON public.safety_workflows FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete safety workflows"
  ON public.safety_workflows FOR DELETE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Updated_at trigger
CREATE TRIGGER update_safety_workflows_updated_at
  BEFORE UPDATE ON public.safety_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_safety_workflows_tenant ON public.safety_workflows(tenant_id);
CREATE INDEX idx_safety_workflows_status ON public.safety_workflows(tenant_id, status);
CREATE INDEX idx_safety_workflows_priority ON public.safety_workflows(tenant_id, prioridade);
CREATE INDEX idx_safety_workflows_employee ON public.safety_workflows(employee_id) WHERE employee_id IS NOT NULL;
