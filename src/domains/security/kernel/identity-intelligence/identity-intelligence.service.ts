/**
 * Identity Intelligence Layer — Core Service
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ORCHESTRATOR + STATE MACHINE + DECISION ENGINE + READ-MODEL        ║
 * ║                                                                      ║
 * ║  Sits ABOVE all identity subsystems:                                 ║
 * ║    • Platform Identity Layer (PlatformGuard / usePlatformIdentity)   ║
 * ║    • Tenant Identity (TenantContext / tenant_memberships)            ║
 * ║    • Identity Boundary Layer (IBL)                                   ║
 * ║    • Dual Identity Engine (impersonation)                            ║
 * ║    • Access Graph (scope reachability)                               ║
 * ║    • Navigation Intelligence (AdaptiveSidebar / AppBreadcrumbs)      ║
 * ║                                                                      ║
 * ║  SINGLETON — no React dependency.                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { identityBoundary } from '../identity-boundary';
import { dualIdentityEngine } from '../dual-identity-engine';
import { getAccessGraph } from '../access-graph';
import { auditSecurity } from '../audit-security.service';
import type {
  IdentityPhase,
  IdentityTrigger,
  IdentitySnapshot,
  RiskAssessment,
  RiskLevel,
  RiskSignal,
  IntelligenceDecision,
  DecisionAction,
  IILEvent,
  IILPhaseTransitionEvent,
  IILRiskEscalationEvent,
  IILAnomalyDetectedEvent,
  IILDecisionIssuedEvent,
} from './types';

// ════════════════════════════════════
// EVENT BUS
// ════════════════════════════════════

type IILListener = (event: IILEvent) => void;
const listeners = new Set<IILListener>();
const eventLog: IILEvent[] = [];
const MAX_LOG = 100;

export function onIILEvent(listener: IILListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getIILEventLog(): readonly IILEvent[] {
  return eventLog;
}

function emit(event: IILEvent): void {
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.splice(0, eventLog.length - MAX_LOG);
  console.info(`[IIL] ${event.type}`, event);
  for (const fn of listeners) {
    try { fn(event); } catch { /* swallow */ }
  }
}

// ════════════════════════════════════
// VALID TRANSITIONS (FSM)
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

// ════════════════════════════════════
// CORE SERVICE
// ════════════════════════════════════

export class IdentityIntelligenceService {
  private _phase: IdentityPhase = 'anonymous';
  private _previousPhase: IdentityPhase | null = null;
  private _phaseChangedAt: number | null = null;
  private _lastRisk: RiskAssessment = { level: 'low', score: 0, signals: [], assessedAt: Date.now() };
  private _transitionCount = 0;
  private _lastTransitionTimestamps: number[] = [];
  private _snapshotListeners = new Set<() => void>();

  // ══════════════════════════════════
  // STATE MACHINE
  // ══════════════════════════════════

  get phase(): IdentityPhase {
    return this._phase;
  }

  /**
   * Attempt a state transition. Returns true if valid.
   */
  transition(trigger: IdentityTrigger): boolean {
    const valid = VALID_TRANSITIONS.find(
      t => t.from === this._phase && t.trigger === trigger,
    );
    if (!valid) {
      console.warn(`[IIL] Invalid transition: ${this._phase} --${trigger}--> ???`);
      emit({
        type: 'AnomalyDetected',
        timestamp: Date.now(),
        userId: this._resolveUserId(),
        anomaly: 'INVALID_TRANSITION',
        detail: `Attempted ${trigger} from phase ${this._phase}`,
      });
      return false;
    }

    const from = this._phase;
    this._previousPhase = from;
    this._phase = valid.to;
    this._phaseChangedAt = Date.now();
    this._transitionCount++;

    // Track rapid transitions for anomaly detection
    const now = Date.now();
    this._lastTransitionTimestamps.push(now);
    if (this._lastTransitionTimestamps.length > 20) {
      this._lastTransitionTimestamps.shift();
    }

    emit({
      type: 'PhaseTransition',
      timestamp: now,
      userId: this._resolveUserId(),
      from,
      to: valid.to,
      trigger,
    } satisfies IILPhaseTransitionEvent);

    // Re-assess risk on every transition
    this._assessRisk();
    this._notifySnapshotListeners();

    return true;
  }

