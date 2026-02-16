/**
 * IdentityOrchestrator — Unified identity state for the POSL.
 *
 * Unifies four identity layers into a single OperationalIdentitySnapshot:
 *
 *   1. Platform Identity  → platform_role, is_platform_admin
 *   2. Tenant Identity    → tenant_id, tenant_role, scope, group, company
 *   3. Dual Identity      → impersonation session state
 *   4. UnifiedIdentitySession → IIL session (phase, risk, workspaces)
 *
 * SECURITY: This is a READ-ONLY facade. It does NOT create or
 * modify identity — it only reads from the Security Kernel.
 */

import type {
  IdentityOrchestratorAPI,
  OperationalIdentitySnapshot,
  GlobalEventKernelAPI,
} from './types';

// ── Security Kernel sources ──────────────────────────────────
import { identityBoundary } from '@/domains/security/kernel/identity-boundary';
import { dualIdentityEngine } from '@/domains/security/kernel/dual-identity-engine';
import { getAccessGraph } from '@/domains/security/kernel/access-graph';
import { identityIntelligence } from '@/domains/security/kernel/identity-intelligence';

type IdentityChangeHandler = (snapshot: OperationalIdentitySnapshot) => void;

export function createIdentityOrchestrator(events: GlobalEventKernelAPI): IdentityOrchestratorAPI {
  const listeners = new Set<IdentityChangeHandler>();

  // ── Build snapshot from all four identity layers ──────────

  function buildSnapshot(): OperationalIdentitySnapshot {
    const now = Date.now();
    const ibl = identityBoundary;
    const dual = dualIdentityEngine;
    const graph = getAccessGraph();
    const iblSnapshot = ibl.snapshot();
    const context = ibl.operationalContext;
    const impersonation = dual.currentSession;

    // IIL session (if available)
    let iilPhase: OperationalIdentitySnapshot['phase'] = 'idle';
    let userType: OperationalIdentitySnapshot['user_type'] = 'unknown';
    let platformRole: string | null = null;
    let riskLevel: OperationalIdentitySnapshot['risk_level'] = 'low';
    let riskScore = 0;
    let sessionId: string | null = null;

    try {
      const iilSnapshot = identityIntelligence.snapshot();
      if (iilSnapshot) {
        iilPhase = iilSnapshot.phase ?? 'idle';
        userType = iilSnapshot.userType ?? 'unknown';
        platformRole = iilSnapshot.platformRole ?? null;
        riskLevel = iilSnapshot.risk?.level ?? 'low';
        riskScore = iilSnapshot.risk?.score ?? 0;
      }
    } catch {
      // IIL not yet initialized — degrade gracefully
    }

    try {
      const iilSession = identityIntelligence.unifiedSession();
      if (iilSession) {
        sessionId = iilSession.session_id;
      }
    } catch {
      // IIL not yet initialized
    }

    // ── Platform layer
    const userId = iblSnapshot.userId ?? dual.realIdentity?.userId ?? null;
    const email = dual.realIdentity?.email ?? null;
    const isAuthenticated = !!userId;
    const isPlatformAdmin = userType === 'platform' || !!platformRole;

    // ── Tenant layer
    const currentTenantId = context?.activeTenantId ?? iblSnapshot.activeTenantId ?? null;
    const currentTenantName = context?.activeTenantName ?? null;
    const tenantRole = context?.membershipRole ?? null;
    const effectiveRoles = context?.effectiveRoles ?? iblSnapshot.effectiveRoles ?? [];
    const scopeLevel = context?.scopeLevel ?? iblSnapshot.scopeLevel ?? null;
    const currentGroupId = context?.activeGroupId ?? null;
    const currentCompanyId = context?.activeCompanyId ?? null;

    // ── Dual identity
    const isImpersonating = dual.isImpersonating;
    const impersonationData = isImpersonating && impersonation
      ? {
          real_user_id: impersonation.realIdentity.userId,
          target_tenant_id: impersonation.targetTenantId,
          simulated_role: impersonation.simulatedRole,
          reason: impersonation.reason,
          remaining_ms: dual.getRemainingMs(),
          operation_count: impersonation.operationCount,
        }
      : null;

    // ── Workspaces
    const identity = ibl.identity;
    const availableTenants = (identity?.tenantScopes ?? []).map(scope => ({
      tenant_id: scope.tenantId,
      tenant_name: scope.tenantName,
      role: scope.role,
      is_active: scope.tenantId === currentTenantId,
    }));

    const availableGroups: Array<{ group_id: string; tenant_id: string }> = [];
    if (graph && currentTenantId) {
      for (const groupId of graph.getReachableGroups()) {
        availableGroups.push({ group_id: groupId, tenant_id: currentTenantId });
      }
    }

    // If impersonating, override user_type and phase
    const finalPhase = isImpersonating ? 'impersonating' : iilPhase;
    const finalUserType = isImpersonating ? 'tenant' as const : userType;

    return {
      user_id: userId,
      email,
      is_authenticated: isAuthenticated,
      phase: finalPhase,

      is_platform_admin: isPlatformAdmin && !isImpersonating,
      platform_role: isImpersonating ? null : platformRole,
      user_type: finalUserType,

      current_tenant_id: currentTenantId,
      current_tenant_name: currentTenantName,
      tenant_role: tenantRole,
      effective_roles: effectiveRoles,
      scope_level: scopeLevel,
      current_group_id: currentGroupId,
      current_company_id: currentCompanyId,

      is_impersonating: isImpersonating,
      impersonation: impersonationData,

      available_tenants: availableTenants,
      available_groups: availableGroups,
      can_switch_workspace: availableTenants.length > 1,

      has_access_graph: iblSnapshot.hasAccessGraph,
      reachable_company_count: graph?.getReachableCompanies().size ?? 0,
      reachable_group_count: graph?.getReachableGroups().size ?? 0,

      risk_level: riskLevel,
      risk_score: riskScore,

      resolved_at: now,
      session_id: sessionId,
    };
  }

  // ── Notify listeners ─────────────────────────────────────────

  function notifyListeners(): void {
    const snap = buildSnapshot();
    listeners.forEach(fn => {
      try { fn(snap); } catch (err) { console.error('[IdentityOrchestrator] listener error:', err); }
    });
  }

  // ── Public API ───────────────────────────────────────────────

  function snapshot(): OperationalIdentitySnapshot {
    return buildSnapshot();
  }

  async function refresh(): Promise<void> {
    events.emit('identity:refresh_requested', 'IdentityOrchestrator', {});
    // Notify listeners with fresh snapshot
    notifyListeners();
  }

  function onIdentityChange(handler: IdentityChangeHandler): () => void {
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function isAuthenticated(): boolean {
    return buildSnapshot().is_authenticated;
  }

  function isImpersonating(): boolean {
    return dualIdentityEngine.isImpersonating;
  }

  function currentPhase(): string {
    return buildSnapshot().phase;
  }

  // ── Listen for identity updates from event kernel ────────────

  events.on('identity:updated', () => notifyListeners());
  events.on('ibl:ContextSwitched', () => notifyListeners());
  events.on('iil:PhaseTransition', () => notifyListeners());
  events.on('iil:WorkspaceSwitched', () => notifyListeners());

  return {
    snapshot,
    refresh,
    onIdentityChange,
    isAuthenticated,
    isImpersonating,
    currentPhase,
  };
}
