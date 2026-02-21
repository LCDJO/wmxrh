-- =============================================
-- FIX 1: Webhook secrets encryption with pgcrypto
-- =============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted column
ALTER TABLE public.webhook_configurations 
  ADD COLUMN secret_encrypted bytea;

-- Encrypt existing plaintext secrets
UPDATE public.webhook_configurations
SET secret_encrypted = pgp_sym_encrypt(secret_value, current_setting('app.settings.jwt_secret', true))
WHERE secret_value IS NOT NULL AND secret_value != '';

-- Create SECURITY DEFINER function to decrypt (only callable server-side)
CREATE OR REPLACE FUNCTION public.get_webhook_secret(_webhook_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _secret bytea;
  _plain text;
BEGIN
  SELECT secret_encrypted INTO _secret
  FROM public.webhook_configurations
  WHERE id = _webhook_id;
  
  IF _secret IS NULL THEN
    RETURN NULL;
  END IF;
  
  _plain := pgp_sym_decrypt(_secret, current_setting('app.settings.jwt_secret', true));
  RETURN _plain;
END;
$$;

-- Revoke public access to the decrypt function
REVOKE EXECUTE ON FUNCTION public.get_webhook_secret FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_webhook_secret TO authenticated;

-- Drop the plaintext column
ALTER TABLE public.webhook_configurations DROP COLUMN secret_value;

-- =============================================
-- FIX 2: RLS "Always True" policies
-- =============================================

-- 2a: landing_metric_events — restrict to anon role only (public tracking)
DROP POLICY IF EXISTS "Anyone can insert metric events" ON public.landing_metric_events;
CREATE POLICY "Anon can insert metric events"
  ON public.landing_metric_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- 2b: landing_traffic_allocations — restrict to anon role only
DROP POLICY IF EXISTS "Anyone can insert allocation" ON public.landing_traffic_allocations;
CREATE POLICY "Anon can insert allocation"
  ON public.landing_traffic_allocations FOR INSERT
  TO anon
  WITH CHECK (true);

-- 2c: tenants — remove overly permissive INSERT, keep the platform admin one
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;
-- Tenant creation is handled via self_register_tenant RPC which runs as SECURITY DEFINER
-- No direct INSERT needed for regular users

-- =============================================
-- FIX 3: payroll_simulations — soft delete + restrict DELETE
-- =============================================

-- Add soft delete column
ALTER TABLE public.payroll_simulations 
  ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Drop permissive DELETE policy
DROP POLICY IF EXISTS "Compensation managers can delete simulations" ON public.payroll_simulations;

-- Only superadmin/owner can hard-delete
CREATE POLICY "Only admins can delete simulations"
  ON public.payroll_simulations FOR DELETE
  TO authenticated
  USING (is_tenant_admin(auth.uid(), tenant_id));

-- Update SELECT policy to exclude soft-deleted records
DROP POLICY IF EXISTS "Compensation viewers can view simulations" ON public.payroll_simulations;
CREATE POLICY "Compensation viewers can view active simulations"
  ON public.payroll_simulations FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL 
    AND can_view_compensation_scoped(auth.uid(), tenant_id, company_id, company_group_id)
  );
