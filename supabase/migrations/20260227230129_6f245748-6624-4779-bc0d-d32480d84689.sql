
-- ══════════════════════════════════════════════════════════════
-- BCDR Engine — Business Continuity & Disaster Recovery
-- ══════════════════════════════════════════════════════════════

-- 1. Recovery Policies (RTO/RPO per module/tenant)
CREATE TABLE public.bcdr_recovery_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  module_name TEXT NOT NULL,
  rto_minutes INTEGER NOT NULL DEFAULT 60,
  rpo_minutes INTEGER NOT NULL DEFAULT 15,
  priority TEXT NOT NULL DEFAULT 'high' CHECK (priority IN ('critical','high','medium','low')),
  replication_strategy TEXT NOT NULL DEFAULT 'async' CHECK (replication_strategy IN ('sync','async','snapshot')),
  failover_mode TEXT NOT NULL DEFAULT 'automatic' CHECK (failover_mode IN ('automatic','manual','semi-automatic')),
  backup_frequency_minutes INTEGER NOT NULL DEFAULT 60,
  retention_days INTEGER NOT NULL DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_recovery_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_recovery_policies"
  ON public.bcdr_recovery_policies FOR ALL
  USING (true) WITH CHECK (true);

-- 2. Replication Status
CREATE TABLE public.bcdr_replication_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID REFERENCES public.bcdr_recovery_policies(id) ON DELETE CASCADE,
  source_region TEXT NOT NULL DEFAULT 'primary',
  target_region TEXT NOT NULL DEFAULT 'secondary',
  lag_seconds INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','degraded','failed','initializing')),
  bytes_replicated BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_replication_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_replication_status"
  ON public.bcdr_replication_status FOR ALL
  USING (true) WITH CHECK (true);

-- 3. Failover Records
CREATE TABLE public.bcdr_failover_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID REFERENCES public.bcdr_recovery_policies(id),
  trigger_type TEXT NOT NULL DEFAULT 'automatic' CHECK (trigger_type IN ('automatic','manual','dr_test')),
  trigger_reason TEXT,
  source_region TEXT NOT NULL,
  target_region TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','in_progress','completed','failed','rolled_back')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  rto_actual_minutes INTEGER,
  rpo_actual_minutes INTEGER,
  rto_met BOOLEAN,
  rpo_met BOOLEAN,
  affected_tenants TEXT[] DEFAULT '{}',
  incident_id UUID,
  initiated_by UUID,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_failover_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_failover_records"
  ON public.bcdr_failover_records FOR ALL
  USING (true) WITH CHECK (true);

-- 4. Backup Records
CREATE TABLE public.bcdr_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id UUID REFERENCES public.bcdr_recovery_policies(id),
  backup_type TEXT NOT NULL DEFAULT 'incremental' CHECK (backup_type IN ('full','incremental','differential','snapshot')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed','expired')),
  size_bytes BIGINT DEFAULT 0,
  storage_location TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  checksum TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_backups"
  ON public.bcdr_backups FOR ALL
  USING (true) WITH CHECK (true);

-- 5. DR Test Runs
CREATE TABLE public.bcdr_dr_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_type TEXT NOT NULL DEFAULT 'tabletop' CHECK (test_type IN ('tabletop','simulation','partial_failover','full_failover')),
  scenario_description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','running','passed','failed','cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rto_target_minutes INTEGER,
  rto_actual_minutes INTEGER,
  rpo_target_minutes INTEGER,
  rpo_actual_minutes INTEGER,
  rto_met BOOLEAN,
  rpo_met BOOLEAN,
  modules_tested TEXT[] DEFAULT '{}',
  findings JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  executed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_dr_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_dr_tests"
  ON public.bcdr_dr_tests FOR ALL
  USING (true) WITH CHECK (true);

-- 6. Continuity Audit Log
CREATE TABLE public.bcdr_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  actor_id UUID,
  details JSONB DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_audit_log"
  ON public.bcdr_audit_log FOR ALL
  USING (true) WITH CHECK (true);

-- 7. Region Health
CREATE TABLE public.bcdr_region_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','degraded','unhealthy','offline')),
  latency_ms INTEGER DEFAULT 0,
  cpu_usage_pct NUMERIC(5,2) DEFAULT 0,
  memory_usage_pct NUMERIC(5,2) DEFAULT 0,
  disk_usage_pct NUMERIC(5,2) DEFAULT 0,
  active_connections INTEGER DEFAULT 0,
  last_health_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bcdr_region_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on bcdr_region_health"
  ON public.bcdr_region_health FOR ALL
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_bcdr_policies_module ON public.bcdr_recovery_policies(module_name);
CREATE INDEX idx_bcdr_policies_tenant ON public.bcdr_recovery_policies(tenant_id);
CREATE INDEX idx_bcdr_replication_policy ON public.bcdr_replication_status(policy_id);
CREATE INDEX idx_bcdr_failover_policy ON public.bcdr_failover_records(policy_id);
CREATE INDEX idx_bcdr_failover_status ON public.bcdr_failover_records(status);
CREATE INDEX idx_bcdr_backups_policy ON public.bcdr_backups(policy_id);
CREATE INDEX idx_bcdr_backups_status ON public.bcdr_backups(status);
CREATE INDEX idx_bcdr_dr_tests_status ON public.bcdr_dr_tests(status);
CREATE INDEX idx_bcdr_audit_event ON public.bcdr_audit_log(event_type);
CREATE INDEX idx_bcdr_region_status ON public.bcdr_region_health(status);
