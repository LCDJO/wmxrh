
-- Fix: scope service_role policy explicitly
DROP POLICY "Service role manages oauth2 grants" ON public.oauth2_grants;

CREATE POLICY "Service role manages oauth2 grants"
  ON public.oauth2_grants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
