
-- Safety Automation Audit Log for legal compliance
CREATE TABLE public.safety_automation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  workflow_id UUID REFERENCES public.safety_workflows(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  executor TEXT NOT NULL DEFAULT 'system' CHECK (executor IN ('system', 'user')),
  executor_user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_safety_audit_tenant ON public.safety_automation_audit_log(tenant_id);
CREATE INDEX idx_safety_audit_workflow ON public.safety_automation_audit_log(workflow_id);
CREATE INDEX idx_safety_audit_created ON public.safety_automation_audit_log(created_at DESC);
CREATE INDEX idx_safety_audit_action ON public.safety_automation_audit_log(action);

-- RLS
ALTER TABLE public.safety_automation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view safety audit logs"
ON public.safety_automation_audit_log FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins and RH can insert safety audit logs"
ON public.safety_automation_audit_log FOR INSERT
TO authenticated
WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Immutable: no update or delete allowed (legal compliance)

-- Auto-log function callable from app code
CREATE OR REPLACE FUNCTION public.log_safety_automation_action(
  p_tenant_id UUID,
  p_workflow_id UUID,
  p_action TEXT,
  p_executor TEXT DEFAULT 'system',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.safety_automation_audit_log
    (tenant_id, workflow_id, action, executor, executor_user_id, entity_type, entity_id, metadata)
  VALUES
    (p_tenant_id, p_workflow_id, p_action, p_executor, auth.uid(), p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
