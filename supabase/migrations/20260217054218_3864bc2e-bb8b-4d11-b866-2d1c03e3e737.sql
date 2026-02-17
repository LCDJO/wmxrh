
-- Usage records
CREATE TABLE public.usage_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  metric_key TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_records_tenant_period ON public.usage_records(tenant_id, billing_period_start, billing_period_end);
CREATE INDEX idx_usage_records_metric ON public.usage_records(tenant_id, metric_key);
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_admin_usage_records"
ON public.usage_records FOR ALL TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "tenant_read_own_usage"
ON public.usage_records FOR SELECT TO authenticated
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

-- Usage pricing tiers
CREATE TABLE public.usage_pricing_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.saas_plans(id),
  metric_key TEXT NOT NULL,
  tier_start NUMERIC NOT NULL DEFAULT 0,
  tier_end NUMERIC,
  unit_price_brl NUMERIC NOT NULL DEFAULT 0,
  flat_fee_brl NUMERIC NOT NULL DEFAULT 0,
  included_quantity NUMERIC NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL DEFAULT 'tiered',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_pricing_plan_metric ON public.usage_pricing_tiers(plan_id, metric_key);
ALTER TABLE public.usage_pricing_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_admin_pricing_tiers"
ON public.usage_pricing_tiers FOR ALL TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "anyone_read_pricing_tiers"
ON public.usage_pricing_tiers FOR SELECT TO authenticated
USING (is_active = true);

-- Coupons
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  max_discount_brl NUMERIC,
  currency TEXT NOT NULL DEFAULT 'BRL',
  applicable_plan_ids UUID[],
  applicable_billing_cycles TEXT[],
  min_plan_tier TEXT,
  max_redemptions INTEGER,
  max_redemptions_per_tenant INTEGER DEFAULT 1,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  duration_months INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_status ON public.coupons(status);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_admin_coupons"
ON public.coupons FOR ALL TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "anyone_read_active_coupons"
ON public.coupons FOR SELECT TO authenticated
USING (status = 'active');

-- Coupon redemptions
CREATE TABLE public.coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  plan_id UUID REFERENCES public.saas_plans(id),
  invoice_id UUID REFERENCES public.invoices(id),
  discount_applied_brl NUMERIC NOT NULL DEFAULT 0,
  billing_cycles_remaining INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_redemptions_tenant ON public.coupon_redemptions(tenant_id);
CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_admin_redemptions"
ON public.coupon_redemptions FOR ALL TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "tenant_read_own_redemptions"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

-- Billing adjustments
CREATE TABLE public.billing_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_id UUID REFERENCES public.invoices(id),
  coupon_redemption_id UUID REFERENCES public.coupon_redemptions(id),
  adjustment_type TEXT NOT NULL,
  amount_brl NUMERIC NOT NULL,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_adjustments_tenant ON public.billing_adjustments(tenant_id);
CREATE INDEX idx_billing_adjustments_invoice ON public.billing_adjustments(invoice_id);
ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_billing_admin_adjustments"
ON public.billing_adjustments FOR ALL TO authenticated
USING (public.is_platform_billing_admin(auth.uid()));

CREATE POLICY "tenant_read_own_adjustments"
ON public.billing_adjustments FOR SELECT TO authenticated
USING (tenant_id IN (
  SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
));

-- Triggers
CREATE TRIGGER update_usage_pricing_tiers_updated_at
BEFORE UPDATE ON public.usage_pricing_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupon_redemptions_updated_at
BEFORE UPDATE ON public.coupon_redemptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
