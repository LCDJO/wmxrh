
-- ═══════════════════════════════════════════════════════
-- IAM MODULE: Custom Roles, Permissions & Auto Admin Master
-- ═══════════════════════════════════════════════════════

-- 1) Permission scope enum
CREATE TYPE public.permission_scope AS ENUM ('tenant', 'company_group', 'company');

-- 2) Custom Roles table (tenant-scoped, user-defined roles)
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- 3) Permission definitions (what actions exist)
CREATE TABLE public.permission_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Role ↔ Permission mapping
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permission_definitions(id) ON DELETE CASCADE,
  scope_type permission_scope NOT NULL DEFAULT 'tenant',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id),
  UNIQUE(role_id, permission_id)
);

-- 5) User ↔ Custom Role assignment
CREATE TABLE public.user_custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope_type permission_scope NOT NULL DEFAULT 'tenant',
  scope_id UUID,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id, tenant_id)
);

-- ═══════════════════════════════════════════════════════
-- ENABLE RLS
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════
-- SECURITY DEFINER: Check if user is tenant admin
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'superadmin', 'tenant_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin', 'superadmin', 'tenant_admin')
  );
$$;

-- ═══════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════

-- custom_roles: tenant members can view, admins can manage
CREATE POLICY "Members can view custom roles" ON public.custom_roles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = custom_roles.tenant_id
  ));

CREATE POLICY "Admins can create custom roles" ON public.custom_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update custom roles" ON public.custom_roles
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can delete custom roles" ON public.custom_roles
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id) AND is_system = false);

-- permission_definitions: readable by all authenticated
CREATE POLICY "All can view permissions" ON public.permission_definitions
  FOR SELECT TO authenticated USING (true);

-- role_permissions: view by tenant members (through role), manage by admins
CREATE POLICY "Members can view role permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_roles cr
    JOIN public.tenant_memberships tm ON tm.tenant_id = cr.tenant_id
    WHERE cr.id = role_permissions.role_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_roles cr
    WHERE cr.id = role_permissions.role_id
      AND public.is_tenant_admin(auth.uid(), cr.tenant_id)
  ));

CREATE POLICY "Admins can delete role permissions" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_roles cr
    WHERE cr.id = role_permissions.role_id
      AND public.is_tenant_admin(auth.uid(), cr.tenant_id)
  ));

-- user_custom_roles: tenant members view, admins manage
CREATE POLICY "Members can view user role assignments" ON public.user_custom_roles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = user_custom_roles.tenant_id
  ));

CREATE POLICY "Admins can assign custom roles" ON public.user_custom_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can update role assignments" ON public.user_custom_roles
  FOR UPDATE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Admins can remove role assignments" ON public.user_custom_roles
  FOR DELETE TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id));

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX idx_custom_roles_tenant ON public.custom_roles(tenant_id);
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles(user_id, tenant_id);
CREATE INDEX idx_user_custom_roles_role ON public.user_custom_roles(role_id);

-- ═══════════════════════════════════════════════════════
-- SEED: Permission definitions for all modules
-- ═══════════════════════════════════════════════════════

