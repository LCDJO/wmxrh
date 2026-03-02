
-- ══════════════════════════════════════════════════════════════
-- WorkTime Compliance Engine — Immutable Time Ledger & Anti-Fraud
-- Portaria 671/2021, CLT Art. 74
-- ══════════════════════════════════════════════════════════════

-- 1. Immutable Time Ledger (append-only, tamper-proof)
CREATE TABLE public.worktime_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('clock_in','clock_out','break_start','break_end')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','biometric','geofence','app','api')),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  device_fingerprint text,
  device_model text,
  device_os text,
  app_version text,
  ip_address text,
  geofence_id uuid,
  geofence_matched boolean DEFAULT false,
  photo_proof_url text,
  nsr_sequence bigint,
  integrity_hash text NOT NULL,
  previous_hash text,
  is_offline_sync boolean DEFAULT false,
  offline_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Immutability triggers
CREATE OR REPLACE FUNCTION public.fn_worktime_ledger_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'worktime_ledger is immutable — updates and deletes are forbidden (Portaria 671/2021)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_worktime_ledger_no_update
  BEFORE UPDATE ON public.worktime_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_ledger_immutable();

CREATE TRIGGER trg_worktime_ledger_no_delete
  BEFORE DELETE ON public.worktime_ledger
  FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_ledger_immutable();

CREATE INDEX idx_worktime_ledger_tenant_emp ON public.worktime_ledger(tenant_id, employee_id, recorded_at DESC);
CREATE INDEX idx_worktime_ledger_hash ON public.worktime_ledger(integrity_hash);
CREATE INDEX idx_worktime_ledger_nsr ON public.worktime_ledger(tenant_id, nsr_sequence);

ALTER TABLE public.worktime_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for worktime_ledger select"
  ON public.worktime_ledger FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Insert worktime_ledger"
  ON public.worktime_ledger FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 2. Ledger Adjustments (append-only corrections)
CREATE TABLE public.worktime_ledger_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  original_entry_id uuid NOT NULL REFERENCES public.worktime_ledger(id),
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('correction','addition','invalidation')),
  new_recorded_at timestamptz,
  new_event_type text,
  reason text NOT NULL,
  legal_basis text,
  approved_by uuid,
  approved_at timestamptz,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  integrity_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_worktime_adj_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'worktime_ledger_adjustments is immutable';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_worktime_adj_no_update BEFORE UPDATE ON public.worktime_ledger_adjustments FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_adj_immutable();
CREATE TRIGGER trg_worktime_adj_no_delete BEFORE DELETE ON public.worktime_ledger_adjustments FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_adj_immutable();

ALTER TABLE public.worktime_ledger_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for worktime_adjustments select"
  ON public.worktime_ledger_adjustments FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));

CREATE POLICY "Insert worktime_adjustments"
  ON public.worktime_ledger_adjustments FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 3. Geofence Zones
CREATE TABLE public.worktime_geofences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  description text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters double precision NOT NULL DEFAULT 100,
  geofence_type text NOT NULL DEFAULT 'work_site' CHECK (geofence_type IN ('work_site','branch','client_site','restricted')),
  is_active boolean NOT NULL DEFAULT true,
  allowed_clock_types text[] DEFAULT ARRAY['clock_in','clock_out','break_start','break_end'],
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.worktime_geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant worktime_geofences"
  ON public.worktime_geofences FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 4. Device Registry
CREATE TABLE public.worktime_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  device_model text,
  device_os text,
  is_trusted boolean NOT NULL DEFAULT false,
  trusted_at timestamptz,
  trusted_by uuid,
  is_blocked boolean NOT NULL DEFAULT false,
  blocked_reason text,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, employee_id, device_fingerprint)
);

ALTER TABLE public.worktime_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant worktime_devices"
  ON public.worktime_devices FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 5. Anti-Fraud Log
CREATE TABLE public.worktime_fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  ledger_entry_id uuid REFERENCES public.worktime_ledger(id),
  fraud_type text NOT NULL CHECK (fraud_type IN (
    'location_spoof','device_tamper','time_anomaly','velocity_impossible',
    'duplicate_clock','untrusted_device','offline_abuse','pattern_anomaly','photo_mismatch'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  confidence_score double precision NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1),
  evidence jsonb NOT NULL DEFAULT '{}',
  auto_action text CHECK (auto_action IN ('none','flag','block','notify_manager','suspend_clock')),
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow only resolution updates on fraud logs
CREATE OR REPLACE FUNCTION public.fn_worktime_fraud_update_guard()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.resolved = true THEN
    RAISE EXCEPTION 'Resolved fraud logs cannot be modified';
  END IF;
  IF NEW.resolved IS DISTINCT FROM OLD.resolved AND NEW.resolved = true THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'worktime_fraud_logs only allows resolution updates';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_worktime_fraud_update_guard BEFORE UPDATE ON public.worktime_fraud_logs FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_fraud_update_guard();
CREATE TRIGGER trg_worktime_fraud_no_delete BEFORE DELETE ON public.worktime_fraud_logs FOR EACH ROW EXECUTE FUNCTION public.fn_worktime_ledger_immutable();

ALTER TABLE public.worktime_fraud_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant worktime_fraud_logs"
  ON public.worktime_fraud_logs FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 6. Compliance Audit Trail
CREATE TABLE public.worktime_compliance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  audit_type text NOT NULL CHECK (audit_type IN (
    'daily_closure','weekly_review','monthly_report','portaria_671_check',
    'overtime_limit','break_violation','nocturnal_check','hash_verification'
  )),
  period_start date NOT NULL,
  period_end date NOT NULL,
  employee_id uuid,
  findings jsonb NOT NULL DEFAULT '[]',
  violations_count int NOT NULL DEFAULT 0,
  compliance_score double precision DEFAULT 100,
  audited_by text NOT NULL DEFAULT 'system',
  report_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.worktime_compliance_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant worktime_compliance_audits"
  ON public.worktime_compliance_audits FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));


-- 7. Export History (AFD/AFDT/ACJEF)
CREATE TABLE public.worktime_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  export_type text NOT NULL CHECK (export_type IN ('AFD','AFDT','ACJEF','AEJ','espelho_ponto','csv','pdf')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  employee_ids uuid[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  file_url text,
  file_hash text,
  record_count int DEFAULT 0,
  requested_by uuid,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.worktime_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant worktime_exports"
  ON public.worktime_exports FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tm.tenant_id FROM public.tenant_memberships tm WHERE tm.user_id = auth.uid()));
