
-- Function for self-registration: creates tenant + membership for a new user
CREATE OR REPLACE FUNCTION public.self_register_tenant(
  p_user_id UUID,
  p_user_email TEXT,
  p_user_name TEXT,
  p_company_name TEXT,
  p_company_document TEXT DEFAULT NULL,
  p_company_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_existing_membership UUID;
BEGIN
  -- Check if user already has a membership (prevent duplicate tenants)
  SELECT id INTO v_existing_membership
  FROM public.tenant_memberships
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_existing_membership IS NOT NULL THEN
    RETURN json_build_object('already_registered', true);
  END IF;

  -- Create the tenant
  INSERT INTO public.tenants (name, document, phone, email, status)
  VALUES (p_company_name, p_company_document, p_company_phone, p_user_email, 'active')
  RETURNING id INTO v_tenant_id;

  -- The auto_add_tenant_owner trigger handles:
  -- 1. Creating tenant_membership with role 'owner'
  -- 2. Creating user_roles entry
  -- 3. Seeding default custom_roles
  -- But we need to update the membership with the user's name
  UPDATE public.tenant_memberships
  SET name = p_user_name, email = p_user_email
  WHERE tenant_id = v_tenant_id AND user_id = p_user_id;

  RETURN json_build_object(
    'tenant_id', v_tenant_id,
    'already_registered', false
  );
END;
$$;
