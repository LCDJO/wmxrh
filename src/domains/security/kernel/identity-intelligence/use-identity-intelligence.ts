/**
 * useIdentityIntelligence — React Hook
 *
 * Reactive hook that exposes the unified IdentitySnapshot from the
 * Identity Intelligence Layer. Re-renders on phase transitions,
 * risk changes, and snapshot invalidations.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import { identityIntelligence } from './identity-intelligence.service';
import type { IdentitySnapshot, IntelligenceDecision, IdentityPhase, RiskAssessment } from './types';

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

// Snapshot function — returns a stable reference when nothing changed
let cachedSnapshot: IdentitySnapshot | null = null;
let cachedPhase: IdentityPhase | null = null;

function getSnapshot(): IdentitySnapshot {
  const currentPhase = identityIntelligence.phase;
  // Only rebuild if phase changed (lightweight check)
  if (cachedPhase !== currentPhase || !cachedSnapshot) {
    cachedPhase = currentPhase;
    cachedSnapshot = identityIntelligence.snapshot();
  }
  return cachedSnapshot;
}

export function useIdentityIntelligence(): UseIdentityIntelligenceReturn {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const evaluate = useCallback(
    (action?: string, resource?: string) => identityIntelligence.evaluate(action, resource),
    [],
  );

  const syncPhase = useCallback(() => identityIntelligence.syncPhase(), []);

  const debug = useCallback(() => identityIntelligence.debug(), []);

  return useMemo(() => ({
    snapshot,
    phase: snapshot.phase,
    risk: snapshot.risk,
    isAnonymous: snapshot.phase === 'anonymous',
    isAuthenticated: snapshot.phase === 'authenticated',
    isScoped: snapshot.phase === 'scoped',
    isImpersonating: snapshot.phase === 'impersonating',
    evaluate,
    syncPhase,
    debug,
  }), [snapshot, evaluate, syncPhase, debug]);
}
