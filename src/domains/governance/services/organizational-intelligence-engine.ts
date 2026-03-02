/**
 * OrganizationalIntelligenceEngine — Async Architecture
 *
 * CAMADA 2: Full organizational intelligence with:
 *   - Async job dispatch (background processing via edge function)
 *   - Real-time event-driven projections (in-process)
 *   - Time-series KPI snapshots (turnover, risk, absenteeism, performance)
 *   - Disciplinary pattern detection
 *   - Department risk heatmap
 *
 * Architecture:
 *   Events → In-Process Projections (fast, real-time)
 *   Events → Job Queue → Edge Function Worker (heavy calculations)
 *   Snapshots → Query API (time-series analytics)
 */

import { supabase } from '@/integrations/supabase/client';
import { onGovernanceEvent } from '../events/governance-event-bus';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import { EMPLOYEE_LIFECYCLE_EVENTS } from '../events/employee-lifecycle-events';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';
import type { Json } from '@/integrations/supabase/types';

const projectionStore = new GovernanceProjectionStore();

// ══════════════════════════════════════════════
// JOB TYPES
// ══════════════════════════════════════════════

export const ORG_INTELLIGENCE_JOB_TYPES = {
  TurnoverCalc: 'turnover_calc',
  RiskHeatmap: 'risk_heatmap',
  AbsenteeismIndex: 'absenteeism_index',
  HeadcountSnapshot: 'headcount_snapshot',
  PerformanceSummary: 'performance_summary',
  DisciplinaryPatterns: 'disciplinary_patterns',
} as const;

export type OrgIntelligenceJobType = typeof ORG_INTELLIGENCE_JOB_TYPES[keyof typeof ORG_INTELLIGENCE_JOB_TYPES];

// ══════════════════════════════════════════════
// ASYNC JOB DISPATCHER
// ══════════════════════════════════════════════

export class OrgIntelligenceJobDispatcher {
  /** Enqueue a background job. */
  async dispatch(
    tenantId: string,
    jobType: OrgIntelligenceJobType,
    payload?: Record<string, unknown>,
    opts?: { priority?: number; scheduledAt?: string },
  ): Promise<string> {
    const { data, error } = await supabase
      .from('org_intelligence_jobs')
      .insert([{
        tenant_id: tenantId,
        job_type: jobType,
        payload: JSON.parse(JSON.stringify(payload ?? {})) as Json,
        priority: opts?.priority ?? 5,
        scheduled_at: opts?.scheduledAt ?? new Date().toISOString(),
      }])
      .select('id')
      .single();

    if (error) throw new Error(`[OrgIntelligence] Job dispatch failed: ${error.message}`);
    return data.id;
  }

  /** Dispatch all standard calculations for a tenant. */
  async dispatchFullRecalculation(tenantId: string, periodStart?: string): Promise<string[]> {
    const start = periodStart ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const payload = { period_start: start, period_end: new Date().toISOString() };

    const jobIds: string[] = [];
    for (const jobType of Object.values(ORG_INTELLIGENCE_JOB_TYPES)) {
      const id = await this.dispatch(tenantId, jobType, payload, { priority: 3 });
      jobIds.push(id);
    }
    return jobIds;
  }

  /** Trigger the worker edge function. */
  async triggerWorker(): Promise<void> {
    await supabase.functions.invoke('org-intelligence-worker', {
      body: { trigger: 'manual' },
    });
  }

