
-- ═══════════════════════════════════════════════════════════
-- FIX 1: claim_invited_memberships - add email ownership validation
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.claim_invited_memberships(uuid, text);

CREATE OR REPLACE FUNCTION public.claim_invited_memberships(p_user_id UUID, p_email TEXT)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership RECORD;
  v_auth_email TEXT;
BEGIN
  -- SECURITY: Verify the provided email matches the authenticated user's email
  SELECT lower(email) INTO v_auth_email FROM auth.users WHERE id = p_user_id;
  
  IF v_auth_email IS NULL OR v_auth_email != lower(trim(p_email)) THEN
    RAISE EXCEPTION 'Email does not match authenticated user';
  END IF;

  FOR v_membership IN
    SELECT id, tenant_id, role FROM public.tenant_memberships
    WHERE email = lower(trim(p_email))
      AND user_id IS NULL
      AND status = 'invited'
  LOOP
    UPDATE public.tenant_memberships
    SET user_id = p_user_id, status = 'active', updated_at = now()
    WHERE id = v_membership.id;

    INSERT INTO public.user_roles (tenant_id, user_id, role, scope_type)
    VALUES (v_membership.tenant_id, p_user_id, v_membership.role::tenant_role, 'tenant')
    ON CONFLICT DO NOTHING;

    RETURN NEXT v_membership.tenant_id;
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- FIX 2: Make chat-attachments bucket private again
-- ═══════════════════════════════════════════════════════════

UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';
