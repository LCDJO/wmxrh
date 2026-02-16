/**
 * SSO Ready - Infrastructure Stubs
 * 
 * Prepared interfaces for SAML 2.0 and OIDC single sign-on.
 * Supabase Auth supports SSO natively (Enterprise plan).
 * 
 * To activate:
 * 1. Configure SSO provider in Supabase Auth
 * 2. Set SECURITY_FEATURES.SSO.enabled = true
 * 3. Add provider domains to the allowlist
 */

import { supabase } from '@/integrations/supabase/client';
import { SECURITY_FEATURES } from './feature-flags';

// ═══════════════════════════════════
// Types
// ═══════════════════════════════════

export interface SSOProvider {
  id: string;
  type: 'saml' | 'oidc';
  domain: string;
  displayName: string;
  /** Only for SAML */
  metadataUrl?: string;
  /** Only for OIDC */
  issuerUrl?: string;
}

export interface SSOConfig {
  enabled: boolean;
  providers: SSOProvider[];
  /** If true, email domain auto-redirects to SSO (no password form) */
  autoRedirect: boolean;
}

// ═══════════════════════════════════
// SSO Service (stubs - activate when ready)
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

  /** Initiate SSO login for a given domain */
  async signInWithSSO(domain: string): Promise<{ url: string } | null> {
    if (!SECURITY_FEATURES.SSO.enabled) return null;

    const { data, error } = await supabase.auth.signInWithSSO({ domain });
    if (error) {
      console.error('[SSO] Sign-in failed:', error.message);
      return null;
    }

    return { url: data.url };
  },

  /** Get SSO configuration for the current tenant (future: from DB) */
  getConfig(): SSOConfig {
    return {
      enabled: SECURITY_FEATURES.SSO.enabled,
      providers: [],
      autoRedirect: false,
    };
  },
};
