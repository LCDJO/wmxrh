
-- ══════════════════════════════════════
-- Developer Portal: App Reviews + Marketplace
-- ══════════════════════════════════════

-- 5) App Review Workflow
CREATE TABLE public.developer_app_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  review_stage TEXT NOT NULL DEFAULT 'automated' CHECK (review_stage IN ('automated', 'manual', 'security')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed', 'waived')),
  checklist JSONB NOT NULL DEFAULT '{}',
  findings TEXT[] DEFAULT '{}',
  reviewer_id UUID,
  reviewer_role TEXT CHECK (reviewer_role IS NULL OR reviewer_role IN ('platform_superadmin', 'platform_operations')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_app_reviews ENABLE ROW LEVEL SECURITY;

-- Only platform superadmin/operations can manage reviews
CREATE POLICY "Platform manage reviews"
  ON public.developer_app_reviews FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers can view reviews for their own apps (read-only)
CREATE POLICY "Developers view own app reviews"
  ON public.developer_app_reviews FOR SELECT
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE INDEX idx_app_reviews_app ON public.developer_app_reviews(app_id);
CREATE INDEX idx_app_reviews_status ON public.developer_app_reviews(status);

-- 6) Marketplace Catalog
CREATE TABLE public.developer_marketplace_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  supported_modules TEXT[] NOT NULL DEFAULT '{}',
  pricing_model TEXT NOT NULL DEFAULT 'free' CHECK (pricing_model IN ('free', 'freemium', 'paid', 'contact_sales')),
  price_monthly_brl NUMERIC(12,2),
  price_yearly_brl NUMERIC(12,2),
  trial_days INTEGER,
  featured BOOLEAN NOT NULL DEFAULT false,
  featured_order INTEGER,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_listings_app_unique UNIQUE (app_id)
);

ALTER TABLE public.developer_marketplace_listings ENABLE ROW LEVEL SECURITY;

-- Published/public listings visible to all authenticated users
CREATE POLICY "Public marketplace listings visible"
  ON public.developer_marketplace_listings FOR SELECT
  TO authenticated
  USING (
    visibility = 'public'
    AND app_id IN (SELECT id FROM public.developer_apps WHERE app_status = 'published')
  );

-- Platform users full management
CREATE POLICY "Platform manage marketplace"
  ON public.developer_marketplace_listings FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers manage own listings
CREATE POLICY "Developers view own listings"
  ON public.developer_marketplace_listings FOR SELECT
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE POLICY "Developers create own listing"
  ON public.developer_marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE POLICY "Developers update own listing"
  ON public.developer_marketplace_listings FOR UPDATE
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ))
  WITH CHECK (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

-- App Installations (tenant installs from marketplace)
CREATE TABLE public.developer_app_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  installed_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'uninstalled')),
  config JSONB DEFAULT '{}',
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMPTZ,
  CONSTRAINT app_installations_unique UNIQUE (app_id, tenant_id)
);

ALTER TABLE public.developer_app_installations ENABLE ROW LEVEL SECURITY;

-- Platform full access
CREATE POLICY "Platform manage installations"
  ON public.developer_app_installations FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Tenant admins can manage installations for their tenant
CREATE POLICY "Tenant admins manage installations"
  ON public.developer_app_installations FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins install apps"
  ON public.developer_app_installations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_tenant_admin(auth.uid(), tenant_id)
    AND installed_by = auth.uid()
  );

CREATE POLICY "Tenant admins update installations"
  ON public.developer_app_installations FOR UPDATE
  TO authenticated
  USING (public.user_is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.user_is_tenant_admin(auth.uid(), tenant_id));

-- Developers can view installations of their apps (analytics)
CREATE POLICY "Developers view own app installations"
  ON public.developer_app_installations FOR SELECT
  TO authenticated
  USING (app_id IN (
    SELECT da.id FROM public.developer_apps da
    JOIN public.developer_accounts d ON d.id = da.developer_id
    WHERE d.user_id = auth.uid()
  ));

CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON public.developer_marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_marketplace_pricing ON public.developer_marketplace_listings(pricing_model);
CREATE INDEX idx_marketplace_visibility ON public.developer_marketplace_listings(visibility);
CREATE INDEX idx_installations_app ON public.developer_app_installations(app_id);
CREATE INDEX idx_installations_tenant ON public.developer_app_installations(tenant_id);
CREATE INDEX idx_installations_status ON public.developer_app_installations(status);
