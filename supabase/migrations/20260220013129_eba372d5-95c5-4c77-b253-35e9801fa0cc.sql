
-- 1) Allow user_id to be NULL in tenant_memberships (for invited users not yet registered)
ALTER TABLE public.tenant_memberships ALTER COLUMN user_id DROP NOT NULL;

-- 2) Update platform_create_tenant to NOT insert fake UUIDs
CREATE OR REPLACE FUNCTION public.platform_create_tenant(
  p_name TEXT,
  p_document TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_admin_email TEXT DEFAULT NULL,
  p_admin_name TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_role_id UUID;
  v_membership_id UUID;
BEGIN
  -- 1) Create Tenant
  INSERT INTO public.tenants (name, document, email, phone, status)
  VALUES (p_name, p_document, p_email, p_phone, 'active')
  RETURNING id INTO v_tenant_id;

  -- 2) Create default TenantAdmin role
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system, is_active, created_by)
  VALUES (v_tenant_id, 'Tenant Admin', 'tenant_admin', 'Administrador padrão do tenant', true, true, auth.uid())
  RETURNING id INTO v_role_id;

  -- 3) Create invited membership with NULL user_id (will be linked on first login)
  IF p_admin_email IS NOT NULL AND p_admin_email <> '' THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, email, name, role, status, created_by)
    VALUES (v_tenant_id, NULL, p_admin_email, p_admin_name, 'admin', 'invited', auth.uid())
    RETURNING id INTO v_membership_id;
  END IF;

  RETURN json_build_object(
    'tenant_id', v_tenant_id,
    'role_id', v_role_id,
    'membership_id', v_membership_id
  );
END;
$$;

-- 3) Function to claim invited memberships on login (called from app code)
CREATE OR REPLACE FUNCTION public.claim_invited_memberships(p_user_id UUID, p_email TEXT)
RETURNS SETOF UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_membership RECORD;
BEGIN
  -- Find all invited memberships matching this email with no user_id
  FOR v_membership IN
    SELECT id, tenant_id, role FROM public.tenant_memberships
    WHERE email = lower(trim(p_email))
      AND user_id IS NULL
      AND status = 'invited'
  LOOP
    -- Link user_id and activate
    UPDATE public.tenant_memberships
    SET user_id = p_user_id, status = 'active'
    WHERE id = v_membership.id;

    -- Create corresponding user_roles entry
    INSERT INTO public.user_roles (tenant_id, user_id, role, scope_type)
    VALUES (v_membership.tenant_id, p_user_id, v_membership.role::tenant_role, 'tenant')
    ON CONFLICT DO NOTHING;

    RETURN NEXT v_membership.tenant_id;
  END LOOP;
END;
$$;

-- 4) Function to check if a tenant needs onboarding (has no companies yet)
CREATE OR REPLACE FUNCTION public.check_tenant_needs_onboarding(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE tenant_id = p_tenant_id AND deleted_at IS NULL
  );
$$;
