
-- ══════════════════════════════════════════════════════════════════
-- FIX: Broken tenant isolation in RLS policies
--
-- Problem: 12 policies used `tenant_id IN (SELECT id FROM tenants)`
-- which only checks if the tenant EXISTS — not if the authenticated
-- user BELONGS to that tenant. Any authenticated user could read
-- data from all tenants.
--
-- Fix: Replace with `public.is_tenant_member(auth.uid(), tenant_id)`
-- which enforces that the current user must be a member of the tenant.
-- ══════════════════════════════════════════════════════════════════

-- ── automation_rules ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for automation_rules" ON public.automation_rules;
CREATE POLICY "Tenant isolation for automation_rules"
  ON public.automation_rules FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── automation_rule_executions ───────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation for automation_rule_executions" ON public.automation_rule_executions;
CREATE POLICY "Tenant isolation for automation_rule_executions"
  ON public.automation_rule_executions FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── ats_requisitions ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation ats_requisitions" ON public.ats_requisitions;
CREATE POLICY "Tenant isolation ats_requisitions"
  ON public.ats_requisitions FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── ats_pipeline_stages ──────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation ats_pipeline_stages" ON public.ats_pipeline_stages;
CREATE POLICY "Tenant isolation ats_pipeline_stages"
  ON public.ats_pipeline_stages FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── ats_candidates ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation ats_candidates" ON public.ats_candidates;
CREATE POLICY "Tenant isolation ats_candidates"
  ON public.ats_candidates FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── performance_review_cycles ────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation performance_review_cycles" ON public.performance_review_cycles;
CREATE POLICY "Tenant isolation performance_review_cycles"
  ON public.performance_review_cycles FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── employee_reviews ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation employee_reviews" ON public.employee_reviews;
CREATE POLICY "Tenant isolation employee_reviews"
  ON public.employee_reviews FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── employee_goals ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation employee_goals" ON public.employee_goals;
CREATE POLICY "Tenant isolation employee_goals"
  ON public.employee_goals FOR ALL
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── governance_events ────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation - governance_events SELECT" ON public.governance_events;
DROP POLICY IF EXISTS "Tenant isolation - governance_events INSERT" ON public.governance_events;

CREATE POLICY "Tenant isolation - governance_events SELECT"
  ON public.governance_events FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - governance_events INSERT"
  ON public.governance_events FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

-- ── governance_projections ───────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation - governance_projections SELECT" ON public.governance_projections;
DROP POLICY IF EXISTS "Tenant isolation - governance_projections INSERT" ON public.governance_projections;
DROP POLICY IF EXISTS "Tenant isolation - governance_projections UPDATE" ON public.governance_projections;

CREATE POLICY "Tenant isolation - governance_projections SELECT"
  ON public.governance_projections FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - governance_projections INSERT"
  ON public.governance_projections FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - governance_projections UPDATE"
  ON public.governance_projections FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── org_intelligence_jobs ────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_jobs SELECT" ON public.org_intelligence_jobs;
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_jobs INSERT" ON public.org_intelligence_jobs;
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_jobs UPDATE" ON public.org_intelligence_jobs;

CREATE POLICY "Tenant isolation - org_intelligence_jobs SELECT"
  ON public.org_intelligence_jobs FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - org_intelligence_jobs INSERT"
  ON public.org_intelligence_jobs FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - org_intelligence_jobs UPDATE"
  ON public.org_intelligence_jobs FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id));

-- ── org_intelligence_snapshots ───────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_snapshots SELECT" ON public.org_intelligence_snapshots;
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_snapshots INSERT" ON public.org_intelligence_snapshots;
DROP POLICY IF EXISTS "Tenant isolation - org_intelligence_snapshots UPDATE" ON public.org_intelligence_snapshots;

CREATE POLICY "Tenant isolation - org_intelligence_snapshots SELECT"
  ON public.org_intelligence_snapshots FOR SELECT
  USING (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - org_intelligence_snapshots INSERT"
  ON public.org_intelligence_snapshots FOR INSERT
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant isolation - org_intelligence_snapshots UPDATE"
  ON public.org_intelligence_snapshots FOR UPDATE
  USING (public.is_tenant_member(auth.uid(), tenant_id));
