/**
 * useRiskHeatmap — Hook para heatmap de risco baseado em eventos comportamentais.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { analyzeHotspots } from '../../engines/traffic-hotspot-analyzer';
import type { HotspotGrid, BehaviorEvent } from '../../engines/types';

export interface UseRiskHeatmapReturn {
  grid: HotspotGrid | null;
  loading: boolean;
  error: string | null;
  loadHeatmap: (from: string, to: string) => Promise<void>;
}

export function useRiskHeatmap(tenantId: string | null): UseRiskHeatmapReturn {
  const [grid, setGrid] = useState<HotspotGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHeatmap = useCallback(async (from: string, to: string) => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('fleet_behavior_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('event_timestamp', from)
        .lte('event_timestamp', to)
        .limit(2000);

      if (dbError) throw new Error(dbError.message);

      const events: BehaviorEvent[] = (data || []).map((e: any) => ({
        device_id: e.device_id,
        employee_id: e.employee_id,
        event_type: e.event_type,
        severity: e.severity,
        details: e.details || {},
        event_timestamp: e.event_timestamp,
        latitude: e.details?.latitude ?? null,
        longitude: e.details?.longitude ?? null,
      }));

      const hotspotGrid = analyzeHotspots(events);
      setGrid(hotspotGrid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  return { grid, loading, error, loadHeatmap };
}
