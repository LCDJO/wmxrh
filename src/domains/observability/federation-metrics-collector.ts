/**
 * FederationMetricsCollector — Prometheus-compatible metrics for identity federation.
 *
 * Exported metrics:
 *   saml_login_total                 (gauge)
 *   oidc_login_total                 (gauge)
 *   oauth_token_issued_total         (gauge)
 *   token_validation_failures        (gauge)
 */
import { getMetricsCollector } from './metrics-collector';
import { supabase } from '@/integrations/supabase/client';

export interface FederationMetricsSnapshot {
  saml_login_total: number;
  oidc_login_total: number;
  oauth_token_issued_total: number;
  token_validation_failures: number;
}

let _cachedSnapshot: FederationMetricsSnapshot | null = null;
let _lastFetch = 0;
const CACHE_TTL_MS = 60_000;

export async function collectFederationMetrics(): Promise<FederationMetricsSnapshot> {
  const now = Date.now();
  if (_cachedSnapshot && now - _lastFetch < CACHE_TTL_MS) return _cachedSnapshot;

  const collector = getMetricsCollector();

  // SAML logins
  const { count: samlCount } = await supabase
    .from('federation_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('protocol', 'saml')
    .eq('success', true)
    .in('event_type', ['login_success', 'session_created']);

  // OIDC logins
  const { count: oidcCount } = await supabase
    .from('federation_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('protocol', 'oidc')
    .eq('success', true)
    .in('event_type', ['login_success', 'session_created']);

  // OAuth tokens issued
  const { count: oauthTokenCount } = await supabase
    .from('federation_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('protocol', 'oauth2')
    .eq('success', true)
    .in('event_type', ['token_issued', 'token_refreshed']);

  // Token validation failures
  const { count: validationFailures } = await supabase
    .from('federation_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('success', false)
    .in('event_type', ['token_issued', 'token_refreshed', 'login_failure']);

  const snapshot: FederationMetricsSnapshot = {
    saml_login_total: samlCount ?? 0,
    oidc_login_total: oidcCount ?? 0,
    oauth_token_issued_total: oauthTokenCount ?? 0,
    token_validation_failures: validationFailures ?? 0,
  };

  collector.gauge('saml_login_total', snapshot.saml_login_total);
  collector.gauge('oidc_login_total', snapshot.oidc_login_total);
  collector.gauge('oauth_token_issued_total', snapshot.oauth_token_issued_total);
  collector.gauge('token_validation_failures', snapshot.token_validation_failures);

  _cachedSnapshot = snapshot;
  _lastFetch = now;
  return snapshot;
}

export function getFederationMetricsSnapshot(): FederationMetricsSnapshot {
  return _cachedSnapshot ?? {
    saml_login_total: 0,
    oidc_login_total: 0,
    oauth_token_issued_total: 0,
    token_validation_failures: 0,
  };
}
