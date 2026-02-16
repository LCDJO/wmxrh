
-- Add status to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- Add status to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Create user_roles table with scoped access
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  role public.tenant_role NOT NULL DEFAULT 'viewer',
  scope_type text NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('tenant', 'company_group', 'company')),
  scope_id uuid, -- NULL for tenant-wide scope, otherwise group or company id
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_scope UNIQUE (user_id, tenant_id, role, scope_type, scope_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Migrate existing tenant_memberships data into user_roles
INSERT INTO public.user_roles (user_id, tenant_id, role, scope_type, scope_id)
SELECT user_id, tenant_id, role, 'tenant', NULL
FROM public.tenant_memberships
ON CONFLICT DO NOTHING;

-- Helper: check if user has access to a tenant (any scope)
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- Helper: check if user is tenant-level admin
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
    AND role IN ('owner', 'admin')
  )
$$;

-- Helper: check if user has access to a specific company (via tenant, group, or company scope)
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _tenant_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
    AND (
      scope_type = 'tenant'
      OR (scope_type = 'company' AND scope_id = _company_id)
      OR (scope_type = 'company_group' AND scope_id IN (
        SELECT company_group_id FROM public.companies WHERE id = _company_id AND company_group_id IS NOT NULL
      ))
    )
  )
$$;

-- Helper: check if user has access to a specific company_group
CREATE OR REPLACE FUNCTION public.user_has_group_access(_user_id uuid, _tenant_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
    AND (
      scope_type = 'tenant'
      OR (scope_type = 'company_group' AND scope_id = _group_id)
    )
  )
$$;

-- Update auto_add_tenant_owner trigger to also insert into user_roles
CREATE OR REPLACE FUNCTION public.auto_add_tenant_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');
  INSERT INTO public.user_roles (tenant_id, user_id, role, scope_type)
  VALUES (NEW.id, auth.uid(), 'owner', 'tenant');
  RETURN NEW;
END;
$$;

-- RLS for user_roles
CREATE POLICY "Users can view roles in their tenant"
ON public.user_roles FOR SELECT
USING (user_has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage roles"
ON public.user_roles FOR INSERT
WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can update roles"
ON public.user_roles FOR UPDATE
USING (user_is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can delete roles"
ON public.user_roles FOR DELETE
USING (user_is_tenant_admin(auth.uid(), tenant_id));
