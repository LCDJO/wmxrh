
-- ══════════════════════════════════════════════════════════════
-- Biometric Trust Layer — LGPD-compliant biometric storage
-- ══════════════════════════════════════════════════════════════

-- 1. Biometric Enrollments
CREATE TABLE public.biometric_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  enrollment_status text NOT NULL DEFAULT 'pending' CHECK (enrollment_status IN ('pending','active','revoked','expired')),
  template_hash text NOT NULL,
  template_version int NOT NULL DEFAULT 1,
  quality_score numeric(5,2) NOT NULL DEFAULT 0,
  liveness_verified boolean NOT NULL DEFAULT false,
  capture_device text,
  capture_method text NOT NULL DEFAULT 'camera' CHECK (capture_method IN ('camera','upload','kiosk')),
  consent_granted boolean NOT NULL DEFAULT false,
  consent_granted_at timestamptz,
  consent_ip_address text,
  lgpd_legal_basis text NOT NULL DEFAULT 'consent',
  lgpd_retention_days int NOT NULL DEFAULT 730,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_biometric_enroll_tenant_emp ON public.biometric_enrollments(tenant_id, employee_id);
ALTER TABLE public.biometric_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access biometric enrollments"
  ON public.biometric_enrollments FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 2. Biometric Match Logs (immutable)
CREATE TABLE public.biometric_match_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  enrollment_id uuid REFERENCES public.biometric_enrollments(id),
  worktime_entry_id uuid,
  match_score numeric(5,4) NOT NULL DEFAULT 0,
  match_threshold numeric(5,4) NOT NULL DEFAULT 0.85,
  match_result text NOT NULL CHECK (match_result IN ('match','no_match','spoof_detected','liveness_failed','error')),
  liveness_passed boolean NOT NULL DEFAULT false,
  liveness_score numeric(5,4),
  liveness_method text DEFAULT 'passive',
  risk_score numeric(5,2) NOT NULL DEFAULT 0,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  capture_quality numeric(5,2),
  device_fingerprint text,
  ip_address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  processing_time_ms int,
  fraud_signals jsonb DEFAULT '[]'::jsonb,
  auto_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_match_tenant_emp ON public.biometric_match_logs(tenant_id, employee_id, created_at DESC);
CREATE INDEX idx_bio_match_result ON public.biometric_match_logs(match_result);

CREATE OR REPLACE FUNCTION public.fn_biometric_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'This biometric table is immutable — LGPD Art. 37';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_bio_match_no_update BEFORE UPDATE ON public.biometric_match_logs FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();
CREATE TRIGGER trg_bio_match_no_delete BEFORE DELETE ON public.biometric_match_logs FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();

ALTER TABLE public.biometric_match_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access biometric match logs"
  ON public.biometric_match_logs FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 3. Biometric Audit Trail (immutable)
CREATE TABLE public.biometric_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid,
  actor_id uuid,
  action text NOT NULL,
  action_category text NOT NULL DEFAULT 'access' CHECK (action_category IN ('enrollment','verification','access','consent','revocation','deletion','export')),
  entity_type text NOT NULL DEFAULT 'biometric_enrollment',
  entity_id uuid,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  lgpd_justification text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_audit_tenant ON public.biometric_audit_trail(tenant_id, created_at DESC);
CREATE TRIGGER trg_bio_audit_no_update BEFORE UPDATE ON public.biometric_audit_trail FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();
CREATE TRIGGER trg_bio_audit_no_delete BEFORE DELETE ON public.biometric_audit_trail FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();

ALTER TABLE public.biometric_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access biometric audit"
  ON public.biometric_audit_trail FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 4. Liveness Challenges
CREATE TABLE public.biometric_liveness_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  challenge_type text NOT NULL DEFAULT 'passive' CHECK (challenge_type IN ('passive','blink','head_turn','smile','random_gesture')),
  challenge_data jsonb DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'pending' CHECK (result IN ('pending','passed','failed','timeout','error')),
  confidence_score numeric(5,4),
  spoof_probability numeric(5,4),
  processing_time_ms int,
  device_info jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_liveness_tenant ON public.biometric_liveness_challenges(tenant_id, employee_id, created_at DESC);

ALTER TABLE public.biometric_liveness_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access liveness challenges"
  ON public.biometric_liveness_challenges FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- 5. Consent Records (immutable, LGPD Art. 11)
CREATE TABLE public.biometric_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  employee_id uuid NOT NULL,
  consent_type text NOT NULL DEFAULT 'facial_recognition' CHECK (consent_type IN ('facial_recognition','liveness_detection','template_storage','data_sharing')),
  consent_version text NOT NULL DEFAULT '1.0',
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  revoked_at timestamptz,
  ip_address text,
  legal_basis text NOT NULL DEFAULT 'consent',
  purpose_description text NOT NULL DEFAULT 'Registro de ponto eletrônico com reconhecimento facial conforme Portaria 671/2021',
  retention_period_days int NOT NULL DEFAULT 730,
  policy_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bio_consent_tenant_emp ON public.biometric_consent_records(tenant_id, employee_id);
CREATE TRIGGER trg_bio_consent_no_update BEFORE UPDATE ON public.biometric_consent_records FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();
CREATE TRIGGER trg_bio_consent_no_delete BEFORE DELETE ON public.biometric_consent_records FOR EACH ROW EXECUTE FUNCTION public.fn_biometric_immutable();

ALTER TABLE public.biometric_consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant access biometric consent"
  ON public.biometric_consent_records FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Realtime for control plane
ALTER PUBLICATION supabase_realtime ADD TABLE public.biometric_match_logs;
