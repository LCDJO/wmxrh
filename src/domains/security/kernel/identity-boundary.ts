/**
 * SecurityKernel — Identity Boundary Layer (IBL)
 * 
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  IDENTITY BOUNDARY LAYER — COMPOSITOR                               ║
 * ║                                                                      ║
 * ║  Composes 5 specialized components:                                  ║
 * ║    1. IdentitySessionManager  → session lifecycle                    ║
 * ║    2. ContextSwitcherService  → validated context switching          ║
 * ║    3. ContextResolver         → stateless role/scope computation     ║
 * ║    4. MultiScopeTokenBuilder  → query-ready scope tokens             ║
 * ║    5. ContextGuardMiddleware  → pre-operation validation chain       ║
 * ║                                                                      ║
 * ║  CONCEITO CENTRAL:                                                   ║
 * ║    IdentitySession  → WHO (immutable per auth session)               ║
 * ║    OperationalContext → WHERE (mutable, validated)                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── Re-export all types from the shared type file ──
export type {
  IdentitySession,
  TenantScope,
  BoundaryIdentity,
  TenantMembership,
  IdentityProvider,
  OperationalContext,
  ContextSwitchRequest,
  ContextSwitchResult,
  IdentityBoundarySnapshot,
  AccessGraphSnapshot,
  AllowedScopes,
} from './identity-boundary.types';

// ── Re-export components ──
export { IdentitySessionManager } from './ibl/identity-session-manager';
export type { EstablishIdentityInput, RefreshScopesInput } from './ibl/identity-session-manager';
export { ContextSwitcherService } from './ibl/context-switcher.service';
export { contextResolver } from './ibl/context-resolver';
export type { ResolvedContext, ScopeValidation, ResolutionStrategy, InitialContextResolution, PersistedContext } from './ibl/context-resolver';
export { multiScopeTokenBuilder } from './ibl/multi-scope-token-builder';
export type { ScopeToken, QueryFilterSet } from './ibl/multi-scope-token-builder';
export { contextGuard, ContextGuardError } from './ibl/context-guard.middleware';
export type { GuardResult, GuardTarget, GuardCheckName } from './ibl/context-guard.middleware';

// ── Components ──
import { IdentitySessionManager } from './ibl/identity-session-manager';
import type { EstablishIdentityInput } from './ibl/identity-session-manager';
import { ContextSwitcherService } from './ibl/context-switcher.service';
import { contextGuard } from './ibl/context-guard.middleware';
import { multiScopeTokenBuilder } from './ibl/multi-scope-token-builder';
import type {
  IdentitySession,
  TenantScope,
  OperationalContext,
  ContextSwitchRequest,
  ContextSwitchResult,
  IdentityBoundarySnapshot,
} from './identity-boundary.types';
import type { ScopeToken, QueryFilterSet } from './ibl/multi-scope-token-builder';
import type { GuardResult, GuardTarget } from './ibl/context-guard.middleware';

// ════════════════════════════════════
// COMPOSITOR CLASS
// ════════════════════════════════════

export class IdentityBoundaryLayer {
  private readonly _sessionManager = new IdentitySessionManager();
  private readonly _switcher = new ContextSwitcherService();

  // ── IdentitySessionManager delegates ──

  establish(input: EstablishIdentityInput): IdentitySession {
    return this._sessionManager.establish(input);
  }

  clear(): void {
    this._sessionManager.clear();
    this._switcher.clear();
  }

  get identity(): IdentitySession | null {
    return this._sessionManager.session;
  }

  get isEstablished(): boolean {
    return this._sessionManager.isEstablished;
  }

  // ── ContextSwitcherService delegates ──

  switchContext(request: ContextSwitchRequest): ContextSwitchResult {
    return this._switcher.switch(this._sessionManager.session, request);
  }

  get operationalContext(): OperationalContext | null {
    return this._switcher.currentContext;
  }

  get hasActiveContext(): boolean {
    return this._switcher.currentContext !== null;
  }

  get switchCount(): number {
    return this._switcher.switchCount;
  }

  // ── ContextGuardMiddleware delegates ──

  guard(target?: GuardTarget): GuardResult {
    return contextGuard.validate(
      this._sessionManager.session,
      this._switcher.currentContext,
      target,
    );
  }

  requireContext(target?: GuardTarget): void {
    contextGuard.require(
      this._sessionManager.session,
      this._switcher.currentContext,
      target,
    );
  }

  get isReady(): boolean {
    return contextGuard.isReady(
      this._sessionManager.session,
      this._switcher.currentContext,
    );
  }

  // ── MultiScopeTokenBuilder delegates ──

  buildScopeToken(): ScopeToken | null {
    const session = this._sessionManager.session;
    const context = this._switcher.currentContext;
    if (!session || !context) return null;
    return multiScopeTokenBuilder.buildScopeToken(session, context);
  }

  buildQueryFilters(): QueryFilterSet | null {
    const token = this.buildScopeToken();
    if (!token) return null;
    return multiScopeTokenBuilder.buildQueryFilters(token);
  }

  // ── Convenience ──

  getAvailableTenants(): ReadonlyArray<TenantScope> {
    return this._sessionManager.session?.tenantScopes ?? [];
  }

  canSwitchToTenant(tenantId: string): boolean {
    return this._sessionManager.session?.tenantScopes.some(
      m => m.tenantId === tenantId
    ) ?? false;
  }

  snapshot(): IdentityBoundarySnapshot {
    const session = this._sessionManager.session;
    const context = this._switcher.currentContext;
    return {
      hasIdentity: this.isEstablished,
      userId: session?.userId ?? null,
      provider: session?.provider ?? null,
      authenticatedAt: session?.authenticatedAt ?? null,
      tenantCount: session?.tenantScopes.length ?? 0,
      tenantIds: session?.tenantIds ? [...session.tenantIds] : [],
      roles: session?.roles ? [...session.roles] : [],
      featureFlagCount: session?.featureFlags.length ?? 0,
      hasAccessGraph: !!session?.accessGraphSnapshot,
      allowedScopes: session?.allowedScopes ?? null,
      activeTenantId: context?.activeTenantId ?? null,
      scopeLevel: context?.scopeLevel ?? null,
      effectiveRoles: context?.effectiveRoles ? [...context.effectiveRoles] : [],
      switchCount: this._switcher.switchCount,
    };
  }

  // ── Direct component access (for advanced usage) ──

  get sessionManager(): IdentitySessionManager {
    return this._sessionManager;
  }

  get switcher(): ContextSwitcherService {
    return this._switcher;
  }
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

export const identityBoundary = new IdentityBoundaryLayer();
