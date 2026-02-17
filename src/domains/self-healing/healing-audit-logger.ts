/**
 * HealingAuditLogger — Append-only, immutable log of all self-healing actions.
 *
 * Each entry records:
 *  - action_type   (recovery action executed)
 *  - target_module (module_id affected)
 *  - triggered_by  ('auto' | 'manual')
 *  - executed_at   (timestamp)
 *  - result        (success | partial | failed | skipped)
 *
 * Entries are never modified or deleted (append-only).
 */

import type { HealingAuditEntry, RecoveryAction } from './types';

const MAX_ENTRIES = 500;

export type TriggerSource = 'auto' | 'manual';

export class HealingAuditLogger {
  private entries: HealingAuditEntry[] = [];

  log(incidentId: string, action: RecoveryAction, triggeredBy: TriggerSource = 'auto'): HealingAuditEntry {
    const entry: HealingAuditEntry = {
      id: `heal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      incident_id: incidentId,
      action_type: action.type,
      target_module: action.target_module,
      triggered_by: triggeredBy,
      result: action.result,
      executed_at: action.executed_at,
      duration_ms: action.duration_ms,
      metadata: { description: action.description, error: action.error },
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    return entry;
  }

  getAll(): HealingAuditEntry[] {
    return [...this.entries];
  }

  getForIncident(incidentId: string): HealingAuditEntry[] {
    return this.entries.filter(e => e.incident_id === incidentId);
  }

  getForModule(moduleId: string): HealingAuditEntry[] {
    return this.entries.filter(e => e.target_module === moduleId);
  }

  getByTrigger(triggeredBy: TriggerSource): HealingAuditEntry[] {
    return this.entries.filter(e => e.triggered_by === triggeredBy);
  }

  count(): number {
    return this.entries.length;
  }
}
