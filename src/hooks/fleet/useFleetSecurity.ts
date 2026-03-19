/**
 * useFleetSecurity — Security layer for Fleet module.
 *
 * Enforces:
 * 1. Access Graph filtering (only reachable companies/groups)
 * 2. Role-based visibility:
 *    - Gestor: sees only their managed team (employees in their scope)
 *    - RH (hr_manager, admin): sees all employees
 * 3. Mandatory audit logging for all fleet actions
 *
 * Integrates with SecurityKernel, AccessGraph and AuditSecurity.
 */
import { useCallback, useMemo } from 'react';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { supabase } from '@/integrations/supabase/client';
import type { TenantRole } from '@/domains/shared/types';

// ── Types ──

export type FleetAction =
  | 'fleet.view_dashboard'
  | 'fleet.view_live'
  | 'fleet.view_analytics'
  | 'fleet.view_behavior_profile'
  | 'fleet.manage_device'
  | 'fleet.issue_warning'
  | 'fleet.review_incident'
  | 'fleet.manage_rules'
  | 'fleet.export_data';

export interface FleetSecurityContext {
  /** User can access fleet module at all */
  hasAccess: boolean;
  /** User has full fleet visibility (RH/Admin) */
  isFullAccess: boolean;
  /** User is restricted to managed team only (Gestor) */
  isTeamOnly: boolean;
  /** Set of reachable company IDs from Access Graph */
  allowedCompanyIds: ReadonlySet<string>;
  /** Set of reachable group IDs from Access Graph */
  allowedGroupIds: ReadonlySet<string>;
  /** Whether user has tenant-wide scope */
  hasTenantScope: boolean;
  /** Current user's effective roles */
  roles: TenantRole[];
}

