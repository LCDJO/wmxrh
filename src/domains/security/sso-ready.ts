/**
 * SSO Ready - Infrastructure Bridge
 * 
 * Bridges the legacy SSO interface to the new
 * Unified Identity Federation Engine (UIFE).
 * 
 * Supabase Auth supports SSO natively (Enterprise plan).
 * UIFE extends this with full SAML 2.0 + OIDC + OAuth2 support.
 * 
 * To activate:
 * 1. Configure IdPs via UIFE registry (identity_provider_configs table)
 * 2. Set SECURITY_FEATURES.SSO.enabled = true
 * 3. Add provider domains to the IdP's allowed_domains
 */

import { supabase } from '@/integrations/supabase/client';
import { SECURITY_FEATURES } from './feature-flags';
import { getIdentityFederationEngine } from './federation';

// ═══════════════════════════════════
// Types (backward compat)
// ═══════════════════════════════════

export interface SSOProvider {
  id: string;
  type: 'saml' | 'oidc';
  domain: string;
  displayName: string;
  metadataUrl?: string;
  issuerUrl?: string;
}

export interface SSOConfig {
  enabled: boolean;
  providers: SSOProvider[];
  autoRedirect: boolean;
}

// ═══════════════════════════════════
// SSO Service (delegates to UIFE)
// ═══════════════════════════════════

export const ssoService = {
  /** Check if SSO feature is enabled */
  isFeatureEnabled(): boolean {
    return SECURITY_FEATURES.SSO.enabled;
  },

  /** Check if an email domain is configured for SSO */
  isDomainSSO(email: string): boolean {
    if (!SECURITY_FEATURES.SSO.enabled) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return SECURITY_FEATURES.SSO.providers.includes(domain);
  },

  /** Initiate SSO login — delegates to UIFE for IdP resolution */
  async signInWithSSO(domain: string): Promise<{ url: string } | null> {
    if (!SECURITY_FEATURES.SSO.enabled) return null;

    // Try UIFE federation first
    const engine = getIdentityFederationEngine();
    const health = engine.getHealth();
    if (health.initialized && health.tenant_id) {
      const idp = await engine.registry.getByDomain(domain, health.tenant_id);
      if (idp) {
        if (idp.protocol === 'saml') {
          const url = engine.saml.buildLoginUrl(idp);
          await engine.audit.log({
            tenant_id: health.tenant_id,
            idp_config_id: idp.id,
            event_type: 'saml_authn_request',
            protocol: 'saml',
            success: true,
            details: { domain },
          });
          return { url };
        }
        if (idp.protocol === 'oidc') {
          const state = crypto.randomUUID();
          const nonce = crypto.randomUUID();
          const url = engine.oidc.buildAuthorizationUrl(idp, state, nonce);
          await engine.audit.log({
            tenant_id: health.tenant_id,
            idp_config_id: idp.id,
            event_type: 'oidc_auth_request',
            protocol: 'oidc',
            success: true,
            details: { domain, state },
          });
          return { url };
        }
      }
    }

    // Fallback to Supabase native SSO
    const { data, error } = await supabase.auth.signInWithSSO({ domain });
    if (error) {
      console.error('[SSO] Sign-in failed:', error.message);
      return null;
    }

    return { url: data.url };
  },

  /** Get SSO configuration for the current tenant */
  getConfig(): SSOConfig {
    return {
      enabled: SECURITY_FEATURES.SSO.enabled,
      providers: [],
      autoRedirect: false,
    };
  },
};
