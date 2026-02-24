/**
 * IntegrationHealthService — Client service for Integration Health & Monitoring Engine.
 */
import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  id: string;
  tenant_id: string;
  checked_at: string;
  server_connection: CheckResult;
  api_authentication: CheckResult;
  device_sync: CheckResult;
  event_flow: CheckResult;
  queue_health: CheckResult;
  alert_generation: CheckResult;
  devices_synced: number;
  events_last_24h: number;
  alerts_last_24h: number;
  last_event_received: string | null;
  queue_lag: number;
  server_response_time_ms: number | null;
  health_score: number;
  health_status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  check_duration_ms: number | null;
  error_summary: string | null;
}

export interface CheckResult {
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  message: string;
  duration_ms?: number;
  details?: Record<string, unknown>;
}

/**
 * Get latest health check per tenant (for dashboard overview).
 */
export async function getLatestHealthChecks(): Promise<HealthCheckResult[]> {
  // Get distinct latest check per tenant
  const { data, error } = await supabase
    .from('integration_health_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  // Deduplicate by tenant_id (keep latest)
  const byTenant = new Map<string, HealthCheckResult>();
  for (const row of (data || [])) {
    if (!byTenant.has(row.tenant_id)) {
      byTenant.set(row.tenant_id, row as unknown as HealthCheckResult);
    }
  }
  return Array.from(byTenant.values());
}

/**
 * Get health check history for a specific tenant.
 */
export async function getTenantHealthHistory(
  tenantId: string,
  limit = 50
): Promise<HealthCheckResult[]> {
  const { data, error } = await supabase
    .from('integration_health_checks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('checked_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as HealthCheckResult[];
}

/**
 * Trigger health check for a specific tenant or all tenants.
 */
export async function triggerHealthCheck(tenantId?: string): Promise<{
  checked: number;
  results: Array<HealthCheckResult & { tenant_id: string }>;
}> {
  const body = tenantId ? { tenant_id: tenantId } : { all: true };
  const { data, error } = await supabase.functions.invoke('integration-health-check', { body });
  if (error) throw new Error(error.message);
  return data as any;
}
