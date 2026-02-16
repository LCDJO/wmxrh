
-- Create tenant_plans table
CREATE TABLE public.tenant_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.saas_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'trial', 'suspended', 'cancelled', 'past_due')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual', 'custom')),
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users within tenant
CREATE POLICY "Users can view their tenant plan"
  ON public.tenant_plans FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Write: only platform admins (superadmin role)
CREATE POLICY "Platform admins can insert tenant plans"
  ON public.tenant_plans FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin')
  ));

CREATE POLICY "Platform admins can update tenant plans"
  ON public.tenant_plans FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin')
  ));

CREATE POLICY "Platform admins can delete tenant plans"
  ON public.tenant_plans FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('superadmin')
  ));

CREATE TRIGGER update_tenant_plans_updated_at
  BEFORE UPDATE ON public.tenant_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: assign Basic plan (trial) to all existing tenants
INSERT INTO public.tenant_plans (tenant_id, plan_id, status, trial_ends_at)
SELECT
  t.id,
  (SELECT id FROM public.saas_plans WHERE name = 'Basic' LIMIT 1),
  'trial',
  now() + interval '14 days'
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.tenant_plans tp WHERE tp.tenant_id = t.id);
