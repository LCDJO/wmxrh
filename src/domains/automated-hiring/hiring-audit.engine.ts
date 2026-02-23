/**
 * Automated Hiring — Auditoria Completa
 *
 * Append-only audit log for the hiring workflow.
 * Every step transition, decision, and action is recorded
 * with full traceability (who, when, what, why).
 *
 * Design:
 *   - Immutable: entries are never updated or deleted
 *   - Append-only: new events are always appended
 *   - Traceable: each entry links to workflow, step, user, and decision
 */

import type { HiringStep, HiringWorkflow } from './types';

// ═══════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════

export type AuditDecision =
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'blocked'
  | 'override'
  | 'cancelled'
  | 'retried'
  | 'auto_completed'
  | 'escalated'
  | 'info';

export interface HiringAuditEntry {
  id: string;
  workflow_id: string;
  tenant_id: string;
  step: HiringStep | 'workflow';
  action: string;
  decision: AuditDecision;
  reason: string | null;
  user_id: string;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

export interface CreateAuditEntryDTO {
  workflow_id: string;
  tenant_id: string;
  step: HiringStep | 'workflow';
  action: string;
  decision: AuditDecision;
  reason?: string | null;
  user_id: string;
  user_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditQueryFilters {
  workflow_id?: string;
  tenant_id?: string;
  step?: HiringStep | 'workflow';
  decision?: AuditDecision;
  user_id?: string;
  from?: string;
  to?: string;
}

export interface AuditTimeline {
  workflow_id: string;
  entries: HiringAuditEntry[];
  total: number;
  first_entry_at: string | null;
  last_entry_at: string | null;
}

// ═══════════════════════════════════════════════
//  In-Memory Append-Only Store
// ═══════════════════════════════════════════════

let _auditLog: HiringAuditEntry[] = [];
let _idCounter = 0;

function generateId(): string {
  _idCounter++;
  return `audit_${Date.now()}_${_idCounter}`;
}

// ═══════════════════════════════════════════════
//  Write Operations (append-only)
// ═══════════════════════════════════════════════

/**
 * Record a single audit entry. Immutable once created.
 */
export function recordAuditEntry(dto: CreateAuditEntryDTO): HiringAuditEntry {
  const entry: HiringAuditEntry = {
    id: generateId(),
    workflow_id: dto.workflow_id,
    tenant_id: dto.tenant_id,
    step: dto.step,
    action: dto.action,
    decision: dto.decision,
    reason: dto.reason ?? null,
    user_id: dto.user_id,
    user_name: dto.user_name ?? null,
    metadata: dto.metadata ?? null,
    timestamp: new Date().toISOString(),
  };

  _auditLog.push(Object.freeze(entry) as HiringAuditEntry);
  return entry;
}

/**
 * Record a workflow-level event (creation, cancellation, activation).
 */
export function recordWorkflowEvent(
  workflow: HiringWorkflow,
  action: string,
  decision: AuditDecision,
  userId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): HiringAuditEntry {
  return recordAuditEntry({
    workflow_id: workflow.id,
    tenant_id: workflow.tenant_id,
    step: 'workflow',
    action,
    decision,
    reason,
    user_id: userId,
    metadata: {
      status: workflow.status,
      current_step: workflow.current_step,
      ...metadata,
    },
  });
}

/**
 * Record a step-level transition event.
 */
export function recordStepTransition(
  workflow: HiringWorkflow,
  step: HiringStep,
  action: string,
  decision: AuditDecision,
  userId: string,
  reason?: string,
  metadata?: Record<string, unknown>,
): HiringAuditEntry {
  const stepState = workflow.steps.find(s => s.step === step);
  return recordAuditEntry({
    workflow_id: workflow.id,
    tenant_id: workflow.tenant_id,
    step,
    action,
    decision,
    reason,
    user_id: userId,
    metadata: {
      step_status: stepState?.status ?? 'unknown',
      ...metadata,
    },
  });
}

// ═══════════════════════════════════════════════
//  Read Operations
// ═══════════════════════════════════════════════

/**
 * Query audit entries with optional filters.
 */
export function queryAuditLog(filters: AuditQueryFilters = {}): HiringAuditEntry[] {
  return _auditLog.filter(entry => {
    if (filters.workflow_id && entry.workflow_id !== filters.workflow_id) return false;
    if (filters.tenant_id && entry.tenant_id !== filters.tenant_id) return false;
    if (filters.step && entry.step !== filters.step) return false;
    if (filters.decision && entry.decision !== filters.decision) return false;
    if (filters.user_id && entry.user_id !== filters.user_id) return false;
    if (filters.from && entry.timestamp < filters.from) return false;
    if (filters.to && entry.timestamp > filters.to) return false;
    return true;
  });
}

/**
 * Build a complete timeline for a workflow.
 */
export function getWorkflowTimeline(workflowId: string): AuditTimeline {
  const entries = queryAuditLog({ workflow_id: workflowId })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    workflow_id: workflowId,
    entries,
    total: entries.length,
    first_entry_at: entries[0]?.timestamp ?? null,
    last_entry_at: entries[entries.length - 1]?.timestamp ?? null,
  };
}

/**
 * Get all decisions made by a specific user.
 */
export function getUserDecisions(userId: string, tenantId?: string): HiringAuditEntry[] {
  return queryAuditLog({ user_id: userId, tenant_id: tenantId });
}

// ═══════════════════════════════════════════════
//  Reset (testing only)
// ═══════════════════════════════════════════════

export function resetAuditLog(): void {
  _auditLog = [];
  _idCounter = 0;
}
