
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _old jsonb := NULL;
  _new jsonb := NULL;
  _tenant_id uuid;
  _company_id uuid := NULL;
  _group_id uuid := NULL;
  _entity_id uuid;
  _row jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _row := to_jsonb(NEW);
    _new := _row;
    _tenant_id := (_row->>'tenant_id')::uuid;
    _entity_id := (_row->>'id')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _old := to_jsonb(OLD);
    _row := to_jsonb(NEW);
    _new := _row;
    _tenant_id := (_row->>'tenant_id')::uuid;
    _entity_id := (_row->>'id')::uuid;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _row := to_jsonb(OLD);
    _old := _row;
    _tenant_id := (_row->>'tenant_id')::uuid;
    _entity_id := (_row->>'id')::uuid;
  END IF;

  -- Safely extract optional columns via jsonb (avoids "has no field" errors)
  IF _row ? 'company_id' THEN
    _company_id := (_row->>'company_id')::uuid;
  END IF;
  IF _row ? 'company_group_id' THEN
    _group_id := (_row->>'company_group_id')::uuid;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, company_group_id, company_id, user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (_tenant_id, _group_id, _company_id, auth.uid(), _action, TG_TABLE_NAME, _entity_id, _old, _new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
