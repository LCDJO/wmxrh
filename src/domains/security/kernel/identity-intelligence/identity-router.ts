/**
 * IdentityRouter — FSM (Finite State Machine) for identity phases.
 *
 * Manages transitions: Anonymous → Authenticated → Scoped → Impersonating
 * Validates every transition against a strict adjacency table.
 *
 * Part of the Identity Intelligence Layer decomposition.
 */

import { identityBoundary } from '../identity-boundary';
import { dualIdentityEngine } from '../dual-identity-engine';
import type { IdentityPhase, IdentityTrigger, IILAnomalyDetectedEvent, IILPhaseTransitionEvent } from './types';

// ════════════════════════════════════
// VALID TRANSITIONS
// ════════════════════════════════════

const VALID_TRANSITIONS: ReadonlyArray<{ from: IdentityPhase; to: IdentityPhase; trigger: IdentityTrigger }> = [
  { from: 'anonymous',       to: 'authenticated', trigger: 'LOGIN' },
  { from: 'authenticated',   to: 'scoped',        trigger: 'SCOPE_RESOLVED' },
  { from: 'authenticated',   to: 'anonymous',     trigger: 'LOGOUT' },
  { from: 'scoped',          to: 'impersonating', trigger: 'IMPERSONATION_START' },
  { from: 'scoped',          to: 'scoped',        trigger: 'SCOPE_SWITCH' },
  { from: 'scoped',          to: 'authenticated', trigger: 'SCOPE_LOST' },
  { from: 'scoped',          to: 'anonymous',     trigger: 'LOGOUT' },
  { from: 'impersonating',   to: 'scoped',        trigger: 'IMPERSONATION_END' },
  { from: 'impersonating',   to: 'anonymous',     trigger: 'LOGOUT' },
];

export type TransitionCallback = (event: IILPhaseTransitionEvent | IILAnomalyDetectedEvent) => void;

export class IdentityRouter {
  private _phase: IdentityPhase = 'anonymous';
  private _previousPhase: IdentityPhase | null = null;
  private _phaseChangedAt: number | null = null;
  private _transitionCount = 0;
  private _lastTransitionTimestamps: number[] = [];
  private _onEvent: TransitionCallback;

  constructor(onEvent: TransitionCallback) {
    this._onEvent = onEvent;
  }

  get phase(): IdentityPhase { return this._phase; }
  get previousPhase(): IdentityPhase | null { return this._previousPhase; }
  get phaseChangedAt(): number | null { return this._phaseChangedAt; }
  get transitionCount(): number { return this._transitionCount; }
  get lastTransitionTimestamps(): readonly number[] { return this._lastTransitionTimestamps; }

  /**
   * Attempt a state transition. Returns the target phase or null if invalid.
   */
  transition(trigger: IdentityTrigger): IdentityPhase | null {
    const valid = VALID_TRANSITIONS.find(
      t => t.from === this._phase && t.trigger === trigger,
    );

    if (!valid) {
      this._onEvent({
        type: 'AnomalyDetected',
        timestamp: Date.now(),
        userId: this._resolveUserId(),
        anomaly: 'INVALID_TRANSITION',
        detail: `Attempted ${trigger} from phase ${this._phase}`,
      });
      return null;
    }

    const from = this._phase;
    const now = Date.now();

    this._previousPhase = from;
    this._phase = valid.to;
    this._phaseChangedAt = now;
    this._transitionCount++;

    this._lastTransitionTimestamps.push(now);
    if (this._lastTransitionTimestamps.length > 20) {
      this._lastTransitionTimestamps.shift();
    }

    this._onEvent({
      type: 'PhaseTransition',
      timestamp: now,
      userId: this._resolveUserId(),
      from,
      to: valid.to,
      trigger,
    });

    return valid.to;
  }

  /**
   * Auto-resolve phase from current subsystem state.
   */
  resolvePhase(): IdentityPhase {
    if (dualIdentityEngine.isImpersonating) return 'impersonating';
    if (identityBoundary.isEstablished && identityBoundary.hasActiveContext) return 'scoped';
    if (identityBoundary.isEstablished) return 'authenticated';
    return 'anonymous';
  }

  /**
   * Sync phase — auto-transition if subsystem state diverges.
   */
  syncPhase(): IdentityPhase {
    const resolved = this.resolvePhase();
    if (resolved !== this._phase) {
      const inferredTrigger = VALID_TRANSITIONS.find(
        t => t.from === this._phase && t.to === resolved,
      )?.trigger;

      if (inferredTrigger) {
        this.transition(inferredTrigger);
      } else {
        // Force sync without valid transition
        this._previousPhase = this._phase;
        this._phase = resolved;
        this._phaseChangedAt = Date.now();
      }
    }
    return this._phase;
  }

  /**
   * Force reset to anonymous (e.g., on session destroy).
   */
  reset(): void {
    this._previousPhase = this._phase;
    this._phase = 'anonymous';
    this._phaseChangedAt = Date.now();
  }

  private _resolveUserId(): string | null {
    return identityBoundary.identity?.userId
      ?? dualIdentityEngine.realIdentity?.userId
      ?? null;
  }
}
