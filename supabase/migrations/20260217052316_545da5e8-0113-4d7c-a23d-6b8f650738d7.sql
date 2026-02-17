
-- Financial Ledger table (real, no mocks)
CREATE TABLE public.platform_financial_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('subscription','upgrade','downgrade','refund','adjustment','payment','credit')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  source_plan_id UUID REFERENCES public.saas_plans(id),
  invoice_id UUID REFERENCES public.invoices(id),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users full access on financial entries"
  ON public.platform_financial_entries FOR ALL
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Tenants can view own financial entries"
  ON public.platform_financial_entries FOR SELECT
  USING (public.user_has_tenant_access(auth.uid(), tenant_id));

CREATE INDEX idx_financial_entries_tenant ON public.platform_financial_entries(tenant_id);
CREATE INDEX idx_financial_entries_type ON public.platform_financial_entries(entry_type);
CREATE INDEX idx_financial_entries_created ON public.platform_financial_entries(created_at DESC);
