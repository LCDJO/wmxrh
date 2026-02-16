-- ══════════════════════════════════════════════════════════
-- Tenant Subscriptions: tracks plan, MRR, billing per tenant
-- ══════════════════════════════════════════════════════════

CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'churned');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'professional', 'enterprise', 'custom');

CREATE TABLE public.tenant_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'starter',
  status subscription_status NOT NULL DEFAULT 'trial',
  mrr NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  churned_at TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  seats_included INTEGER NOT NULL DEFAULT 5,
  seats_used INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Platform users can manage subscriptions
CREATE POLICY "Platform users can select subscriptions"
ON public.tenant_subscriptions FOR SELECT
USING (is_active_platform_user(auth.uid()));

CREATE POLICY "Platform admins can insert subscriptions"
ON public.tenant_subscriptions FOR INSERT
WITH CHECK (has_platform_role(auth.uid(), 'platform_super_admin') OR has_platform_role(auth.uid(), 'platform_operations'));

CREATE POLICY "Platform admins can update subscriptions"
ON public.tenant_subscriptions FOR UPDATE
USING (has_platform_role(auth.uid(), 'platform_super_admin') OR has_platform_role(auth.uid(), 'platform_operations'));

-- Auto-update updated_at
CREATE TRIGGER update_tenant_subscriptions_updated_at
BEFORE UPDATE ON public.tenant_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ══════════════════════════════════════════════════════════
-- Subscription History: tracks plan changes for churn analysis
-- ══════════════════════════════════════════════════════════

CREATE TABLE public.subscription_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created','upgraded','downgraded','cancelled','churned','reactivated'
  old_plan subscription_plan,
  new_plan subscription_plan,
  old_mrr NUMERIC(12,2),
  new_mrr NUMERIC(12,2),
  reason TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can select subscription events"
ON public.subscription_events FOR SELECT
USING (is_active_platform_user(auth.uid()));

CREATE POLICY "Platform admins can insert subscription events"
ON public.subscription_events FOR INSERT
WITH CHECK (has_platform_role(auth.uid(), 'platform_super_admin') OR has_platform_role(auth.uid(), 'platform_operations'));

-- ══════════════════════════════════════════════════════════
-- RPC: Aggregate platform metrics in a single call
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result JSONB;
  _total_tenants INTEGER;
  _active_tenants INTEGER;
  _suspended_tenants INTEGER;
  _total_users INTEGER;
  _total_mrr NUMERIC;
  _active_subs INTEGER;
  _trial_subs INTEGER;
  _churned_subs INTEGER;
  _avg_mrr NUMERIC;
  _recent_tenants JSONB;
  _plan_distribution JSONB;
  _top_tenants JSONB;
BEGIN
  -- Only allow platform users
  IF NOT is_active_platform_user(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Tenant counts
  SELECT COUNT(*) INTO _total_tenants FROM tenants;
  SELECT COUNT(*) INTO _active_tenants FROM tenants WHERE status = 'active';
  SELECT COUNT(*) INTO _suspended_tenants FROM tenants WHERE status = 'suspended';

  -- User count
  SELECT COUNT(*) INTO _total_users FROM tenant_memberships;

  -- MRR metrics
  SELECT 
    COALESCE(SUM(mrr), 0),
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'trial'),
    COUNT(*) FILTER (WHERE status = 'churned'),
    COALESCE(AVG(mrr) FILTER (WHERE status = 'active' AND mrr > 0), 0)
  INTO _total_mrr, _active_subs, _trial_subs, _churned_subs, _avg_mrr
  FROM tenant_subscriptions;

  -- Recent tenants (last 10)
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO _recent_tenants
  FROM (
    SELECT t.id, t.name, t.status, t.created_at,
           ts.plan, ts.mrr, ts.status as sub_status,
           (SELECT COUNT(*) FROM tenant_memberships tm WHERE tm.tenant_id = t.id) as user_count
    FROM tenants t
    LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) r;

  -- Plan distribution
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO _plan_distribution
  FROM (
    SELECT plan::text, COUNT(*) as count, SUM(mrr) as total_mrr
    FROM tenant_subscriptions
    WHERE status IN ('active', 'trial')
    GROUP BY plan
    ORDER BY total_mrr DESC
  ) r;

  -- Top tenants by MRR
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  INTO _top_tenants
  FROM (
    SELECT t.name, ts.mrr, ts.plan::text, ts.seats_used,
           (SELECT COUNT(*) FROM tenant_memberships tm WHERE tm.tenant_id = t.id) as user_count
    FROM tenant_subscriptions ts
    JOIN tenants t ON t.id = ts.tenant_id
    WHERE ts.status = 'active'
    ORDER BY ts.mrr DESC
    LIMIT 5
  ) r;

  _result := jsonb_build_object(
    'total_tenants', _total_tenants,
    'active_tenants', _active_tenants,
    'suspended_tenants', _suspended_tenants,
    'total_users', _total_users,
    'total_mrr', ROUND(_total_mrr, 2),
    'active_subscriptions', _active_subs,
    'trial_subscriptions', _trial_subs,
    'churned_subscriptions', _churned_subs,
    'avg_mrr', ROUND(_avg_mrr, 2),
    'churn_rate', CASE WHEN (_active_subs + _churned_subs) > 0 
      THEN ROUND((_churned_subs::numeric / (_active_subs + _churned_subs) * 100), 1)
      ELSE 0 END,
    'recent_tenants', _recent_tenants,
    'plan_distribution', _plan_distribution,
    'top_tenants', _top_tenants
  );

  RETURN _result;
END;
$$;

-- ══════════════════════════════════════════════════════════
-- Seed subscriptions for existing tenants
-- ══════════════════════════════════════════════════════════

INSERT INTO public.tenant_subscriptions (tenant_id, plan, status, mrr, started_at, seats_included, seats_used)
SELECT 
  t.id,
  'professional',
  'active',
  497.00,
  t.created_at,
  10,
  (SELECT COUNT(*) FROM tenant_memberships tm WHERE tm.tenant_id = t.id)
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id)
ON CONFLICT (tenant_id) DO NOTHING;
