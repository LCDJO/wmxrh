
-- ═══════════════════════════════════════════════════════════
-- 1) CUSTOM ACCESS TOKEN HOOK — injects user_type into JWT
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_platform BOOLEAN;
  v_claims JSONB;
BEGIN
  v_user_id := (event->>'user_id')::UUID;
  v_claims := event->'claims';

  -- Check if user exists in platform_users with active status
  SELECT EXISTS(
    SELECT 1 FROM public.platform_users
    WHERE user_id = v_user_id AND status = 'active'
  ) INTO v_is_platform;

  -- Inject user_type claim
  IF v_is_platform THEN
    v_claims := jsonb_set(v_claims, '{user_type}', '"platform"');
  ELSE
    v_claims := jsonb_set(v_claims, '{user_type}', '"tenant"');
  END IF;

  -- Return modified event
  event := jsonb_set(event, '{claims}', v_claims);
  RETURN event;
END;
$$;

-- Grant required permission for Supabase Auth to call this hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for safety
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;

-- ═══════════════════════════════════════════════════════════
-- 2) MUTUAL EXCLUSION: platform_user cannot have tenant_membership
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_platform_tenant_exclusion_on_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = NEW.user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Platform users cannot hold tenant memberships. user_id=%', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_no_platform_user_as_tenant
  BEFORE INSERT OR UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_platform_tenant_exclusion_on_membership();

-- ═══════════════════════════════════════════════════════════
-- 3) MUTUAL EXCLUSION: tenant_user cannot become platform_user
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_tenant_platform_exclusion_on_platform()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Tenant users cannot hold platform roles. user_id=%', NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_no_tenant_user_as_platform
  BEFORE INSERT OR UPDATE ON public.platform_users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_platform_exclusion_on_platform();

-- ═══════════════════════════════════════════════════════════
-- 4) VALIDATION FUNCTION: check user_type from JWT claims
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_type_from_jwt()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'user_type',
    'tenant'
  );
$$;
