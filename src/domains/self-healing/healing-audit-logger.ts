/**
 * HealingAuditLogger — Immutable log of all self-healing actions.
 */

import type { HealingAuditEntry, RecoveryAction } from './types';

const MAX_ENTRIES = 500;

export class HealingAuditLogger {
  private entries: HealingAuditEntry[] = [];

  log(incidentId: string, action: RecoveryAction): HealingAuditEntry {
    const entry: HealingAuditEntry = {
      id: `heal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      incident_id: incidentId,
      action_type: action.type,
      target_module: action.target_module,
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
}
