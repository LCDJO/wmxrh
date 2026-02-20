/**
 * Safety Automation — Security Layer
 *
 * 1. Automatic creation of safety events via domain events
 * 2. Access controlled by Access Graph (tenant + role checks)
 * 3. Mandatory audit logging for every automation action
 *
 * SECURITY INVARIANT: All mutations are scoped by tenant_id
 * and validated against the user's effective roles.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { onSafetyEvent, type SafetyAutomationEvent } from './events';

// ═══════════════════════════════════════════════════════
// ACCESS GRAPH — Role-based access control
// ═══════════════════════════════════════════════════════

/** Roles that can VIEW safety automation data */
const SAFETY_VIEW_ROLES = [
  'owner', 'admin', 'superadmin', 'tenant_admin', 'rh',
  'gestor', 'group_admin', 'company_admin',
] as const;

/** Roles that can EXECUTE safety automation actions */
const SAFETY_EXECUTE_ROLES = [
  'owner', 'admin', 'superadmin', 'tenant_admin', 'rh',
] as const;

/** Roles that can CONFIGURE automation rules */
const SAFETY_ADMIN_ROLES = [
  'owner', 'admin', 'superadmin', 'tenant_admin',
] as const;

export type SafetyAccessLevel = 'view' | 'execute' | 'admin';

export interface SafetyAccessResult {
  allowed: boolean;
  level: SafetyAccessLevel;
  userId: string | null;
  tenantId: string;
  reason: string;
}

/**
 * Check if the current user has a given access level for safety automation.
 * Uses the Access Graph pattern: user_roles → role → allowed_actions.
 */
export async function checkSafetyAccess(
  tenantId: string,
  requiredLevel: SafetyAccessLevel,
): Promise<SafetyAccessResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, level: requiredLevel, userId: null, tenantId, reason: 'Not authenticated' };
  }

  const allowedRoles =
    requiredLevel === 'admin' ? SAFETY_ADMIN_ROLES :
    requiredLevel === 'execute' ? SAFETY_EXECUTE_ROLES :
    SAFETY_VIEW_ROLES;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId);

  const userRoles = (roles ?? []).map(r => r.role);
  const hasAccess = userRoles.some(r => (allowedRoles as readonly string[]).includes(r));

  const result: SafetyAccessResult = {
    allowed: hasAccess,
    level: requiredLevel,
    userId: user.id,
    tenantId,
    reason: hasAccess ? 'Access granted via role match' : `No matching role for level '${requiredLevel}'`,
  };

  // Log access check
  await logSecurityEvent(tenantId, {
    action: 'safety_access_check',
    userId: user.id,
    level: requiredLevel,
    allowed: hasAccess,
    roles: userRoles,
  });

  return result;
}

// ═══════════════════════════════════════════════════════
// MANDATORY AUDIT LOGGING
// ═══════════════════════════════════════════════════════

export interface SafetyAuditEntry {
  action: string;
  userId?: string | null;
  level?: SafetyAccessLevel;
  allowed?: boolean;
  roles?: string[];
  signalId?: string;
  ruleId?: string;
  entityType?: string;
  entityId?: string;
  severity?: string;
  executionId?: string;
  actionType?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persist a security/audit event to the audit_logs table.
 * Every safety automation action MUST call this.
 */
export async function logSecurityEvent(
  tenantId: string,
  entry: SafetyAuditEntry,
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert([{
      tenant_id: tenantId,
      action: `safety_security:${entry.action}`,
      entity_type: entry.entityType ?? 'safety_automation',
      entity_id: entry.entityId ?? null,
      user_id: entry.userId ?? null,
      metadata: {
        ...entry.metadata,
        level: entry.level,
        allowed: entry.allowed,
        roles: entry.roles,
        signal_id: entry.signalId,
        rule_id: entry.ruleId,
        severity: entry.severity,
        execution_id: entry.executionId,
        action_type: entry.actionType,
        status: entry.status,
        logged_at: new Date().toISOString(),
      } as unknown as Json,
    }]);
  } catch (err) {
    console.error('[SafetySecurity] Failed to log audit event:', err);
  }
}

