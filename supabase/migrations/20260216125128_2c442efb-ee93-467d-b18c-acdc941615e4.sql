
-- PERMISSION HELPER: check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(_user_id uuid, _tenant_id uuid, _role tenant_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- PERMISSION HELPER: check if user has any of the given roles
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _tenant_id uuid, _roles tenant_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = ANY(_roles)
  )
$$;

-- PERMISSION: can manage employees (write)
CREATE OR REPLACE FUNCTION public.can_manage_employees(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'group_admin', 'company_admin', 'rh')
  )
$$;

-- PERMISSION: can manage compensation (write)
CREATE OR REPLACE FUNCTION public.can_manage_compensation(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'rh', 'financeiro')
  )
$$;

-- PERMISSION: can view compensation
CREATE OR REPLACE FUNCTION public.can_view_compensation(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('superadmin', 'owner', 'admin', 'tenant_admin', 'group_admin', 'company_admin', 'rh', 'gestor', 'financeiro')
  )
$$;

-- Update is_tenant_admin to include new admin roles
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role IN ('owner', 'admin', 'superadmin', 'tenant_admin')
  )
$$;

-- Update user_is_tenant_admin to include new admin roles
CREATE OR REPLACE FUNCTION public.user_is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
    AND scope_type = 'tenant'
    AND role IN ('owner', 'admin', 'superadmin', 'tenant_admin')
  )
$$;
