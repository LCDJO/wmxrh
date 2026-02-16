/**
 * Identity Intelligence Layer — Core Service
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ORCHESTRATOR + STATE MACHINE + DECISION ENGINE + READ-MODEL        ║
 * ║                                                                      ║
 * ║  CAPABILITIES:                                                       ║
 * ║    1. Auto-detect PlatformUser vs TenantUser (JWT → DB → fallback)  ║
 * ║    2. Multi-tenant session with workspace switching                  ║
 * ║    3. Active context management without logout                       ║
 * ║    4. Recent context history for quick workspace switch              ║
 * ║    5. Risk assessment & anomaly detection                            ║
 * ║    6. Decision engine for access control                             ║
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
  IILUserTypeDetectedEvent,
  IILWorkspaceSwitchedEvent,
  UserTypeDetection,
  DetectedUserType,
  WorkspaceEntry,
  RecentContext,
} from './types';

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const MAX_RECENT_CONTEXTS = 10;
const RECENT_CONTEXTS_KEY = 'iil:recent_contexts';
const LAST_WORKSPACE_KEY = 'iil:last_workspace';

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

  // ── User type detection ──
  private _userTypeDetection: UserTypeDetection | null = null;

  // ── Workspace & context history ──
  private _recentContexts: RecentContext[] = [];
  private _contextEnteredAt: number | null = null;

  constructor() {
    this._loadRecentContexts();
  }

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

    // On LOGOUT, clear user type detection
    if (trigger === 'LOGOUT') {
      this._userTypeDetection = null;
      this._contextEnteredAt = null;
    }

    // On SCOPE_RESOLVED, mark context entry
    if (trigger === 'SCOPE_RESOLVED' || trigger === 'SCOPE_SWITCH') {
      this._contextEnteredAt = now;
    }

    this._notifySnapshotListeners();
    return true;
  }

  /**
   * Auto-resolve phase from current subsystem state.
   */
  syncPhase(): IdentityPhase {
    const resolved = this._resolveCurrentPhase();
    if (resolved !== this._phase) {
      const trigger = this._inferTrigger(this._phase, resolved);
      if (trigger) {
        this.transition(trigger);
      } else {
        this._previousPhase = this._phase;
        this._phase = resolved;
        this._phaseChangedAt = Date.now();
        this._notifySnapshotListeners();
      }
    }
    return this._phase;
  }

  // ══════════════════════════════════
  // USER TYPE AUTO-DETECTION
  // ══════════════════════════════════

  /**
   * Detect user type from JWT claim.
   * Called during login/session restore with the access token.
   */
  detectUserTypeFromJwt(accessToken: string | undefined): UserTypeDetection {
    let detectedType: DetectedUserType = 'unknown';
    let platformRole = null;

    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        if (payload.user_type === 'platform' || payload.user_type === 'tenant') {
          detectedType = payload.user_type;
        }
        if (payload.platform_role) {
          platformRole = payload.platform_role;
        }
      } catch { /* malformed token */ }
    }

    const detection: UserTypeDetection = {
      detectedType,
      confidence: detectedType !== 'unknown' ? 'jwt_claim' : 'unknown',
      platformRole,
      tenantCount: identityBoundary.identity?.tenantScopes.length ?? 0,
      detectedAt: Date.now(),
    };

    this._userTypeDetection = detection;

    emit({
      type: 'UserTypeDetected',
      timestamp: Date.now(),
      userId: this._resolveUserId(),
      detection,
    } satisfies IILUserTypeDetectedEvent);

    this._notifySnapshotListeners();
    return detection;
  }

  /**
   * Set user type from DB lookup (platform_users table or tenant_memberships).
   * Called as fallback when JWT claim is not available.
   */
  setDetectedUserType(
    type: DetectedUserType,
    confidence: UserTypeDetection['confidence'],
    platformRole: string | null = null,
  ): void {
    // Don't downgrade from jwt_claim confidence
    if (this._userTypeDetection?.confidence === 'jwt_claim' && confidence !== 'jwt_claim') {
      return;
    }

    const tenantCount = identityBoundary.identity?.tenantScopes.length ?? 0;

    this._userTypeDetection = {
      detectedType: type,
      confidence,
      platformRole: platformRole as any,
      tenantCount,
      detectedAt: Date.now(),
    };

    emit({
      type: 'UserTypeDetected',
      timestamp: Date.now(),
      userId: this._resolveUserId(),
      detection: this._userTypeDetection,
    } satisfies IILUserTypeDetectedEvent);

    this._notifySnapshotListeners();
  }

  get userTypeDetection(): UserTypeDetection | null {
    return this._userTypeDetection;
  }

  get isPlatformUser(): boolean {
    return this._userTypeDetection?.detectedType === 'platform';
  }

  get isTenantUser(): boolean {
    return this._userTypeDetection?.detectedType === 'tenant';
  }

  // ══════════════════════════════════
  // WORKSPACE MANAGEMENT
  // ══════════════════════════════════

  /**
   * Get all available workspaces the user can switch to.
   */
  getAvailableWorkspaces(): WorkspaceEntry[] {
    const session = identityBoundary.identity;
    if (!session) return [];

    return session.tenantScopes.map(scope => ({
      tenantId: scope.tenantId,
      tenantName: scope.tenantName,
      role: scope.role,
      scopeLevel: null,
      groupId: null,
      companyId: null,
    }));
  }

  /**
   * Switch to a different workspace (tenant) without logout.
   * Records the previous context in history before switching.
   */
  switchWorkspace(
    tenantId: string,
    method: 'explicit' | 'auto_restore' | 'initial' = 'explicit',
  ): boolean {
    const session = identityBoundary.identity;
    if (!session) return false;

    // Validate membership
    if (!identityBoundary.canSwitchToTenant(tenantId)) {
      emit({
        type: 'AnomalyDetected',
        timestamp: Date.now(),
        userId: this._resolveUserId(),
        anomaly: 'WORKSPACE_SWITCH_DENIED',
        detail: `No membership for tenant ${tenantId}`,
      });
      return false;
    }

    // Record current context in history before leaving
    this._recordCurrentContextInHistory();

    const previousTenantId = identityBoundary.operationalContext?.activeTenantId ?? null;

    // Perform the actual switch via IBL
    const result = identityBoundary.switchContext({ targetTenantId: tenantId });
    if (!result.success) return false;

    // Persist last workspace
    this._persistLastWorkspace(tenantId);

    // Mark context entry time
    this._contextEnteredAt = Date.now();

    // Emit workspace switched event
    const targetScope = session.tenantScopes.find(s => s.tenantId === tenantId);
    emit({
      type: 'WorkspaceSwitched',
      timestamp: Date.now(),
      userId: this._resolveUserId(),
      fromTenantId: previousTenantId,
      toTenantId: tenantId,
      toTenantName: targetScope?.tenantName ?? tenantId,
      switchMethod: method,
    } satisfies IILWorkspaceSwitchedEvent);

    // Transition FSM if needed
    if (this._phase === 'authenticated') {
      this.transition('SCOPE_RESOLVED');
    } else if (this._phase === 'scoped') {
      this.transition('SCOPE_SWITCH');
    }

    auditSecurity.log({
      action: 'workspace_switched',
      resource: 'identity_intelligence',
      result: 'success',
      reason: `Workspace switched to ${targetScope?.tenantName ?? tenantId}`,
      user_id: session.userId,
      tenant_id: tenantId,
      metadata: { method, fromTenantId: previousTenantId },
    });

    this._notifySnapshotListeners();
    return true;
  }

  /**
   * Restore the last workspace from localStorage on session restore.
   * Returns the restored tenant ID, or null if none found.
   */
  restoreLastWorkspace(): string | null {
    try {
      const saved = localStorage.getItem(LAST_WORKSPACE_KEY);
      if (!saved) return null;

      const { tenantId } = JSON.parse(saved);
      if (!tenantId) return null;

      // Validate the user still has membership
      if (!identityBoundary.canSwitchToTenant(tenantId)) return null;

      // Restore
      if (this.switchWorkspace(tenantId, 'auto_restore')) {
        return tenantId;
      }
    } catch { /* corrupted storage */ }
    return null;
  }

  /**
   * Get recent context history for quick workspace switching.
   */
  getRecentContexts(): readonly RecentContext[] {
    return this._recentContexts;
  }

  // ══════════════════════════════════
  // DECISION ENGINE
  // ══════════════════════════════════

  /**
   * Evaluate the current identity context and return an intelligent decision.
   */
  evaluate(action?: string, resource?: string): IntelligenceDecision {
    const risk = this._lastRisk;
    const snapshot = this.snapshot();

    if (risk.level === 'critical') {
      return this._issueDecision('FORCE_LOGOUT', 'Risk level critical — session terminated', { risk });
    }

    if (snapshot.phase === 'anonymous') {
      return this._issueDecision('REQUIRE_SCOPE', 'User not authenticated', { phase: snapshot.phase });
    }

    if (snapshot.phase === 'authenticated') {
      return this._issueDecision('REQUIRE_SCOPE', 'Tenant/scope not resolved', { phase: snapshot.phase });
    }

    if (snapshot.isImpersonating && resource) {
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
    const context = identityBoundary.operationalContext;
    const workspaces = this.getAvailableWorkspaces();

    const now = Date.now();

    return {
      // Phase
      phase: this._phase,
      previousPhase: this._previousPhase,
      phaseChangedAt: this._phaseChangedAt,

      // Who
      userId: iblSnapshot.userId ?? dualIdentity.realIdentity?.userId ?? null,
      email: dualIdentity.realIdentity?.email ?? null,
      userType: this._userTypeDetection?.detectedType === 'unknown'
        ? null
        : (this._userTypeDetection?.detectedType ?? dualIdentity.activeIdentity.userType ?? null),
      platformRole: this._userTypeDetection?.platformRole ?? dualIdentity.realIdentity?.platformRole ?? null,
      userTypeDetection: this._userTypeDetection,

      // Where
      tenantId: context?.activeTenantId ?? iblSnapshot.activeTenantId ?? dualIdentity.activeIdentity.tenantId ?? null,
      tenantName: context?.activeTenantName ?? session?.targetTenantName ?? null,
      scopeLevel: context?.scopeLevel ?? iblSnapshot.scopeLevel ?? null,
      groupId: context?.activeGroupId ?? null,
      companyId: context?.activeCompanyId ?? null,
      effectiveRoles: context?.effectiveRoles ?? iblSnapshot.effectiveRoles,

      // Workspaces
      availableWorkspaces: workspaces,
      recentContexts: this._recentContexts,
      canSwitchWorkspace: workspaces.length > 1,

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

    // ── Unknown user type when scoped ──
    if (this._phase === 'scoped' && (!this._userTypeDetection || this._userTypeDetection.detectedType === 'unknown')) {
      signals.push({ signal: 'UNKNOWN_USER_TYPE', weight: 5, detail: 'User type not yet resolved' });
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
  // PRIVATE — CONTEXT HISTORY
  // ══════════════════════════════════

  private _recordCurrentContextInHistory(): void {
    const context = identityBoundary.operationalContext;
    if (!context) return;

    const durationMs = this._contextEnteredAt ? Date.now() - this._contextEnteredAt : 0;

    const entry: RecentContext = {
      tenantId: context.activeTenantId,
      tenantName: context.activeTenantName,
      role: context.membershipRole,
      scopeLevel: context.scopeLevel,
      groupId: context.activeGroupId,
      companyId: context.activeCompanyId,
      visitedAt: this._contextEnteredAt ?? Date.now(),
      durationMs,
    };

    // Remove duplicate (same tenant)
    this._recentContexts = this._recentContexts.filter(
      c => c.tenantId !== entry.tenantId,
    );

    // Add to front
    this._recentContexts.unshift(entry);

    // Trim
    if (this._recentContexts.length > MAX_RECENT_CONTEXTS) {
      this._recentContexts = this._recentContexts.slice(0, MAX_RECENT_CONTEXTS);
    }

    this._persistRecentContexts();
  }

  private _loadRecentContexts(): void {
    try {
      const raw = localStorage.getItem(RECENT_CONTEXTS_KEY);
      if (raw) {
        this._recentContexts = JSON.parse(raw);
      }
    } catch { /* corrupted */ }
  }

  private _persistRecentContexts(): void {
    try {
      localStorage.setItem(RECENT_CONTEXTS_KEY, JSON.stringify(this._recentContexts));
    } catch { /* storage full */ }
  }

  private _persistLastWorkspace(tenantId: string): void {
    try {
      localStorage.setItem(LAST_WORKSPACE_KEY, JSON.stringify({ tenantId, savedAt: Date.now() }));
    } catch { /* storage full */ }
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
      userTypeDetection: this._userTypeDetection,
      recentContextsCount: this._recentContexts.length,
      availableWorkspaces: this.getAvailableWorkspaces().length,
    };
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identityIntelligence = new IdentityIntelligenceService();
