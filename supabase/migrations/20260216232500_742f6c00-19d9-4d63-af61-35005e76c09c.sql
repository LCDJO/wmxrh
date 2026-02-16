
-- Create SaaS Plans table
CREATE TABLE public.saas_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  allowed_modules TEXT[] NOT NULL DEFAULT '{}',
  allowed_payment_methods TEXT[] NOT NULL DEFAULT '{}',
  feature_flags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can view active plans of their tenant
CREATE POLICY "Users can view plans for their tenant"
  ON public.saas_plans FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- RLS: admins (owner/admin/superadmin) can manage plans
CREATE POLICY "Admins can insert plans"
  ON public.saas_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = saas_plans.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update plans"
  ON public.saas_plans FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = saas_plans.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can delete plans"
  ON public.saas_plans FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = saas_plans.tenant_id
        AND ur.role IN ('owner', 'admin', 'superadmin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_saas_plans_updated_at
  BEFORE UPDATE ON public.saas_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default plans
INSERT INTO public.saas_plans (id, name, description, price, billing_cycle, allowed_modules, allowed_payment_methods, feature_flags, is_active, tenant_id)
SELECT
  gen_random_uuid(),
  p.name,
  p.description,
  p.price,
  'monthly',
  p.modules,
  p.payments,
  p.flags,
  true,
  t.id
FROM (VALUES
  ('Basic', 'Plano básico com módulos essenciais', 99.90,
    ARRAY['employees','departments','positions','companies']::text[],
    ARRAY['pix','boleto','credit_card']::text[],
    ARRAY['ui:basic_dashboard']::text[]),
  ('Pro', 'Plano profissional com módulos avançados', 299.90,
    ARRAY['employees','departments','positions','companies','compensation','benefits','health','compliance','agreements','labor_rules']::text[],
    ARRAY['pix','boleto','credit_card','bank_transfer']::text[],
    ARRAY['ui:basic_dashboard','ui:advanced_reports','ui:payroll_simulation']::text[]),
  ('Enterprise', 'Plano enterprise com todos os módulos', 799.90,
    ARRAY['employees','departments','positions','companies','compensation','benefits','health','compliance','agreements','labor_rules','esocial','payroll_simulation','workforce_intelligence','audit','iam']::text[],
    ARRAY['pix','boleto','credit_card','bank_transfer','invoice']::text[],
    ARRAY['ui:basic_dashboard','ui:advanced_reports','ui:payroll_simulation','ui:workforce_intelligence','ui:strategic_intelligence','ui:custom_branding']::text[])
) AS p(name, description, price, modules, payments, flags)
CROSS JOIN (SELECT id FROM public.tenants LIMIT 1) t;
