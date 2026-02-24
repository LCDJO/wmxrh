/**
 * TraccarSyncService — Frontend service for device sync operations.
 *
 * Wraps the traccar-sync edge function with React Query integration.
 */
import { supabase } from '@/integrations/supabase/client';
import { traccarApi } from './traccar-api-client';

export interface SyncResult {
  devices: number;
  positions: number;
  events_created: number;
  behavior_events: number;
}

export interface DeviceCacheEntry {
  id: string;
  tenant_id: string;
  traccar_id: number;
  unique_id: string;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  speed: number;
  ignition: boolean | null;
  computed_status: string;
  employee_id: string | null;
  vehicle_id: string | null;
  synced_at: string;
}

/**
 * Trigger a full sync for a tenant.
 */
export async function triggerTraccarSync(
  tenantId: string,
  speedLimitKmh = 80
): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke('traccar-sync', {
    body: { tenant_id: tenantId, speed_limit_kmh: speedLimitKmh },
  });

  if (error) throw new Error(error.message);

  const result = data as { synced: number; results: Array<SyncResult & { tenant_id: string; error?: string }> };
  const tenantResult = result.results?.find(r => r.tenant_id === tenantId);

  if (tenantResult?.error) throw new Error(tenantResult.error);

  return {
    devices: tenantResult?.devices ?? 0,
    positions: tenantResult?.positions ?? 0,
    events_created: tenantResult?.events_created ?? 0,
    behavior_events: tenantResult?.behavior_events ?? 0,
  };
}

/**
 * Get cached devices from local DB (fast, no API call).
 */
export async function getCachedDevices(tenantId: string): Promise<DeviceCacheEntry[]> {
  const { data, error } = await supabase
    .from('traccar_device_cache')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) throw new Error(error.message);
  return (data || []) as unknown as DeviceCacheEntry[];
}

/**
 * Link a cached device to an employee/vehicle.
 */
export async function linkDeviceToEmployee(
  tenantId: string,
  traccarId: number,
  employeeId: string | null,
  vehicleId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('traccar_device_cache')
    .update({ employee_id: employeeId, vehicle_id: vehicleId })
    .eq('tenant_id', tenantId)
    .eq('traccar_id', traccarId);

  if (error) throw new Error(error.message);
}

/**
 * Get sync health status for a tenant.
 */
export async function getSyncHealth(tenantId: string) {
  const { data } = await supabase
    .from('traccar_sync_status')
    .select('*')
    .eq('tenant_id', tenantId);

  return data || [];
}

/**
 * Test Traccar connection with full health data.
 */
export async function testTraccarHealth(tenantId: string) {
  return traccarApi.testConnection(tenantId);
}