  /**
   * Auto-resolve phase from current subsystem state.
   * Called when subsystems change externally (e.g. IBL establish).
   */
  syncPhase(): IdentityPhase {
    const resolved = this._resolveCurrentPhase();
    if (resolved !== this._phase) {
      const trigger = this._inferTrigger(this._phase, resolved);
      if (trigger) {
        this.transition(trigger);
      } else {
        // Force-set if no clean trigger (e.g. external state change)
        this._previousPhase = this._phase;
        this._phase = resolved;
        this._phaseChangedAt = Date.now();
        this._notifySnapshotListeners();
      }
    }
    return this._phase;
  }

  // ══════════════════════════════════
  // DECISION ENGINE
  // ══════════════════════════════════

  /**
   * Evaluate the current identity context and return an intelligent decision.
   * Used by SecurityPipeline and UI guards.
   */
  evaluate(action?: string, resource?: string): IntelligenceDecision {
    const risk = this._lastRisk;
    const snapshot = this.snapshot();

    // ── Critical risk → force logout ──
    if (risk.level === 'critical') {
      return this._issueDecision('FORCE_LOGOUT', 'Risk level critical — session terminated', { risk });
    }

    // ── Anonymous → require auth ──
    if (snapshot.phase === 'anonymous') {
      return this._issueDecision('REQUIRE_SCOPE', 'User not authenticated', { phase: snapshot.phase });
    }

    // ── Authenticated but not scoped → require scope ──
    if (snapshot.phase === 'authenticated') {
      return this._issueDecision('REQUIRE_SCOPE', 'Tenant/scope not resolved', { phase: snapshot.phase });
    }

    // ── Impersonating + financial action → block ──
    if (snapshot.isImpersonating && resource) {
      const financialResources = ['salary_adjustments', 'salary_contracts', 'compensation', 'benefit_plans', 'employee_benefits'];
      if (financialResources.includes(resource) && action && ['create', 'update', 'delete'].includes(action)) {
        return this._issueDecision('BLOCK_FINANCIAL', `Financial action ${action} on ${resource} blocked during impersonation`);
      }
    }

    // ── High risk → rate limit ──
    if (risk.level === 'high') {
      return this._issueDecision('RATE_LIMIT', 'Elevated risk — applying rate limiting', { risk });
    }

    return this._issueDecision('ALLOW', 'All checks passed');
  }

  // ══════════════════════════════════
  // READ-MODEL (Unified Snapshot)
  // ══════════════════════════════════

  /**
   * Project the current state of ALL identity subsystems
   * into a single IdentitySnapshot.
   */
  snapshot(): IdentitySnapshot {
    const iblSnapshot = identityBoundary.snapshot();
    const dualIdentity = dualIdentityEngine;
    const graph = getAccessGraph();
    const session = dualIdentity.currentSession;

    const now = Date.now();

    return {
      // Phase
      phase: this._phase,
      previousPhase: this._previousPhase,
      phaseChangedAt: this._phaseChangedAt,

      // Who
      userId: iblSnapshot.userId ?? dualIdentity.realIdentity?.userId ?? null,
      email: dualIdentity.realIdentity?.email ?? null,
      userType: dualIdentity.activeIdentity.userType ?? null,
      platformRole: dualIdentity.realIdentity?.platformRole ?? null,

      // Where
      tenantId: iblSnapshot.activeTenantId ?? dualIdentity.activeIdentity.tenantId ?? null,
      tenantName: session?.targetTenantName ?? null,
      scopeLevel: iblSnapshot.scopeLevel ?? null,
      groupId: null, // resolved from operational context
      companyId: null,
      effectiveRoles: iblSnapshot.effectiveRoles,

      // Dual Identity
      isImpersonating: dualIdentity.isImpersonating,
      realIdentity: dualIdentity.realIdentity,
      activeIdentity: dualIdentity.activeIdentity,
      impersonationSession: session,
      impersonationRemainingMs: dualIdentity.getRemainingMs(),

      // Access Graph
      hasAccessGraph: iblSnapshot.hasAccessGraph,
      reachableCompanyCount: graph?.getReachableCompanies().size ?? 0,
      reachableGroupCount: graph?.getReachableGroups().size ?? 0,

      // IBL
      iblEstablished: iblSnapshot.hasIdentity,
      contextSwitchCount: iblSnapshot.switchCount,
      availableTenantCount: iblSnapshot.tenantCount,

      // Risk
      risk: this._lastRisk,

      // Meta
      resolvedAt: now,
    };
  }

  /**
   * Subscribe to snapshot changes (for React hook).
   */
  onSnapshotChange(listener: () => void): () => void {
    this._snapshotListeners.add(listener);
    return () => this._snapshotListeners.delete(listener);
  }

  // ══════════════════════════════════
  // RISK ASSESSMENT ENGINE
  // ══════════════════════════════════

