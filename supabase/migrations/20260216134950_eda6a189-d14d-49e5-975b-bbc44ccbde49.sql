
-- Custom access token hook: injects tenant_id, roles, and scopes into JWT claims
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id uuid;
  _claims jsonb;
  _tenant_id uuid;
  _roles jsonb;
  _scopes jsonb;
BEGIN
  _user_id := (event->'claims'->>'sub')::uuid;
  _claims := event->'claims';

  -- Get the user's first tenant (or the one from app_metadata if set)
  SELECT tm.tenant_id INTO _tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = _user_id
  ORDER BY tm.created_at ASC
  LIMIT 1;

  IF _tenant_id IS NULL THEN
    -- No tenant, return claims as-is
    RETURN event;
  END IF;

  -- Collect roles array
  SELECT COALESCE(jsonb_agg(DISTINCT ur.role), '[]'::jsonb)
  INTO _roles
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id AND ur.tenant_id = _tenant_id;

  -- Collect scopes array: [{type, id}]
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', ur.scope_type,
      'id', COALESCE(ur.scope_id::text, _tenant_id::text)
    )
  ), '[]'::jsonb)
  INTO _scopes
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id AND ur.tenant_id = _tenant_id;

  -- Inject into claims
  _claims := jsonb_set(_claims, '{tenant_id}', to_jsonb(_tenant_id::text));
  _claims := jsonb_set(_claims, '{roles}', _roles);
  _claims := jsonb_set(_claims, '{scopes}', _scopes);

  -- Update event with enriched claims
  event := jsonb_set(event, '{claims}', _claims);

  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

-- Grant necessary table access to supabase_auth_admin
GRANT SELECT ON TABLE public.tenant_memberships TO supabase_auth_admin;
GRANT SELECT ON TABLE public.user_roles TO supabase_auth_admin;
