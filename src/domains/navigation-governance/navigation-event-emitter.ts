/**
 * Navigation Governance — Domain Event Emitter
 *
 * Lightweight event emitter that dispatches CustomEvents on `window`.
 * The PlatformOS event kernel can bridge these if needed.
 * Keeps the domain decoupled from platform-os runtime.
 */

import { NAVIGATION_GOVERNANCE_EVENTS } from './navigation-governance-events';
import type {
  NavigationRefactorProposedPayload,
  NavigationVersionCreatedPayload,
  NavigationRefactorAppliedPayload,
  NavigationRollbackExecutedPayload,
  NavigationDraftCreatedPayload,
  NavigationDraftApprovedPayload,
  NavigationDraftRejectedPayload,
} from './navigation-governance-events';

type EventPayloadMap = {
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationRefactorProposed]: NavigationRefactorProposedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationVersionCreated]: NavigationVersionCreatedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationRefactorApplied]: NavigationRefactorAppliedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationRollbackExecuted]: NavigationRollbackExecutedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationDraftCreated]: NavigationDraftCreatedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationDraftApproved]: NavigationDraftApprovedPayload;
  [NAVIGATION_GOVERNANCE_EVENTS.NavigationDraftRejected]: NavigationDraftRejectedPayload;
};

const SOURCE = 'NavigationGovernance';

/**
 * Emit a navigation governance domain event.
 */
export function emitNavigationEvent<K extends keyof EventPayloadMap>(
  type: K,
  payload: EventPayloadMap[K],
): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(type, {
          detail: { source: SOURCE, payload, emitted_at: Date.now() },
        }),
      );
    }
    console.debug(`[NavGovernance] Event: ${type}`, payload);
  } catch {
    // Silently fail in non-browser environments
  }
}

/**
 * Listen for a navigation governance domain event.
 * Returns an unsubscribe function.
 */
export function onNavigationEvent<K extends keyof EventPayloadMap>(
  type: K,
  handler: (payload: EventPayloadMap[K]) => void,
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    handler(detail.payload);
  };
  window.addEventListener(type, listener);
  return () => window.removeEventListener(type, listener);
}
