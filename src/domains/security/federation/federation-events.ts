/**
 * UIFE — Federation Kernel Events
 *
 * Canonical events emitted through GlobalEventKernel for cross-cutting
 * integration with Observability, Self-Healing, and Governance layers.
 */

export const FEDERATION_KERNEL_EVENTS = {
  /** User completed a federated login (any protocol) */
  UserFederatedLogin: 'federation:user_federated_login',
  /** SAML assertion was validated and identity extracted */
  SAMLAssertionValidated: 'federation:saml_assertion_validated',
  /** OIDC token set was issued after code exchange */
  OIDCTokenIssued: 'federation:oidc_token_issued',
  /** OAuth2 client was authorized (client_credentials or auth code) */
  OAuthClientAuthorized: 'federation:oauth_client_authorized',
  /** A federation session was revoked (logout, timeout, or admin action) */
  SessionRevoked: 'federation:session_revoked',
} as const;

export type FederationKernelEvent = typeof FEDERATION_KERNEL_EVENTS[keyof typeof FEDERATION_KERNEL_EVENTS];

// ── Payload types ───────────────────────────────────────────────

export interface UserFederatedLoginPayload {
  user_id: string;
  tenant_id: string;
  protocol: 'saml' | 'oidc' | 'oauth2';
  idp_config_id: string;
  idp_name: string;
  email: string;
  ip_address: string | null;
  session_id: string | null;
}

export interface SAMLAssertionValidatedPayload {
  tenant_id: string;
  idp_config_id: string;
  idp_name: string;
  name_id: string;
  session_index: string | null;
  attributes: Record<string, string>;
  assertion_valid: boolean;
}

export interface OIDCTokenIssuedPayload {
  tenant_id: string;
  idp_config_id: string;
  user_id: string | null;
  client_id: string;
  scopes: string[];
  token_type: 'access_token' | 'id_token' | 'refresh_token';
  expires_in: number;
}

export interface OAuthClientAuthorizedPayload {
  tenant_id: string;
  client_id: string;
  grant_type: 'client_credentials' | 'authorization_code' | 'refresh_token';
  scopes: string[];
  user_id: string | null;
}

export interface SessionRevokedPayload {
  session_id: string;
  tenant_id: string;
  user_id: string | null;
  reason: 'logout' | 'timeout' | 'idle_timeout' | 'admin_revoke' | 'token_reuse' | 'concurrent_limit';
  protocol: 'saml' | 'oidc' | 'oauth2' | null;
}

export const __DOMAIN_CATALOG = {
  domain: 'Federation',
  color: 'hsl(210 80% 55%)',
  events: [
    { name: 'UserFederatedLogin', description: 'Login federado concluído' },
    { name: 'SAMLAssertionValidated', description: 'Asserção SAML validada' },
    { name: 'OIDCTokenIssued', description: 'Token OIDC emitido' },
    { name: 'OAuthClientAuthorized', description: 'Cliente OAuth2 autorizado' },
    { name: 'SessionRevoked', description: 'Sessão federada revogada' },
  ],
};
