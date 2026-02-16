/**
 * Identity Intelligence Layer — Core Orchestrator
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  IdentityIntelligenceService                                        ║
 * ║   ├── IdentityRouter          (FSM: phase transitions)              ║
 * ║   ├── WorkspaceResolver       (workspace listing/switching)         ║
 * ║   ├── ContextMemoryService    (recent context history)              ║
 * ║   ├── UnifiedSessionManager   (read-model projector)                ║
 * ║   └── LoginIntentDetector     (PlatformUser vs TenantUser)          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * SINGLETON — no React dependency.
 */

import { identityBoundary } from '../identity-boundary';
import { dualIdentityEngine } from '../dual-identity-engine';
import { getAccessGraph } from '../access-graph';
import { auditSecurity } from '../audit-security.service';

import { IdentityRouter } from './identity-router';
import { WorkspaceResolver } from './workspace-resolver';
import { ContextMemoryService } from './context-memory.service';
import { UnifiedSessionManager } from './unified-session-manager';
import { LoginIntentDetector } from './login-intent-detector';

import type {
  IdentityPhase,
  IdentityTrigger,
  IdentitySnapshot,
  UnifiedIdentitySession,
  RiskAssessment,
  RiskLevel,
  RiskSignal,
  IntelligenceDecision,
  DecisionAction,
  UserTypeDetection,
  DetectedUserType,
  WorkspaceEntry,
  RecentContext,
  IILEvent,
  IILRiskEscalationEvent,
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
// CORE ORCHESTRATOR
// ════════════════════════════════════

export class IdentityIntelligenceService {
  // ── Sub-components ──
  readonly router: IdentityRouter;
  readonly workspaceResolver: WorkspaceResolver;
  readonly contextMemory: ContextMemoryService;
  readonly sessionManager: UnifiedSessionManager;
  readonly loginDetector: LoginIntentDetector;

  // ── Internal state ──
  private _lastRisk: RiskAssessment = { level: 'low', score: 0, signals: [], assessedAt: Date.now() };
  private _snapshotListeners = new Set<() => void>();

  constructor() {
    // Wire sub-components with shared event bus
    this.router = new IdentityRouter((event) => {
      emit(event);
      this._onRouterTransition();
    });

    this.workspaceResolver = new WorkspaceResolver((event) => emit(event));
    this.contextMemory = new ContextMemoryService();
    this.sessionManager = new UnifiedSessionManager();

    this.loginDetector = new LoginIntentDetector((event) => {
      emit(event);
      this._notifySnapshotListeners();
    });
  }

  // ══════════════════════════════════
  // DELEGATED — STATE MACHINE
  // ══════════════════════════════════

  get phase(): IdentityPhase { return this.router.phase; }

  transition(trigger: IdentityTrigger): boolean {
    const result = this.router.transition(trigger);
    if (result) this._notifySnapshotListeners();
    return result !== null;
  }

  syncPhase(): IdentityPhase {
    const phase = this.router.syncPhase();
    this._notifySnapshotListeners();
    return phase;
  }

  // ══════════════════════════════════
  // DELEGATED — USER TYPE DETECTION
  // ══════════════════════════════════

  detectUserTypeFromJwt(accessToken: string | undefined): UserTypeDetection {
    return this.loginDetector.detectFromJwt(accessToken);
  }

  setDetectedUserType(
    type: DetectedUserType,
    confidence: UserTypeDetection['confidence'],
    platformRole: string | null = null,
  ): void {
    this.loginDetector.setFromDbLookup(type, confidence, platformRole);
    this._notifySnapshotListeners();
  }

  get userTypeDetection(): UserTypeDetection | null { return this.loginDetector.detection; }
  get isPlatformUser(): boolean { return this.loginDetector.isPlatformUser; }
  get isTenantUser(): boolean { return this.loginDetector.isTenantUser; }

  // ══════════════════════════════════
  // DELEGATED — WORKSPACE
  // ══════════════════════════════════

  getAvailableWorkspaces(): WorkspaceEntry[] {
    return this.workspaceResolver.getAvailableWorkspaces();
  }

  switchWorkspace(
    tenantId: string,
    method: 'explicit' | 'auto_restore' | 'initial' = 'explicit',
  ): boolean {
    // Record current context before switching
    this.contextMemory.recordCurrentContext();

    const success = this.workspaceResolver.switchWorkspace(tenantId, method);
    if (!success) return false;

    // Track context entry
    this.contextMemory.markContextEntry();

    // Transition FSM
    if (this.router.phase === 'authenticated') {
      this.transition('SCOPE_RESOLVED');
    } else if (this.router.phase === 'scoped') {
      this.transition('SCOPE_SWITCH');
    }

    this._notifySnapshotListeners();
    return true;
  }

  restoreLastWorkspace(): string | null {
    return this.workspaceResolver.restoreLastWorkspace();
  }

  getRecentContexts(): readonly RecentContext[] {
    return this.contextMemory.recentContexts;
  }

  // ══════════════════════════════════
  // DECISION ENGINE
  // ══════════════════════════════════

  evaluate(action?: string, resource?: string): IntelligenceDecision {
    const risk = this._lastRisk;

    if (risk.level === 'critical') {
      return this._issueDecision('FORCE_LOGOUT', 'Risk level critical — session terminated', { risk });
    }

    const phase = this.router.phase;

    if (phase === 'anonymous') {
      return this._issueDecision('REQUIRE_SCOPE', 'User not authenticated', { phase });
    }

    if (phase === 'authenticated') {
      return this._issueDecision('REQUIRE_SCOPE', 'Tenant/scope not resolved', { phase });
    }

    if (dualIdentityEngine.isImpersonating && resource) {
      const financialResources = ['salary_adjustments', 'salary_contracts', 'compensation', 'benefit_plans', 'employee_benefits'];
      if (financialResources.includes(resource) && action && ['create', 'update', 'delete'].includes(action)) {
        return this._issueDecision('BLOCK_FINANCIAL', `Financial action ${action} on ${resource} blocked during impersonation`);
      }
    }

    if (risk.level === 'high') {
      return this._issueDecision('RATE_LIMIT', 'Elevated risk — applying rate limiting', { risk });
    }

    return this._issueDecision('ALLOW', 'All checks passed');
  }

  // ══════════════════════════════════
  // READ-MODEL
  // ══════════════════════════════════

  private _projectionInput() {
    return {
      phase: this.router.phase,
      previousPhase: this.router.previousPhase,
      phaseChangedAt: this.router.phaseChangedAt,
      userTypeDetection: this.loginDetector.detection,
      recentContexts: this.contextMemory.recentContexts,
      lastRisk: this._lastRisk,
      workspaces: this.workspaceResolver.getAvailableWorkspaces(),
    };
  }

  snapshot(): IdentitySnapshot {
    return this.sessionManager.buildSnapshot(this._projectionInput());
  }

  unifiedSession(): UnifiedIdentitySession {
    return this.sessionManager.buildSession(this._projectionInput());
  }

  onSnapshotChange(listener: () => void): () => void {
    this._snapshotListeners.add(listener);
    return () => this._snapshotListeners.delete(listener);
  }

  // ══════════════════════════════════
  // RISK ENGINE
  // ══════════════════════════════════

  private _assessRisk(): void {
    const signals: RiskSignal[] = [];

    const recentTransitions = this.router.lastTransitionTimestamps.filter(
      t => Date.now() - t < 60_000,
    ).length;
    if (recentTransitions > 10) {
      signals.push({ signal: 'RAPID_TRANSITIONS', weight: 40, detail: `${recentTransitions} transitions in last 60s` });
    } else if (recentTransitions > 5) {
      signals.push({ signal: 'ELEVATED_TRANSITIONS', weight: 15, detail: `${recentTransitions} transitions in last 60s` });
    }

    if (dualIdentityEngine.isImpersonating) {
      signals.push({ signal: 'IMPERSONATION_ACTIVE', weight: 20, detail: 'Platform user impersonating tenant' });
      const session = dualIdentityEngine.currentSession;
      if (session && session.operationCount > 50) {
        signals.push({ signal: 'HIGH_IMPERSONATION_OPS', weight: 15, detail: `${session.operationCount} ops during impersonation` });
      }
    }

    if (!getAccessGraph() && this.router.phase === 'scoped') {
      signals.push({ signal: 'NO_ACCESS_GRAPH', weight: 10, detail: 'Operating without AccessGraph — degraded authorization' });
    }

    if (this.router.phase === 'scoped' && !identityBoundary.isEstablished) {
      signals.push({ signal: 'IBL_DESYNC', weight: 30, detail: 'Phase is scoped but IBL session not established' });
    }

    if (this.router.phase === 'scoped' && (!this.loginDetector.detection || this.loginDetector.detection.detectedType === 'unknown')) {
      signals.push({ signal: 'UNKNOWN_USER_TYPE', weight: 5, detail: 'User type not yet resolved' });
    }

    const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
    const level: RiskLevel =
      score >= 80 ? 'critical' :
      score >= 50 ? 'high' :
      score >= 25 ? 'medium' :
      'low';

    const previousLevel = this._lastRisk.level;
    this._lastRisk = { level, score, signals, assessedAt: Date.now() };

    if (this._riskOrdinal(level) > this._riskOrdinal(previousLevel)) {
      emit({
        type: 'RiskEscalation',
        timestamp: Date.now(),
        userId: identityBoundary.identity?.userId ?? null,
        previousLevel,
        newLevel: level,
        score,
        signals,
      } satisfies IILRiskEscalationEvent);

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
  // INTERNAL HOOKS
  // ══════════════════════════════════

  /**
   * Called after every router transition.
   */
  private _onRouterTransition(): void {
    const trigger = this.router.previousPhase; // phase already changed

    // Re-assess risk
    this._assessRisk();

    // On LOGOUT, clear detection + context
    if (this.router.phase === 'anonymous') {
      this.loginDetector.clear();
      this.contextMemory.clearEntry();
    }

    // On SCOPE_RESOLVED or SCOPE_SWITCH, mark context entry
    if (this.router.phase === 'scoped') {
      this.contextMemory.markContextEntry();
    }

    this._notifySnapshotListeners();
  }

  // ══════════════════════════════════
  // HELPERS
  // ══════════════════════════════════

  private _issueDecision(action: DecisionAction, reason: string, metadata?: Record<string, unknown>): IntelligenceDecision {
    const decision: IntelligenceDecision = { action, reason, metadata };
    if (action !== 'ALLOW') {
      emit({
        type: 'DecisionIssued',
        timestamp: Date.now(),
        userId: identityBoundary.identity?.userId ?? null,
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

  debug() {
    return {
      phase: this.router.phase,
      previousPhase: this.router.previousPhase,
      transitionCount: this.router.transitionCount,
      risk: this._lastRisk,
      iblEstablished: identityBoundary.isEstablished,
      isImpersonating: dualIdentityEngine.isImpersonating,
      hasAccessGraph: !!getAccessGraph(),
      eventLogSize: eventLog.length,
      userTypeDetection: this.loginDetector.detection,
      recentContextsCount: this.contextMemory.recentContexts.length,
      availableWorkspaces: this.workspaceResolver.getAvailableWorkspaces().length,
    };
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identityIntelligence = new IdentityIntelligenceService();
