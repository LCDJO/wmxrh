
-- Immutability: block UPDATE and DELETE on platform_policy_acceptances
CREATE OR REPLACE FUNCTION public.prevent_policy_acceptance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow only is_current to be set to false (invalidation flow)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_current = false AND OLD.is_current = true THEN
      -- Only allow changing is_current, nothing else
      IF NEW.policy_id = OLD.policy_id
        AND NEW.policy_version_id = OLD.policy_version_id
        AND NEW.tenant_id = OLD.tenant_id
        AND NEW.accepted_by = OLD.accepted_by
        AND NEW.accepted_at = OLD.accepted_at
        AND NEW.acceptance_method = OLD.acceptance_method
      THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'platform_policy_acceptances records are immutable. Retroactive edits are not allowed.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform_policy_acceptances records cannot be deleted. They are part of the audit trail.';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_policy_acceptance_mutation
BEFORE UPDATE OR DELETE ON public.platform_policy_acceptances
FOR EACH ROW
EXECUTE FUNCTION public.prevent_policy_acceptance_mutation();