  private _assessRisk(): void {
    const signals: RiskSignal[] = [];

    // ── Rapid transitions (possible session hijack) ──
    const recentTransitions = this._lastTransitionTimestamps.filter(
      t => Date.now() - t < 60_000,
    ).length;
    if (recentTransitions > 10) {
      signals.push({ signal: 'RAPID_TRANSITIONS', weight: 40, detail: `${recentTransitions} transitions in last 60s` });
    } else if (recentTransitions > 5) {
      signals.push({ signal: 'ELEVATED_TRANSITIONS', weight: 15, detail: `${recentTransitions} transitions in last 60s` });
    }

    // ── Impersonation active ──
    if (dualIdentityEngine.isImpersonating) {
      signals.push({ signal: 'IMPERSONATION_ACTIVE', weight: 20, detail: 'Platform user impersonating tenant' });

      const session = dualIdentityEngine.currentSession;
      if (session && session.operationCount > 50) {
        signals.push({ signal: 'HIGH_IMPERSONATION_OPS', weight: 15, detail: `${session.operationCount} ops during impersonation` });
      }
    }

    // ── No access graph (degraded authorization) ──
    if (!getAccessGraph() && this._phase === 'scoped') {
      signals.push({ signal: 'NO_ACCESS_GRAPH', weight: 10, detail: 'Operating without AccessGraph — degraded authorization' });
    }

    // ── IBL not established but phase says scoped ──
    if (this._phase === 'scoped' && !identityBoundary.isEstablished) {
      signals.push({ signal: 'IBL_DESYNC', weight: 30, detail: 'Phase is scoped but IBL session not established' });
    }

    // ── Score ──
    const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
    const level: RiskLevel =
      score >= 80 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 25 ? 'medium' :
      'low';

    const previousLevel = this._lastRisk.level;

    this._lastRisk = { level, score, signals, assessedAt: Date.now() };

    // Emit escalation event if risk increased
    if (this._riskOrdinal(level) > this._riskOrdinal(previousLevel)) {
      emit({
        type: 'RiskEscalation',
        timestamp: Date.now(),
        userId: this._resolveUserId(),
        previousLevel,
        newLevel: level,
        score,
        signals,
      } satisfies IILRiskEscalationEvent);

      // Audit high+ risk
      if (level === 'high' || level === 'critical') {
        auditSecurity.log({
          action: 'unauthorized_access',
          resource: 'identity_intelligence',
          result: 'blocked',
          reason: `Risk escalation: ${previousLevel} → ${level} (score: ${score})`,
          metadata: { signals: signals.map(s => s.signal) },
        });
      }
    }
  }

  // ══════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════

  private _resolveCurrentPhase(): IdentityPhase {
    if (dualIdentityEngine.isImpersonating) return 'impersonating';
    if (identityBoundary.isEstablished && identityBoundary.hasActiveContext) return 'scoped';
    if (identityBoundary.isEstablished) return 'authenticated';
    return 'anonymous';
  }

  private _inferTrigger(from: IdentityPhase, to: IdentityPhase): IdentityTrigger | null {
    const match = VALID_TRANSITIONS.find(t => t.from === from && t.to === to);
    return match?.trigger ?? null;
  }

  private _resolveUserId(): string | null {
    return identityBoundary.identity?.userId
      ?? dualIdentityEngine.realIdentity?.userId
      ?? null;
  }

  private _issueDecision(action: DecisionAction, reason: string, metadata?: Record<string, unknown>): IntelligenceDecision {
    const decision: IntelligenceDecision = { action, reason, metadata };

    if (action !== 'ALLOW') {
      emit({
        type: 'DecisionIssued',
        timestamp: Date.now(),
        userId: this._resolveUserId(),
        decision,
      } satisfies IILDecisionIssuedEvent);
    }

    return decision;
  }

  private _riskOrdinal(level: RiskLevel): number {
    return { low: 0, medium: 1, high: 2, critical: 3 }[level];
  }

  private _notifySnapshotListeners(): void {
    for (const fn of this._snapshotListeners) {
      try { fn(); } catch { /* swallow */ }
    }
  }

  /**
   * Full debug dump.
   */
  debug() {
    return {
      phase: this._phase,
      previousPhase: this._previousPhase,
      transitionCount: this._transitionCount,
      risk: this._lastRisk,
      iblEstablished: identityBoundary.isEstablished,
      isImpersonating: dualIdentityEngine.isImpersonating,
      hasAccessGraph: !!getAccessGraph(),
      eventLogSize: eventLog.length,
    };
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identityIntelligence = new IdentityIntelligenceService();
