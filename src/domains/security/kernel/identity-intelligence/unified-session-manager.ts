/**
 * UnifiedSessionManager — Builds and CACHES the UnifiedIdentitySession and IdentitySnapshot.
 *
 * JWT stays simple (sub, email, user_type, platform_role).
 * The advanced session is computed client-side and cached in-memory with
 * version-based invalidation. No heavy data hits the token.
 *
 * Cache strategy:
 *   - In-memory LRU with version counter
 *   - Invalidated on: phase transition, workspace switch, impersonation change
 *   - TTL fallback: 30s max staleness
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import { dualIdentityEngine } from '../dual-identity-engine';
import { getAccessGraph } from '../access-graph';
import type { IdentityPhase, UserTypeDetection, RiskAssessment, RecentContext, WorkspaceEntry } from './types';
import type { IdentitySnapshot, UnifiedIdentitySession } from './types';

// ════════════════════════════════════
// CACHE CONFIG
// ════════════════════════════════════

const CACHE_TTL_MS = 30_000; // 30s max staleness

export interface SessionProjectionInput {
  phase: IdentityPhase;
  previousPhase: IdentityPhase | null;
  phaseChangedAt: number | null;
  userTypeDetection: UserTypeDetection | null;
  recentContexts: readonly RecentContext[];
  lastRisk: RiskAssessment;
  workspaces: WorkspaceEntry[];
}

interface CacheEntry<T> {
  value: T;
  version: number;
  builtAt: number;
  /** session_id key for cross-reference */
  sessionId: string | null;
}

export class UnifiedSessionManager {
  // ── Cache state ──
  private _version = 0;
  private _sessionCache: CacheEntry<UnifiedIdentitySession> | null = null;
  private _snapshotCache: CacheEntry<IdentitySnapshot> | null = null;
  /** session_id-keyed secondary cache for fast lookups across context switches */
  private _sessionIdCache = new Map<string, CacheEntry<UnifiedIdentitySession>>();
  private static readonly MAX_SESSION_CACHE_SIZE = 10;

  /**
   * Bump cache version — called by the orchestrator on every state change.
   */
  invalidate(): void {
    this._version++;
    // Don't clear cache eagerly — let next read rebuild lazily
  }

  /**
   * Current cache version (for diagnostics).
   */
  get cacheVersion(): number { return this._version; }

