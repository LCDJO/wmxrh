
-- Create plan_modules junction table
CREATE TABLE public.plan_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, module_key)
);

-- Enable RLS
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view plan modules for their tenant"
  ON public.plan_modules FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Admins can insert plan modules"
  ON public.plan_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = plan_modules.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update plan modules"
  ON public.plan_modules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = plan_modules.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can delete plan modules"
  ON public.plan_modules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = plan_modules.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

-- Seed plan_modules from existing saas_plans.allowed_modules
INSERT INTO public.plan_modules (plan_id, module_key, tenant_id)
SELECT sp.id, unnest(sp.allowed_modules), sp.tenant_id
FROM public.saas_plans sp;
