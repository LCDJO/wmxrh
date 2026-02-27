/**
 * UIFE — IdentityProviderRegistry
 *
 * CRUD + lifecycle management for Identity Provider configurations per tenant.
 * Backed by identity_provider_configs table with RLS.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  IdentityProviderConfig,
  IdentityProviderRegistryAPI,
  FederationProtocol,
  ValidationResult,
} from './types';

export function createIdentityProviderRegistry(): IdentityProviderRegistryAPI {
  return {
    async list(tenantId) {
      const { data, error } = await supabase
        .from('identity_provider_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[UIFE:Registry] list failed:', error.message);
        return [];
      }
      return (data ?? []) as unknown as IdentityProviderConfig[];
    },

    async getById(id) {
      const { data, error } = await supabase
        .from('identity_provider_configs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;
      return data as unknown as IdentityProviderConfig;
    },

    async getByDomain(domain, tenantId) {
      const { data, error } = await supabase
        .from('identity_provider_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .contains('allowed_domains', [domain]);

      if (error || !data?.length) return null;
      return data[0] as unknown as IdentityProviderConfig;
    },

    async create(config) {
      const { data, error } = await supabase
        .from('identity_provider_configs')
        .insert({
          tenant_id: config.tenant_id,
          name: config.name,
          protocol: config.protocol,
          entity_id: config.entity_id ?? null,
          metadata_url: config.metadata_url ?? null,
          sso_url: config.sso_url ?? null,
          slo_url: config.slo_url ?? null,
          certificate: config.certificate ?? null,
          issuer_url: config.issuer_url ?? null,
          client_id: config.client_id ?? null,
          authorization_endpoint: config.authorization_endpoint ?? null,
          token_endpoint: config.token_endpoint ?? null,
          userinfo_endpoint: config.userinfo_endpoint ?? null,
          jwks_uri: config.jwks_uri ?? null,
          attribute_mapping: (config.attribute_mapping ?? {}) as import('@/integrations/supabase/types').Json,
          allowed_domains: config.allowed_domains ?? [],
          auto_provision_users: config.auto_provision_users ?? false,
          default_role: config.default_role ?? null,
          scopes: config.scopes ?? [],
          display_name: config.display_name ?? null,
          icon_url: config.icon_url ?? null,
          display_order: config.display_order ?? 0,
          metadata: (config.metadata ?? {}) as import('@/integrations/supabase/types').Json,
          created_by: config.created_by ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`[UIFE:Registry] create failed: ${error.message}`);
      return data as unknown as IdentityProviderConfig;
    },

    async update(id, patch) {
      const cleanPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (k !== 'id' && k !== 'created_at' && v !== undefined) {
          cleanPatch[k] = v;
        }
      }

      const { data, error } = await supabase
        .from('identity_provider_configs')
        .update(cleanPatch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`[UIFE:Registry] update failed: ${error.message}`);
      return data as unknown as IdentityProviderConfig;
    },

    async activate(id) {
      await supabase
        .from('identity_provider_configs')
        .update({ status: 'active' })
        .eq('id', id);
    },

    async suspend(id) {
      await supabase
        .from('identity_provider_configs')
        .update({ status: 'suspended' })
        .eq('id', id);
    },

    async delete(id) {
      await supabase
        .from('identity_provider_configs')
        .delete()
        .eq('id', id);
    },

    validateConfig(config) {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!config.name) errors.push('Name is required');
      if (!config.protocol) errors.push('Protocol is required');

      if (config.protocol === 'saml') {
        if (!config.entity_id) errors.push('SAML: entity_id is required');
        if (!config.sso_url && !config.metadata_url) errors.push('SAML: sso_url or metadata_url is required');
        if (!config.certificate && !config.metadata_url) warnings.push('SAML: certificate recommended for signature validation');
      }

      if (config.protocol === 'oidc') {
        if (!config.issuer_url) errors.push('OIDC: issuer_url is required');
        if (!config.client_id) errors.push('OIDC: client_id is required');
        if (!config.authorization_endpoint && !config.issuer_url) {
          errors.push('OIDC: authorization_endpoint or issuer_url (for discovery) is required');
        }
      }

      if (config.protocol === 'oauth2') {
        if (!config.client_id) errors.push('OAuth2: client_id is required');
        if (!config.authorization_endpoint) errors.push('OAuth2: authorization_endpoint is required');
        if (!config.token_endpoint) errors.push('OAuth2: token_endpoint is required');
      }

      if (config.allowed_domains.length === 0) {
        warnings.push('No allowed domains configured — IdP won\'t match any email automatically');
      }

      return { valid: errors.length === 0, errors, warnings };
    },
  };
}
