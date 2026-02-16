/**
 * useIdentityIntelligence — React Hook
 *
 * Reactive hook that exposes both the UnifiedIdentitySession (primary API)
 * and the full IdentitySnapshot (diagnostic) from the Identity Intelligence Layer.
 *
 * PXE Integration: enriches active_context with active_plan + allowed_modules
 * from tenant_plans and tenant_module_access tables.
 */

import { useSyncExternalStore, useCallback, useMemo, useEffect, useState } from 'react';
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

// Subscription function for useSyncExternalStore
function subscribe(onStoreChange: () => void): () => void {
  return identityIntelligence.onSnapshotChange(onStoreChange);
}

// Cache management
let cachedSnapshot: IdentitySnapshot | null = null;
let cachedSession: UnifiedIdentitySession | null = null;
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

// Bump version on every notification
const originalSubscribe = subscribe;
function subscribeBump(onStoreChange: () => void): () => void {
  return originalSubscribe(() => {
    cachedVersion++;
    cachedState = null;
    onStoreChange();
  });
}

export function useIdentityIntelligence(): UseIdentityIntelligenceReturn {
  const state = useSyncExternalStore(subscribeBump, getState, getState);

  // ── PXE enrichment: fetch active_plan + allowed_modules ──
  const [planInfo, setPlanInfo] = useState<ActivePlanInfo | null>(null);
  const [allowedModules, setAllowedModules] = useState<readonly string[]>([]);
  const tenantId = state.session.active_context?.tenant_id ?? null;

  useEffect(() => {
    if (!tenantId) {
      setPlanInfo(null);
      setAllowedModules([]);
      return;
    }
    let cancelled = false;

    // Fetch plan + modules in parallel
    const planPromise = supabase
      .from('tenant_plans')
      .select('id, plan_id, status, billing_cycle')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    const modulesPromise = (supabase
      .from('tenant_module_access' as any)
      .select('module_key')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)) as any;

    Promise.all([planPromise, modulesPromise]).then(([planRes, modulesRes]: [any, any]) => {
      if (cancelled) return;
      if (planRes.data) {
        const d = planRes.data as any;
        setPlanInfo({
          plan_id: d.plan_id,
          plan_name: d.plan_id, // plan name resolved from plan_id
          tier: 'active',
          status: d.status,
          billing_cycle: d.billing_cycle,
        });
      } else {
        setPlanInfo(null);
      }
      setAllowedModules((modulesRes.data ?? []).map((m: any) => m.module_key));
    });

    return () => { cancelled = true; };
  }, [tenantId]);

  // ── Enrich active_context with PXE data ──
  const enrichedContext: ActiveContext | null = useMemo(() => {
    const ctx = state.session.active_context;
    if (!ctx) return null;
    return {
      ...ctx,
      active_plan: planInfo,
      allowed_modules: allowedModules,
    };
  }, [state.session.active_context, planInfo, allowedModules]);

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