INSERT INTO public.permission_definitions (code, name, description, module) VALUES
  -- Empresa
  ('companies.view', 'Visualizar Empresas', 'Ver lista e detalhes de empresas', 'empresa'),
  ('companies.create', 'Criar Empresas', 'Cadastrar novas empresas', 'empresa'),
  ('companies.update', 'Editar Empresas', 'Alterar dados de empresas', 'empresa'),
  ('companies.delete', 'Excluir Empresas', 'Remover empresas', 'empresa'),
  ('company_groups.view', 'Visualizar Grupos', 'Ver grupos empresariais', 'empresa'),
  ('company_groups.create', 'Criar Grupos', 'Criar grupos empresariais', 'empresa'),
  ('company_groups.update', 'Editar Grupos', 'Alterar grupos', 'empresa'),
  ('company_groups.delete', 'Excluir Grupos', 'Remover grupos', 'empresa'),
  ('departments.view', 'Visualizar Departamentos', 'Ver departamentos', 'empresa'),
  ('departments.create', 'Criar Departamentos', 'Criar departamentos', 'empresa'),
  ('departments.update', 'Editar Departamentos', 'Editar departamentos', 'empresa'),
  ('departments.delete', 'Excluir Departamentos', 'Remover departamentos', 'empresa'),
  ('positions.view', 'Visualizar Cargos', 'Ver cargos', 'empresa'),
  ('positions.create', 'Criar Cargos', 'Criar cargos', 'empresa'),
  ('positions.update', 'Editar Cargos', 'Editar cargos', 'empresa'),
  ('positions.delete', 'Excluir Cargos', 'Remover cargos', 'empresa'),
  -- Funcionários
  ('employees.view', 'Visualizar Funcionários', 'Ver lista e perfil', 'funcionarios'),
  ('employees.create', 'Cadastrar Funcionários', 'Admitir funcionários', 'funcionarios'),
  ('employees.update', 'Editar Funcionários', 'Alterar dados cadastrais', 'funcionarios'),
  ('employees.delete', 'Desligar Funcionários', 'Remover funcionários', 'funcionarios'),
  -- Remuneração
  ('compensation.view', 'Visualizar Remuneração', 'Ver salários e histórico', 'remuneracao'),
  ('compensation.create', 'Gerenciar Remuneração', 'Criar contratos e ajustes', 'remuneracao'),
  ('compensation.update', 'Alterar Remuneração', 'Modificar dados salariais', 'remuneracao'),
  ('compensation.delete', 'Excluir Remuneração', 'Remover registros salariais', 'remuneracao'),
  -- Benefícios
  ('benefits.view', 'Visualizar Benefícios', 'Ver planos e adesões', 'beneficios'),
  ('benefits.create', 'Criar Benefícios', 'Cadastrar planos', 'beneficios'),
  ('benefits.update', 'Editar Benefícios', 'Alterar planos', 'beneficios'),
  ('benefits.delete', 'Excluir Benefícios', 'Remover planos', 'beneficios'),
  -- Saúde
  ('health.view', 'Visualizar Saúde', 'Ver programas e exames', 'saude'),
  ('health.create', 'Criar Registros Saúde', 'Registrar exames e programas', 'saude'),
  ('health.update', 'Editar Registros Saúde', 'Alterar dados de saúde', 'saude'),
  ('health.delete', 'Excluir Registros Saúde', 'Remover registros de saúde', 'saude'),
  -- Trabalhista
  ('labor.view', 'Visualizar Trabalhista', 'Ver compliance trabalhista', 'trabalhista'),
  ('labor.manage', 'Gerenciar Trabalhista', 'Criar/editar regras trabalhistas', 'trabalhista'),
  -- eSocial
  ('esocial.view', 'Visualizar eSocial', 'Ver eventos eSocial', 'esocial'),
  ('esocial.manage', 'Gerenciar eSocial', 'Transmitir eventos', 'esocial'),
  -- Auditoria
  ('audit.view', 'Visualizar Auditoria', 'Ver logs de auditoria', 'auditoria'),
  -- IAM
  ('iam.view', 'Visualizar Usuários', 'Ver usuários e permissões', 'iam'),
  ('iam.manage_roles', 'Gerenciar Cargos', 'Criar/editar cargos do sistema', 'iam'),
  ('iam.assign_roles', 'Atribuir Cargos', 'Atribuir cargos a usuários', 'iam'),
  ('iam.manage_users', 'Gerenciar Usuários', 'Convidar e gerenciar usuários', 'iam'),
  -- Inteligência
  ('intelligence.view', 'Visualizar Inteligência', 'Ver dashboards de inteligência', 'inteligencia'),
  -- Termos
  ('agreements.view', 'Visualizar Termos', 'Ver templates e termos', 'termos'),
  ('agreements.manage', 'Gerenciar Termos', 'Criar/editar templates', 'termos');

-- ═══════════════════════════════════════════════════════
-- AUTO-CREATE SYSTEM ROLES ON TENANT CREATION
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_create_system_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role_id UUID;
  v_rh_role_id UUID;
  v_gestor_role_id UUID;
  v_viewer_role_id UUID;
  v_perm RECORD;
BEGIN
  -- Create ADMIN MASTER role
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system, created_by)
  VALUES (NEW.id, 'Administrador Master', 'admin_master', 'Acesso total ao sistema. Criado automaticamente.', true, NULL)
  RETURNING id INTO v_admin_role_id;

  -- Assign ALL permissions to admin master
  INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
  SELECT v_admin_role_id, pd.id, 'tenant'
  FROM public.permission_definitions pd;

  -- Create RH role
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system)
  VALUES (NEW.id, 'Recursos Humanos', 'rh', 'Gestão de funcionários, benefícios e compliance.', true)
  RETURNING id INTO v_rh_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
  SELECT v_rh_role_id, pd.id, 'tenant'
  FROM public.permission_definitions pd
  WHERE pd.module IN ('funcionarios', 'remuneracao', 'beneficios', 'saude', 'trabalhista', 'termos');

  -- Create Gestor role
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system)
  VALUES (NEW.id, 'Gestor', 'gestor', 'Visualização da equipe e aprovações.', true)
  RETURNING id INTO v_gestor_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
  SELECT v_gestor_role_id, pd.id, 'company'
  FROM public.permission_definitions pd
  WHERE pd.code IN ('employees.view', 'compensation.view', 'benefits.view', 'health.view', 'agreements.view');

  -- Create Viewer role
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system)
  VALUES (NEW.id, 'Visualizador', 'viewer', 'Apenas leitura.', true)
  RETURNING id INTO v_viewer_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id, scope_type)
  SELECT v_viewer_role_id, pd.id, 'tenant'
  FROM public.permission_definitions pd
  WHERE pd.code LIKE '%.view';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_system_roles
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_create_system_roles();

-- ═══════════════════════════════════════════════════════
-- AUTO-ASSIGN ADMIN MASTER to tenant creator
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_assign_admin_master_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_role_id UUID;
BEGIN
  -- Only assign when membership role is 'owner' (initial creator)
  IF NEW.role = 'owner' THEN
    SELECT id INTO v_admin_role_id
    FROM public.custom_roles
    WHERE tenant_id = NEW.tenant_id AND slug = 'admin_master'
    LIMIT 1;

    IF v_admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_custom_roles (user_id, role_id, tenant_id, scope_type, assigned_by)
      VALUES (NEW.user_id, v_admin_role_id, NEW.tenant_id, 'tenant', NEW.user_id)
      ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_admin_master
  AFTER INSERT ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_assign_admin_master_role();

-- ═══════════════════════════════════════════════════════
-- UPDATE TIMESTAMP TRIGGER
-- ═══════════════════════════════════════════════════════

CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
