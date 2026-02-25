
-- ═══════════════════════════════════════════════════════════
-- SECURITY HARDENING MIGRATION
-- ═══════════════════════════════════════════════════════════

-- ── 1. Fix always-true policies (restrict to service_role) ──

DROP POLICY IF EXISTS "Service role updates queue" ON public.blockchain_anchor_queue;
CREATE POLICY "Service role updates queue"
  ON public.blockchain_anchor_queue FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert access logs" ON public.document_access_logs;
CREATE POLICY "Service role can insert access logs"
  ON public.document_access_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert health alerts" ON public.integration_health_alerts;
CREATE POLICY "Service role can insert health alerts"
  ON public.integration_health_alerts FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert health checks" ON public.integration_health_checks;
CREATE POLICY "Service role can insert health checks"
  ON public.integration_health_checks FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anon can insert metric events" ON public.landing_metric_events;
CREATE POLICY "Anon can insert metric events"
  ON public.landing_metric_events FOR INSERT
  TO anon
  WITH CHECK (event_type IS NOT NULL AND landing_page_id IS NOT NULL);

DROP POLICY IF EXISTS "Anon can insert allocation" ON public.landing_traffic_allocations;
CREATE POLICY "Anon can insert allocation"
  ON public.landing_traffic_allocations FOR INSERT
  TO anon
  WITH CHECK (experiment_id IS NOT NULL AND variant_id IS NOT NULL);

-- ── 2. Add missing policy to validation_rate_limits ──

CREATE POLICY "Service role manages rate limits"
  ON public.validation_rate_limits FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Harden sensitive employee data tables ──

-- employee_personal_data
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.employee_personal_data;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.employee_personal_data;
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.employee_personal_data;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.employee_personal_data;

CREATE POLICY "HR admins can view personal data"
  ON public.employee_personal_data FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert personal data"
  ON public.employee_personal_data FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update personal data"
  ON public.employee_personal_data FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can delete personal data"
  ON public.employee_personal_data FOR DELETE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- employee_contracts
DROP POLICY IF EXISTS "Tenant isolation for employee_contracts" ON public.employee_contracts;

CREATE POLICY "HR admins can view contracts"
  ON public.employee_contracts FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert contracts"
  ON public.employee_contracts FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update contracts"
  ON public.employee_contracts FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- employee_dependents
DROP POLICY IF EXISTS "Tenant isolation for employee_dependents" ON public.employee_dependents;

CREATE POLICY "HR admins can view dependents"
  ON public.employee_dependents FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert dependents"
  ON public.employee_dependents FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update dependents"
  ON public.employee_dependents FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- employee_addresses
DROP POLICY IF EXISTS "Tenant isolation for employee_addresses" ON public.employee_addresses;

CREATE POLICY "HR admins can view addresses"
  ON public.employee_addresses FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert addresses"
  ON public.employee_addresses FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update addresses"
  ON public.employee_addresses FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- employee_documents
DROP POLICY IF EXISTS "Tenant isolation for employee_documents" ON public.employee_documents;

CREATE POLICY "HR admins can view documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert documents"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update documents"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- offboarding_workflows
DROP POLICY IF EXISTS "Tenant members can view offboarding workflows" ON public.offboarding_workflows;
DROP POLICY IF EXISTS "Tenant members can insert offboarding workflows" ON public.offboarding_workflows;
DROP POLICY IF EXISTS "Tenant members can update offboarding workflows" ON public.offboarding_workflows;

CREATE POLICY "HR admins can view offboarding workflows"
  ON public.offboarding_workflows FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert offboarding workflows"
  ON public.offboarding_workflows FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can update offboarding workflows"
  ON public.offboarding_workflows FOR UPDATE TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

-- signed_documents
DROP POLICY IF EXISTS "Tenant members can view signed documents" ON public.signed_documents;
DROP POLICY IF EXISTS "Tenant members can insert signed documents" ON public.signed_documents;

CREATE POLICY "HR admins can view signed documents"
  ON public.signed_documents FOR SELECT TO authenticated
  USING (can_access_employee_data(auth.uid(), tenant_id));

CREATE POLICY "HR admins can insert signed documents"
  ON public.signed_documents FOR INSERT TO authenticated
  WITH CHECK (can_access_employee_data(auth.uid(), tenant_id));

-- telegram_bindings
DROP POLICY IF EXISTS "Tenant members can view bindings" ON public.telegram_bindings;

CREATE POLICY "Tenant admins can view bindings"
  ON public.telegram_bindings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.tenant_id = telegram_bindings.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'active'
      AND tm.role IN ('admin', 'owner', 'superadmin', 'tenant_admin')
  ));
