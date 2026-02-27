/**
 * BCDREngine — Business Continuity & Disaster Recovery Engine
 *
 * Sub-engines:
 *   ├── RecoveryPolicyManager   → RTO/RPO per module/tenant
 *   ├── ReplicationController   → data replication status & lag monitoring
 *   ├── FailoverOrchestrator    → automatic/manual failover lifecycle
 *   ├── BackupManager           → backup creation, verification, expiry
 *   ├── DRTestRunner            → disaster recovery test lifecycle
 *   ├── ContinuityAuditLogger   → audit trail for all BCDR operations
 *   └── RegionHealthMonitor     → multi-region health checks
 *
 * Integrations:
 *   - IncidentManagementEngine → auto-failover on critical incidents
 *   - Control Plane            → BCDRCommandCenter widget
 *   - ObservabilityCore        → region health signals
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  BCDREngineAPI,
  BCDRDashboardStats,
  RecoveryPolicy,
  ReplicationStatus,
  FailoverRecord,
  BackupRecord,
  DRTestRun,
  BCDRAuditEntry,
  RegionHealth,
  BackupType,
  BackupStatus,
  FailoverTrigger,
  AuditSeverity,
} from './types';
import { BCDR_KERNEL_EVENTS } from './bcdr-events';

// ── Singleton ────────────────────────────────────────

let _engine: BCDREngineAPI | null = null;

export function createBCDREngine(): BCDREngineAPI {
  // ── Recovery Policy Manager ──────────────────────
  const policies: BCDREngineAPI['policies'] = {
    async list() {
      const { data } = await (supabase as any)
        .from('bcdr_recovery_policies')
        .select('*')
        .eq('is_active', true)
        .order('priority');
      return (data ?? []) as RecoveryPolicy[];
    },
    async getByModule(module: string) {
      const { data } = await (supabase as any)
        .from('bcdr_recovery_policies')
        .select('*')
        .eq('module_name', module)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return data as RecoveryPolicy | null;
    },
    async upsert(policy) {
      const { data } = await (supabase as any)
        .from('bcdr_recovery_policies')
        .upsert(policy, { onConflict: 'id' })
        .select()
        .single();
      await audit.log({ event_type: 'policy_upserted', entity_type: 'recovery_policy', entity_id: data?.id, actor_id: null, details: { module: policy.module_name }, severity: 'info' });
      return data as RecoveryPolicy;
    },
    async deactivate(policyId: string) {
      await (supabase as any)
        .from('bcdr_recovery_policies')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', policyId);
      await audit.log({ event_type: 'policy_deactivated', entity_type: 'recovery_policy', entity_id: policyId, actor_id: null, details: {}, severity: 'warning' });
    },
  };

  // ── Replication Controller ───────────────────────
  const replication: BCDREngineAPI['replication'] = {
    async getStatus() {
      const { data } = await (supabase as any)
        .from('bcdr_replication_status')
        .select('*')
        .order('updated_at', { ascending: false });
      return (data ?? []) as ReplicationStatus[];
    },
    async getByPolicy(policyId: string) {
      const { data } = await (supabase as any)
        .from('bcdr_replication_status')
        .select('*')
        .eq('policy_id', policyId)
        .maybeSingle();
      return data as ReplicationStatus | null;
    },
    async updateLag(id: string, lagSeconds: number) {
      await (supabase as any)
        .from('bcdr_replication_status')
        .update({
          lag_seconds: lagSeconds,
          last_synced_at: new Date().toISOString(),
          status: lagSeconds > 300 ? 'failed' : lagSeconds > 60 ? 'degraded' : 'healthy',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    },
    async checkHealth() {
      const all = await this.getStatus();
      return {
        healthy: all.filter(r => r.status === 'healthy').length,
        degraded: all.filter(r => r.status === 'degraded').length,
        failed: all.filter(r => r.status === 'failed').length,
      };
    },
  };

  // ── Failover Orchestrator ────────────────────────
  const failover: BCDREngineAPI['failover'] = {
    async initiate(policyId, reason, trigger, initiatedBy) {
      const policy = await policies.getByModule(policyId).catch(() => null);
      const { data } = await (supabase as any)
        .from('bcdr_failover_records')
        .insert({
          policy_id: policyId,
          trigger_type: trigger,
          trigger_reason: reason,
          source_region: 'primary',
          target_region: 'secondary',
          status: 'initiated',
          initiated_by: initiatedBy ?? null,
        })
        .select()
        .single();

      const record = data as FailoverRecord;
      await audit.log({ event_type: 'failover_initiated', entity_type: 'failover', entity_id: record.id, actor_id: initiatedBy ?? null, details: { reason, trigger, policy_id: policyId }, severity: 'critical' });
      console.info(`[BCDR] Failover initiated: ${record.id} (${trigger}) — ${reason}`);
      return record;
    },
    async complete(failoverId, rtoActual, rpoActual) {
      const { data: policy } = await (supabase as any)
        .from('bcdr_failover_records')
        .select('policy_id')
        .eq('id', failoverId)
        .single();

      let rtoMet = true;
      let rpoMet = true;
      if (policy?.policy_id) {
        const { data: pol } = await (supabase as any)
          .from('bcdr_recovery_policies')
          .select('rto_minutes, rpo_minutes')
          .eq('id', policy.policy_id)
          .single();
        if (pol) {
          rtoMet = rtoActual <= pol.rto_minutes;
          rpoMet = rpoActual <= pol.rpo_minutes;
        }
      }

      const { data } = await (supabase as any)
        .from('bcdr_failover_records')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          rto_actual_minutes: rtoActual,
          rpo_actual_minutes: rpoActual,
          rto_met: rtoMet,
          rpo_met: rpoMet,
        })
        .eq('id', failoverId)
        .select()
        .single();

      await audit.log({ event_type: 'failover_completed', entity_type: 'failover', entity_id: failoverId, actor_id: null, details: { rtoActual, rpoActual, rtoMet, rpoMet }, severity: rtoMet && rpoMet ? 'info' : 'critical' });
      console.info(`[BCDR] Failover completed: ${failoverId} — RTO: ${rtoActual}m (${rtoMet ? 'MET' : 'BREACHED'}), RPO: ${rpoActual}m (${rpoMet ? 'MET' : 'BREACHED'})`);
      return data as FailoverRecord;
    },
    async fail(failoverId, error) {
      await (supabase as any)
        .from('bcdr_failover_records')
        .update({ status: 'failed', error_details: error, completed_at: new Date().toISOString() })
        .eq('id', failoverId);
      await audit.log({ event_type: 'failover_failed', entity_type: 'failover', entity_id: failoverId, actor_id: null, details: { error }, severity: 'critical' });
    },
    async rollback(failoverId) {
      await (supabase as any)
        .from('bcdr_failover_records')
        .update({ status: 'rolled_back', completed_at: new Date().toISOString() })
        .eq('id', failoverId);
      await audit.log({ event_type: 'failover_rolled_back', entity_type: 'failover', entity_id: failoverId, actor_id: null, details: {}, severity: 'warning' });
    },
    async getActive() {
      const { data } = await (supabase as any)
        .from('bcdr_failover_records')
        .select('*')
        .in('status', ['initiated', 'in_progress'])
        .order('started_at', { ascending: false });
      return (data ?? []) as FailoverRecord[];
    },
    async getHistory(limit = 20) {
      const { data } = await (supabase as any)
        .from('bcdr_failover_records')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);
      return (data ?? []) as FailoverRecord[];
    },
  };

  // ── Backup Manager ───────────────────────────────
  const backups: BCDREngineAPI['backups'] = {
    async create(policyId, type) {
      const { data } = await (supabase as any)
        .from('bcdr_backups')
        .insert({ policy_id: policyId, backup_type: type, status: 'in_progress' })
        .select()
        .single();
      await audit.log({ event_type: 'backup_started', entity_type: 'backup', entity_id: data?.id, actor_id: null, details: { type, policy_id: policyId }, severity: 'info' });
      return data as BackupRecord;
    },
    async complete(backupId, sizeBytes, checksum) {
      await (supabase as any)
        .from('bcdr_backups')
        .update({ status: 'completed', size_bytes: sizeBytes, checksum, completed_at: new Date().toISOString() })
        .eq('id', backupId);
      await audit.log({ event_type: 'backup_completed', entity_type: 'backup', entity_id: backupId, actor_id: null, details: { sizeBytes }, severity: 'info' });
    },
    async verify(backupId) {
      await (supabase as any)
        .from('bcdr_backups')
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq('id', backupId);
      return true;
    },
    async getLatest(policyId) {
      const { data } = await (supabase as any)
        .from('bcdr_backups')
        .select('*')
        .eq('policy_id', policyId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as BackupRecord | null;
    },
    async listByStatus(status) {
      const { data } = await (supabase as any)
        .from('bcdr_backups')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });
      return (data ?? []) as BackupRecord[];
    },
    async expireOld() {
      const now = new Date().toISOString();
      const { data } = await (supabase as any)
        .from('bcdr_backups')
        .update({ status: 'expired' })
        .lt('expires_at', now)
        .eq('status', 'completed')
        .select('id');
      return data?.length ?? 0;
    },
  };

  // ── DR Test Runner ───────────────────────────────
  const drTests: BCDREngineAPI['drTests'] = {
    async schedule(test) {
      const { data } = await (supabase as any)
        .from('bcdr_dr_tests')
        .insert({ ...test, status: 'scheduled', scheduled_at: new Date().toISOString() })
        .select()
        .single();
      await audit.log({ event_type: 'dr_test_scheduled', entity_type: 'dr_test', entity_id: data?.id, actor_id: null, details: { test_type: test.test_type }, severity: 'info' });
      return data as DRTestRun;
    },
    async start(testId) {
      await (supabase as any)
        .from('bcdr_dr_tests')
        .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', testId);
      await audit.log({ event_type: 'dr_test_started', entity_type: 'dr_test', entity_id: testId, actor_id: null, details: {}, severity: 'info' });
    },
    async complete(testId, findings, recommendations, rtoActual, rpoActual) {
      const { data: existing } = await (supabase as any)
        .from('bcdr_dr_tests')
        .select('rto_target_minutes, rpo_target_minutes')
        .eq('id', testId)
        .single();

      const rtoMet = existing?.rto_target_minutes ? rtoActual <= existing.rto_target_minutes : null;
      const rpoMet = existing?.rpo_target_minutes ? rpoActual <= existing.rpo_target_minutes : null;
      const passed = (rtoMet === null || rtoMet) && (rpoMet === null || rpoMet) && findings.filter((f: any) => f.severity === 'critical').length === 0;

      const { data } = await (supabase as any)
        .from('bcdr_dr_tests')
        .update({
          status: passed ? 'passed' : 'failed',
          completed_at: new Date().toISOString(),
          rto_actual_minutes: rtoActual,
          rpo_actual_minutes: rpoActual,
          rto_met: rtoMet,
          rpo_met: rpoMet,
          findings,
          recommendations,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testId)
        .select()
        .single();

      await audit.log({ event_type: passed ? 'dr_test_passed' : 'dr_test_failed', entity_type: 'dr_test', entity_id: testId, actor_id: null, details: { rtoActual, rpoActual, findingsCount: findings.length }, severity: passed ? 'info' : 'critical' });
      console.info(`[BCDR] DR Test ${testId} ${passed ? 'PASSED' : 'FAILED'}`);
      return data as DRTestRun;
    },
    async cancel(testId) {
      await (supabase as any)
        .from('bcdr_dr_tests')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', testId);
    },
    async getHistory(limit = 20) {
      const { data } = await (supabase as any)
        .from('bcdr_dr_tests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data ?? []) as DRTestRun[];
    },
  };

  // ── Continuity Audit Logger ──────────────────────
  const audit: BCDREngineAPI['audit'] = {
    async log(entry) {
      await (supabase as any)
        .from('bcdr_audit_log')
        .insert(entry);
    },
    async query(filter) {
      let q = (supabase as any).from('bcdr_audit_log').select('*').order('created_at', { ascending: false });
      if (filter?.event_type) q = q.eq('event_type', filter.event_type);
      if (filter?.severity) q = q.eq('severity', filter.severity);
      q = q.limit(filter?.limit ?? 50);
      const { data } = await q;
      return (data ?? []) as BCDRAuditEntry[];
    },
  };

  // ── Region Health Monitor ────────────────────────
  const regions: BCDREngineAPI['regions'] = {
    async getAll() {
      const { data } = await (supabase as any)
        .from('bcdr_region_health')
        .select('*')
        .order('region_name');
      return (data ?? []) as RegionHealth[];
    },
    async getPrimary() {
      const { data } = await (supabase as any)
        .from('bcdr_region_health')
        .select('*')
        .eq('is_primary', true)
        .maybeSingle();
      return data as RegionHealth | null;
    },
    async update(regionName, health) {
      await (supabase as any)
        .from('bcdr_region_health')
        .update({ ...health, updated_at: new Date().toISOString() })
        .eq('region_name', regionName);
    },
    async checkAllRegions() {
      const all = await this.getAll();
      return all.map(r => ({ region: r.region_name, status: r.status }));
    },
  };

  // ── Dashboard Stats ──────────────────────────────
  async function getDashboardStats(): Promise<BCDRDashboardStats> {
    const [pols, regs, repls, bkps, fovers, tests] = await Promise.all([
      policies.list(),
      regions.getAll(),
      replication.getStatus(),
      (supabase as any).from('bcdr_backups').select('status, created_at').gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
      failover.getHistory(50),
      drTests.getHistory(50),
    ]);

    const backupData = (bkps as any)?.data ?? [];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const recentFailovers = fovers.filter(f => f.started_at >= thirtyDaysAgo);
    const recentTests = tests.filter(t => t.created_at >= ninetyDaysAgo);
    const passedTests = recentTests.filter(t => t.status === 'passed');

    const completedFailovers = recentFailovers.filter(f => f.status === 'completed' && f.rto_actual_minutes != null);
    const avgRto = completedFailovers.length > 0
      ? Math.round(completedFailovers.reduce((s, f) => s + (f.rto_actual_minutes ?? 0), 0) / completedFailovers.length)
      : 0;
    const avgRpo = completedFailovers.length > 0
      ? Math.round(completedFailovers.reduce((s, f) => s + (f.rpo_actual_minutes ?? 0), 0) / completedFailovers.length)
      : 0;

    return {
      active_policies: pols.length,
      regions_healthy: regs.filter(r => r.status === 'healthy').length,
      regions_degraded: regs.filter(r => r.status === 'degraded').length,
      regions_offline: regs.filter(r => r.status === 'offline' || r.status === 'unhealthy').length,
      replication_lag_max_seconds: Math.max(0, ...repls.map(r => r.lag_seconds)),
      backups_last_24h: backupData.filter((b: any) => b.status === 'completed').length,
      backups_failed: backupData.filter((b: any) => b.status === 'failed').length,
      failovers_last_30d: recentFailovers.length,
      dr_tests_last_90d: recentTests.length,
      dr_tests_passed_pct: recentTests.length > 0 ? Math.round((passedTests.length / recentTests.length) * 100) : 100,
      avg_rto_actual_minutes: avgRto,
      avg_rpo_actual_minutes: avgRpo,
    };
  }

  _engine = {
    policies,
    replication,
    failover,
    backups,
    drTests,
    audit,
    regions,
    getDashboardStats,
  };

  return _engine;
}

export function getBCDREngine(): BCDREngineAPI {
  if (!_engine) return createBCDREngine();
  return _engine;
}

export function resetBCDREngine(): void {
  _engine = null;
}
