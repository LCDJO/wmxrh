-- ══════════════════════════════════════════════════════════
-- Platform RBAC: permission definitions + role→permission mapping
-- ══════════════════════════════════════════════════════════

-- Add display_name to platform_users for better UX
ALTER TABLE public.platform_users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Platform permission definitions (seeded, immutable reference)
CREATE TABLE public.platform_permission_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_permission_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view permission defs"
ON public.platform_permission_definitions FOR SELECT
USING (is_active_platform_user(auth.uid()));

-- Platform role→permission assignments
CREATE TABLE public.platform_role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role platform_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.platform_permission_definitions(id) ON DELETE CASCADE,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

ALTER TABLE public.platform_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view role permissions"
ON public.platform_role_permissions FOR SELECT
USING (is_active_platform_user(auth.uid()));

CREATE POLICY "Super admins can manage role permissions"
ON public.platform_role_permissions FOR ALL
USING (has_platform_role(auth.uid(), 'platform_super_admin'));

-- Seed permission definitions
INSERT INTO public.platform_permission_definitions (code, module, description) VALUES
  ('tenant.create', 'tenants', 'Criar novos tenants'),
  ('tenant.view', 'tenants', 'Visualizar lista de tenants'),
  ('tenant.edit', 'tenants', 'Editar dados de tenants'),
  ('tenant.suspend', 'tenants', 'Suspender/reativar tenants'),
  ('tenant.delete', 'tenants', 'Excluir tenants'),
  ('tenant.impersonate', 'tenants', 'Entrar como tenant (impersonação)'),
  ('module.view', 'modulos', 'Visualizar módulos'),
  ('module.enable', 'modulos', 'Ativar/desativar módulos'),
  ('module.disable', 'modulos', 'Desativar módulos de tenants'),
  ('audit.view', 'auditoria', 'Visualizar logs de auditoria'),
  ('billing.view', 'financeiro', 'Visualizar dados de faturamento'),
  ('billing.manage', 'financeiro', 'Gerenciar faturamento e planos'),
  ('platform_user.view', 'usuarios', 'Visualizar usuários da plataforma'),
  ('platform_user.create', 'usuarios', 'Criar usuários da plataforma'),
  ('platform_user.edit', 'usuarios', 'Editar usuários da plataforma'),
  ('platform_user.delete', 'usuarios', 'Remover usuários da plataforma'),
  ('security.view', 'seguranca', 'Visualizar configurações de segurança'),
  ('security.manage', 'seguranca', 'Gerenciar configurações de segurança')
ON CONFLICT (code) DO NOTHING;

-- Seed platform_super_admin with ALL permissions
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_super_admin'::platform_role, pd.id
FROM public.platform_permission_definitions pd
ON CONFLICT (role, permission_id) DO NOTHING;

-- Seed platform_operations
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_operations'::platform_role, pd.id
FROM public.platform_permission_definitions pd
WHERE pd.code IN ('tenant.create','tenant.view','tenant.edit','tenant.suspend','module.view','module.enable','module.disable','audit.view','billing.view','platform_user.view','security.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Seed platform_support
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_support'::platform_role, pd.id
FROM public.platform_permission_definitions pd
WHERE pd.code IN ('tenant.view','tenant.impersonate','audit.view','module.view','platform_user.view','security.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Seed platform_finance
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_finance'::platform_role, pd.id
FROM public.platform_permission_definitions pd
WHERE pd.code IN ('tenant.view','billing.view','billing.manage','audit.view')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Seed platform_read_only
INSERT INTO public.platform_role_permissions (role, permission_id)
SELECT 'platform_read_only'::platform_role, pd.id
FROM public.platform_permission_definitions pd
WHERE pd.code IN ('tenant.view','module.view','audit.view','billing.view','platform_user.view','security.view')
ON CONFLICT (role, permission_id) DO NOTHING;
