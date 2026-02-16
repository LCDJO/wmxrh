/**
 * Dual Identity Engine
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CONTROLLED IMPERSONATION ENGINE                                    ║
 * ║                                                                      ║
 * ║  Allows PlatformUsers to operate within a Tenant's context           ║
 * ║  WITHOUT breaking the identity boundary.                             ║
 * ║                                                                      ║
 * ║  ARCHITECTURE:                                                       ║
 * ║    DualIdentityEngine                                                ║
 * ║     ├── RealIdentity  (frozen, from Platform Identity Layer)         ║
 * ║     ├── ActiveIdentity (synthetic, from impersonation context)       ║
 * ║     ├── ImpersonationSession (audited, time-limited)                 ║
 * ║     └── Audit trail (every action tagged with impersonated_by)       ║
 * ║                                                                      ║
 * ║  INTEGRATION POINTS:                                                 ║
 * ║    • Platform Identity Layer → resolves RealIdentity                 ║
 * ║    • Identity Boundary Layer → overrides OperationalContext           ║
 * ║    • Security Pipeline → tags audit with impersonation metadata      ║
 * ║    • IBL Domain Events → emits ImpersonationStarted/Ended            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import type { PlatformRoleType } from '@/domains/platform/PlatformGuard';
import { auditSecurity } from './audit-security.service';
import { emitIBLEvent } from './ibl/domain-events';
import type {
  RealIdentity,
  ActiveIdentity,
  ImpersonationSession,
  StartImpersonationRequest,
  StartImpersonationResult,
  EndImpersonationResult,
  ImpersonationDenialReason,
  ImpersonationEvent,
} from './dual-identity-engine.types';
import {
  IMPERSONATION_ALLOWED_ROLES,
  DEFAULT_SIMULATED_ROLE,
  MAX_IMPERSONATION_DURATION_MINUTES,
  DEFAULT_IMPERSONATION_DURATION_MINUTES,
} from './dual-identity-engine.types';

// ════════════════════════════════════
// EVENT BUS (local)
// ════════════════════════════════════

type ImpersonationListener = (event: ImpersonationEvent) => void;
const listeners = new Set<ImpersonationListener>();
const eventLog: ImpersonationEvent[] = [];
const MAX_LOG = 100;

export function onImpersonationEvent(listener: ImpersonationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getImpersonationEventLog(): readonly ImpersonationEvent[] {
  return eventLog;
}

function emitImpersonationEvent(event: ImpersonationEvent): void {
  eventLog.push(event);
  if (eventLog.length > MAX_LOG) eventLog.splice(0, eventLog.length - MAX_LOG);

  console.info(`[DualIdentity] ${event.type}`, event);

  for (const fn of listeners) {
    try { fn(event); } catch { /* swallow */ }
  }

  // Also emit to IBL event bus for cross-layer visibility
  emitIBLEvent(event as any);
}

// ════════════════════════════════════
// ENGINE
// ════════════════════════════════════

export class DualIdentityEngine {
  private _realIdentity: RealIdentity | null = null;
  private _activeSession: ImpersonationSession | null = null;
  private _expirationTimer: ReturnType<typeof setTimeout> | null = null;

  // ── RealIdentity lifecycle ──

  /**
   * Set the real identity from the Platform Identity Layer.
   * Called once on login/session restore.
   */
  setRealIdentity(identity: RealIdentity): void {
    // INVARIANT: RealIdentity is NEVER mutated during an active impersonation.
    // It can only be set when no session is active (login/restore) or cleared on logout.
    if (this._activeSession) {
      console.error('[DualIdentity] SECURITY: Cannot mutate RealIdentity during active impersonation.');
      return;
    }
    this._realIdentity = Object.freeze({ ...identity });
  }

  clearRealIdentity(): void {
    if (this._activeSession) {
      this.endImpersonation('forced');
    }
    this._realIdentity = null;
  }

  get realIdentity(): RealIdentity | null {
    return this._realIdentity;
  }

  // ── Active Identity (resolves to real or impersonated) ──

  get activeIdentity(): ActiveIdentity {
    if (this._activeSession) {
      // Check expiration
      if (Date.now() > this._activeSession.expiresAt) {
        this.endImpersonation('expired');
        return this._buildNativeActiveIdentity();
      }
      return this._activeSession.activeIdentity;
    }
    return this._buildNativeActiveIdentity();
  }

  get isImpersonating(): boolean {
    if (!this._activeSession) return false;
    if (Date.now() > this._activeSession.expiresAt) {
      this.endImpersonation('expired');
      return false;
    }
    return true;
  }

  get currentSession(): ImpersonationSession | null {
    if (!this._activeSession) return null;
    if (Date.now() > this._activeSession.expiresAt) {
      this.endImpersonation('expired');
      return null;
    }
    return this._activeSession;
  }

  // ── Impersonation lifecycle ──

