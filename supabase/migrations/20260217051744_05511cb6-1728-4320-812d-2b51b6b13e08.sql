
-- Invoice Engine table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.saas_plans(id),
  subscription_id UUID REFERENCES public.tenant_subscriptions(id),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','paid','overdue','cancelled','refunded')),
  payment_method TEXT CHECK (payment_method IN ('pix','boleto','credit_card','bank_transfer','manual',NULL)),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Platform users can manage all invoices
CREATE POLICY "Platform users full access on invoices"
  ON public.invoices FOR ALL
  USING (public.is_active_platform_user(auth.uid()));

-- Tenants can view their own invoices
CREATE POLICY "Tenants can view own invoices"
  ON public.invoices FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);

-- Auto-update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
