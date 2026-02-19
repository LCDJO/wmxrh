
-- ══════════════════════════════════════
-- Developer Portal: Core Tables
-- ══════════════════════════════════════

-- 1) Developer Accounts
CREATE TABLE public.developer_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'revoked')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_level TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_level IN ('unverified', 'email_verified', 'identity_verified', 'partner_verified')),
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'professional', 'enterprise')),
  website_url TEXT,
  logo_url TEXT,
  accepted_tos_version TEXT,
  accepted_tos_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_accounts ENABLE ROW LEVEL SECURITY;

-- Platform users can manage all developers
CREATE POLICY "Platform users can view all developers"
  ON public.developer_accounts FOR SELECT
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can manage developers"
  ON public.developer_accounts FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers can view/update their own account
CREATE POLICY "Developers can view own account"
  ON public.developer_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Developers can update own account"
  ON public.developer_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Anyone authenticated can register as developer
CREATE POLICY "Users can register as developer"
  ON public.developer_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_developer_accounts_updated_at
  BEFORE UPDATE ON public.developer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Developer Apps
CREATE TABLE public.developer_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  icon_url TEXT,
  screenshots TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'utilities',
  tags TEXT[] DEFAULT '{}',
  app_type TEXT NOT NULL DEFAULT 'public' CHECK (app_type IN ('public', 'private', 'internal')),
  app_status TEXT NOT NULL DEFAULT 'draft' CHECK (app_status IN ('draft', 'submitted', 'in_review', 'approved', 'published', 'suspended', 'rejected')),
  version TEXT NOT NULL DEFAULT '1.0.0',
  homepage_url TEXT,
  support_url TEXT,
  privacy_policy_url TEXT,
  terms_url TEXT,
  webhook_url TEXT,
  redirect_urls TEXT[] DEFAULT '{}',
  requested_scopes TEXT[] DEFAULT '{}',
  optional_scopes TEXT[] DEFAULT '{}',
  install_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developer_apps_slug_unique UNIQUE (slug)
);

ALTER TABLE public.developer_apps ENABLE ROW LEVEL SECURITY;

-- Platform users can manage all apps
CREATE POLICY "Platform users can view all apps"
  ON public.developer_apps FOR SELECT
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()));

CREATE POLICY "Platform users can manage apps"
  ON public.developer_apps FOR ALL
  TO authenticated
  USING (public.is_active_platform_user(auth.uid()))
  WITH CHECK (public.is_active_platform_user(auth.uid()));

-- Developers can CRUD their own apps
CREATE POLICY "Developers can view own apps"
  ON public.developer_apps FOR SELECT
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Developers can create apps"
  ON public.developer_apps FOR INSERT
  TO authenticated
  WITH CHECK (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Developers can update own apps"
  ON public.developer_apps FOR UPDATE
  TO authenticated
  USING (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()))
  WITH CHECK (developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid()));

CREATE POLICY "Developers can delete draft apps"
  ON public.developer_apps FOR DELETE
  TO authenticated
  USING (
    developer_id IN (SELECT id FROM public.developer_accounts WHERE user_id = auth.uid())
    AND app_status = 'draft'
  );

-- Published apps visible to all authenticated users (marketplace browsing)
CREATE POLICY "Published apps visible to all"
  ON public.developer_apps FOR SELECT
  TO authenticated
  USING (app_status = 'published');

CREATE TRIGGER update_developer_apps_updated_at
  BEFORE UPDATE ON public.developer_apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for marketplace queries
CREATE INDEX idx_developer_apps_status ON public.developer_apps(app_status);
CREATE INDEX idx_developer_apps_category ON public.developer_apps(category);
CREATE INDEX idx_developer_apps_developer ON public.developer_apps(developer_id);