  /**
   * Check if a cache entry is still valid.
   */
  private _isValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
    if (!entry) return false;
    if (entry.version !== this._version) return false;
    if (Date.now() - entry.builtAt > CACHE_TTL_MS) return false;
    return true;
  }

  // ══════════════════════════════════
  // SESSION (cached)
  // ══════════════════════════════════

  /**
   * Get UnifiedIdentitySession — returns cached if valid, rebuilds otherwise.
   */
  getSession(input: SessionProjectionInput): UnifiedIdentitySession {
    // Check primary cache
    if (this._isValid(this._sessionCache)) {
      return this._sessionCache.value;
    }

    const session = this._buildSession(input);
    const sid = session.session_id;
    const entry: CacheEntry<UnifiedIdentitySession> = {
      value: session, version: this._version, builtAt: Date.now(), sessionId: sid,
    };

    this._sessionCache = entry;

    // Store in session_id-keyed secondary cache
    this._sessionIdCache.set(sid, entry);
    if (this._sessionIdCache.size > UnifiedSessionManager.MAX_SESSION_CACHE_SIZE) {
      // Evict oldest
      const firstKey = this._sessionIdCache.keys().next().value;
      if (firstKey) this._sessionIdCache.delete(firstKey);
    }

    return session;
  }

  /**
   * Get session by session_id — O(1) lookup from secondary cache.
   * Useful when restoring context without rebuilding.
   */
  getSessionById(sessionId: string): UnifiedIdentitySession | null {
    const entry = this._sessionIdCache.get(sessionId);
    if (!entry) return null;
    if (Date.now() - entry.builtAt > CACHE_TTL_MS) {
      this._sessionIdCache.delete(sessionId);
      return null;
    }
    return entry.value;
  }

  /**
   * Get IdentitySnapshot — returns cached if valid, rebuilds otherwise.
   */
  getSnapshot(input: SessionProjectionInput): IdentitySnapshot {
    if (this._isValid(this._snapshotCache)) {
      return this._snapshotCache.value;
    }
    const snapshot = this._buildSnapshot(input);
    this._snapshotCache = { value: snapshot, version: this._version, builtAt: Date.now(), sessionId: null };
    return snapshot;
  }

  /**
   * Force rebuild (bypass cache). Used for diagnostics.
   */
  buildSession(input: SessionProjectionInput): UnifiedIdentitySession {
    this.invalidate();
    return this.getSession(input);
  }

  buildSnapshot(input: SessionProjectionInput): IdentitySnapshot {
    this.invalidate();
    return this.getSnapshot(input);
  }

  /**
   * Clear all cached data (e.g., on logout).
   */
  clearCache(): void {
    this._sessionCache = null;
    this._snapshotCache = null;
    this._sessionIdCache.clear();
    this._version++;
  }

  // ══════════════════════════════════
  // BUILDERS (internal)
  // ══════════════════════════════════

  private _buildSession(input: SessionProjectionInput): UnifiedIdentitySession {
    const iblSession = identityBoundary.identity;
    const dual = dualIdentityEngine;
    const graph = getAccessGraph();
    const context = identityBoundary.operationalContext;
    const impersonation = dual.currentSession;
    const now = Date.now();

    const realUserId = iblSession?.userId ?? dual.realIdentity?.userId ?? '';
    const realEmail = iblSession?.email ?? dual.realIdentity?.email ?? null;

    const activeTenantId = context?.activeTenantId ?? null;
    const availableTenants = (iblSession?.tenantScopes ?? []).map(scope => ({
      tenant_id: scope.tenantId,
      tenant_name: scope.tenantName,
      role: scope.role,
      is_active: scope.tenantId === activeTenantId,
    }));

    const availableGroups: Array<{ group_id: string; tenant_id: string; inherited_from: 'tenant' | 'direct' }> = [];
    if (graph && activeTenantId) {
      for (const groupId of graph.getReachableGroups()) {
        availableGroups.push({ group_id: groupId, tenant_id: activeTenantId, inherited_from: 'tenant' });
      }
    }

    const activeContext = context ? {
      tenant_id: context.activeTenantId,
      tenant_name: context.activeTenantName,
      membership_role: context.membershipRole,
      effective_roles: context.effectiveRoles,
      scope_level: context.scopeLevel,
      group_id: context.activeGroupId,
      company_id: context.activeCompanyId,
      activated_at: context.activatedAt,
      // PXE fields — populated lazily by useIdentityIntelligence via enrichment
      active_plan: (context as any).activePlan ?? null,
      allowed_modules: (context as any).allowedModules ?? [],
    } : null;

    const impersonationState = impersonation ? {
      session_id: impersonation.id,
      real_user_id: impersonation.realIdentity.userId,
      target_tenant_id: impersonation.targetTenantId,
      target_tenant_name: impersonation.targetTenantName,
      simulated_role: impersonation.simulatedRole,
      reason: impersonation.reason,
      started_at: impersonation.startedAt,
      expires_at: impersonation.expiresAt,
      remaining_ms: dual.getRemainingMs(),
      operation_count: impersonation.operationCount,
    } : null;

    const realIdentityObj = {
      user_id: realUserId,
      email: realEmail,
      user_type: input.userTypeDetection?.detectedType ?? 'unknown' as const,
      platform_role: input.userTypeDetection?.platformRole ?? dual.realIdentity?.platformRole ?? null,
      detection: input.userTypeDetection,
      authenticated_at: iblSession?.authenticatedAt ?? dual.realIdentity?.authenticatedAt ?? 0,
    };

    // ── Build active_identity ──
    // During impersonation: active_identity is the simulated tenant persona
    // Normal mode: active_identity mirrors real_identity
    const isImpersonating = dual.isImpersonating;
    const activeIdentityObj = isImpersonating && impersonation
      ? {
          user_id: realUserId, // still the same physical user
          email: realEmail,
          user_type: 'tenant' as const, // SECURITY: impersonation = tenant view
          platform_role: null, // stripped during impersonation
          is_impersonated: true,
          tenant_id: impersonation.targetTenantId,
          tenant_role: impersonation.simulatedRole,
        }
      : {
          user_id: realIdentityObj.user_id,
          email: realIdentityObj.email,
          user_type: realIdentityObj.user_type,
          platform_role: realIdentityObj.platform_role,
          is_impersonated: false,
          tenant_id: activeContext?.tenant_id ?? null,
          tenant_role: activeContext?.membership_role ?? null,
        };

    return {
      session_id: iblSession?.sessionFingerprint ?? `anon_${now}`,
      phase: input.phase,
      real_identity: realIdentityObj,
      active_identity: activeIdentityObj,
      available_tenants: availableTenants,
      available_groups: availableGroups,
      recent_contexts: input.recentContexts,
      active_context: activeContext,
      impersonation_state: impersonationState,
      risk: input.lastRisk,
      established_at: iblSession?.authenticatedAt ?? 0,
      resolved_at: now,
    };
  }

  private _buildSnapshot(input: SessionProjectionInput): IdentitySnapshot {
    const iblSnapshot = identityBoundary.snapshot();
    const dual = dualIdentityEngine;
    const graph = getAccessGraph();
    const session = dual.currentSession;
    const context = identityBoundary.operationalContext;
    const now = Date.now();

    return {
      phase: input.phase,
      previousPhase: input.previousPhase,
      phaseChangedAt: input.phaseChangedAt,

      userId: iblSnapshot.userId ?? dual.realIdentity?.userId ?? null,
      email: dual.realIdentity?.email ?? null,
      userType: input.userTypeDetection?.detectedType === 'unknown'
        ? null
        : (input.userTypeDetection?.detectedType ?? dual.activeIdentity.userType ?? null),
      platformRole: input.userTypeDetection?.platformRole ?? dual.realIdentity?.platformRole ?? null,
      userTypeDetection: input.userTypeDetection,

      tenantId: context?.activeTenantId ?? iblSnapshot.activeTenantId ?? dual.activeIdentity.tenantId ?? null,
      tenantName: context?.activeTenantName ?? session?.targetTenantName ?? null,
      scopeLevel: context?.scopeLevel ?? iblSnapshot.scopeLevel ?? null,
      groupId: context?.activeGroupId ?? null,
      companyId: context?.activeCompanyId ?? null,
      effectiveRoles: context?.effectiveRoles ?? iblSnapshot.effectiveRoles,

      availableWorkspaces: input.workspaces,
      recentContexts: input.recentContexts,
      canSwitchWorkspace: input.workspaces.length > 1,

      isImpersonating: dual.isImpersonating,
      realIdentity: dual.realIdentity,
      activeIdentity: dual.activeIdentity,
      impersonationSession: session,
      impersonationRemainingMs: dual.getRemainingMs(),

      hasAccessGraph: iblSnapshot.hasAccessGraph,
      reachableCompanyCount: graph?.getReachableCompanies().size ?? 0,
      reachableGroupCount: graph?.getReachableGroups().size ?? 0,

      iblEstablished: iblSnapshot.hasIdentity,
      contextSwitchCount: iblSnapshot.switchCount,
      availableTenantCount: iblSnapshot.tenantCount,

      risk: input.lastRisk,
      resolvedAt: now,
    };
  }
}
