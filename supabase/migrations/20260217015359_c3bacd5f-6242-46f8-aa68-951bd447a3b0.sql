
-- ═══════════════════════════════════════════════════════════════
-- Platform IAM Schema Restructure (fixed ordering)
-- ═══════════════════════════════════════════════════════════════

-- 1. Create platform_roles table
CREATE TABLE public.platform_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  inherits_role_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;

-- 2. Seed system roles
INSERT INTO public.platform_roles (name, slug, description, is_system_role) VALUES
  ('Super Admin', 'platform_super_admin', 'Acesso total à plataforma SaaS', true),
  ('Operações', 'platform_operations', 'Gestão operacional de tenants e módulos', true),
  ('Suporte', 'platform_support', 'Suporte ao cliente e impersonation', true),
  ('Financeiro', 'platform_finance', 'Gestão financeira e billing', true),
  ('Somente Leitura', 'platform_read_only', 'Visualização sem alterações', true);

-- 3. Add role_id to platform_users FIRST (before RLS policies reference it)
ALTER TABLE public.platform_users
  ADD COLUMN role_id UUID REFERENCES public.platform_roles(id);

UPDATE public.platform_users pu
SET role_id = pr.id
FROM public.platform_roles pr
WHERE pr.slug = pu.role::text;

ALTER TABLE public.platform_users ALTER COLUMN role_id SET NOT NULL;

-- 4. Now create RLS policies that reference role_id
CREATE POLICY "Platform roles readable by authenticated"
  ON public.platform_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform roles writable by super admins"
  ON public.platform_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.role_id IN (SELECT r.id FROM public.platform_roles r WHERE r.slug = 'platform_super_admin')
    )
  );

-- 5. Add resource/action/domain to platform_permission_definitions
ALTER TABLE public.platform_permission_definitions
  ADD COLUMN IF NOT EXISTS resource TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'platform';

UPDATE public.platform_permission_definitions
SET resource = split_part(code, '.', 1),
    action = split_part(code, '.', 2),
    domain = 'platform'
WHERE resource IS NULL;

ALTER TABLE public.platform_permission_definitions
  ALTER COLUMN resource SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN domain SET NOT NULL;

-- 6. Create platform_access_scopes table
CREATE TABLE public.platform_access_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.platform_roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'platform_section')),
  scope_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_access_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access scopes readable by authenticated"
  ON public.platform_access_scopes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Access scopes writable by super admins"
  ON public.platform_access_scopes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.role_id IN (SELECT r.id FROM public.platform_roles r WHERE r.slug = 'platform_super_admin')
    )
  );

INSERT INTO public.platform_access_scopes (role_id, scope_type)
SELECT id, 'global' FROM public.platform_roles WHERE is_system_role = true;

-- 7. Add role_id to platform_role_permissions
ALTER TABLE public.platform_role_permissions
  ADD COLUMN role_id UUID REFERENCES public.platform_roles(id) ON DELETE CASCADE;

UPDATE public.platform_role_permissions rp
SET role_id = pr.id
FROM public.platform_roles pr
WHERE pr.slug = rp.role::text;

ALTER TABLE public.platform_role_permissions ALTER COLUMN role_id SET NOT NULL;

ALTER TABLE public.platform_role_permissions
  ADD CONSTRAINT platform_role_permissions_role_id_perm_id_unique UNIQUE (role_id, permission_id);

-- 8. Trigger for updated_at
CREATE TRIGGER update_platform_roles_updated_at
  BEFORE UPDATE ON public.platform_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
