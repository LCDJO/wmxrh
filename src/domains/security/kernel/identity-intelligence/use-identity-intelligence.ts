/**
 * useIdentityIntelligence — React Hook
 *
 * Reactive hook that exposes both the UnifiedIdentitySession (primary API)
 * and the full IdentitySnapshot (diagnostic) from the Identity Intelligence Layer.
 *
 * PXE Integration: enriches active_context with active_plan + allowed_modules.
 *
 * PERFORMANCE: Plan + modules are resolved ONCE per login / context-switch
 * and cached in a module-level store. Re-renders do NOT trigger re-fetches.
 */

import { useSyncExternalStore, useCallback, useMemo, useEffect, useRef } from 'react';
import { identityIntelligence } from './identity-intelligence.service';
import { supabase } from '@/integrations/supabase/client';
import type {
  IdentitySnapshot,
  UnifiedIdentitySession,
  IntelligenceDecision,
  IdentityPhase,
  RiskAssessment,
  WorkspaceEntry,
  RecentContext,
  UserTypeDetection,
  ActiveContext,
  ActivePlanInfo,
  TenantWorkspace,
} from './types';

// ── Module-level PXE cache ─────────────────────────────────────────
// Resolved once per tenant context switch; never re-fetched on re-render.

interface PxeCache {
  tenantId: string;
  planInfo: ActivePlanInfo | null;
  allowedModules: readonly string[];
  /** Monotonic version to trigger React updates */
  version: number;
}

let pxeCache: PxeCache = {
  tenantId: '',
  planInfo: null,
  allowedModules: [],
  version: 0,
};

let pxeFetchInFlight: string | null = null;
let pxeListeners: Set<() => void> = new Set();

function notifyPxe() {
  pxeCache = { ...pxeCache, version: pxeCache.version + 1 };
  pxeListeners.forEach(fn => fn());
}

/**
 * Resolve plan + modules for a tenant. Called ONLY on login / context switch.
 */
async function resolvePxe(tenantId: string): Promise<void> {
  if (!tenantId) {
    if (pxeCache.tenantId !== '') {
      pxeCache = { tenantId: '', planInfo: null, allowedModules: [], version: pxeCache.version + 1 };
      notifyPxe();
    }
    return;
  }

  // Already resolved for this tenant — skip
  if (pxeCache.tenantId === tenantId) return;

  // Deduplicate in-flight requests
  if (pxeFetchInFlight === tenantId) return;
  pxeFetchInFlight = tenantId;

  try {
    const [planRes, modulesRes] = await Promise.all([
      supabase
        .from('tenant_plans')
        .select('id, plan_id, status, billing_cycle')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle(),
      (supabase
        .from('tenant_module_access' as any)
        .select('module_key')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)) as any,
    ]);

    // If tenant changed while we were fetching, discard stale result
    if (pxeFetchInFlight !== tenantId) return;

    const planInfo: ActivePlanInfo | null = planRes.data
      ? {
          plan_id: (planRes.data as any).plan_id,
          plan_name: (planRes.data as any).plan_id,
          tier: 'active',
          status: (planRes.data as any).status,
          billing_cycle: (planRes.data as any).billing_cycle,
        }
      : null;

    const allowedModules: string[] = ((modulesRes as any).data ?? []).map((m: any) => m.module_key);

    pxeCache = { tenantId, planInfo, allowedModules, version: pxeCache.version + 1 };
    notifyPxe();
  } finally {
    if (pxeFetchInFlight === tenantId) pxeFetchInFlight = null;
  }
}

/** Force invalidation — call on logout */
function invalidatePxe() {
  pxeCache = { tenantId: '', planInfo: null, allowedModules: [], version: pxeCache.version + 1 };
  pxeFetchInFlight = null;
  notifyPxe();
}

// ── useSyncExternalStore for PXE ──────────────────────────────────

function subscribePxe(cb: () => void) {
  pxeListeners.add(cb);
  return () => { pxeListeners.delete(cb); };
}

function getPxeSnapshot() { return pxeCache; }

// ═══════════════════════════════════════════════════════════════════

export interface UseIdentityIntelligenceReturn {
  /** Primary API — clean, focused session object */
  session: UnifiedIdentitySession;

  /** Full diagnostic snapshot (superset of session) */
  snapshot: IdentitySnapshot;

  /** Current identity phase */
  phase: IdentityPhase;

  /** Current risk assessment */
  risk: RiskAssessment;

  /** Quick boolean checks */
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isScoped: boolean;
  isImpersonating: boolean;

  /** User type detection */
  isPlatformUser: boolean;
  isTenantUser: boolean;
  userTypeDetection: UserTypeDetection | null;

