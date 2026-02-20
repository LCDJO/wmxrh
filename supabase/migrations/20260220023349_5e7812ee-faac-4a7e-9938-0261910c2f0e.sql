
-- Escalation policies for safety tasks
CREATE TABLE public.safety_escalation_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Trigger conditions
  dias_sem_resposta INTEGER NOT NULL DEFAULT 3,
  current_priority TEXT NOT NULL DEFAULT 'medium',
  -- Escalation action
  novo_responsavel TEXT NOT NULL DEFAULT 'next_level', -- 'next_level' | 'rh_admin' | 'specific_user'
  novo_responsavel_user_id UUID,
  nova_prioridade TEXT NOT NULL DEFAULT 'high',
  escalation_level INTEGER NOT NULL DEFAULT 1,
  max_escalations INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_escalation_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view escalation policies"
  ON public.safety_escalation_policies FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage escalation policies"
  ON public.safety_escalation_policies FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Track escalation history on safety_tasks
ALTER TABLE public.safety_tasks
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS escalation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX idx_safety_escalation_policies_tenant ON public.safety_escalation_policies(tenant_id);
CREATE INDEX idx_safety_tasks_priority ON public.safety_tasks(tenant_id, priority) WHERE status = 'pending';
CREATE INDEX idx_safety_tasks_escalation ON public.safety_tasks(tenant_id, status, escalation_count) WHERE status = 'pending';

CREATE TRIGGER update_safety_escalation_policies_updated_at
  BEFORE UPDATE ON public.safety_escalation_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
