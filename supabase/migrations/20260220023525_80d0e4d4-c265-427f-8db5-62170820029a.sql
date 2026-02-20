
-- Safety Playbooks: pre-defined automation rule templates
CREATE TABLE public.safety_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Trigger
  evento_origem TEXT NOT NULL, -- matches SafetySignalSource
  condicao JSONB NOT NULL DEFAULT '[]'::jsonb, -- SafetyRuleCondition[]
  min_severity TEXT NOT NULL DEFAULT 'medium',
  -- Actions chain (ordered)
  acoes JSONB NOT NULL DEFAULT '[]'::jsonb, -- SafetyAction[]
  -- Metadata
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  cooldown_hours INTEGER NOT NULL DEFAULT 24,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view playbooks"
  ON public.safety_playbooks FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage playbooks"
  ON public.safety_playbooks FOR ALL
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE INDEX idx_safety_playbooks_tenant ON public.safety_playbooks(tenant_id);
CREATE INDEX idx_safety_playbooks_evento ON public.safety_playbooks(tenant_id, evento_origem) WHERE is_active = true;

CREATE TRIGGER update_safety_playbooks_updated_at
  BEFORE UPDATE ON public.safety_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
