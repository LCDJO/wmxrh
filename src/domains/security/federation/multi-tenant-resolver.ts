/**
 * UIFE — MultiTenantResolver
 *
 * Resolves tenant identity from 3 sources (priority order):
 *   1. Explicit tenant_id (query param, header, or programmatic)
 *   2. Custom domain lookup (tenant_domains table)
 *   3. Subdomain slug (tenants.slug match)
 *
 * Used pre-authentication to determine which tenant context to load.
 */

import { supabase } from '@/integrations/supabase/client';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

export type TenantResolutionStrategy = 'explicit' | 'custom_domain' | 'subdomain' | 'none';

export interface TenantResolutionResult {
  tenantId: string | null;
  tenantName: string | null;
  strategy: TenantResolutionStrategy;
  domain: string | null;
  slug: string | null;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface MultiTenantResolverAPI {
  /** Resolve tenant from current browser context */
  resolve(explicitTenantId?: string | null): Promise<TenantResolutionResult>;
  /** Resolve tenant by custom domain */
  resolveByDomain(domain: string): Promise<TenantResolutionResult>;
  /** Resolve tenant by subdomain slug */
  resolveBySubdomain(slug: string): Promise<TenantResolutionResult>;
  /** Resolve tenant by explicit ID (validates it exists) */
  resolveByTenantId(tenantId: string): Promise<TenantResolutionResult>;
  /** Register a custom domain for a tenant */
  registerDomain(tenantId: string, domain: string, isPrimary?: boolean): Promise<void>;
  /** Verify a domain (marks as verified) */
  verifyDomain(domainId: string): Promise<void>;
  /** Remove a custom domain */
  removeDomain(domainId: string): Promise<void>;
  /** List domains for a tenant */
  listDomains(tenantId: string): Promise<TenantDomainRecord[]>;
  /** Set tenant slug */
  setSlug(tenantId: string, slug: string): Promise<void>;
}

export interface TenantDomainRecord {
  id: string;
  tenantId: string;
  domain: string;
  domainType: 'custom' | 'subdomain';
  isPrimary: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  sslStatus: string;
}

// ════════════════════════════════════
// HELPERS
// ════════════════════════════════════

const SKIP_HOSTS = [
  'localhost',
  '.lovable.app',
  '.lovableproject.com',
];

function getCurrentHostname(): string | null {
  try {
    return window.location.hostname;
  } catch {
    return null;
  }
}

function isSkippedHost(hostname: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  return SKIP_HOSTS.some(h => h.startsWith('.') ? hostname.endsWith(h) : hostname === h);
}

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (sub === 'www') return null;
  return sub;
}

function getExplicitTenantId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('tenant_id') || params.get('tenantId') || null;
  } catch {
    return null;
  }
}

const NOT_FOUND: TenantResolutionResult = {
  tenantId: null,
  tenantName: null,
  strategy: 'none',
  domain: null,
  slug: null,
  confidence: 'low',
  reason: 'No tenant could be resolved',
};

// ════════════════════════════════════
// RESOLVER
// ════════════════════════════════════

