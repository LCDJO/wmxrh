
-- 1. Add PlatformFiscal role (if not already added by previous partial migration)
INSERT INTO public.platform_roles (name, slug, description, is_system_role) VALUES
  ('Fiscal', 'platform_fiscal', 'Relatórios fiscais e auditoria financeira', true)
ON CONFLICT (slug) DO NOTHING;

-- 2. Add missing fiscal permissions
INSERT INTO public.platform_permission_definitions (code, module, resource, action, domain, description) VALUES
  ('fiscal.view', 'fiscal', 'fiscal', 'view', 'platform', 'Visualizar relatórios fiscais'),
  ('fiscal.report', 'fiscal', 'fiscal', 'report', 'platform', 'Gerar relatórios fiscais')
ON CONFLICT DO NOTHING;

-- 3. Add global access scope for the new role
INSERT INTO public.platform_access_scopes (role_id, scope_type)
SELECT id, 'global' FROM public.platform_roles WHERE slug = 'platform_fiscal'
AND NOT EXISTS (SELECT 1 FROM public.platform_access_scopes WHERE role_id = (SELECT id FROM public.platform_roles WHERE slug = 'platform_fiscal'));

-- 4. Re-seed all role permissions
DELETE FROM public.platform_role_permissions;

-- Super Admin: ALL
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_super_admin'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_super_admin';

-- Operations
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_operations'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_operations'
  AND p.code IN ('tenant.create','tenant.view','tenant.edit','tenant.suspend','module.view','module.enable','module.disable','audit.view','platform_user.view','security.view');

-- Support
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_support'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_support'
  AND p.code IN ('tenant.view','tenant.impersonate','audit.view','module.view','platform_user.view','security.view');

-- Finance
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_finance'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_finance'
  AND p.code IN ('tenant.view','billing.view','billing.manage','plan.manage','audit.view');

-- Fiscal
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_fiscal'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_fiscal'
  AND p.code IN ('fiscal.view','fiscal.report','billing.view','audit.view','tenant.view');

-- Read Only
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_read_only'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_read_only'
  AND p.code IN ('tenant.view','module.view','audit.view','billing.view','platform_user.view','security.view','fiscal.view');
