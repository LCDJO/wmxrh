/**
 * useTraccarFleet — Hook for fetching real Traccar fleet data.
 * Provides devices, positions, events with automatic polling.
 * Falls back gracefully when Traccar is not configured.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  // Enriched from position
  lat?: number;
  lng?: number;
  speed?: number;
  course?: number;
  address?: string | null;
  ignition?: boolean;
  computedStatus?: 'moving' | 'idle' | 'stopped' | 'speeding';
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

interface UseTraccarFleetOptions {
  tenantId: string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  speedLimitKmh?: number;
}

interface UseTraccarFleetReturn {
  vehicles: TraccarVehicle[];
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  refresh: () => void;
  lastUpdate: Date | null;
}

async function invokeProxy<T>(tenantId: string, action: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('traccar-proxy', {
    body: { action, tenantId, ...params },
  });

  if (error) {
    // Extract specific error from response body
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

export function useTraccarFleet(opts: UseTraccarFleetOptions): UseTraccarFleetReturn {
  const { tenantId, enabled = true, pollIntervalMs = 10_000, speedLimitKmh = 80 } = opts;
  const [vehicles, setVehicles] = useState<TraccarVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchFleetData = useCallback(async () => {
    if (!tenantId || !enabled) return;

    try {
      setLoading(prev => !prev ? true : prev); // only set true on first load

      // Fetch devices and positions in parallel
      const [devices, positions] = await Promise.all([
        invokeProxy<any[]>(tenantId, 'devices'),
        invokeProxy<any[]>(tenantId, 'positions'),
      ]);

      if (!devices || !Array.isArray(devices)) {
        setError('Nenhum dispositivo encontrado no Traccar');
        setVehicles([]);
        return;
      }

      setIsConfigured(true);

      // Build position lookup by deviceId
      const posMap = new Map<number, any>();
      if (positions && Array.isArray(positions)) {
        for (const pos of positions) {
          posMap.set(pos.deviceId, pos);
        }
      }

      // Enrich devices with position data
      const enriched: TraccarVehicle[] = devices.map((dev: any) => {
        const pos = posMap.get(dev.id);
        const speedKmh = pos ? pos.speed * 1.852 : 0; // knots to km/h
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
          address: pos?.address,
          ignition,
          computedStatus,
        };
      });

      setVehicles(enriched);
      setError(null);
      setLastUpdate(new Date());
    } catch (err: any) {
      const msg = err?.message || 'Erro ao buscar dados do Traccar';
      setError(msg);
      if (msg.includes('não encontrada') || msg.includes('não configurados')) {
        setIsConfigured(false);
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, enabled, speedLimitKmh]);

  // Initial fetch + polling
  useEffect(() => {
    if (!tenantId || !enabled) return;

    fetchFleetData();
    intervalRef.current = setInterval(fetchFleetData, pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchFleetData, pollIntervalMs, tenantId, enabled]);

  return {
    vehicles,
    loading,
    error,
    isConfigured,
    refresh: fetchFleetData,
    lastUpdate,
  };
}
