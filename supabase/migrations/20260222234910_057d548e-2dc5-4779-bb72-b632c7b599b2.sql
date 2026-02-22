
-- Telegram Bindings (Destinations: users, groups, channels)
CREATE TABLE public.telegram_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  chat_type TEXT NOT NULL DEFAULT 'user' CHECK (chat_type IN ('user', 'group', 'channel')),
  label TEXT NOT NULL DEFAULT '',
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, chat_id)
);

ALTER TABLE public.telegram_bindings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_bindings_tenant ON public.telegram_bindings(tenant_id);
CREATE INDEX idx_telegram_bindings_employee ON public.telegram_bindings(employee_id) WHERE employee_id IS NOT NULL;

-- Telegram Templates (editable per tenant, per event type)
CREATE TABLE public.telegram_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_label TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN DEFAULT true,
  template_text TEXT NOT NULL DEFAULT '',
  parse_mode TEXT DEFAULT 'HTML',
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'hr', 'fleet', 'compliance', 'safety', 'payroll')),
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, event_type)
);

ALTER TABLE public.telegram_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_telegram_templates_tenant ON public.telegram_templates(tenant_id);

-- Add rate_limit and priority to message queue
ALTER TABLE public.telegram_message_queue
  ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS binding_id UUID REFERENCES public.telegram_bindings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.telegram_templates(id) ON DELETE SET NULL;

-- RLS for bindings
CREATE POLICY "Tenant members can view bindings"
ON public.telegram_bindings FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_bindings.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

CREATE POLICY "Tenant admins can manage bindings"
ON public.telegram_bindings FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_bindings.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
  AND tm.role IN ('admin', 'owner')
));

-- RLS for templates
CREATE POLICY "Tenant members can view templates"
ON public.telegram_templates FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_templates.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
));

CREATE POLICY "Tenant admins can manage templates"
ON public.telegram_templates FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tenant_memberships tm
  WHERE tm.tenant_id = telegram_templates.tenant_id
  AND tm.user_id = auth.uid()
  AND tm.status = 'active'
  AND tm.role IN ('admin', 'owner')
));

-- Service role full access
CREATE POLICY "Service role bindings"
ON public.telegram_bindings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role templates"
ON public.telegram_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_telegram_bindings_updated_at
BEFORE UPDATE ON public.telegram_bindings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_telegram_templates_updated_at
BEFORE UPDATE ON public.telegram_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
