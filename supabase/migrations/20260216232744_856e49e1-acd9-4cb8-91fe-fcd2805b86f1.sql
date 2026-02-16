
-- Materialized view as table for fast module access resolution at login
CREATE TABLE public.tenant_module_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  access_source TEXT NOT NULL DEFAULT 'plan' CHECK (access_source IN ('plan', 'addon', 'trial', 'override')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, module_key)
);

ALTER TABLE public.tenant_module_access ENABLE ROW LEVEL SECURITY;

-- Read: tenant members
CREATE POLICY "Users can view tenant module access"
  ON public.tenant_module_access FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Write: superadmin only
CREATE POLICY "Platform admins can manage module access"
  ON public.tenant_module_access FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'superadmin'
  ));

-- Function to sync module access from tenant plan
CREATE OR REPLACE FUNCTION public.sync_tenant_module_access(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove plan-sourced entries
  DELETE FROM public.tenant_module_access
  WHERE tenant_id = p_tenant_id AND access_source = 'plan';

  -- Re-insert from current plan modules
  INSERT INTO public.tenant_module_access (tenant_id, module_key, access_source)
  SELECT p_tenant_id, pm.module_key, 'plan'
  FROM public.tenant_plans tp
  JOIN public.plan_modules pm ON pm.plan_id = tp.plan_id
  WHERE tp.tenant_id = p_tenant_id
    AND tp.status IN ('active', 'trial')
  ON CONFLICT (tenant_id, module_key) DO NOTHING;
END;
$$;

-- Trigger: auto-sync when tenant_plans changes
CREATE OR REPLACE FUNCTION public.trigger_sync_module_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_tenant_module_access(NEW.tenant_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_module_access_on_plan_change
  AFTER INSERT OR UPDATE ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_module_access();

-- Seed: sync all existing tenants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tenant_id FROM public.tenant_plans LOOP
    PERFORM public.sync_tenant_module_access(r.tenant_id);
  END LOOP;
END;
$$;
