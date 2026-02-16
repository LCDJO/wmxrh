
-- Add default system roles seeding to the tenant creation trigger
CREATE OR REPLACE FUNCTION public.auto_add_tenant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Create tenant membership for the creator
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner');

  -- 2. Create user_roles entry
  INSERT INTO public.user_roles (tenant_id, user_id, role, scope_type)
  VALUES (NEW.id, auth.uid(), 'owner', 'tenant');

  -- 3. Seed default system roles for the new tenant
  INSERT INTO public.custom_roles (tenant_id, name, slug, description, is_system, is_active)
  VALUES
    (NEW.id, 'Administrador Master', 'admin_master', 'Acesso total ao sistema. Criado automaticamente.', true, true),
    (NEW.id, 'Recursos Humanos', 'rh', 'Gestão de funcionários, benefícios e compliance.', true, true),
    (NEW.id, 'Gestor', 'gestor', 'Visualização da equipe e aprovações.', true, true),
    (NEW.id, 'Visualizador', 'viewer', 'Apenas leitura.', true, true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
