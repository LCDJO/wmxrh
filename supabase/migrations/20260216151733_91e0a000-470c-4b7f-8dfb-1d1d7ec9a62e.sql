-- Allow authenticated users to insert security logs
CREATE POLICY "Authenticated users can insert security logs"
  ON public.security_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to insert audit logs  
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tenant_member(auth.uid(), tenant_id));