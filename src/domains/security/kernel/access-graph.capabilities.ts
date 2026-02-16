/**
 * SecurityKernel — Future Access Capabilities
 * 
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TYPE FOUNDATIONS FOR FUTURE CAPABILITIES                        ║
 * ║                                                                  ║
 * ║  These types are defined now so the AccessGraph, Cache, and     ║
 * ║  Event system can evolve without breaking changes.               ║
 * ║                                                                  ║
 * ║  Capabilities:                                                   ║
 * ║    • Delegated Access    — user A grants access to user B        ║
 * ║    • Temporary Perms     — time-bounded role assignments         ║
 * ║    • Access Expiration   — auto-revoke after TTL                 ║
 * ║    • External IdP        — SSO / SAML / OIDC identity sources   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import type { TenantRole, ScopeType } from '@/domains/shared/types';
import type { PermissionAction, PermissionEntity } from '../permissions';

// ════════════════════════════════════
// 1. DELEGATED ACCESS
// ════════════════════════════════════

/**
 * A delegation record: user A grants a subset of their access to user B.
 * 
 * Future: stored in `access_delegations` table, processed during graph build.
 * The graph would add edges: DelegateUser → DelegatedScope with relation 'DELEGATED_BY'.
 */
export interface AccessDelegation {
  id: string;
  /** Who is granting access */
  delegator_id: string;
  /** Who receives access */
  delegate_id: string;
  tenant_id: string;
  /** What scope is being delegated */
  scope_type: ScopeType;
  scope_id: string | null;
  /** Which permissions are delegated (null = all that delegator has) */
  permissions: DelegatedPermission[] | null;
  /** When this delegation starts */
  starts_at: string;
  /** When this delegation expires (null = manual revocation only) */
  expires_at: string | null;
  /** Whether the delegate can further delegate (sub-delegation) */
  allow_sub_delegation: boolean;
  /** Reason for delegation (audit trail) */
  reason: string | null;
  /** Status lifecycle */
  status: DelegationStatus;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export interface DelegatedPermission {
  entity: PermissionEntity;
  actions: PermissionAction[];
}

export type DelegationStatus = 'active' | 'expired' | 'revoked' | 'pending_approval';

/**
 * Graph edge relation for delegated access.
 * Added to EdgeRelation union when implemented.
 */
export type DelegatedEdgeRelation = 'DELEGATED_BY' | 'DELEGATED_TO';

// ════════════════════════════════════
// 2. TEMPORARY PERMISSIONS
// ════════════════════════════════════

/**
 * A time-bounded role assignment.
 * 
 * Future: extends user_roles table with `expires_at` column.
 * The graph build step would filter out expired temporary roles.
 * AccessExpiration service runs periodic sweeps.
 */
export interface TemporaryPermission {
  id: string;
  user_id: string;
  tenant_id: string;
  /** The temporary role being granted */
  role: TenantRole;
  scope_type: ScopeType;
  scope_id: string | null;
  /** When this permission becomes active */
  starts_at: string;
  /** When this permission auto-expires */
  expires_at: string;
  /** Who granted this temporary permission */
  granted_by: string;
  /** Business reason */
  reason: string | null;
  /** Whether it has been consumed/expired */
  status: TemporaryPermissionStatus;
  created_at: string;
}

export type TemporaryPermissionStatus = 'active' | 'expired' | 'revoked' | 'consumed';

/**
 * Graph event for temporary permission lifecycle.
 */
export type TemporaryPermissionEventType =
  | 'TempPermGranted'
  | 'TempPermExpired'
  | 'TempPermRevoked'
  | 'TempPermConsumed';

// ════════════════════════════════════
// 3. ACCESS EXPIRATION
// ════════════════════════════════════

/**
 * Configuration for automatic access expiration.
 * 
 * Future: runs as a background service (edge function or cron)
 * that sweeps expired delegations and temporary permissions,
 * emitting graph events to invalidate caches.
 */
export interface AccessExpirationConfig {
  /** How often to run the expiration sweep (ms) */
  sweep_interval_ms: number;
  /** Grace period after expiration before hard removal (ms) */
  grace_period_ms: number;
  /** Whether to notify users before expiration */
  notify_before_expiry: boolean;
  /** How far in advance to notify (ms) */
  notification_lead_time_ms: number;
}

export const DEFAULT_EXPIRATION_CONFIG: AccessExpirationConfig = {
  sweep_interval_ms: 60_000, // 1 minute
  grace_period_ms: 0,
  notify_before_expiry: false,
  notification_lead_time_ms: 24 * 60 * 60_000, // 24 hours
};

/**
 * Result of an expiration sweep.
 * Used for monitoring and audit.
 */
export interface ExpirationSweepResult {
  swept_at: number;
  expired_delegations: string[];
  expired_temp_permissions: string[];
  errors: Array<{ id: string; error: string }>;
}

// ════════════════════════════════════
// 4. EXTERNAL IDENTITY PROVIDERS
// ════════════════════════════════════

/**
 * External Identity Provider configuration.
 * 
 * Future: stored in `identity_providers` table per tenant.
 * During graph build, external identities are mapped to internal
 * user IDs via `identity_mappings` table.
 */
export interface ExternalIdentityProvider {
  id: string;
  tenant_id: string;
  /** Provider type */
  provider_type: IdentityProviderType;
  /** Display name */
  name: string;
  /** Provider-specific configuration (encrypted at rest) */
  config: IdentityProviderConfig;
  /** Whether this IdP is active */
  enabled: boolean;
  /** Role mapping rules: external group → internal role */
  role_mappings: ExternalRoleMapping[];
  /** Default role for users from this IdP (if no mapping matches) */
  default_role: TenantRole | null;
  /** Default scope for users from this IdP */
  default_scope_type: ScopeType;
  default_scope_id: string | null;
  created_at: string;
  updated_at: string;
}

export type IdentityProviderType =
  | 'saml'
  | 'oidc'
  | 'oauth2'
  | 'ldap'
  | 'azure_ad'
  | 'google_workspace'
  | 'okta';

export interface IdentityProviderConfig {
  /** SSO endpoint */
  sso_url?: string;
  /** Metadata URL (SAML) or well-known URL (OIDC) */
  metadata_url?: string;
  /** Client ID (OIDC/OAuth2) */
  client_id?: string;
  /** Issuer (OIDC) */
  issuer?: string;
  /** Certificate (SAML) */
  certificate?: string;
  /** Attribute mappings */
  attribute_mappings?: Record<string, string>;
}

/**
 * Maps an external group/role to an internal TenantRole.
 * 
 * Example: Azure AD group "HR-Admins" → internal role "rh"
 */
export interface ExternalRoleMapping {
  /** External group/role identifier */
  external_group: string;
  /** Internal role to assign */
  internal_role: TenantRole;
  /** Scope restriction for this mapping */
  scope_type: ScopeType;
  scope_id: string | null;
}

/**
 * Mapping between external identity and internal user.
 * 
 * Future: stored in `identity_mappings` table.
 * Allows one internal user to have multiple external identities.
 */
export interface IdentityMapping {
  id: string;
  user_id: string;
  provider_id: string;
  /** External unique identifier (e.g., SAML NameID, OIDC sub) */
  external_id: string;
  /** External email (for matching/display) */
  external_email: string | null;
  /** External groups/roles (synced from IdP) */
  external_groups: string[];
  /** Last sync timestamp */
  last_synced_at: string;
  created_at: string;
}

// ════════════════════════════════════
// CAPABILITY FLAGS (for AccessGraph)
// ════════════════════════════════════

/**
 * Capabilities that can be enabled per-tenant.
 * The AccessGraph build step checks these flags to decide
 * whether to process delegations, temp perms, external IdPs, etc.
 */
export interface AccessCapabilities {
  delegated_access: boolean;
  temporary_permissions: boolean;
  access_expiration: boolean;
  external_identity_providers: boolean;
}

export const DEFAULT_CAPABILITIES: AccessCapabilities = {
  delegated_access: false,
  temporary_permissions: false,
  access_expiration: false,
  external_identity_providers: false,
};

/**
 * Extended AccessGraphInput for when capabilities are enabled.
 * The base AccessGraphInput remains unchanged for backward compat.
 */
export interface AccessGraphInputExtended {
  /** Active delegations for this user (as delegator or delegate) */
  delegations?: AccessDelegation[];
  /** Active temporary permissions for this user */
  temporaryPermissions?: TemporaryPermission[];
  /** External identity mappings */
  identityMappings?: IdentityMapping[];
  /** External role mappings from the IdP config */
  externalRoleMappings?: ExternalRoleMapping[];
  /** Tenant capability flags */
  capabilities?: AccessCapabilities;
}
