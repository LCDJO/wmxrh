CREATE OR REPLACE FUNCTION public.fn_training_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'assigned';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _action := NEW.status;
    ELSE
      _action := 'updated';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'removed';
  END IF;

  INSERT INTO public.training_audit_logs (tenant_id, employee_id, nr_codigo, action, user_id, metadata)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    COALESCE(NEW.employee_id, OLD.employee_id),
    COALESCE(NEW.nr_number, OLD.nr_number),
    _action,
    auth.uid(),
    jsonb_build_object(
      'old_status', CASE WHEN TG_OP != 'INSERT' THEN OLD.status ELSE NULL END,
      'new_status', CASE WHEN TG_OP != 'DELETE' THEN NEW.status ELSE NULL END,
      'assignment_id', COALESCE(NEW.id, OLD.id)::text
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;