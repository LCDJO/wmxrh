/**
 * Safety Automation Audit Log — Service
 *
 * Legal compliance: append-only log of every workflow action.
 * No updates or deletes are permitted (enforced by RLS + no policies for UPDATE/DELETE).
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { onSafetyEvent, type SafetyAutomationEvent } from './events';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface SafetyAuditLogEntry {
  id: string;
  tenant_id: string;
  workflow_id: string | null;
  action: string;
  executor: 'system' | 'user';
  executor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════
// WRITE (append-only)
// ═══════════════════════════════════════════════════════

export async function logSafetyAuditAction(
  tenantId: string,
  action: string,
  executor: 'system' | 'user' = 'system',
  opts?: {
    workflowId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string | null> {
  const { data, error } = await supabase.rpc('log_safety_automation_action', {
    p_tenant_id: tenantId,
    p_workflow_id: opts?.workflowId ?? null,
    p_action: action,
    p_executor: executor,
    p_entity_type: opts?.entityType ?? null,
    p_entity_id: opts?.entityId ?? null,
    p_metadata: (opts?.metadata ?? {}) as unknown as Json,
  });

  if (error) {
    console.error('[SafetyAuditLog] Failed to log:', error.message);
    return null;
  }
  return data as string;
}

// ═══════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════

export async function fetchSafetyAuditLog(
  tenantId: string,
  opts?: { workflowId?: string; limit?: number; action?: string },
): Promise<SafetyAuditLogEntry[]> {
  let q = supabase
    .from('safety_automation_audit_log' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (opts?.workflowId) q = q.eq('workflow_id', opts.workflowId);
  if (opts?.action) q = q.eq('action', opts.action);
  q = q.limit(opts?.limit ?? 100);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SafetyAuditLogEntry[];
}

// ═══════════════════════════════════════════════════════
// AUTO-BRIDGE: Domain Events → Audit Log
// ═══════════════════════════════════════════════════════

/**
 * Subscribe to all SafetyAutomation domain events and
 * persist them as immutable audit log entries.
 */
export function startAuditLogBridge(): () => void {
  return onSafetyEvent((event: SafetyAutomationEvent) => {
    const tenantId = event.tenant_id;

    switch (event.type) {
      case 'SafetySignalReceived':
        logSafetyAuditAction(tenantId, 'signal_received', 'system', {
          entityType: event.entity_type,
          entityId: event.entity_id,
          metadata: { source: event.source, severity: event.severity, signal_id: event.signal_id },
        });
        break;

      case 'SafetyRuleMatched':
        logSafetyAuditAction(tenantId, 'rule_matched', 'system', {
          metadata: { signal_id: event.signal_id, rule_id: event.rule_id, rule_name: event.rule_name },
        });
        break;

      case 'SafetyActionExecuted':
        logSafetyAuditAction(tenantId, 'action_executed', 'system', {
          entityType: event.action_type,
          entityId: event.created_entity_id ?? undefined,
          metadata: { signal_id: event.signal_id, rule_id: event.rule_id, status: event.status },
        });
        break;

      case 'SafetyExecutionCompleted':
        logSafetyAuditAction(tenantId, 'execution_completed', 'system', {
          metadata: {
            execution_id: event.execution_id,
            signal_id: event.signal_id,
            rule_id: event.rule_id,
            status: event.status,
            actions_total: event.actions_total,
            actions_succeeded: event.actions_succeeded,
            actions_failed: event.actions_failed,
            duration_ms: event.duration_ms,
          },
        });
        break;

      case 'SafetyEscalationTriggered':
        logSafetyAuditAction(tenantId, 'escalation_triggered', 'system', {
          metadata: { signal_id: event.signal_id, level: event.escalation_level, reason: event.reason },
        });
        break;

      case 'SafetyEmployeeBlocked':
        logSafetyAuditAction(tenantId, 'employee_blocked', 'system', {
          entityType: 'employee',
          entityId: event.employee_id,
          metadata: { signal_id: event.signal_id, blocking_level: event.blocking_level, reason: event.reason },
        });
        break;
    }
  });
}
