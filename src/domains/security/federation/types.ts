/**
 * UIFE — Unified Identity Federation Engine — Type definitions.
 *
 * Covers SAML 2.0, OIDC, OAuth2 and multi-tenant federation types.
 */

// ════════════════════════════════════
// PROTOCOL ENUMS
// ════════════════════════════════════

export type FederationProtocol = 'saml' | 'oidc' | 'oauth2';
export type IdPStatus = 'draft' | 'active' | 'suspended' | 'archived';
export type FederationSessionStatus = 'pending' | 'authenticated' | 'expired' | 'revoked';

// ════════════════════════════════════
// IDENTITY PROVIDER CONFIG
// ════════════════════════════════════

export interface IdentityProviderConfig {
  id: string;
  tenant_id: string;
  name: string;
  protocol: FederationProtocol;
  // SAML
  entity_id: string | null;
  metadata_url: string | null;
  sso_url: string | null;
  slo_url: string | null;
  certificate: string | null;
  // OIDC
  issuer_url: string | null;
  client_id: string | null;
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  userinfo_endpoint: string | null;
  jwks_uri: string | null;
  // Shared
  attribute_mapping: AttributeMapping;
  allowed_domains: string[];
  auto_provision_users: boolean;
  default_role: string | null;
  scopes: string[];
  status: IdPStatus;
  is_primary: boolean;
  display_name: string | null;
  icon_url: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttributeMapping {
  /** External attribute → internal field mapping */
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  groups?: string;
  role?: string;
  department?: string;
  [key: string]: string | undefined;
}

// ════════════════════════════════════
// FEDERATION SESSION
// ════════════════════════════════════

export interface FederationSession {
  id: string;
  tenant_id: string;
  idp_config_id: string;
  user_id: string | null;
  protocol: FederationProtocol;
  session_index: string | null;
  name_id: string | null;
  external_subject: string | null;
  attributes: Record<string, unknown>;
  status: FederationSessionStatus;
  ip_address: string | null;
  user_agent: string | null;
  started_at: string;
  authenticated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ════════════════════════════════════
// SAML TYPES
// ════════════════════════════════════

export interface SAMLAuthnRequest {
  id: string;
  issuer: string;
  destination: string;
  assertion_consumer_service_url: string;
  name_id_format: string;
  force_authn: boolean;
  is_passive: boolean;
  relay_state?: string;
}

export interface SAMLResponse {
  id: string;
  in_response_to: string;
  issuer: string;
  status_code: string;
  assertion?: SAMLAssertion;
  signature_valid: boolean;
}

export interface SAMLAssertion {
  subject_name_id: string;
  subject_name_id_format: string;
  session_index: string;
  authn_instant: string;
  authn_context_class: string;
  conditions: {
    not_before: string;
    not_on_or_after: string;
    audience_restrictions: string[];
  };
  attributes: Record<string, string | string[]>;
}

// ════════════════════════════════════
// OIDC TYPES
// ════════════════════════════════════

export interface OIDCDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
}

export interface OIDCTokenSet {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OIDCUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  picture?: string;
  locale?: string;
  [key: string]: unknown;
}

// ════════════════════════════════════
// OAUTH2 TYPES
// ════════════════════════════════════

export interface OAuth2AuthorizationRequest {
  response_type: 'code' | 'token';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  code_challenge?: string;
  code_challenge_method?: 'S256' | 'plain';
  nonce?: string;
}

export interface OAuth2TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token' | 'client_credentials' | 'urn:ietf:params:oauth:grant-type:device_code';
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
  device_code?: string;
  scope?: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

// ════════════════════════════════════
// FEDERATION ENGINE API
// ════════════════════════════════════

export interface FederationEngineAPI {
  /** Registry */
  registry: IdentityProviderRegistryAPI;
  /** SAML SP */
  saml: SAMLServiceProviderAPI;
  /** OIDC */
  oidc: OIDCProviderAPI;
  /** OAuth2 Authorization Server */
  oauth: OAuthAuthorizationServerAPI;
  /** Token service */
  tokens: TokenServiceAPI;
  /** Session management */
  sessions: SessionManagerAPI;
  /** Audit */
  audit: FederationAuditLoggerAPI;

