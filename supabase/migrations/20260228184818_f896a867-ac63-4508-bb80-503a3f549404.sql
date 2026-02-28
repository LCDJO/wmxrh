
-- Payment Gateway Configuration & Transactions

CREATE TABLE public.payment_gateway_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe', 'pagarme', 'manual')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key_encrypted TEXT,
  webhook_secret_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

ALTER TABLE public.payment_gateway_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view own gateway config"
  ON public.payment_gateway_configs FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner', 'superadmin')
  ));

CREATE POLICY "Tenant admins can manage own gateway config"
  ON public.payment_gateway_configs FOR ALL
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner', 'superadmin')
  ));

-- Payment transactions log (server-side only, immutable)
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_id UUID REFERENCES public.invoices(id),
  gateway_provider TEXT NOT NULL,
  gateway_transaction_id TEXT,
  gateway_session_id TEXT,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),
  payment_method TEXT,
  error_message TEXT,
  webhook_payload JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view own transactions"
  ON public.payment_transactions FOR SELECT
  USING (tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner', 'superadmin')
  ));

CREATE POLICY "Service role can insert transactions"
  ON public.payment_transactions FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_payment_transactions_tenant ON public.payment_transactions(tenant_id);
CREATE INDEX idx_payment_transactions_invoice ON public.payment_transactions(invoice_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_gateway_configs_tenant ON public.payment_gateway_configs(tenant_id);

CREATE TRIGGER update_payment_gateway_configs_updated_at
  BEFORE UPDATE ON public.payment_gateway_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutability: prevent deletion/update of succeeded transactions
CREATE OR REPLACE FUNCTION public.protect_payment_transactions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'succeeded' THEN
    RAISE EXCEPTION 'Cannot delete succeeded payment transactions';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'succeeded' AND NEW.status NOT IN ('refunded', 'disputed') THEN
    RAISE EXCEPTION 'Succeeded transactions can only transition to refunded or disputed';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_protect_payment_transactions
  BEFORE UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.protect_payment_transactions();