  /**
   * Start impersonating a tenant context.
   *
   * SECURITY CHECKS:
   *   1. Caller must have RealIdentity set
   *   2. RealIdentity.userType must be 'platform'
   *   3. platformRole must be in IMPERSONATION_ALLOWED_ROLES
   *   4. Cannot start if already impersonating
   *   5. Reason is required (audit compliance)
   *   6. Duration must be within limits
   */
  startImpersonation(request: StartImpersonationRequest): StartImpersonationResult {
    // ── Validation ──

    if (!this._realIdentity) {
      return this._deny('NOT_PLATFORM_USER', 'Nenhuma identidade real estabelecida.');
    }

    // RULE: TenantUsers can NEVER impersonate another tenant
    if (this._realIdentity.userType !== 'platform') {
      return this._deny('NOT_PLATFORM_USER', 'Apenas usuários da plataforma podem impersonar. TenantUsers não possuem esse privilégio.', request.targetTenantId);
    }

    // RULE: platform_finance is explicitly denied impersonation
    if (this._realIdentity.platformRole === 'platform_finance') {
      return this._deny(
        'INSUFFICIENT_ROLE',
        'platform_finance não possui permissão de impersonação por política de segurança.',
        request.targetTenantId,
      );
    }

    if (!this._realIdentity.platformRole || !IMPERSONATION_ALLOWED_ROLES.includes(this._realIdentity.platformRole)) {
      return this._deny(
        'INSUFFICIENT_ROLE',
        `Role "${this._realIdentity.platformRole}" não tem permissão para impersonar. Requer: ${IMPERSONATION_ALLOWED_ROLES.join(', ')}`,
        request.targetTenantId,
      );
    }

    if (this._activeSession) {
      return this._deny('ALREADY_IMPERSONATING', `Já existe uma sessão de impersonação ativa para tenant ${this._activeSession.targetTenantId}.`, request.targetTenantId);
    }

    if (!request.reason?.trim()) {
      return this._deny('REASON_REQUIRED', 'Motivo é obrigatório para impersonação (compliance).', request.targetTenantId);
    }

    const durationMin = request.maxDurationMinutes ?? DEFAULT_IMPERSONATION_DURATION_MINUTES;
    if (durationMin > MAX_IMPERSONATION_DURATION_MINUTES) {
      return this._deny('DURATION_EXCEEDED', `Duração máxima é ${MAX_IMPERSONATION_DURATION_MINUTES} minutos. Solicitado: ${durationMin}.`, request.targetTenantId);
    }

    // ── Build session ──

    const sessionId = `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const simulatedRole = request.simulatedRole ?? DEFAULT_SIMULATED_ROLE;
    const now = Date.now();
    const expiresAt = now + durationMin * 60_000;

    const activeIdentity: ActiveIdentity = Object.freeze({
      userId: this._realIdentity.userId,
      email: this._realIdentity.email,
      userType: 'tenant' as const,
      tenantId: request.targetTenantId,
      effectiveRole: simulatedRole,
      isImpersonated: true,
      impersonatedBy: this._realIdentity.userId,
    });

    this._activeSession = {
      id: sessionId,
      realIdentity: this._realIdentity,
      activeIdentity,
      targetTenantId: request.targetTenantId,
      targetTenantName: request.targetTenantName,
      simulatedRole,
      reason: request.reason.trim(),
      startedAt: now,
      expiresAt,
      operationCount: 0,
    };

    // ── Auto-expire timer ──
    this._clearTimer();
    this._expirationTimer = setTimeout(() => {
      if (this._activeSession?.id === sessionId) {
        this.endImpersonation('expired');
      }
    }, durationMin * 60_000);

    // ── Audit ──
    auditSecurity.log({
      action: 'identity_established' as any,
      resource: 'dual_identity_engine',
      result: 'success',
      reason: `Impersonation started: ${this._realIdentity.email} → tenant ${request.targetTenantName} as ${simulatedRole}`,
      user_id: this._realIdentity.userId,
      tenant_id: request.targetTenantId,
      metadata: {
        sessionId,
        impersonatedBy: this._realIdentity.userId,
        platformRole: this._realIdentity.platformRole,
        simulatedRole,
        reason: request.reason,
        expiresAt,
      },
    });

    // ── Event ──
    emitImpersonationEvent({
      type: 'ImpersonationStarted',
      timestamp: now,
      sessionId,
      realUserId: this._realIdentity.userId,
      realEmail: this._realIdentity.email,
      platformRole: this._realIdentity.platformRole!,
      targetTenantId: request.targetTenantId,
      targetTenantName: request.targetTenantName,
      simulatedRole,
      reason: request.reason,
      expiresAt,
    });

    return {
      success: true,
      session: this._activeSession,
      reason: `Impersonação iniciada: operando como ${simulatedRole} no tenant ${request.targetTenantName}`,
    };
  }

  /**
   * End the current impersonation session.
   */
  endImpersonation(endReason: 'manual' | 'expired' | 'forced' = 'manual'): EndImpersonationResult {
    if (!this._activeSession) {
      return { success: false, reason: 'Nenhuma sessão de impersonação ativa.', operationCount: 0, durationMs: 0 };
    }

    const session = this._activeSession;
    const durationMs = Date.now() - session.startedAt;

    // ── Clean up ──
    this._activeSession = null;
    this._clearTimer();

    // ── Audit ──
    auditSecurity.log({
      action: 'identity_cleared' as any,
      resource: 'dual_identity_engine',
      result: 'success',
      reason: `Impersonation ended (${endReason}): ${session.realIdentity.email} left tenant ${session.targetTenantName}`,
      user_id: session.realIdentity.userId,
      tenant_id: session.targetTenantId,
      metadata: {
        sessionId: session.id,
        endReason,
        durationMs,
        operationCount: session.operationCount,
        simulatedRole: session.simulatedRole,
      },
    });

    // ── Event ──
    emitImpersonationEvent({
      type: 'ImpersonationEnded',
      timestamp: Date.now(),
      sessionId: session.id,
      realUserId: session.realIdentity.userId,
      targetTenantId: session.targetTenantId,
      endReason,
      durationMs,
      operationCount: session.operationCount,
    });

    return {
      success: true,
      reason: `Impersonação encerrada (${endReason}). ${session.operationCount} operações realizadas em ${Math.round(durationMs / 1000)}s.`,
      operationCount: session.operationCount,
      durationMs,
    };
  }

  /**
   * Record an operation performed during impersonation (for audit counting).
   */
  recordOperation(): void {
    if (this._activeSession) {
      (this._activeSession as any).operationCount = this._activeSession.operationCount + 1;
    }
  }

  // ── Helpers for SecurityPipeline integration ──

  /**
   * Returns metadata to be injected into every audit entry during impersonation.
   */
  getAuditMetadata(): Record<string, unknown> | null {
    if (!this._activeSession) return null;
    return {
      impersonated: true,
      impersonatedBy: this._activeSession.realIdentity.userId,
      impersonatedByEmail: this._activeSession.realIdentity.email,
      impersonationSessionId: this._activeSession.id,
      platformRole: this._activeSession.realIdentity.platformRole,
      simulatedRole: this._activeSession.simulatedRole,
      impersonationReason: this._activeSession.reason,
    };
  }

  /**
   * Get remaining time for the current impersonation session.
   */
  getRemainingMs(): number {
    if (!this._activeSession) return 0;
    return Math.max(0, this._activeSession.expiresAt - Date.now());
  }

  /**
   * Snapshot for debugging/UI.
   */
  snapshot() {
    return {
      hasRealIdentity: !!this._realIdentity,
      realUserId: this._realIdentity?.userId ?? null,
      realUserType: this._realIdentity?.userType ?? null,
      realPlatformRole: this._realIdentity?.platformRole ?? null,
      isImpersonating: this.isImpersonating,
      activeUserId: this.activeIdentity.userId,
      activeUserType: this.activeIdentity.userType,
      activeTenantId: this.activeIdentity.tenantId,
      activeRole: this.activeIdentity.effectiveRole,
      sessionId: this._activeSession?.id ?? null,
      remainingMs: this.getRemainingMs(),
      operationCount: this._activeSession?.operationCount ?? 0,
    };
  }

  // ════════════════════════════════════
  // PRIVATE
  // ════════════════════════════════════

  private _buildNativeActiveIdentity(): ActiveIdentity {
    if (!this._realIdentity) {
      return {
        userId: '',
        email: null,
        userType: 'tenant',
        tenantId: null,
        effectiveRole: 'viewer',
        isImpersonated: false,
        impersonatedBy: null,
      };
    }
    return {
      userId: this._realIdentity.userId,
      email: this._realIdentity.email,
      userType: this._realIdentity.userType,
      tenantId: null,
      effectiveRole: this._realIdentity.platformRole ?? 'viewer',
      isImpersonated: false,
      impersonatedBy: null,
    };
  }

  private _deny(
    denialReason: ImpersonationDenialReason,
    detail: string,
    targetTenantId?: string | null,
  ): StartImpersonationResult {
    emitImpersonationEvent({
      type: 'ImpersonationDenied',
      timestamp: Date.now(),
      realUserId: this._realIdentity?.userId ?? 'unknown',
      targetTenantId: targetTenantId ?? null,
      denialReason,
      detail,
    });

    auditSecurity.logAccessDenied({
      resource: 'dual_identity_engine:impersonation',
      reason: `[${denialReason}] ${detail}`,
      metadata: { denialReason, targetTenantId },
    });

    return { success: false, session: null, reason: detail, failedValidation: denialReason };
  }

  private _clearTimer(): void {
    if (this._expirationTimer) {
      clearTimeout(this._expirationTimer);
      this._expirationTimer = null;
    }
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const dualIdentityEngine = new DualIdentityEngine();