export interface FleetAuditPayload {
  action: FleetAction;
  entityType: string;
  entityId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

// ── Role classification ──

/** Roles with full fleet visibility */
const FULL_ACCESS_ROLES: TenantRole[] = ['admin', 'rh', 'owner', 'superadmin', 'tenant_admin'];

/** Roles restricted to their managed team/scope */
const TEAM_ONLY_ROLES: TenantRole[] = ['manager', 'gestor', 'viewer', 'company_admin'];

/** Roles that can manage fleet resources (devices, rules, warnings) */
const MANAGEMENT_ROLES: TenantRole[] = ['admin', 'rh', 'owner', 'manager', 'gestor'];

// ── Hook ──

export function useFleetSecurity() {
  const kernel = useSecurityKernel();
  const { accessGraph, effectiveRoles, securityContext, audit, hasRole, isAuthenticated } = kernel;

  // ── Security Context ──
  const fleetContext = useMemo((): FleetSecurityContext => {
    const isFullAccess = effectiveRoles.some(r => FULL_ACCESS_ROLES.includes(r));
    const isTeamOnly = !isFullAccess;
    const hasTenantScope = accessGraph?.hasTenantScope() ?? false;

    return {
      hasAccess: isAuthenticated && effectiveRoles.length > 0,
      isFullAccess,
      isTeamOnly,
      allowedCompanyIds: accessGraph?.getReachableCompanies() ?? new Set(),
      allowedGroupIds: accessGraph?.getReachableGroups() ?? new Set(),
      hasTenantScope,
      roles: effectiveRoles,
    };
  }, [effectiveRoles, accessGraph, isAuthenticated]);

  // ── Data Filtering ──

  /**
   * Filter an array of records by Access Graph visibility.
   * Records must have company_id and optionally company_group_id fields.
   */
  const filterByAccess = useCallback(<T extends { company_id?: string | null; company_group_id?: string | null }>(
    records: T[],
  ): T[] => {
    if (!fleetContext.hasAccess) return [];
    if (fleetContext.hasTenantScope || fleetContext.isFullAccess) return records;

    return records.filter(record => {
      if (record.company_id && fleetContext.allowedCompanyIds.has(record.company_id)) return true;
      if (record.company_group_id && fleetContext.allowedGroupIds.has(record.company_group_id)) return true;
      return false;
    });
  }, [fleetContext]);

  /**
   * Filter employees by team visibility.
   * - RH/Admin: sees all
   * - Gestor: sees only employees in reachable companies
   */
  const filterEmployees = useCallback(<T extends { company_id?: string | null; employee_id?: string | null }>(
    employees: T[],
  ): T[] => {
    if (!fleetContext.hasAccess) return [];
    if (fleetContext.isFullAccess) return employees;

    // Team-only: filter by reachable companies
    return employees.filter(emp => {
      if (emp.company_id && fleetContext.allowedCompanyIds.has(emp.company_id)) return true;
      return false;
    });
  }, [fleetContext]);

  /**
   * Check if a specific fleet action is allowed.
   */
  const canPerform = useCallback((action: FleetAction): boolean => {
    if (!fleetContext.hasAccess) return false;

    switch (action) {
      case 'fleet.view_dashboard':
      case 'fleet.view_live':
      case 'fleet.view_analytics':
      case 'fleet.view_behavior_profile':
        return true; // All authenticated fleet users can view

      case 'fleet.manage_device':
      case 'fleet.issue_warning':
      case 'fleet.review_incident':
      case 'fleet.manage_rules':
        return effectiveRoles.some(r => MANAGEMENT_ROLES.includes(r));

      case 'fleet.export_data':
        return fleetContext.isFullAccess;

      default:
        return false;
    }
  }, [fleetContext, effectiveRoles]);

  // ── Audit Logging ──

  /**
   * Log a fleet action to the audit trail.
   * MANDATORY for all write operations.
   */
  const logAction = useCallback(async (payload: FleetAuditPayload): Promise<void> => {
    const userId = securityContext?.user_id;
    const tenantId = securityContext?.tenant_id;

    if (!userId || !tenantId) {
      console.warn('[FleetSecurity] Cannot log action: missing security context');
      return;
    }

    // Log via SecurityKernel audit service
    audit.logAccessAllowed({
      resource: payload.entityType,
      action: payload.action,
      metadata: {
        ...payload.metadata,
        fleet_module: true,
        details: payload.details,
        roles: effectiveRoles,
        scope: fleetContext.hasTenantScope ? 'tenant' : 'restricted',
        allowed_companies: Array.from(fleetContext.allowedCompanyIds).slice(0, 10),
      },
    });

    // Also persist to fleet_audit_log table
    try {
      await (supabase.from as any)('fleet_audit_log').insert({
        tenant_id: tenantId,
        entity_type: payload.entityType,
        entity_id: payload.entityId ?? null,
        action: payload.action,
        actor_id: userId,
        actor_type: 'user',
        old_value: null,
        new_value: payload.metadata ?? null,
        integrity_hash: generateIntegrityHash(tenantId, userId, payload.action, Date.now()),
        metadata: {
          details: payload.details,
          roles: effectiveRoles,
          ip: null, // server-side only
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('[FleetSecurity] Audit log insert failed:', err);
    }
  }, [securityContext, audit, effectiveRoles, fleetContext]);

  /**
   * Wrap a mutation with mandatory audit logging.
   * Returns a higher-order function that logs before and after execution.
   */
  const withAudit = useCallback(
    <TArgs extends unknown[], TResult>(
      action: FleetAction,
      entityType: string,
      fn: (...args: TArgs) => Promise<TResult>,
    ) => {
      return async (...args: TArgs): Promise<TResult> => {
        // Pre-action check
        if (!canPerform(action)) {
          await logAction({
            action,
            entityType,
            details: 'ACCESS_DENIED: Insufficient permissions',
            metadata: { attempted_args: args.length },
          });
          throw new Error(`Permissão negada: ${action}`);
        }

        // Log attempt
        await logAction({
          action,
          entityType,
          details: `Ação iniciada: ${action}`,
          metadata: { phase: 'start' },
        });

        try {
          const result = await fn(...args);

          // Log success
          await logAction({
            action,
            entityType,
            details: `Ação concluída: ${action}`,
            metadata: { phase: 'success' },
          });

          return result;
        } catch (error) {
          // Log failure
          await logAction({
            action,
            entityType,
            details: `Ação falhou: ${action} — ${error instanceof Error ? error.message : 'unknown'}`,
            metadata: { phase: 'error' },
          });
          throw error;
        }
      };
    },
    [canPerform, logAction],
  );

  return {
    // Context
    fleetContext,
    isAuthenticated,

    // Filtering
    filterByAccess,
    filterEmployees,

    // Authorization
    canPerform,
    hasRole,

    // Audit
    logAction,
    withAudit,

    // Raw kernel access
    kernel,
  };
}

// ── Integrity hash (simple client-side; real hash should be server-side) ──

function generateIntegrityHash(tenantId: string, userId: string, action: string, ts: number): string {
  const raw = `${tenantId}:${userId}:${action}:${ts}`;
  // Simple hash for client-side (real production should use HMAC on server)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit int
  }
  return `flthash_${Math.abs(hash).toString(36)}_${ts.toString(36)}`;
}
