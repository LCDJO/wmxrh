
-- 1. Delete old tenant.impersonate and re-associate role_permissions
-- First get the old permission ID and update role_permissions to point to support.impersonate

-- Add billing.refund
INSERT INTO public.platform_permission_definitions (code, module, resource, action, domain, description) VALUES
  ('billing.refund', 'financeiro', 'billing', 'refund', 'platform', 'Processar reembolsos de billing');

-- Add support.impersonate  
INSERT INTO public.platform_permission_definitions (code, module, resource, action, domain, description) VALUES
  ('support.impersonate', 'suporte', 'support', 'impersonate', 'platform', 'Impersonar tenant de forma controlada');

-- Migrate role_permissions from tenant.impersonate to support.impersonate
UPDATE public.platform_role_permissions
SET permission_id = (SELECT id FROM public.platform_permission_definitions WHERE code = 'support.impersonate')
WHERE permission_id = (SELECT id FROM public.platform_permission_definitions WHERE code = 'tenant.impersonate');

-- Delete old tenant.impersonate
DELETE FROM public.platform_permission_definitions WHERE code = 'tenant.impersonate';

-- Add billing.refund to Finance + SuperAdmin
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, r.slug::public.platform_role
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug IN ('platform_finance', 'platform_super_admin') AND p.code = 'billing.refund'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Add support.impersonate to SuperAdmin (if not already)
INSERT INTO public.platform_role_permissions (role_id, permission_id, role)
SELECT r.id, p.id, 'platform_super_admin'
FROM public.platform_roles r, public.platform_permission_definitions p
WHERE r.slug = 'platform_super_admin' AND p.code = 'support.impersonate'
ON CONFLICT (role_id, permission_id) DO NOTHING;