// ═══════════════════════════════════════════════════════
// AUTOMATIC EVENT-DRIVEN CREATION
// ═══════════════════════════════════════════════════════

/**
 * Start listening to SafetyAutomationEvents and automatically
 * log them as security audit entries. This creates the mandatory
 * audit trail for all automation actions.
 *
 * Returns an unsubscribe function.
 */
export function startSecurityEventBridge(): () => void {
  return onSafetyEvent((event: SafetyAutomationEvent) => {
    const tenantId = event.tenant_id;

    switch (event.type) {
      case 'SafetySignalReceived':
        logSecurityEvent(tenantId, {
          action: 'signal_received',
          signalId: event.signal_id,
          entityType: event.entity_type,
          entityId: event.entity_id,
          severity: event.severity,
          metadata: { source: event.source },
        });
        break;

      case 'SafetyRuleMatched':
        logSecurityEvent(tenantId, {
          action: 'rule_matched',
          signalId: event.signal_id,
          ruleId: event.rule_id,
          metadata: { rule_name: event.rule_name, action_count: event.action_count },
        });
        break;

      case 'SafetyActionExecuted':
        logSecurityEvent(tenantId, {
          action: 'action_executed',
          signalId: event.signal_id,
          ruleId: event.rule_id,
          actionType: event.action_type,
          status: event.status,
          entityId: event.created_entity_id ?? undefined,
        });
        break;

      case 'SafetyExecutionCompleted':
        logSecurityEvent(tenantId, {
          action: 'execution_completed',
          signalId: event.signal_id,
          ruleId: event.rule_id,
          executionId: event.execution_id,
          status: event.status,
          metadata: {
            actions_total: event.actions_total,
            actions_succeeded: event.actions_succeeded,
            actions_failed: event.actions_failed,
            duration_ms: event.duration_ms,
          },
        });
        break;

      case 'SafetyEscalationTriggered':
        logSecurityEvent(tenantId, {
          action: 'escalation_triggered',
          signalId: event.signal_id,
          severity: 'high',
          metadata: {
            escalation_level: event.escalation_level,
            reason: event.reason,
          },
        });
        break;

      case 'SafetyEmployeeBlocked':
        logSecurityEvent(tenantId, {
          action: 'employee_blocked',
          entityType: 'employee',
          entityId: event.employee_id,
          signalId: event.signal_id,
          severity: 'critical',
          metadata: {
            blocking_level: event.blocking_level,
            reason: event.reason,
          },
        });
        break;
    }
  });
}

// ═══════════════════════════════════════════════════════
// GUARDED OPERATIONS
// ═══════════════════════════════════════════════════════

/**
 * Execute a safety automation operation only if the user
 * has the required access level. Logs both the access check
 * and the operation result.
 */
export async function guardedSafetyOperation<T>(
  tenantId: string,
  requiredLevel: SafetyAccessLevel,
  operationName: string,
  operation: () => Promise<T>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const access = await checkSafetyAccess(tenantId, requiredLevel);

  if (!access.allowed) {
    await logSecurityEvent(tenantId, {
      action: `blocked:${operationName}`,
      userId: access.userId,
      level: requiredLevel,
      allowed: false,
      metadata: { reason: access.reason },
    });
    return { success: false, error: access.reason };
  }

  try {
    const result = await operation();

    await logSecurityEvent(tenantId, {
      action: `success:${operationName}`,
      userId: access.userId,
      level: requiredLevel,
      allowed: true,
      status: 'success',
    });

    return { success: true, data: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await logSecurityEvent(tenantId, {
      action: `error:${operationName}`,
      userId: access.userId,
      level: requiredLevel,
      allowed: true,
      status: 'error',
      metadata: { error: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}
