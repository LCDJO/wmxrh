
-- ================================
-- AUDIT LOG TABLE
-- ================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_group_id uuid REFERENCES public.company_groups(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
USING (user_is_tenant_admin(auth.uid(), tenant_id));

-- System inserts via SECURITY DEFINER triggers; admins can also insert
CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_is_tenant_admin(auth.uid(), tenant_id));

-- Indexes
CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- ================================
-- GENERIC AUDIT TRIGGER FUNCTION
-- ================================
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _action text;
  _old jsonb := NULL;
  _new jsonb := NULL;
  _tenant_id uuid;
  _company_id uuid;
  _group_id uuid;
  _entity_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _new := to_jsonb(NEW);
    _tenant_id := NEW.tenant_id;
    _entity_id := NEW.id;
    _company_id := CASE WHEN TG_TABLE_NAME IN ('employees','departments','positions') THEN NEW.company_id ELSE NULL END;
    _group_id := CASE WHEN TG_TABLE_NAME IN ('employees') AND NEW.company_group_id IS NOT NULL THEN NEW.company_group_id ELSE NULL END;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    _tenant_id := NEW.tenant_id;
    _entity_id := NEW.id;
    _company_id := CASE WHEN TG_TABLE_NAME IN ('employees','departments','positions') THEN NEW.company_id ELSE NULL END;
    _group_id := CASE WHEN TG_TABLE_NAME IN ('employees') AND NEW.company_group_id IS NOT NULL THEN NEW.company_group_id ELSE NULL END;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _old := to_jsonb(OLD);
    _tenant_id := OLD.tenant_id;
    _entity_id := OLD.id;
    _company_id := CASE WHEN TG_TABLE_NAME IN ('employees','departments','positions') THEN OLD.company_id ELSE NULL END;
    _group_id := CASE WHEN TG_TABLE_NAME IN ('employees') AND OLD.company_group_id IS NOT NULL THEN OLD.company_group_id ELSE NULL END;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, company_group_id, company_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (_tenant_id, _group_id, _company_id, auth.uid(), _action, TG_TABLE_NAME, _entity_id, _old, _new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ================================
-- ATTACH AUDIT TRIGGERS TO KEY TABLES
-- ================================
CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_companies
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_company_groups
AFTER INSERT OR UPDATE OR DELETE ON public.company_groups
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_departments
AFTER INSERT OR UPDATE OR DELETE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_positions
AFTER INSERT OR UPDATE OR DELETE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_salary_contracts
AFTER INSERT ON public.salary_contracts
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_salary_adjustments
AFTER INSERT ON public.salary_adjustments
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_salary_additionals
AFTER INSERT ON public.salary_additionals
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
