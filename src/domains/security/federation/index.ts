/**
 * UIFE — Unified Identity Federation Engine
 *
 * Barrel export for the complete federation module.
 * Supports SAML 2.0, OpenID Connect, OAuth2, and multi-tenant federation.
 */

// ── Engine ──
export {
  createIdentityFederationEngine,
  getIdentityFederationEngine,
  resetFederationEngine,
} from './identity-federation-engine';

// ── Sub-services ──
export { createIdentityProviderRegistry } from './identity-provider-registry';
export { createSAMLServiceProvider, SAML_DEFAULT_ATTRIBUTE_MAP, mapSAMLAttributes } from './saml-service-provider';
export type { SAMLMappedIdentity, SAMLACSResult } from './saml-service-provider';
export { createOIDCProvider } from './oidc-provider';
export { createOAuthAuthorizationServer } from './oauth-authorization-server';
export { createTokenService } from './token-service';
export { createSessionManager, getUnifiedSession, getActiveUnifiedSessions, touchSession, extendSession } from './session-manager';
export type { UnifiedIdentitySession } from './session-manager';
export { createFederationAuditLogger } from './federation-audit-logger';
export { createFederationRoleMapper } from './federation-role-mapper';
export { createMultiTenantResolver } from './multi-tenant-resolver';
export type {
  TenantResolutionStrategy,
  TenantResolutionResult,
  MultiTenantResolverAPI,
  TenantDomainRecord,
} from './multi-tenant-resolver';

// ── Security Hardening ──
export {
  SECURITY_POLICY,
  PKCEEnforcer,
  TokenExpirationPolicy,
  RefreshTokenRotation,
  SessionRevocation,
  MFAPolicy,
} from './security-hardening';
export type {
  PKCEMethod,
  PKCEParams,
  PKCEVerification,
  MFAStatus,
  MFAMethod,
  MFAChallenge,
  MFAEnrollment,
  SecurityValidationResult,
  RefreshTokenRotationResult,
  SessionSecurityContext,
} from './security-hardening';

// ── UGE Provider ──
export { federationGraphProvider } from './federation-graph-provider';

// ── Kernel Events ──
export { FEDERATION_KERNEL_EVENTS } from './federation-events';
export type {
  FederationKernelEvent,
  UserFederatedLoginPayload,
  SAMLAssertionValidatedPayload,
  OIDCTokenIssuedPayload,
  OAuthClientAuthorizedPayload,
  SessionRevokedPayload,
} from './federation-events';
// ── Types ──
export type {
  FederationProtocol,
  IdPStatus,
  FederationSessionStatus,
  IdentityProviderConfig,
  AttributeMapping,
  FederationSession,
  SAMLAuthnRequest,
  SAMLResponse,
  SAMLAssertion,
  OIDCDiscoveryDocument,
  OIDCTokenSet,
  OIDCUserInfo,
  OIDCPlatformClaims,
  OAuth2AuthorizationRequest,
  OAuth2TokenRequest,
  OAuth2TokenResponse,
  OAuth2DeviceAuthorizationResponse,
  FederationEngineAPI,
  IdentityProviderRegistryAPI,
  SAMLServiceProviderAPI,
  OIDCProviderAPI,
  OAuthAuthorizationServerAPI,
  TokenServiceAPI,
  SessionManagerAPI,
  FederationAuditLoggerAPI,
  FederationRoleMappingAPI,
  CreateSessionParams,
  FederationAuditEvent,
  FederationEventType,
  FederationAuditEntry,
  AuditQueryFilters,
  ValidationResult,
  FederationHealthReport,
  ResolvedRoles,
  RoleMappingRule,
  RoleMappingInput,
} from './types';
