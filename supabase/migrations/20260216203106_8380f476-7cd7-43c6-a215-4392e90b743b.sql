
-- Atomic function: create tenant + default TenantAdmin role + first admin user
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
SET search_path = public
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

  -- 3) Create first TenantUser (membership) if admin email provided
  IF p_admin_email IS NOT NULL AND p_admin_email <> '' THEN
    INSERT INTO public.tenant_memberships (tenant_id, user_id, email, name, role, status, created_by)
    VALUES (v_tenant_id, gen_random_uuid(), p_admin_email, p_admin_name, 'admin', 'invited', auth.uid())
    RETURNING id INTO v_membership_id;
  END IF;

  RETURN json_build_object(
    'tenant_id', v_tenant_id,
    'role_id', v_role_id,
    'membership_id', v_membership_id
  );
END;
$$;