  /** Initialize the engine for a tenant */
  initialize(tenantId: string): Promise<void>;
  /** Resolve which IdP handles a given email domain */
  resolveIdPForDomain(email: string, tenantId: string): Promise<IdentityProviderConfig | null>;
  /** Get engine health */
  getHealth(): FederationHealthReport;
}

export interface IdentityProviderRegistryAPI {
  list(tenantId: string): Promise<IdentityProviderConfig[]>;
  getById(id: string): Promise<IdentityProviderConfig | null>;
  getByDomain(domain: string, tenantId: string): Promise<IdentityProviderConfig | null>;
  create(config: Partial<IdentityProviderConfig> & { tenant_id: string; name: string; protocol: FederationProtocol }): Promise<IdentityProviderConfig>;
  update(id: string, patch: Partial<IdentityProviderConfig>): Promise<IdentityProviderConfig>;
  activate(id: string): Promise<void>;
  suspend(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  validateConfig(config: IdentityProviderConfig): ValidationResult;
}

export interface SAMLServiceProviderAPI {
  /** Generate AuthnRequest XML for a given IdP */
  createAuthnRequest(idpConfig: IdentityProviderConfig, relayState?: string): SAMLAuthnRequest;
  /** Build redirect URL for SP-initiated SSO */
  buildLoginUrl(idpConfig: IdentityProviderConfig, relayState?: string): string;
  /** Parse and validate a SAML Response */
  processResponse(samlResponse: string, idpConfig: IdentityProviderConfig): Promise<SAMLResponse>;
  /** Build SLO request */
  createLogoutRequest(idpConfig: IdentityProviderConfig, nameId: string, sessionIndex: string): string;
  /** Get SP metadata XML */
  getMetadata(tenantId: string): string;
}

export interface OIDCProviderAPI {
  /** Discover OIDC endpoints from issuer URL */
  discover(issuerUrl: string): Promise<OIDCDiscoveryDocument>;
  /** Build authorization URL */
  buildAuthorizationUrl(idpConfig: IdentityProviderConfig, state: string, nonce: string): string;
  /** Exchange authorization code for tokens */
  exchangeCode(idpConfig: IdentityProviderConfig, code: string, codeVerifier?: string): Promise<OIDCTokenSet>;
  /** Validate an ID token */
  validateIdToken(idToken: string, idpConfig: IdentityProviderConfig): Promise<OIDCUserInfo>;
  /** Fetch user info from userinfo endpoint */
  fetchUserInfo(accessToken: string, idpConfig: IdentityProviderConfig): Promise<OIDCUserInfo>;
}

export interface OAuth2DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface OAuthAuthorizationServerAPI {
  /** Generate authorization code (stores server-side via edge fn) */
  createAuthorizationCode(request: OAuth2AuthorizationRequest, userId: string, tenantId: string): Promise<string>;
  /** Exchange code/credentials/refresh for tokens (delegates to edge fn) */
  exchangeToken(request: OAuth2TokenRequest): Promise<OAuth2TokenResponse>;
  /** Revoke a token (RFC 7009) */
  revokeToken(token: string, tokenType: 'access_token' | 'refresh_token'): Promise<void>;
  /** Introspect a token (RFC 7662) */
  introspectToken(token: string): Promise<{ active: boolean; sub?: string; scope?: string; client_id?: string; exp?: number }>;
  /** Device Authorization Request (RFC 8628) */
  requestDeviceAuthorization(clientId: string, scope: string, tenantId: string): Promise<OAuth2DeviceAuthorizationResponse>;
  /** Approve a device code by user_code */
  approveDeviceCode(userCode: string, userId: string): Promise<void>;
  /** Deny a device code */
  denyDeviceCode(userCode: string): Promise<void>;
}

export interface TokenServiceAPI {
  /** Issue a platform token for a federated user */
  issueToken(userId: string, tenantId: string, scopes: string[], sessionId: string): Promise<string>;
  /** Validate a platform token */
  validateToken(token: string): Promise<{ valid: boolean; userId?: string; tenantId?: string; scopes?: string[] }>;
  /** Refresh a token */
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }>;
  /** Revoke tokens for a session */
  revokeSessionTokens(sessionId: string): Promise<void>;
}

export interface SessionManagerAPI {
  /** Create a federation session */
  create(params: CreateSessionParams): Promise<FederationSession>;
  /** Mark session as authenticated */
  authenticate(sessionId: string, userId: string, attributes: Record<string, unknown>): Promise<FederationSession>;
  /** Get active sessions for a user */
  getActiveSessions(userId: string, tenantId: string): Promise<FederationSession[]>;
  /** Revoke a session */
  revoke(sessionId: string, reason?: string): Promise<void>;
  /** Revoke all sessions for a user */
  revokeAll(userId: string, tenantId: string): Promise<number>;
  /** Check if a session is valid */
  isValid(sessionId: string): Promise<boolean>;
  /** Clean up expired sessions */
  cleanup(tenantId: string): Promise<number>;
}

export interface FederationAuditLoggerAPI {
  /** Log a federation event */
  log(event: FederationAuditEvent): Promise<void>;
  /** Query audit logs */
  query(tenantId: string, filters?: AuditQueryFilters): Promise<FederationAuditEntry[]>;
  /** Get recent events for a session */
  getSessionEvents(sessionId: string): Promise<FederationAuditEntry[]>;
}

// ════════════════════════════════════
// SUPPORTING TYPES
// ════════════════════════════════════

export interface CreateSessionParams {
  tenant_id: string;
  idp_config_id: string;
  protocol: FederationProtocol;
  ip_address?: string;
  user_agent?: string;
}

export interface FederationAuditEvent {
  tenant_id: string;
  idp_config_id?: string;
  session_id?: string;
  user_id?: string;
  event_type: FederationEventType;
  protocol?: FederationProtocol;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
  error_message?: string;
}

export type FederationEventType =
  | 'idp_created' | 'idp_updated' | 'idp_activated' | 'idp_suspended' | 'idp_deleted'
  | 'saml_authn_request' | 'saml_response_received' | 'saml_response_validated' | 'saml_response_failed'
  | 'saml_slo_request' | 'saml_slo_response'
  | 'oidc_auth_request' | 'oidc_code_exchange' | 'oidc_token_validated' | 'oidc_token_failed'
  | 'oauth_code_issued' | 'oauth_token_exchanged' | 'oauth_token_revoked'
  | 'session_created' | 'session_authenticated' | 'session_revoked' | 'session_expired'
  | 'user_provisioned' | 'user_linked' | 'user_deprovisioned';

export interface FederationAuditEntry {
  id: string;
  tenant_id: string;
  idp_config_id: string | null;
  session_id: string | null;
  user_id: string | null;
  event_type: string;
  protocol: FederationProtocol | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AuditQueryFilters {
  event_type?: FederationEventType;
  user_id?: string;
  idp_config_id?: string;
  session_id?: string;
  success?: boolean;
  from?: string;
  to?: string;
  limit?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FederationHealthReport {
  initialized: boolean;
  tenant_id: string | null;
  idp_count: number;
  active_sessions: number;
  last_event_at: string | null;
  protocol_support: {
    saml: boolean;
    oidc: boolean;
    oauth2: boolean;
  };
}