  /** Active context (from UnifiedIdentitySession) */
  activeContext: ActiveContext | null;

  /** Workspace management */
  availableTenants: readonly TenantWorkspace[];
  availableWorkspaces: readonly WorkspaceEntry[];
  recentContexts: readonly RecentContext[];
  canSwitchWorkspace: boolean;
  switchWorkspace: (tenantId: string) => boolean;
  restoreLastWorkspace: () => string | null;

  /** Evaluate an action/resource against the decision engine */
  evaluate: (action?: string, resource?: string) => IntelligenceDecision;

  /** Manually sync phase from subsystem state */
  syncPhase: () => IdentityPhase;

  /** Debug info */
  debug: () => ReturnType<typeof identityIntelligence.debug>;
}

// ── Identity store subscription ───────────────────────────────────

function subscribe(onStoreChange: () => void): () => void {
  return identityIntelligence.onSnapshotChange(onStoreChange);
}

let cachedVersion = 0;
let lastVersion = -1;

interface CachedState {
  snapshot: IdentitySnapshot;
  session: UnifiedIdentitySession;
}

let cachedState: CachedState | null = null;

function getState(): CachedState {
  if (!cachedState || cachedVersion !== lastVersion) {
    cachedState = {
      snapshot: identityIntelligence.snapshot(),
      session: identityIntelligence.unifiedSession(),
    };
    lastVersion = cachedVersion;
  }
  return cachedState;
}

const originalSubscribe = subscribe;
function subscribeBump(onStoreChange: () => void): () => void {
  return originalSubscribe(() => {
    cachedVersion++;
    cachedState = null;
    onStoreChange();
  });
}

// ═══════════════════════════════════════════════════════════════════

export function useIdentityIntelligence(): UseIdentityIntelligenceReturn {
  const state = useSyncExternalStore(subscribeBump, getState, getState);
  const pxe = useSyncExternalStore(subscribePxe, getPxeSnapshot, getPxeSnapshot);

  // ── Trigger PXE resolution ONLY on context switch ──
  const tenantId = state.session.active_context?.tenant_id ?? '';
  const prevTenantRef = useRef('');

  useEffect(() => {
    if (tenantId !== prevTenantRef.current) {
      prevTenantRef.current = tenantId;
      resolvePxe(tenantId);
    }
  }, [tenantId]);

  // Invalidate PXE on logout (phase goes to anonymous)
  useEffect(() => {
    if (state.session.phase === 'anonymous') {
      invalidatePxe();
    }
  }, [state.session.phase]);

  // ── Enrich active_context with cached PXE data (no fetch) ──
  const enrichedContext: ActiveContext | null = useMemo(() => {
    const ctx = state.session.active_context;
    if (!ctx) return null;
    return {
      ...ctx,
      active_plan: pxe.tenantId === ctx.tenant_id ? pxe.planInfo : null,
      allowed_modules: pxe.tenantId === ctx.tenant_id ? pxe.allowedModules : [],
    };
  }, [state.session.active_context, pxe]);

  const evaluate = useCallback(
    (action?: string, resource?: string) => identityIntelligence.evaluate(action, resource),
    [],
  );

  const syncPhase = useCallback(() => identityIntelligence.syncPhase(), []);
  const debug = useCallback(() => identityIntelligence.debug(), []);

  const switchWorkspace = useCallback(
    (tenantId: string) => identityIntelligence.switchWorkspace(tenantId, 'explicit'),
    [],
  );

  const restoreLastWorkspace = useCallback(
    () => identityIntelligence.restoreLastWorkspace(),
    [],
  );

  return useMemo(() => ({
    session: state.session,
    snapshot: state.snapshot,
    phase: state.session.phase,
    risk: state.session.risk,
    isAnonymous: state.session.phase === 'anonymous',
    isAuthenticated: state.session.phase === 'authenticated',
    isScoped: state.session.phase === 'scoped',
    isImpersonating: state.session.phase === 'impersonating',
    isPlatformUser: state.session.real_identity.user_type === 'platform',
    isTenantUser: state.session.real_identity.user_type === 'tenant',
    userTypeDetection: state.session.real_identity.detection,
    activeContext: enrichedContext,
    availableTenants: state.session.available_tenants,
    availableWorkspaces: state.snapshot.availableWorkspaces,
    recentContexts: state.session.recent_contexts,
    canSwitchWorkspace: state.session.available_tenants.length > 1,
    switchWorkspace,
    restoreLastWorkspace,
    evaluate,
    syncPhase,
    debug,
  }), [state, enrichedContext, evaluate, syncPhase, debug, switchWorkspace, restoreLastWorkspace]);
}
