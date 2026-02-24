/**
 * useTraccarFleet — Robust hook for real-time Traccar fleet data.
 *
 * Architecture:
 *  ├── Dual data source: API polling (primary) + device cache (fallback)
 *  ├── Automatic speed violation detection
 *  ├── Enrichment with employee/vehicle mappings
 *  ├── Health monitoring with sync status
 *  └── Configurable polling interval
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ══════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════

export interface TraccarVehicle {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  disabled: boolean;
  lastUpdate: string | null;
  positionId: number | null;
  groupId: number | null;
  phone: string | null;
  model: string | null;
  category: string | null;
  attributes: Record<string, unknown>;
  // Position data
  lat?: number;
  lng?: number;
  speed?: number;
  course?: number;
  altitude?: number;
  address?: string | null;
  ignition?: boolean;
  // Computed
  computedStatus?: 'moving' | 'idle' | 'stopped' | 'speeding';
  // Enrichment (from cache)
  employeeId?: string | null;
  vehicleId?: string | null;
  fleetDeviceId?: string | null;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address: string | null;
  fixTime: string;
  attributes: Record<string, unknown>;
}

export interface SyncHealth {
  isHealthy: boolean;
  lastSyncAt: string | null;
  deviceCount: number;
  positionCount: number;
  lastError: string | null;
  consecutiveFailures: number;
}

interface UseTraccarFleetOptions {
  tenantId: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  speedLimitKmh?: number;
  useCache?: boolean;
}

interface UseTraccarFleetReturn {
  vehicles: TraccarVehicle[];
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  syncHealth: SyncHealth | null;
  refresh: () => void;
  triggerSync: () => Promise<void>;
  lastUpdate: Date | null;
  stats: {
    total: number;
    moving: number;
    idle: number;
    stopped: number;
    speeding: number;
    online: number;
    offline: number;
  };
}

// ══════════════════════════════════════════════════════════
// PROXY INVOKE
// ══════════════════════════════════════════════════════════

async function invokeProxy<T>(tenantId: string, action: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('traccar-proxy', {
    body: { action, tenantId, ...params },
  });

  if (error) {
    if (error.context && error.context instanceof Response) {
      try {
        const body = await error.context.json();
        throw new Error(body?.error || error.message);
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) throw e;
      }
    }
    throw new Error(error.message || 'Falha na comunicação com o Traccar');
  }

  const resp = data as { success: boolean; data: T; error?: string };
  if (!resp.success) throw new Error(resp.error || 'Erro desconhecido do Traccar');
  return resp.data;
}

// ══════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════

export function useTraccarFleet(opts: UseTraccarFleetOptions): UseTraccarFleetReturn {
  const { tenantId, enabled = true, pollIntervalMs = 10_000, speedLimitKmh = 80, useCache = false } = opts;
  const [vehicles, setVehicles] = useState<TraccarVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Fetch from API (primary)
  const fetchFromApi = useCallback(async () => {
    if (!tenantId) return;

    const syncData = await invokeProxy<{ devices: any[]; positions: any[] }>(
      tenantId, 'sync-devices-positions'
    );

    if (!syncData?.devices || !Array.isArray(syncData.devices)) {
      throw new Error('Nenhum dispositivo encontrado');
    }

    const posMap = new Map<number, any>();
    if (syncData.positions && Array.isArray(syncData.positions)) {
      for (const pos of syncData.positions) posMap.set(pos.deviceId, pos);
    }

    return enrichDevices(syncData.devices, posMap, speedLimitKmh);
  }, [tenantId, speedLimitKmh]);

  // Fetch from cache (fallback)
  const fetchFromCache = useCallback(async () => {
    if (!tenantId) return [];

    const { data, error } = await supabase
      .from('traccar_device_cache')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error || !data) return [];

    return data.map((d: any): TraccarVehicle => ({
      id: d.traccar_id,
      name: d.name,
      uniqueId: d.unique_id,
      status: d.status as 'online' | 'offline' | 'unknown',
      disabled: d.disabled,
      lastUpdate: d.last_update,
      positionId: d.position_id,
      groupId: d.group_id,
      phone: d.phone,
      model: d.model,
      category: d.category,
      attributes: d.attributes || {},
      lat: d.latitude,
      lng: d.longitude,
      speed: d.speed,
      course: d.course,
      altitude: d.altitude,
      address: d.address,
      ignition: d.ignition,
      computedStatus: d.computed_status as TraccarVehicle['computedStatus'],
      employeeId: d.employee_id,
      vehicleId: d.vehicle_id,
      fleetDeviceId: d.fleet_device_id,
    }));
  }, [tenantId]);

  // Fetch sync health
  const fetchSyncHealth = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from('traccar_sync_status')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (data) {
      setSyncHealth({
        isHealthy: data.is_healthy ?? true,
        lastSyncAt: data.last_sync_at,
        deviceCount: data.last_device_count ?? 0,
        positionCount: data.last_position_count ?? 0,
        lastError: data.last_error,
        consecutiveFailures: data.consecutive_failures ?? 0,
      });
    }
  }, [tenantId]);

  // Main fetch logic
  const fetchFleetData = useCallback(async () => {
    if (!tenantId || !enabled) return;

    try {
      setLoading(prev => !prev ? true : prev);

      let result: TraccarVehicle[];
      try {
        result = (await fetchFromApi()) || [];
        setIsConfigured(true);
      } catch (apiErr: any) {
        // Fallback to cache
        if (useCache) {
          result = await fetchFromCache();
          if (result.length > 0) setIsConfigured(true);
        } else {
          throw apiErr;
        }
      }

      setVehicles(result);
      setError(null);
      setLastUpdate(new Date());
      fetchSyncHealth();
    } catch (err: any) {
      const msg = err?.message || 'Erro ao buscar dados do Traccar';
      setError(msg);
      if (msg.includes('não encontrada') || msg.includes('não configurados')) {
        setIsConfigured(false);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, enabled, fetchFromApi, fetchFromCache, fetchSyncHealth, useCache]);

  // Manual sync trigger (calls traccar-sync edge function)
  const triggerSync = useCallback(async () => {
    if (!tenantId) return;
    await supabase.functions.invoke('traccar-sync', {
      body: { tenant_id: tenantId, speed_limit_kmh: speedLimitKmh },
    });
    await fetchFleetData();
  }, [tenantId, speedLimitKmh, fetchFleetData]);

  // Polling
  useEffect(() => {
    if (!tenantId || !enabled) return;
    fetchFleetData();
    intervalRef.current = setInterval(fetchFleetData, pollIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFleetData, pollIntervalMs, tenantId, enabled]);

  // Compute stats
  const stats = {
    total: vehicles.length,
    moving: vehicles.filter(v => v.computedStatus === 'moving').length,
    idle: vehicles.filter(v => v.computedStatus === 'idle').length,
    stopped: vehicles.filter(v => v.computedStatus === 'stopped').length,
    speeding: vehicles.filter(v => v.computedStatus === 'speeding').length,
    online: vehicles.filter(v => v.status === 'online').length,
    offline: vehicles.filter(v => v.status === 'offline').length,
  };

  return {
    vehicles,
    loading,
    error,
    isConfigured,
    syncHealth,
    refresh: fetchFleetData,
    triggerSync,
    lastUpdate,
    stats,
  };
}

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════

function enrichDevices(
  devices: any[],
  posMap: Map<number, any>,
  speedLimitKmh: number
): TraccarVehicle[] {
  return devices.map((dev: any) => {
    const pos = posMap.get(dev.id);
    const speedKmh = pos ? pos.speed * 1.852 : 0;
    const ignition = pos?.attributes?.ignition ?? false;

    let computedStatus: TraccarVehicle['computedStatus'] = 'stopped';
    if (speedKmh > speedLimitKmh) computedStatus = 'speeding';
    else if (speedKmh > 5) computedStatus = 'moving';
    else if (ignition) computedStatus = 'idle';

    return {
      id: dev.id,
      name: dev.name,
      uniqueId: dev.uniqueId,
      status: dev.status || 'unknown',
      disabled: dev.disabled,
      lastUpdate: dev.lastUpdate,
      positionId: dev.positionId,
      groupId: dev.groupId,
      phone: dev.phone,
      model: dev.model,
      category: dev.category,
      attributes: dev.attributes || {},
      lat: pos?.latitude,
      lng: pos?.longitude,
      speed: Math.round(speedKmh),
      course: pos?.course ?? 0,
      altitude: pos?.altitude ?? undefined,
      address: pos?.address,
      ignition: ignition ?? false,
      computedStatus,
    };
  });
}
