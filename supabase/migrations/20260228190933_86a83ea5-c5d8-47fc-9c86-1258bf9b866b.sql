
-- ═══════════════════════════════════════════════════════════════
-- Account Enforcement & Platform Policy Governance Engine
-- ═══════════════════════════════════════════════════════════════

-- 1) Account enforcement actions (ban, suspend, restrict, warn)
CREATE TABLE public.account_enforcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('ban','suspend','restrict','warn')),
  reason TEXT NOT NULL,
  reason_category TEXT NOT NULL DEFAULT 'policy_violation',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','appealed','resolved','expired','revoked')),
  enforced_by UUID,
  enforced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  risk_score_at_enforcement NUMERIC,
  related_incident_id UUID,
  related_fraud_log_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_enforcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage enforcements"
  ON public.account_enforcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin','platform_security_admin')
    )
  );

CREATE INDEX idx_enforcements_tenant ON public.account_enforcements(tenant_id);
CREATE INDEX idx_enforcements_status ON public.account_enforcements(status);

-- 2) Ban registry (permanent record)
CREATE TABLE public.ban_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  enforcement_id UUID REFERENCES public.account_enforcements(id),
  ban_type TEXT NOT NULL DEFAULT 'full' CHECK (ban_type IN ('full','module','feature','api')),
  scope_detail TEXT,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  banned_by UUID,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unbanned_at TIMESTAMPTZ,
  unbanned_by UUID,
  unban_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ban_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage bans"
  ON public.ban_registry FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin','platform_security_admin')
    )
  );

-- 3) Enforcement appeals
CREATE TABLE public.enforcement_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enforcement_id UUID REFERENCES public.account_enforcements(id) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  appealed_by UUID,
  appeal_reason TEXT NOT NULL,
  supporting_evidence JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','denied','escalated')),
  reviewer_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enforcement_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage appeals"
  ON public.enforcement_appeals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin','platform_security_admin')
    )
  );

-- 4) Platform policies (terms, ToS, AUP, DPA, etc.)
CREATE TABLE public.platform_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  policy_type TEXT NOT NULL DEFAULT 'terms_of_service' CHECK (policy_type IN ('terms_of_service','acceptable_use','privacy_policy','data_processing','sla','custom')),
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_version_id UUID,
  requires_re_acceptance_on_update BOOLEAN NOT NULL DEFAULT true,
  grace_period_days INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active policies"
  ON public.platform_policies FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Platform admins manage policies"
  ON public.platform_policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin')
    )
  );

-- 5) Policy versions (immutable legal versioning)
CREATE TABLE public.platform_policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.platform_policies(id) NOT NULL,
  version_number INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_plain TEXT,
  content_hash TEXT,
  change_summary TEXT,
  published_by UUID,
  published_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT false,
  effective_from TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(policy_id, version_number)
);

ALTER TABLE public.platform_policy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read policy versions"
  ON public.platform_policy_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage versions"
  ON public.platform_policy_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin')
    )
  );

-- 6) Policy acceptances (traceable per-tenant)
CREATE TABLE public.platform_policy_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.platform_policies(id) NOT NULL,
  policy_version_id UUID REFERENCES public.platform_policy_versions(id) NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
  accepted_by UUID NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  acceptance_method TEXT NOT NULL DEFAULT 'click' CHECK (acceptance_method IN ('click','signature','api','migration')),
  is_current BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.platform_policy_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own acceptances"
  ON public.platform_policy_acceptances FOR SELECT
  TO authenticated
  USING (accepted_by = auth.uid());

CREATE POLICY "Users can insert own acceptances"
  ON public.platform_policy_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (accepted_by = auth.uid());

CREATE POLICY "Platform admins read all acceptances"
  ON public.platform_policy_acceptances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin')
    )
  );

CREATE INDEX idx_acceptances_tenant ON public.platform_policy_acceptances(tenant_id);
CREATE INDEX idx_acceptances_policy ON public.platform_policy_acceptances(policy_id);

-- 7) Enforcement audit log (immutable)
CREATE TABLE public.enforcement_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enforcement_id UUID REFERENCES public.account_enforcements(id),
  event_type TEXT NOT NULL,
  actor_id UUID,
  tenant_id UUID REFERENCES public.tenants(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enforcement_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read enforcement audit"
  ON public.enforcement_audit_log FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      JOIN public.platform_roles pr ON pr.id = pu.role_id
      WHERE pu.user_id = auth.uid()
        AND pu.status = 'active'
        AND pr.slug IN ('platform_super_admin','platform_admin','platform_security_admin')
    )
  );

-- Immutability trigger for enforcement_audit_log
CREATE OR REPLACE FUNCTION public.block_enforcement_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'enforcement_audit_log records are immutable';
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_block_enforcement_audit_update
  BEFORE UPDATE OR DELETE ON public.enforcement_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.block_enforcement_audit_mutation();

-- Immutability trigger for policy versions (no update/delete after publish)
CREATE OR REPLACE FUNCTION public.block_policy_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published policy versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_block_policy_version_update
  BEFORE UPDATE OR DELETE ON public.platform_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.block_policy_version_mutation();

-- Update current_version_id on platform_policies when a version is marked current
CREATE OR REPLACE FUNCTION public.sync_current_policy_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.platform_policy_versions
      SET is_current = false
      WHERE policy_id = NEW.policy_id AND id != NEW.id AND is_current = true;
    UPDATE public.platform_policies
      SET current_version_id = NEW.id, updated_at = now()
      WHERE id = NEW.policy_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_sync_current_policy_version
  AFTER INSERT ON public.platform_policy_versions
  FOR EACH ROW EXECUTE FUNCTION public.sync_current_policy_version();
