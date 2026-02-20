
-- Create safety_tasks table
CREATE TABLE public.safety_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID NOT NULL REFERENCES public.safety_workflows(id) ON DELETE CASCADE,
  responsavel_user_id UUID,
  employee_id UUID REFERENCES public.employees(id),
  descricao TEXT NOT NULL,
  prazo TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.safety_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can view safety tasks"
  ON public.safety_tasks FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can insert safety tasks"
  ON public.safety_tasks FOR INSERT
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update safety tasks"
  ON public.safety_tasks FOR UPDATE
  USING (public.is_tenant_admin(auth.uid(), tenant_id) OR responsavel_user_id = auth.uid());

CREATE POLICY "Tenant admins can delete safety tasks"
  ON public.safety_tasks FOR DELETE
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_safety_tasks_updated_at
  BEFORE UPDATE ON public.safety_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_safety_tasks_tenant ON public.safety_tasks(tenant_id);
CREATE INDEX idx_safety_tasks_workflow ON public.safety_tasks(workflow_id);
CREATE INDEX idx_safety_tasks_responsavel ON public.safety_tasks(responsavel_user_id) WHERE responsavel_user_id IS NOT NULL;
CREATE INDEX idx_safety_tasks_status ON public.safety_tasks(tenant_id, status);
CREATE INDEX idx_safety_tasks_prazo ON public.safety_tasks(prazo) WHERE status = 'pending';
