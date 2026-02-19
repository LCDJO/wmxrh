/**
 * PAMS Gateway — Data access layer via Domain Gateway pattern.
 * All DB access goes through the sandbox gateway.
 */

import type { SandboxContext } from '@/domains/platform-os/federation/module-sandbox';

export interface ApiClient {
  id: string;
  name: string;
  tenant_id?: string | null;
  client_type: 'tenant' | 'partner' | 'internal';
  status: 'active' | 'suspended' | 'revoked' | 'pending_approval';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  tenant_id: string;
  client_id: string;
  key_prefix: string;
  name: string;
  status: 'active' | 'rotated' | 'revoked' | 'expired';
  scopes: string[];
  environment: 'production' | 'staging' | 'sandbox';
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  rate_limit_override?: number;
  created_at: string;
}

export interface ApiScope {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
  is_system: boolean;
}

export interface ApiVersion {
  id: string;
  version: string;
  status: 'active' | 'deprecated' | 'sunset' | 'beta';
  release_notes?: string;
  deprecated_at?: string;
  sunset_at?: string;
}

export interface ApiUsageLog {
  id: string;
  tenant_id: string;
  client_id?: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms?: number;
  request_scope?: string;
  created_at: string;
}

export interface ApiAnalyticsAggregate {
  id: string;
  tenant_id: string;
  client_id?: string;
  period_start: string;
  period_type: 'hourly' | 'daily' | 'monthly';
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time_ms?: number;
  p95_response_time_ms?: number;
  rate_limited_requests: number;
}

export interface RateLimitConfig {
  id: string;
  plan_tier: string;
  scope_pattern: string;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_limit: number;
  concurrent_limit: number;
}

export function createApiManagementGateway(sandbox: SandboxContext) {
  const { gateway } = sandbox;

  return {
    // ── Clients ──
    listClients: (params?: Record<string, unknown>) =>
      gateway.query<ApiClient[]>('api_clients', 'list', params),
    getClient: (id: string) =>
      gateway.query<ApiClient>('api_clients', 'get', { id }),
    createClient: (data: Partial<ApiClient>) =>
      gateway.mutate('api_clients', 'create', data),
    updateClient: (id: string, data: Partial<ApiClient>) =>
      gateway.mutate('api_clients', 'update', { id, ...data }),
    suspendClient: (id: string) =>
      gateway.mutate('api_clients', 'update', { id, status: 'suspended' }),

    // ── Keys ──
    listKeys: (clientId: string) =>
      gateway.query<ApiKey[]>('api_keys', 'list', { client_id: clientId }),
    revokeKey: (id: string, reason: string) =>
      gateway.mutate('api_keys', 'update', { id, status: 'revoked', revoked_reason: reason }),

    // ── Scopes ──
    listScopes: () =>
      gateway.query<ApiScope[]>('api_scopes', 'list'),

    // ── Versions ──
    listVersions: () =>
      gateway.query<ApiVersion[]>('api_versions', 'list'),

    // ── Usage ──
    getUsageLogs: (params?: Record<string, unknown>) =>
      gateway.query<ApiUsageLog[]>('api_usage_logs', 'list', params),

    // ── Analytics ──
    getAnalytics: (params?: Record<string, unknown>) =>
      gateway.query<ApiAnalyticsAggregate[]>('api_analytics_aggregates', 'list', params),

    // ── Rate Limits ──
    getRateLimits: () =>
      gateway.query<RateLimitConfig[]>('api_rate_limit_configs', 'list'),
    updateRateLimit: (id: string, data: Partial<RateLimitConfig>) =>
      gateway.mutate('api_rate_limit_configs', 'update', { id, ...data }),
  };
}