  /** Get job status. */
  async getJobStatus(jobId: string) {
    const { data, error } = await supabase
      .from('org_intelligence_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw new Error(`[OrgIntelligence] Job status fetch failed: ${error.message}`);
    return data;
  }

  /** List recent jobs for a tenant. */
  async listJobs(tenantId: string, opts?: { status?: string; limit?: number }) {
    let query = supabase
      .from('org_intelligence_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 20);

    if (opts?.status) query = query.eq('status', opts.status);

    const { data, error } = await query;
    if (error) throw new Error(`[OrgIntelligence] Job list failed: ${error.message}`);
    return data ?? [];
  }
}

// ══════════════════════════════════════════════
// SNAPSHOT QUERY API
// ══════════════════════════════════════════════

export class OrgIntelligenceSnapshotQuery {
  /** Get latest snapshot of a given type. */
  async getLatest(tenantId: string, snapshotType: string) {
    const { data, error } = await supabase
      .from('org_intelligence_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_type', snapshotType)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[OrgIntelligence] Snapshot fetch failed: ${error.message}`);
    return data;
  }

  /** Get time-series snapshots. */
  async getTimeSeries(
    tenantId: string,
    snapshotType: string,
    opts?: { periodType?: string; limit?: number; from?: string; to?: string },
  ) {
    let query = supabase
      .from('org_intelligence_snapshots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('snapshot_type', snapshotType)
      .order('period_start', { ascending: true })
      .limit(opts?.limit ?? 12);

    if (opts?.periodType) query = query.eq('period_type', opts.periodType);
    if (opts?.from) query = query.gte('period_start', opts.from);
    if (opts?.to) query = query.lte('period_start', opts.to);

    const { data, error } = await query;
    if (error) throw new Error(`[OrgIntelligence] Time-series fetch failed: ${error.message}`);
    return data ?? [];
  }

  /** Get all latest snapshots for a tenant (dashboard view). */
  async getDashboard(tenantId: string) {
    const types = ['turnover', 'headcount', 'absenteeism', 'risk', 'performance', 'disciplinary_patterns'];
    const results: Record<string, unknown> = {};

    for (const t of types) {
      results[t] = await this.getLatest(tenantId, t);
    }

    return results;
  }
}

// ══════════════════════════════════════════════
// REAL-TIME PROJECTIONS (in-process, fast)
// ══════════════════════════════════════════════

interface OrgMetrics {
  total_hired: number;
  total_terminated: number;
  total_warned: number;
  total_suspended: number;
  active_headcount: number;
  turnover_events: Array<{ employee_id: string; type: string; date: string }>;
  warning_events: Array<{ employee_id: string; severity: string; date: string }>;
  last_updated: string;
}

interface DeptRisk {
  warnings: number;
  suspensions: number;
  terminations: number;
  risk_score: number;
}

async function updateOrgMetrics(tenantId: string, update: (m: OrgMetrics) => void): Promise<void> {
  const existing = await projectionStore.load(tenantId, 'org_intelligence', 'org_metrics', 'global');
  const metrics: OrgMetrics = (existing?.state as unknown as OrgMetrics) ?? {
    total_hired: 0, total_terminated: 0, total_warned: 0, total_suspended: 0,
    active_headcount: 0, turnover_events: [], warning_events: [], last_updated: '',
  };

  update(metrics);
  metrics.last_updated = new Date().toISOString();

  if (metrics.turnover_events.length > 200) metrics.turnover_events = metrics.turnover_events.slice(-200);
  if (metrics.warning_events.length > 200) metrics.warning_events = metrics.warning_events.slice(-200);

  await projectionStore.save({
    tenant_id: tenantId, projection_name: 'org_intelligence',
    aggregate_type: 'org_metrics', aggregate_id: 'global',
    state: metrics as unknown as Record<string, unknown>,
    version: (existing?.version ?? 0) + 1, last_event_id: null,
  });
}

async function updateDeptRisk(tenantId: string, deptId: string, update: (d: DeptRisk) => void): Promise<void> {
  if (!deptId) return;
  const existing = await projectionStore.load(tenantId, 'dept_risk_heatmap', 'department', deptId);
  const risk: DeptRisk = (existing?.state as unknown as DeptRisk) ?? {
    warnings: 0, suspensions: 0, terminations: 0, risk_score: 0,
  };

  update(risk);
  risk.risk_score = (risk.warnings * 10) + (risk.suspensions * 25) + (risk.terminations * 40);

  await projectionStore.save({
    tenant_id: tenantId, projection_name: 'dept_risk_heatmap',
    aggregate_type: 'department', aggregate_id: deptId,
    state: risk as unknown as Record<string, unknown>,
    version: (existing?.version ?? 0) + 1, last_event_id: null,
  });
}

// Auto-dispatch background jobs after significant events
const jobDispatcher = new OrgIntelligenceJobDispatcher();
let _eventThrottleTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function throttledJobDispatch(tenantId: string, jobType: OrgIntelligenceJobType) {
  const key = `${tenantId}:${jobType}`;
  if (_eventThrottleTimers[key]) clearTimeout(_eventThrottleTimers[key]);
  _eventThrottleTimers[key] = setTimeout(() => {
    jobDispatcher.dispatch(tenantId, jobType, {
      period_start: new Date(Date.now() - 30 * 86400000).toISOString(),
      triggered_by: 'event_auto',
    }, { priority: 7 }).catch(console.error);
    delete _eventThrottleTimers[key];
  }, 5000); // 5s debounce
}

function handleEvent(eventType: string, handler: (e: GovernanceDomainEvent) => Promise<void>) {
  onGovernanceEvent(eventType, (event) => {
    handler(event).catch(err => console.error(`[OrgIntelligence] Error handling ${eventType}:`, err));
  });
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

let _initialized = false;

export function initOrganizationalIntelligenceEngine(): void {
  if (_initialized) return;
  _initialized = true;

  // EmployeeHired → real-time + async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeHired, async (e) => {
    const tenantId = e.metadata.tenant_id;
    await updateOrgMetrics(tenantId, m => { m.total_hired++; m.active_headcount++; });
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.TurnoverCalc);
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.HeadcountSnapshot);
  });

  // EmployeeWarned → real-time + async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeWarned, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    await updateOrgMetrics(tenantId, m => {
      m.total_warned++;
      m.warning_events.push({
        employee_id: (p.employee_id as string) ?? e.aggregate_id,
        severity: (p.severity as string) ?? 'low',
        date: e.occurred_at,
      });
    });
    const deptId = (p.departamento_id as string) ?? '';
    if (deptId) await updateDeptRisk(tenantId, deptId, d => { d.warnings++; });
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.RiskHeatmap);
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.DisciplinaryPatterns);
  });

  // EmployeeSuspended → real-time + async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeSuspended, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    await updateOrgMetrics(tenantId, m => { m.total_suspended++; });
    const deptId = (p.departamento_id as string) ?? '';
    if (deptId) await updateDeptRisk(tenantId, deptId, d => { d.suspensions++; });
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.RiskHeatmap);
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.AbsenteeismIndex);
  });

  // EmployeeTerminated → real-time + async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeTerminated, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    await updateOrgMetrics(tenantId, m => {
      m.total_terminated++;
      m.active_headcount = Math.max(0, m.active_headcount - 1);
      m.turnover_events.push({
        employee_id: (p.employee_id as string) ?? e.aggregate_id,
        type: (p.tipo as string) ?? 'unknown',
        date: e.occurred_at,
      });
    });
    const deptId = (p.departamento_id as string) ?? '';
    if (deptId) await updateDeptRisk(tenantId, deptId, d => { d.terminations++; });
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.TurnoverCalc);
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.HeadcountSnapshot);
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.RiskHeatmap);
  });

  // PerformanceReviewCompleted → real-time + async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.PerformanceReviewCompleted, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    const employeeId = (p.employee_id as string) ?? e.aggregate_id;

    const existing = await projectionStore.load(tenantId, 'employee_performance', 'employee', employeeId);
    const reviews = ((existing?.state?.reviews as unknown[]) ?? []) as Array<{ type: string; score: number; date: string }>;
    reviews.push({ type: (p.review_type as string) ?? '', score: (p.score as number) ?? 0, date: e.occurred_at });
    if (reviews.length > 20) reviews.splice(0, reviews.length - 20);
    const avgScore = reviews.reduce((s, r) => s + r.score, 0) / reviews.length;

    await projectionStore.save({
      tenant_id: tenantId, projection_name: 'employee_performance',
      aggregate_type: 'employee', aggregate_id: employeeId,
      state: { reviews, average_score: avgScore, total_reviews: reviews.length },
      version: (existing?.version ?? 0) + 1, last_event_id: e.id,
    });
    throttledJobDispatch(tenantId, ORG_INTELLIGENCE_JOB_TYPES.PerformanceSummary);
  });

  // Leave events → async
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeLeaveStarted, async (e) => {
    throttledJobDispatch(e.metadata.tenant_id, ORG_INTELLIGENCE_JOB_TYPES.AbsenteeismIndex);
  });
}

// ══════════════════════════════════════════════
// UNIFIED QUERY API
// ══════════════════════════════════════════════

export class OrganizationalIntelligenceQuery {
  private snapshots = new OrgIntelligenceSnapshotQuery();

  // Real-time projections
  async getOrgMetrics(tenantId: string): Promise<OrgMetrics | null> {
    const p = await projectionStore.load(tenantId, 'org_intelligence', 'org_metrics', 'global');
    return p ? (p.state as unknown as OrgMetrics) : null;
  }

  async getDeptRisk(tenantId: string, deptId: string): Promise<DeptRisk | null> {
    const p = await projectionStore.load(tenantId, 'dept_risk_heatmap', 'department', deptId);
    return p ? (p.state as unknown as DeptRisk) : null;
  }

  async getAllDeptRisks(tenantId: string) {
    const all = await projectionStore.listByProjection(tenantId, 'dept_risk_heatmap', { limit: 100 });
    return all.map(p => ({ department_id: p.aggregate_id, risk: p.state as unknown as DeptRisk }));
  }

  async getEmployeePerformance(tenantId: string, employeeId: string) {
    const p = await projectionStore.load(tenantId, 'employee_performance', 'employee', employeeId);
    return p?.state ?? null;
  }

  // Background job snapshots (time-series)
  async getTurnoverTrend(tenantId: string, opts?: { limit?: number }) {
    return this.snapshots.getTimeSeries(tenantId, 'turnover', { limit: opts?.limit ?? 12 });
  }

  async getHeadcountTrend(tenantId: string, opts?: { limit?: number }) {
    return this.snapshots.getTimeSeries(tenantId, 'headcount', { periodType: 'daily', limit: opts?.limit ?? 30 });
  }

  async getAbsenteeismTrend(tenantId: string, opts?: { limit?: number }) {
    return this.snapshots.getTimeSeries(tenantId, 'absenteeism', { limit: opts?.limit ?? 12 });
  }

  async getDisciplinaryPatterns(tenantId: string) {
    return this.snapshots.getLatest(tenantId, 'disciplinary_patterns');
  }

  async getPerformanceSummary(tenantId: string) {
    return this.snapshots.getLatest(tenantId, 'performance');
  }

  /** Full dashboard data. */
  async getDashboard(tenantId: string) {
    const [realtime, snapshots] = await Promise.all([
      this.getOrgMetrics(tenantId),
      this.snapshots.getDashboard(tenantId),
    ]);
    return { realtime, snapshots };
  }
}

// ── Singleton ──

let _queryInstance: OrganizationalIntelligenceQuery | null = null;

export function getOrganizationalIntelligence(): OrganizationalIntelligenceQuery {
  initOrganizationalIntelligenceEngine();
  if (!_queryInstance) _queryInstance = new OrganizationalIntelligenceQuery();
  return _queryInstance;
}
