/**
 * Developer Portal Gateway — Data access layer via Domain Gateway pattern.
 * All DB access goes through the sandbox gateway.
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

// ── Entity Types ──

export interface Developer {
  id: string;
  user_id: string;
  organization_name: string;
  organization_type: 'individual' | 'company' | 'partner' | 'internal';
  email: string;
  website_url?: string | null;
  logo_url?: string | null;
  status: 'pending_verification' | 'active' | 'suspended' | 'revoked';
  verification_level: 'unverified' | 'email_verified' | 'identity_verified' | 'partner_verified';
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  accepted_tos_version?: string | null;
  accepted_tos_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DeveloperApp {
  id: string;
  developer_id: string;
  name: string;
  slug: string;
  description?: string | null;
  long_description?: string | null;
  logo_url?: string | null;
  screenshots?: string[] | null;
  category: string;
  tags?: string[] | null;
  app_type: 'public' | 'private' | 'internal';
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'published' | 'suspended' | 'rejected';
  version: string;
  homepage_url?: string | null;
  support_url?: string | null;
  privacy_policy_url?: string | null;
  terms_url?: string | null;
  webhook_url?: string | null;
  redirect_uris?: string[] | null;
  required_scopes: string[];
  optional_scopes?: string[] | null;
  install_count: number;
  rating_avg?: number | null;
  rating_count: number;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthClient {
  id: string;
  app_id: string;
  client_id_hash: string;
  client_secret_hash: string;
  grant_types: string[];
  scopes: string[];
  redirect_uris: string[];
  token_lifetime_seconds: number;
  refresh_token_lifetime_seconds: number;
  status: 'active' | 'rotated' | 'revoked';
  last_used_at?: string | null;
  created_at: string;
  rotated_at?: string | null;
}

export interface ApiSubscription {
  id: string;
  app_id: string;
  developer_id: string;
  api_product_id: string;
  plan_tier: string;
  status: 'active' | 'suspended' | 'cancelled' | 'expired';
  rate_limit_override?: number | null;
  billing_external_id?: string | null;
  started_at: string;
  expires_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceListing {
  id: string;
  app_id: string;
  category: string;
  featured: boolean;
  featured_order?: number | null;
  pricing_model: 'free' | 'freemium' | 'paid' | 'contact_sales';
  price_monthly_brl?: number | null;
  price_yearly_brl?: number | null;
  trial_days?: number | null;
  visibility: 'public' | 'unlisted' | 'private';
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppInstallation {
  id: string;
  app_id: string;
  tenant_id: string;
  installed_by: string;
  status: 'active' | 'suspended' | 'uninstalled';
  config?: Record<string, unknown> | null;
  installed_at: string;
  uninstalled_at?: string | null;
}

export interface AppReview {
  id: string;
  app_id: string;
  reviewer_type: 'automated' | 'manual' | 'security';
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'waived';
  checklist: Record<string, boolean>;
  findings?: string[] | null;
  reviewer_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface SandboxSession {
  id: string;
  developer_id: string;
  app_id: string;
  environment_id: string;
  status: 'provisioning' | 'active' | 'expired' | 'terminated';
  seed_data_template?: string | null;
  api_base_url: string;
  expires_at: string;
  created_at: string;
}

export interface DeveloperAnalyticsSnapshot {
  id: string;
  developer_id: string;
  app_id?: string | null;
  period_start: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  total_api_calls: number;
  successful_calls: number;
  error_calls: number;
  avg_latency_ms?: number | null;
  unique_tenants: number;
  active_installs: number;
  revenue_brl?: number | null;
  created_at: string;
}

// ── Gateway Factory ──

export function createDeveloperPortalGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;

  return {
    // ── Developers ──
    listDevelopers: (params?: Record<string, unknown>) =>
      gateway.query<Developer[]>('developers', 'list', params),
    getDeveloper: (id: string) =>
      gateway.query<Developer>('developers', 'get', { id }),
    createDeveloper: (data: Partial<Developer>) =>
      gateway.mutate('developers', 'create', data),
    updateDeveloper: (id: string, data: Partial<Developer>) =>
      gateway.mutate('developers', 'update', { id, ...data }),
    suspendDeveloper: (id: string) =>
      gateway.mutate('developers', 'update', { id, status: 'suspended' }),

    // ── Apps ──
    listApps: (params?: Record<string, unknown>) =>
      gateway.query<DeveloperApp[]>('developer_apps', 'list', params),
    getApp: (id: string) =>
      gateway.query<DeveloperApp>('developer_apps', 'get', { id }),
    createApp: (data: Partial<DeveloperApp>) =>
      gateway.mutate('developer_apps', 'create', data),
    updateApp: (id: string, data: Partial<DeveloperApp>) =>
      gateway.mutate('developer_apps', 'update', { id, ...data }),
    submitAppForReview: (id: string) =>
      gateway.mutate('developer_apps', 'update', { id, status: 'submitted' }),
    publishApp: (id: string) =>
      gateway.mutate('developer_apps', 'update', { id, status: 'published', published_at: new Date().toISOString() }),

    // ── OAuth Clients ──
    listOAuthClients: (appId: string) =>
      gateway.query<OAuthClient[]>('oauth_clients', 'list', { app_id: appId }),
    revokeOAuthClient: (id: string) =>
      gateway.mutate('oauth_clients', 'update', { id, status: 'revoked' }),

    // ── API Subscriptions ──
    listSubscriptions: (params?: Record<string, unknown>) =>
      gateway.query<ApiSubscription[]>('api_subscriptions', 'list', params),
    createSubscription: (data: Partial<ApiSubscription>) =>
      gateway.mutate('api_subscriptions', 'create', data),
    cancelSubscription: (id: string) =>
      gateway.mutate('api_subscriptions', 'update', { id, status: 'cancelled', cancelled_at: new Date().toISOString() }),

    // ── Marketplace ──
    listMarketplace: (params?: Record<string, unknown>) =>
      gateway.query<MarketplaceListing[]>('marketplace_listings', 'list', params),
    getMarketplaceListing: (id: string) =>
      gateway.query<MarketplaceListing>('marketplace_listings', 'get', { id }),

    // ── Installations ──
    listInstallations: (params?: Record<string, unknown>) =>
      gateway.query<AppInstallation[]>('app_installations', 'list', params),
    installApp: (data: Partial<AppInstallation>) =>
      gateway.mutate('app_installations', 'create', data),
    uninstallApp: (id: string) =>
      gateway.mutate('app_installations', 'update', { id, status: 'uninstalled', uninstalled_at: new Date().toISOString() }),

    // ── Reviews ──
    listReviews: (appId: string) =>
      gateway.query<AppReview[]>('app_reviews', 'list', { app_id: appId }),
    createReview: (data: Partial<AppReview>) =>
      gateway.mutate('app_reviews', 'create', data),
    updateReview: (id: string, data: Partial<AppReview>) =>
      gateway.mutate('app_reviews', 'update', { id, ...data }),

    // ── Sandbox ──
    listSandboxSessions: (developerId: string) =>
      gateway.query<SandboxSession[]>('sandbox_sessions', 'list', { developer_id: developerId }),
    createSandboxSession: (data: Partial<SandboxSession>) =>
      gateway.mutate('sandbox_sessions', 'create', data),
    terminateSandboxSession: (id: string) =>
      gateway.mutate('sandbox_sessions', 'update', { id, status: 'terminated' }),

    // ── Analytics ──
    getDeveloperAnalytics: (params?: Record<string, unknown>) =>
      gateway.query<DeveloperAnalyticsSnapshot[]>('developer_analytics', 'list', params),
  };
}
