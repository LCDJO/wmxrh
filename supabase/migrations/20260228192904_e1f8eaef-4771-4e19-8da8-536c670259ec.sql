
-- Immutability: block DELETE and destructive UPDATE on platform_policy_versions
CREATE OR REPLACE FUNCTION public.prevent_policy_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform_policy_versions records cannot be deleted. Full version history must be preserved.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only allow is_current to change (from true to false)
    IF NEW.is_current IS DISTINCT FROM OLD.is_current
      AND NEW.policy_id = OLD.policy_id
      AND NEW.version_number = OLD.version_number
      AND NEW.content_html = OLD.content_html
      AND NEW.title = OLD.title
      AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
      AND NEW.effective_from IS NOT DISTINCT FROM OLD.effective_from
      AND NEW.requires_reacceptance = OLD.requires_reacceptance
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'platform_policy_versions records are immutable. Content and metadata cannot be changed after publication.';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_policy_version_mutation
BEFORE UPDATE OR DELETE ON public.platform_policy_versions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_policy_version_mutation();
