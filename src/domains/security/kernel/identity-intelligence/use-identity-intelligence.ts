/**
 * useIdentityIntelligence — React Hook
 *
 * Reactive hook that exposes the unified IdentitySnapshot from the
 * Identity Intelligence Layer. Re-renders on phase transitions,
 * risk changes, workspace switches, and snapshot invalidations.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { identityIntelligence } from './identity-intelligence.service';
import type {
  IdentitySnapshot,
  IntelligenceDecision,
  IdentityPhase,
  RiskAssessment,
  WorkspaceEntry,
  RecentContext,
  UserTypeDetection,
} from './types';

export interface UseIdentityIntelligenceReturn {
  /** Full projected snapshot of all identity subsystems */
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

  /** Workspace management */
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

// Snapshot function — invalidates cache on phase change
let cachedSnapshot: IdentitySnapshot | null = null;
let cachedVersion = 0;
let lastVersion = -1;

function getSnapshot(): IdentitySnapshot {
  // Rebuild on every subscribe notification (version bump)
  const currentPhase = identityIntelligence.phase;
  if (!cachedSnapshot || cachedVersion !== lastVersion) {
    cachedSnapshot = identityIntelligence.snapshot();
    lastVersion = cachedVersion;
  }
  return cachedSnapshot;
}

// Bump version on every notification
const originalSubscribe = subscribe;
function subscribeBump(onStoreChange: () => void): () => void {
  return originalSubscribe(() => {
    cachedVersion++;
    cachedSnapshot = null; // force rebuild
    onStoreChange();
  });
}

export function useIdentityIntelligence(): UseIdentityIntelligenceReturn {
  const snapshot = useSyncExternalStore(subscribeBump, getSnapshot, getSnapshot);

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
    snapshot,
    phase: snapshot.phase,
    risk: snapshot.risk,
    isAnonymous: snapshot.phase === 'anonymous',
    isAuthenticated: snapshot.phase === 'authenticated',
    isScoped: snapshot.phase === 'scoped',
    isImpersonating: snapshot.phase === 'impersonating',
    isPlatformUser: snapshot.userType === 'platform',
    isTenantUser: snapshot.userType === 'tenant',
    userTypeDetection: snapshot.userTypeDetection,
    availableWorkspaces: snapshot.availableWorkspaces,
    recentContexts: snapshot.recentContexts,
    canSwitchWorkspace: snapshot.canSwitchWorkspace,
    switchWorkspace,
    restoreLastWorkspace,
    evaluate,
    syncPhase,
    debug,
  }), [snapshot, evaluate, syncPhase, debug, switchWorkspace, restoreLastWorkspace]);
}
