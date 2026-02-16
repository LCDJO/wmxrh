
-- ═══════════════════════════════════════════════════════════════
-- DEFAULT RUBRICS SEED + IMMUTABILITY RULES
-- ═══════════════════════════════════════════════════════════════

-- 1. Function to seed default rubrics for a tenant
CREATE OR REPLACE FUNCTION public.seed_default_rubrics(_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.payroll_item_catalog (tenant_id, code, name, item_type, nature, incidence, esocial_code, is_system)
  VALUES
    (_tenant_id, '1000', 'Salário Base',       'provento',  'fixed',    'all',   '1000', true),
    (_tenant_id, '1010', 'Hora Extra',          'provento',  'variable', 'all',   '1020', true),
    (_tenant_id, '1020', 'Adicional Noturno',   'provento',  'variable', 'all',   '1030', true),
    (_tenant_id, '1030', 'Insalubridade',       'provento',  'fixed',    'all',   '1040', true),
    (_tenant_id, '1040', 'Periculosidade',      'provento',  'fixed',    'all',   '1050', true),
    (_tenant_id, '1050', 'Gratificação',        'provento',  'fixed',    'all',   '1060', true),
    (_tenant_id, '2000', 'Desconto INSS',       'desconto',  'fixed',    'inss',  '9201', true),
    (_tenant_id, '2010', 'Desconto IRRF',       'desconto',  'fixed',    'irrf',  '9202', true)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$;

-- 2. Trigger: auto-seed rubrics when a new tenant is created
CREATE OR REPLACE FUNCTION public.auto_seed_tenant_rubrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_default_rubrics(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_seed_rubrics
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.auto_seed_tenant_rubrics();

-- 3. Seed rubrics for all existing tenants
DO $$
DECLARE _t UUID;
BEGIN
  FOR _t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_rubrics(_t);
  END LOOP;
END;
$$;

-- 4. Prevent modifications to closed salary structures (versioning)
CREATE OR REPLACE FUNCTION public.prevent_closed_structure_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_active = false AND NEW.is_active = false THEN
    RAISE EXCEPTION 'Cannot modify a closed salary structure. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_closed_structure_mutation
  BEFORE UPDATE ON public.salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.prevent_closed_structure_mutation();

-- 5. Prevent deleting system rubrics from catalog
CREATE OR REPLACE FUNCTION public.prevent_system_rubric_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'Cannot delete system rubrics. Deactivate instead.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_system_rubric_delete
  BEFORE DELETE ON public.payroll_item_catalog
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_rubric_delete();
