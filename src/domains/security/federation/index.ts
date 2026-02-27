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
export { createSessionManager } from './session-manager';
export { createFederationAuditLogger } from './federation-audit-logger';

// ── UGE Provider ──
export { federationGraphProvider } from './federation-graph-provider';

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
  CreateSessionParams,
  FederationAuditEvent,
  FederationEventType,
  FederationAuditEntry,
  AuditQueryFilters,
  ValidationResult,
  FederationHealthReport,
} from './types';