export function createMultiTenantResolver(): MultiTenantResolverAPI {
  return {
    async resolve(explicitTenantId) {
      // Strategy 1: Explicit tenant_id
      const explicit = explicitTenantId || getExplicitTenantId();
      if (explicit) {
        return this.resolveByTenantId(explicit);
      }

      const hostname = getCurrentHostname();
      if (!hostname || isSkippedHost(hostname)) {
        return { ...NOT_FOUND, reason: 'Skipped host (localhost/preview)' };
      }

      // Strategy 2: Custom domain
      const domainResult = await this.resolveByDomain(hostname);
      if (domainResult.tenantId) return domainResult;

      // Strategy 3: Subdomain slug
      const slug = extractSubdomain(hostname);
      if (slug) {
        return this.resolveBySubdomain(slug);
      }

      return { ...NOT_FOUND, reason: `No resolution for hostname: ${hostname}` };
    },

    async resolveByDomain(domain) {
      const { data, error } = await (supabase
        .from('tenant_domains' as any)
        .select('tenant_id, tenants:tenant_id(id, name)')
        .eq('domain', domain.toLowerCase())
        .eq('is_verified', true)
        .maybeSingle() as any);

      if (error || !data) {
        return { ...NOT_FOUND, domain, reason: error?.message || 'Domain not found' };
      }

      const tenant = (data as any).tenants;
      return {
        tenantId: data.tenant_id,
        tenantName: tenant?.name || null,
        strategy: 'custom_domain' as TenantResolutionStrategy,
        domain,
        slug: null,
        confidence: 'high' as const,
        reason: `Resolved via custom domain: ${domain}`,
      };
    },

    async resolveBySubdomain(slug) {
      const { data, error } = await (supabase
        .from('tenants' as any)
        .select('id, name')
        .eq('slug', slug.toLowerCase())
        .maybeSingle() as any);

      if (error || !data) {
        return { ...NOT_FOUND, slug, reason: error?.message || `Slug not found: ${slug}` };
      }

      return {
        tenantId: data.id,
        tenantName: data.name,
        strategy: 'subdomain' as TenantResolutionStrategy,
        domain: null,
        slug,
        confidence: 'high' as const,
        reason: `Resolved via subdomain slug: ${slug}`,
      };
    },

    async resolveByTenantId(tenantId) {
      const { data, error } = await (supabase
        .from('tenants' as any)
        .select('id, name')
        .eq('id', tenantId)
        .maybeSingle() as any);

      if (error || !data) {
        return { ...NOT_FOUND, reason: `Tenant not found: ${tenantId}` };
      }

      return {
        tenantId: data.id,
        tenantName: data.name,
        strategy: 'explicit' as TenantResolutionStrategy,
        domain: null,
        slug: null,
        confidence: 'high' as const,
        reason: `Resolved via explicit tenant_id: ${tenantId}`,
      };
    },

    async registerDomain(tenantId, domain, isPrimary = false) {
      const token = crypto.randomUUID();
      const { error } = await (supabase
        .from('tenant_domains' as any)
        .insert({
          tenant_id: tenantId,
          domain: domain.toLowerCase(),
          domain_type: 'custom',
          is_primary: isPrimary,
          is_verified: false,
          verification_token: token,
        } as any) as any);

      if (error) throw new Error(`[MultiTenantResolver] registerDomain failed: ${error.message}`);
    },

    async verifyDomain(domainId) {
      const { error } = await (supabase
        .from('tenant_domains' as any)
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          ssl_status: 'active',
        } as any)
        .eq('id', domainId) as any);

      if (error) throw new Error(`[MultiTenantResolver] verifyDomain failed: ${error.message}`);
    },

    async removeDomain(domainId) {
      const { error } = await (supabase
        .from('tenant_domains' as any)
        .delete()
        .eq('id', domainId) as any);

      if (error) throw new Error(`[MultiTenantResolver] removeDomain failed: ${error.message}`);
    },

    async listDomains(tenantId) {
      const { data, error } = await (supabase
        .from('tenant_domains' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('is_primary', { ascending: false }) as any);

      if (error) return [];

      return (data || []).map((d: any) => ({
        id: d.id,
        tenantId: d.tenant_id,
        domain: d.domain,
        domainType: d.domain_type,
        isPrimary: d.is_primary,
        isVerified: d.is_verified,
        verifiedAt: d.verified_at,
        sslStatus: d.ssl_status,
      }));
    },

    async setSlug(tenantId, slug) {
      const { error } = await (supabase
        .from('tenants' as any)
        .update({ slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-') } as any)
        .eq('id', tenantId) as any);

      if (error) throw new Error(`[MultiTenantResolver] setSlug failed: ${error.message}`);
    },
  };
}
