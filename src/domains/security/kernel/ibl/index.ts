/**
 * IBL — Public API barrel export
 * 
 * All 5 IBL components + domain events accessible from here.
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

// ── Session Cache ──
export { identitySessionCache, computeAccessGraphHash } from './identity-session-cache';
export type { IdentitySessionCacheEntry, OperationalContextSnapshot } from './identity-session-cache';

// ── Domain Events ──
export { emitIBLEvent, onIBLEvent, onIBLEventType, getIBLEventLog, clearIBLEventLog } from './domain-events';
export type {
  IBLDomainEventType, IBLDomainEvent,
  ContextSwitchedPayload, ContextSnapshotPayload,
  IdentitySessionStartedPayload,
  IdentitySessionRefreshedPayload,
  UnauthorizedContextSwitchPayload,
} from './domain-events';

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
