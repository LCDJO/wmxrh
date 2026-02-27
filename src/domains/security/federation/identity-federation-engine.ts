/**
 * UIFE — IdentityFederationEngine
 *
 * Main orchestrator for the Unified Identity Federation Engine.
 * Composes all sub-services and exposes a single API surface.
 *
 * Integrations:
 *   - Security Kernel → SecurityContext federation enrichment
 *   - Platform IAM → Platform-level IdP management
 *   - Tenant IAM → Tenant-scoped IdP configs
 *   - API Management / Developer Portal → OAuth2 AS
 *   - Unified Graph Engine → Federation graph provider
 *   - Control Plane → Federation health & audit
 */

import { createIdentityProviderRegistry } from './identity-provider-registry';
import { createSAMLServiceProvider } from './saml-service-provider';
import { createOIDCProvider } from './oidc-provider';
import { createOAuthAuthorizationServer } from './oauth-authorization-server';
import { createTokenService } from './token-service';
import { createSessionManager } from './session-manager';
import { createFederationAuditLogger } from './federation-audit-logger';
import { createFederationRoleMapper } from './federation-role-mapper';
import type {
  FederationEngineAPI,
  FederationHealthReport,
  IdentityProviderConfig,
} from './types';

let currentTenantId: string | null = null;
let idpCache: IdentityProviderConfig[] = [];

export function createIdentityFederationEngine(): FederationEngineAPI {
  const registry = createIdentityProviderRegistry();
  const saml = createSAMLServiceProvider();
  const oidc = createOIDCProvider();
  const oauth = createOAuthAuthorizationServer();
  const tokens = createTokenService();
  const sessions = createSessionManager();
  const audit = createFederationAuditLogger();
  const roleMapper = createFederationRoleMapper();

  const engine: FederationEngineAPI = {
    registry,
    saml,
    oidc,
    oauth,
    tokens,
    sessions,
    audit,
    roleMapper,

    async initialize(tenantId) {
      currentTenantId = tenantId;
      idpCache = await registry.list(tenantId);

      // Pre-discover OIDC endpoints for active IdPs
      const oidcIdps = idpCache.filter(
        idp => idp.protocol === 'oidc' && idp.status === 'active' && idp.issuer_url
      );
      await Promise.allSettled(
        oidcIdps.map(idp => oidc.discover(idp.issuer_url!))
      );

      await audit.log({
        tenant_id: tenantId,
        event_type: 'session_created',
        success: true,
        details: {
          action: 'engine_initialized',
          idp_count: idpCache.length,
          active_idps: idpCache.filter(i => i.status === 'active').length,
        },
      });

      console.log(`[UIFE] Initialized for tenant ${tenantId} — ${idpCache.length} IdPs loaded`);
    },

    async resolveIdPForDomain(email, tenantId) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) return null;

      // Check cache first
      const cached = idpCache.find(
        idp => idp.status === 'active' && idp.allowed_domains.includes(domain)
      );
      if (cached) return cached;

      // Fallback to DB query
      return registry.getByDomain(domain, tenantId);
    },

    getHealth(): FederationHealthReport {
      return {
        initialized: currentTenantId !== null,
        tenant_id: currentTenantId,
        idp_count: idpCache.length,
        active_sessions: 0, // Would be populated from session manager
        last_event_at: null,
        protocol_support: {
          saml: true,
          oidc: true,
          oauth2: true,
        },
      };
    },
  };

  return engine;
}

// ════════════════════════════════════
// SINGLETON
// ════════════════════════════════════

let _instance: FederationEngineAPI | null = null;

export function getIdentityFederationEngine(): FederationEngineAPI {
  if (!_instance) {
    _instance = createIdentityFederationEngine();
  }
  return _instance;
}

/**
 * Reset singleton (for testing).
 */
export function resetFederationEngine(): void {
  _instance = null;
  currentTenantId = null;
  idpCache = [];
}
