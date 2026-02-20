
CREATE OR REPLACE FUNCTION public.fn_prevent_epi_audit_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'EPI inventory audit log is immutable. Updates are not allowed.';
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_epi_audit_delete()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'EPI inventory audit log is immutable. Deletions are not allowed.';
END;
$$;
