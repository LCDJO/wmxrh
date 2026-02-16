/**
 * IBL — Public API barrel export
 * 
 * All 5 IBL components + types accessible from here.
 */

// ── Components ──
export { IdentitySessionManager } from './identity-session-manager';
export type { EstablishIdentityInput, RefreshScopesInput } from './identity-session-manager';

export { ContextSwitcherService } from './context-switcher.service';
export type { ContextSwitchedEvent, ContextSnapshot } from './context-switcher.service';

export { contextResolver } from './context-resolver';
export type { ResolvedContext, ScopeValidation, ResolutionStrategy, InitialContextResolution, PersistedContext } from './context-resolver';

export { multiScopeTokenBuilder } from './multi-scope-token-builder';
export type { MultiScopeToken, ScopeToken, QueryFilterSet } from './multi-scope-token-builder';

export { contextGuard, ContextGuardError } from './context-guard.middleware';
export type { GuardResult, GuardTarget, GuardCheckName } from './context-guard.middleware';

// ── Types ──
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
} from '../identity-boundary.types';
