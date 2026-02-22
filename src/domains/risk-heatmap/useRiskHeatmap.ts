import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { HeatmapData, HeatmapFilters } from './types';

export function useRiskHeatmap(filters: HeatmapFilters) {
  return useQuery<HeatmapData>({
    queryKey: ['risk-heatmap', filters],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        tenant_id: filters.tenantId,
        grid_size: String(filters.gridSize ?? 20),
        days_back: String(filters.daysBack ?? 30),
      });

      if (filters.bounds?.lat_min != null) params.set('lat_min', String(filters.bounds.lat_min));
      if (filters.bounds?.lat_max != null) params.set('lat_max', String(filters.bounds.lat_max));
      if (filters.bounds?.lng_min != null) params.set('lng_min', String(filters.bounds.lng_min));
      if (filters.bounds?.lng_max != null) params.set('lng_max', String(filters.bounds.lng_max));

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/risk-heatmap?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed to load heatmap');
      }

      return resp.json();
    },
    enabled: !!filters.tenantId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
