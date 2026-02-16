
-- Create payment_policies table
CREATE TABLE public.payment_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
  allowed_methods TEXT[] NOT NULL DEFAULT '{}',
  requires_contract BOOLEAN NOT NULL DEFAULT false,
  min_commitment_months INTEGER NOT NULL DEFAULT 1,
  allow_installments BOOLEAN NOT NULL DEFAULT false,
  max_installments INTEGER NOT NULL DEFAULT 1,
  late_payment_grace_days INTEGER NOT NULL DEFAULT 5,
  auto_suspend_after_days INTEGER NOT NULL DEFAULT 15,
  auto_cancel_after_days INTEGER NOT NULL DEFAULT 30,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id)
);

ALTER TABLE public.payment_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment policies"
  ON public.payment_policies FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Admins can insert payment policies"
  ON public.payment_policies FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = payment_policies.tenant_id
      AND ur.role IN ('owner', 'admin', 'superadmin')
  ));

CREATE POLICY "Admins can update payment policies"
  ON public.payment_policies FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = payment_policies.tenant_id
      AND ur.role IN ('owner', 'admin', 'superadmin')
  ));

CREATE POLICY "Admins can delete payment policies"
  ON public.payment_policies FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = payment_policies.tenant_id
      AND ur.role IN ('owner', 'admin', 'superadmin')
  ));

CREATE TRIGGER update_payment_policies_updated_at
  BEFORE UPDATE ON public.payment_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed from existing saas_plans
INSERT INTO public.payment_policies (plan_id, allowed_methods, requires_contract, min_commitment_months, allow_installments, max_installments, late_payment_grace_days, auto_suspend_after_days, auto_cancel_after_days, tenant_id)
SELECT
  sp.id,
  sp.allowed_payment_methods,
  CASE WHEN sp.name = 'Enterprise' THEN true ELSE false END,
  CASE WHEN sp.name = 'Enterprise' THEN 12 ELSE 1 END,
  CASE WHEN sp.name IN ('Pro','Enterprise') THEN true ELSE false END,
  CASE WHEN sp.name = 'Enterprise' THEN 12 WHEN sp.name = 'Pro' THEN 6 ELSE 1 END,
  CASE WHEN sp.name = 'Enterprise' THEN 15 WHEN sp.name = 'Pro' THEN 7 ELSE 5 END,
  CASE WHEN sp.name = 'Enterprise' THEN 30 WHEN sp.name = 'Pro' THEN 20 ELSE 15 END,
  CASE WHEN sp.name = 'Enterprise' THEN 90 WHEN sp.name = 'Pro' THEN 45 ELSE 30 END,
  sp.tenant_id
FROM public.saas_plans sp;
