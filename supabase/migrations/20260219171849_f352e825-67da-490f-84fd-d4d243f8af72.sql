
-- ══════════════════════════════════════
-- Developer Portal: Revenue Entries + API Subscriptions
-- ══════════════════════════════════════

-- 7) App Revenue Entries (immutable financial ledger)
CREATE TABLE public.developer_app_revenue_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE RESTRICT,
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('subscription', 'usage', 'commission', 'refund', 'adjustment')),
  description TEXT NOT NULL,
  gross_amount_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  platform_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  platform_commission_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  period_start DATE,
  period_end DATE,
  invoice_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable: no updates or deletes
ALTER TABLE public.developer_app_revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform view revenue"
  ON public.developer_app_revenue_entries FOR SELECT
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform insert revenue"
  ON public.developer_app_revenue_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers view own revenue
CREATE POLICY "Developers view own revenue"
  ON public.developer_app_revenue_entries FOR SELECT
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE INDEX idx_revenue_app ON public.developer_app_revenue_entries(app_id);
CREATE INDEX idx_revenue_developer ON public.developer_app_revenue_entries(developer_id);
CREATE INDEX idx_revenue_tenant ON public.developer_app_revenue_entries(tenant_id);
CREATE INDEX idx_revenue_type ON public.developer_app_revenue_entries(entry_type);
CREATE INDEX idx_revenue_created ON public.developer_app_revenue_entries(created_at);

-- 8) API Subscriptions (tenant subscribes to an app's API)
CREATE TABLE public.developer_api_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'professional', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'expired')),
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_override INTEGER,
  billing_external_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT api_sub_unique UNIQUE (app_id, tenant_id)
);

ALTER TABLE public.developer_api_subscriptions ENABLE ROW LEVEL SECURITY;

-- Platform full access
CREATE POLICY "Platform manage api subs"
  ON public.developer_api_subscriptions FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Tenant admins manage their subscriptions
CREATE POLICY "Tenant admins view subs"
  ON public.developer_api_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins create subs"
  ON public.developer_api_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins update subs"
  ON public.developer_api_subscriptions FOR UPDATE
  TO authenticated
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Developers view subscriptions to their apps
CREATE POLICY "Developers view app subs"
  ON public.developer_api_subscriptions FOR SELECT
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE TRIGGER update_api_subs_updated_at
  BEFORE UPDATE ON public.developer_api_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_api_subs_app ON public.developer_api_subscriptions(app_id);
CREATE INDEX idx_api_subs_tenant ON public.developer_api_subscriptions(tenant_id);
CREATE INDEX idx_api_subs_status ON public.developer_api_subscriptions(status);
