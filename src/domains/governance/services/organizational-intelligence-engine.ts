/**
 * OrganizationalIntelligenceEngine
 *
 * Consumes employee lifecycle events from the GovernanceCoreEngine
 * and builds organizational intelligence projections:
 *
 *   - Turnover metrics
 *   - Disciplinary pattern detection
 *   - Headcount tracking
 *   - Risk heatmap by department
 *   - Performance trend analysis
 *
 * Pure read-model: no mutations, only projections built from events.
 */

import { onGovernanceEvent } from '../events/governance-event-bus';
import { GovernanceProjectionStore } from '../repositories/governance-projection-store';
import { EMPLOYEE_LIFECYCLE_EVENTS } from '../events/employee-lifecycle-events';
import type { GovernanceDomainEvent } from '../events/governance-domain-event';

const projectionStore = new GovernanceProjectionStore();

// ── Projection: Organizational Metrics ──

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

async function updateOrgMetrics(tenantId: string, update: (m: OrgMetrics) => void): Promise<void> {
  const existing = await projectionStore.load(tenantId, 'org_intelligence', 'org_metrics', 'global');
  const metrics: OrgMetrics = (existing?.state as unknown as OrgMetrics) ?? {
    total_hired: 0,
    total_terminated: 0,
    total_warned: 0,
    total_suspended: 0,
    active_headcount: 0,
    turnover_events: [],
    warning_events: [],
    last_updated: '',
  };

  update(metrics);
  metrics.last_updated = new Date().toISOString();

  // Trim arrays to last 200 entries
  if (metrics.turnover_events.length > 200) metrics.turnover_events = metrics.turnover_events.slice(-200);
  if (metrics.warning_events.length > 200) metrics.warning_events = metrics.warning_events.slice(-200);

  await projectionStore.save({
    tenant_id: tenantId,
    projection_name: 'org_intelligence',
    aggregate_type: 'org_metrics',
    aggregate_id: 'global',
    state: metrics as unknown as Record<string, unknown>,
    version: (existing?.version ?? 0) + 1,
    last_event_id: null,
  });
}

// ── Projection: Department Risk Heatmap ──

interface DeptRisk {
  warnings: number;
  suspensions: number;
  terminations: number;
  risk_score: number;
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
    tenant_id: tenantId,
    projection_name: 'dept_risk_heatmap',
    aggregate_type: 'department',
    aggregate_id: deptId,
    state: risk as unknown as Record<string, unknown>,
    version: (existing?.version ?? 0) + 1,
    last_event_id: null,
  });
}

// ── Event Handlers ──

function handleEvent(eventType: string, handler: (e: GovernanceDomainEvent) => Promise<void>) {
  onGovernanceEvent(eventType, (event) => {
    handler(event).catch(err => console.error(`[OrgIntelligence] Error handling ${eventType}:`, err));
  });
}

// ── Init ──

let _initialized = false;

export function initOrganizationalIntelligenceEngine(): void {
  if (_initialized) return;
  _initialized = true;

  // EmployeeHired
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeHired, async (e) => {
    const tenantId = e.metadata.tenant_id;
    await updateOrgMetrics(tenantId, m => {
      m.total_hired++;
      m.active_headcount++;
    });
  });

  // EmployeeWarned
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
    if (deptId) {
      await updateDeptRisk(tenantId, deptId, d => { d.warnings++; });
    }
  });

  // EmployeeSuspended
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.EmployeeSuspended, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    await updateOrgMetrics(tenantId, m => {
      m.total_suspended++;
    });

    const deptId = (p.departamento_id as string) ?? '';
    if (deptId) {
      await updateDeptRisk(tenantId, deptId, d => { d.suspensions++; });
    }
  });

  // EmployeeTerminated
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
    if (deptId) {
      await updateDeptRisk(tenantId, deptId, d => { d.terminations++; });
    }
  });

  // PerformanceReviewCompleted
  handleEvent(EMPLOYEE_LIFECYCLE_EVENTS.PerformanceReviewCompleted, async (e) => {
    const tenantId = e.metadata.tenant_id;
    const p = e.payload as Record<string, unknown>;
    const employeeId = (p.employee_id as string) ?? e.aggregate_id;

    const existing = await projectionStore.load(tenantId, 'employee_performance', 'employee', employeeId);
    const reviews = ((existing?.state?.reviews as unknown[]) ?? []) as Array<{
      type: string; score: number; date: string;
    }>;

    reviews.push({
      type: (p.review_type as string) ?? '',
      score: (p.score as number) ?? 0,
      date: e.occurred_at,
    });

    if (reviews.length > 20) reviews.splice(0, reviews.length - 20);

    const avgScore = reviews.reduce((s, r) => s + r.score, 0) / reviews.length;

    await projectionStore.save({
      tenant_id: tenantId,
      projection_name: 'employee_performance',
      aggregate_type: 'employee',
      aggregate_id: employeeId,
      state: { reviews, average_score: avgScore, total_reviews: reviews.length },
      version: (existing?.version ?? 0) + 1,
      last_event_id: e.id,
    });
  });
}

// ── Query API ──

export class OrganizationalIntelligenceQuery {
  async getOrgMetrics(tenantId: string): Promise<OrgMetrics | null> {
    const p = await projectionStore.load(tenantId, 'org_intelligence', 'org_metrics', 'global');
    return p ? (p.state as unknown as OrgMetrics) : null;
  }

  async getDeptRisk(tenantId: string, deptId: string): Promise<DeptRisk | null> {
    const p = await projectionStore.load(tenantId, 'dept_risk_heatmap', 'department', deptId);
    return p ? (p.state as unknown as DeptRisk) : null;
  }

  async getAllDeptRisks(tenantId: string): Promise<Array<{ department_id: string; risk: DeptRisk }>> {
    const all = await projectionStore.listByProjection(tenantId, 'dept_risk_heatmap', { limit: 100 });
    return all.map(p => ({
      department_id: p.aggregate_id,
      risk: p.state as unknown as DeptRisk,
    }));
  }

  async getEmployeePerformance(tenantId: string, employeeId: string) {
    const p = await projectionStore.load(tenantId, 'employee_performance', 'employee', employeeId);
    return p?.state ?? null;
  }
}

// ── Singleton ──

let _queryInstance: OrganizationalIntelligenceQuery | null = null;

export function getOrganizationalIntelligence(): OrganizationalIntelligenceQuery {
  initOrganizationalIntelligenceEngine();
  if (!_queryInstance) _queryInstance = new OrganizationalIntelligenceQuery();
  return _queryInstance;
}
