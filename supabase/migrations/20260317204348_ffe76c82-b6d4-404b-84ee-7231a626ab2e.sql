-- ADS Intelligence Engine schema

-- Event types used for behavior tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ads_behavior_event_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ads_behavior_event_type AS ENUM (
      'login',
      'logout',
      'page_view',
      'module_access',
      'feature_usage',
      'click',
      'conversion'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ads_ab_variant' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ads_ab_variant AS ENUM ('a', 'b');
  END IF;
END $$;

-- Raw user behavior events for ad intelligence
CREATE TABLE IF NOT EXISTS public.ads_user_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tenant_id UUID,
  event_type public.ads_behavior_event_type NOT NULL,
  module_key TEXT,
  slot_name TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_user_created
  ON public.ads_user_behavior (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_tenant_created
  ON public.ads_user_behavior (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_event_type_created
  ON public.ads_user_behavior (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_module_created
  ON public.ads_user_behavior (module_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_slot_created
  ON public.ads_user_behavior (slot_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_user_behavior_event_data_gin
  ON public.ads_user_behavior USING GIN (event_data);

ALTER TABLE public.ads_user_behavior ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage ads behavior" ON public.ads_user_behavior;
CREATE POLICY "Platform users manage ads behavior"
ON public.ads_user_behavior
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users insert own ads behavior" ON public.ads_user_behavior;
CREATE POLICY "Users insert own ads behavior"
ON public.ads_user_behavior
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = ads_user_behavior.tenant_id
    )
  )
);

DROP POLICY IF EXISTS "Users read own ads behavior" ON public.ads_user_behavior;
CREATE POLICY "Users read own ads behavior"
ON public.ads_user_behavior
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Aggregated user profile for recommendations
CREATE TABLE IF NOT EXISTS public.user_behavior_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID,
  most_used_modules TEXT[] NOT NULL DEFAULT '{}'::text[],
  last_active_modules TEXT[] NOT NULL DEFAULT '{}'::text[],
  usage_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_features TEXT[] NOT NULL DEFAULT '{}'::text[],
  last_login TIMESTAMPTZ,
  risk_score INTEGER NOT NULL DEFAULT 0,
  engagement_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_behavior_profile_user_tenant_scope
  ON public.user_behavior_profile (
    user_id,
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_user_behavior_profile_tenant
  ON public.user_behavior_profile (tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_behavior_profile_engagement
  ON public.user_behavior_profile (engagement_score DESC);

ALTER TABLE public.user_behavior_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage behavior profiles" ON public.user_behavior_profile;
CREATE POLICY "Platform users manage behavior profiles"
ON public.user_behavior_profile
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users read own behavior profile" ON public.user_behavior_profile;
CREATE POLICY "Users read own behavior profile"
ON public.user_behavior_profile
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Rules engine for deterministic ad actions
CREATE TABLE IF NOT EXISTS public.ads_rules_engine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE SET NULL,
  slot_name TEXT,
  condition JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_rules_engine_active_priority
  ON public.ads_rules_engine (is_active, priority ASC);

CREATE INDEX IF NOT EXISTS idx_ads_rules_engine_campaign
  ON public.ads_rules_engine (campaign_id);

CREATE INDEX IF NOT EXISTS idx_ads_rules_engine_condition_gin
  ON public.ads_rules_engine USING GIN (condition);

CREATE INDEX IF NOT EXISTS idx_ads_rules_engine_action_gin
  ON public.ads_rules_engine USING GIN (action);

ALTER TABLE public.ads_rules_engine ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage ads rules" ON public.ads_rules_engine;
CREATE POLICY "Platform users manage ads rules"
ON public.ads_rules_engine
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
);

-- A/B test configuration for campaigns
CREATE TABLE IF NOT EXISTS public.ads_ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  slot_name TEXT,
  variant_a UUID NOT NULL REFERENCES public.ads_creatives(id) ON DELETE CASCADE,
  variant_b UUID NOT NULL REFERENCES public.ads_creatives(id) ON DELETE CASCADE,
  traffic_split INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_ab_tests_campaign_active
  ON public.ads_ab_tests (campaign_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ads_ab_tests_slot_active
  ON public.ads_ab_tests (slot_name, is_active);

ALTER TABLE public.ads_ab_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage ads ab tests" ON public.ads_ab_tests;
CREATE POLICY "Platform users manage ads ab tests"
ON public.ads_ab_tests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
);

-- Persisted assignment so each user sees a stable variant
CREATE TABLE IF NOT EXISTS public.ads_ab_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id UUID NOT NULL REFERENCES public.ads_ab_tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID,
  scope_key TEXT NOT NULL DEFAULT 'global',
  assigned_variant public.ads_ab_variant NOT NULL,
  creative_id UUID NOT NULL REFERENCES public.ads_creatives(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ads_ab_assignments_unique_scope
  ON public.ads_ab_assignments (ab_test_id, user_id, scope_key);

CREATE INDEX IF NOT EXISTS idx_ads_ab_assignments_user
  ON public.ads_ab_assignments (user_id, created_at DESC);

ALTER TABLE public.ads_ab_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage ads ab assignments" ON public.ads_ab_assignments;
CREATE POLICY "Platform users manage ads ab assignments"
ON public.ads_ab_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.platform_users pu
    WHERE pu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users read own ads ab assignments" ON public.ads_ab_assignments;
CREATE POLICY "Users read own ads ab assignments"
ON public.ads_ab_assignments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own ads ab assignments" ON public.ads_ab_assignments;
CREATE POLICY "Users insert own ads ab assignments"
ON public.ads_ab_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    tenant_id IS NULL OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = ads_ab_assignments.tenant_id
    )
  )
);

-- Aggregation function to keep recommendation profiles updated
CREATE OR REPLACE FUNCTION public.refresh_user_behavior_profile(p_user_id UUID, p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_most_used_modules TEXT[];
  v_last_active_modules TEXT[];
  v_preferred_features TEXT[];
  v_usage_frequency JSONB;
  v_last_login TIMESTAMPTZ;
  v_risk_score INTEGER;
  v_engagement_score NUMERIC(5,2);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(ARRAY(
    SELECT module_key
    FROM (
      SELECT COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module') AS module_key,
             COUNT(*) AS usage_count
      FROM public.ads_user_behavior ub
      WHERE ub.user_id = p_user_id
        AND ub.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module') IS NOT NULL
      GROUP BY 1
      ORDER BY usage_count DESC, module_key ASC
      LIMIT 5
    ) ranked_modules
  ), '{}'::text[])
  INTO v_most_used_modules;

  SELECT COALESCE(ARRAY(
    SELECT module_key
    FROM (
      SELECT DISTINCT ON (COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module'))
             COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module') AS module_key,
             ub.created_at
      FROM public.ads_user_behavior ub
      WHERE ub.user_id = p_user_id
        AND ub.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module') IS NOT NULL
      ORDER BY COALESCE(ub.module_key, ub.event_data->>'module_key', ub.event_data->>'module'), ub.created_at DESC
    ) recent_modules
    ORDER BY created_at DESC, module_key ASC
    LIMIT 5
  ), '{}'::text[])
  INTO v_last_active_modules;

  SELECT COALESCE(ARRAY(
    SELECT feature_name
    FROM (
      SELECT COALESCE(ub.event_data->>'feature_key', ub.event_data->>'feature', ub.event_data->>'feature_name') AS feature_name,
             COUNT(*) AS usage_count
      FROM public.ads_user_behavior ub
      WHERE ub.user_id = p_user_id
        AND ub.tenant_id IS NOT DISTINCT FROM p_tenant_id
        AND COALESCE(ub.event_data->>'feature_key', ub.event_data->>'feature', ub.event_data->>'feature_name') IS NOT NULL
      GROUP BY 1
      ORDER BY usage_count DESC, feature_name ASC
      LIMIT 5
    ) ranked_features
  ), '{}'::text[])
  INTO v_preferred_features;

  SELECT jsonb_build_object(
    'events_7d', COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'logins_7d', COUNT(*) FILTER (WHERE event_type = 'login' AND created_at >= now() - interval '7 days'),
    'module_access_7d', COUNT(*) FILTER (WHERE event_type = 'module_access' AND created_at >= now() - interval '7 days'),
    'feature_usage_7d', COUNT(*) FILTER (WHERE event_type = 'feature_usage' AND created_at >= now() - interval '7 days'),
    'clicks_7d', COUNT(*) FILTER (WHERE event_type = 'click' AND created_at >= now() - interval '7 days'),
    'conversions_30d', COUNT(*) FILTER (WHERE event_type = 'conversion' AND created_at >= now() - interval '30 days')
  )
  INTO v_usage_frequency
  FROM public.ads_user_behavior
  WHERE user_id = p_user_id
    AND tenant_id IS NOT DISTINCT FROM p_tenant_id;

  SELECT MAX(created_at) FILTER (WHERE event_type = 'login')
  INTO v_last_login
  FROM public.ads_user_behavior
  WHERE user_id = p_user_id
    AND tenant_id IS NOT DISTINCT FROM p_tenant_id;

  SELECT COALESCE(MAX(NULLIF(event_data->>'risk_score', '')::INTEGER), 0)
  INTO v_risk_score
  FROM public.ads_user_behavior
  WHERE user_id = p_user_id
    AND tenant_id IS NOT DISTINCT FROM p_tenant_id;

  v_engagement_score := LEAST(
    100,
    GREATEST(
      0,
      COALESCE((v_usage_frequency->>'logins_7d')::NUMERIC, 0) * 6
      + COALESCE((v_usage_frequency->>'module_access_7d')::NUMERIC, 0) * 2
      + COALESCE((v_usage_frequency->>'feature_usage_7d')::NUMERIC, 0) * 1.5
      + COALESCE((v_usage_frequency->>'clicks_7d')::NUMERIC, 0) * 3
      + COALESCE((v_usage_frequency->>'conversions_30d')::NUMERIC, 0) * 10
      - COALESCE(v_risk_score, 0) * 0.25
    )
  )::NUMERIC(5,2);

  INSERT INTO public.user_behavior_profile (
    user_id,
    tenant_id,
    most_used_modules,
    last_active_modules,
    usage_frequency,
    preferred_features,
    last_login,
    risk_score,
    engagement_score,
    updated_at
  ) VALUES (
    p_user_id,
    p_tenant_id,
    v_most_used_modules,
    v_last_active_modules,
    COALESCE(v_usage_frequency, '{}'::jsonb),
    v_preferred_features,
    v_last_login,
    COALESCE(v_risk_score, 0),
    COALESCE(v_engagement_score, 0),
    now()
  )
  ON CONFLICT ((user_id), (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  DO UPDATE SET
    most_used_modules = EXCLUDED.most_used_modules,
    last_active_modules = EXCLUDED.last_active_modules,
    usage_frequency = EXCLUDED.usage_frequency,
    preferred_features = EXCLUDED.preferred_features,
    last_login = EXCLUDED.last_login,
    risk_score = EXCLUDED.risk_score,
    engagement_score = EXCLUDED.engagement_score,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_ads_user_behavior_profile_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_user_behavior_profile(NEW.user_id, NEW.tenant_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ads_user_behavior_profile_refresh ON public.ads_user_behavior;
CREATE TRIGGER trg_ads_user_behavior_profile_refresh
AFTER INSERT ON public.ads_user_behavior
FOR EACH ROW
EXECUTE FUNCTION public.handle_ads_user_behavior_profile_refresh();

DROP TRIGGER IF EXISTS trg_user_behavior_profile_updated_at ON public.user_behavior_profile;
CREATE TRIGGER trg_user_behavior_profile_updated_at
BEFORE UPDATE ON public.user_behavior_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ads_rules_engine_updated_at ON public.ads_rules_engine;
CREATE TRIGGER trg_ads_rules_engine_updated_at
BEFORE UPDATE ON public.ads_rules_engine
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ads_ab_tests_updated_at ON public.ads_ab_tests;
CREATE TRIGGER trg_ads_ab_tests_updated_at
BEFORE UPDATE ON public.ads_ab_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();