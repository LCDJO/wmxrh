
-- ═══════════════════════════════════════════════════════
-- ALIGN Permission Model: resource.action format
-- Add missing permissions, normalize actions
-- ═══════════════════════════════════════════════════════

-- 1) Add missing fine-grained permissions
INSERT INTO public.permission_definitions (code, name, description, module, resource, action) VALUES
  -- Salary
  ('salary.view', 'Visualizar Salários', 'Ver dados salariais e histórico', 'remuneracao', 'salary', 'view'),
  ('salary.adjust', 'Reajustar Salários', 'Criar reajustes e ajustes salariais', 'remuneracao', 'salary', 'adjust'),
  ('salary.manage', 'Gerenciar Contratos Salariais', 'Criar/editar contratos salariais', 'remuneracao', 'salary', 'manage'),
  -- Company (manage = full CRUD shortcut)
  ('company.manage', 'Gerenciar Empresas', 'CRUD completo de empresas', 'empresa', 'company', 'manage'),
  -- User / IAM
  ('user.invite', 'Convidar Usuários', 'Enviar convite para novos membros do tenant', 'iam', 'user', 'invite'),
  ('user.view', 'Visualizar Usuários', 'Ver lista de membros do tenant', 'iam', 'user', 'view'),
  ('user.manage', 'Gerenciar Usuários', 'Editar e remover membros', 'iam', 'user', 'manage'),
  -- Training
  ('training.view', 'Visualizar Treinamentos', 'Ver treinamentos NR', 'trabalhista', 'training', 'view'),
  ('training.manage', 'Gerenciar Treinamentos', 'Criar/editar treinamentos NR', 'trabalhista', 'training', 'manage'),
  -- Risk
  ('risk.view', 'Visualizar Riscos', 'Ver exposições a risco', 'saude', 'risk', 'view'),
  ('risk.manage', 'Gerenciar Riscos', 'Criar/editar exposições a risco', 'saude', 'risk', 'manage'),
  -- Payroll simulation
  ('payroll.simulate', 'Simular Folha', 'Executar simulações de folha de pagamento', 'remuneracao', 'payroll', 'simulate'),
  -- Intelligence
  ('intelligence.manage', 'Gerenciar Inteligência', 'Configurar e gerar insights', 'inteligencia', 'intelligence', 'manage')
ON CONFLICT (code) DO NOTHING;

-- 2) Assign new permissions to Admin Master roles (all tenants)
INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
SELECT cr.id, pd.id, 'tenant'
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.slug = 'admin_master'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = pd.id
  );

-- 3) Assign salary/training/risk permissions to RH roles
INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
SELECT cr.id, pd.id, 'tenant'
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.slug = 'rh'
  AND pd.code IN ('salary.view', 'salary.adjust', 'salary.manage', 'training.view', 'training.manage', 'risk.view', 'risk.manage', 'payroll.simulate')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = pd.id
  );

-- 4) Assign view permissions to Viewer roles
INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
SELECT cr.id, pd.id, 'tenant'
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.slug = 'viewer'
  AND pd.action = 'view'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = pd.id
  );

-- 5) Assign view + salary.view to Gestor roles
INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
SELECT cr.id, pd.id, 'company'
FROM public.custom_roles cr
CROSS JOIN public.permission_definitions pd
WHERE cr.slug = 'gestor'
  AND pd.code IN ('salary.view', 'training.view', 'risk.view', 'user.view')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = cr.id AND rp.permission_id = pd.id
  );
