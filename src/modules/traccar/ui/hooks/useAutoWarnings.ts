/**
 * useAutoWarnings — Hook para geração e monitoramento de advertências automáticas.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getFleetAlerts,
  getInfractionCountsByEmployee,
  type FleetAlert,
} from '../../fleet-intelligence/infraction-alert.service';

export interface AutoWarningEntry {
  employee_id: string;
  employee_name: string | null;
  infraction_count: number;
  latest_infraction_at: string | null;
  warning_status: 'none' | 'verbal' | 'written' | 'suspension' | 'termination';
  active_warnings: number;
}

export interface UseAutoWarningsReturn {
  alerts: FleetAlert[];
  warningEntries: AutoWarningEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAutoWarnings(tenantId: string | null): UseAutoWarningsReturn {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [warningEntries, setWarningEntries] = useState<AutoWarningEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [alertsData, infractionCounts] = await Promise.all([
        getFleetAlerts(tenantId, { unreadOnly: true, limit: 50 }),
        getInfractionCountsByEmployee(tenantId, 90),
      ]);

      setAlerts(alertsData);

      // Build warning entries from infraction counts
      const entries: AutoWarningEntry[] = Object.entries(infractionCounts).map(([empId, count]) => ({
        employee_id: empId,
        employee_name: null,
        infraction_count: count,
        latest_infraction_at: null,
        warning_status: count >= 5 ? 'termination'
          : count >= 4 ? 'suspension'
          : count >= 3 ? 'written'
          : count >= 1 ? 'verbal'
          : 'none',
        active_warnings: Math.min(count, 3),
      }));

      // Sort by infraction count desc
      entries.sort((a, b) => b.infraction_count - a.infraction_count);
      setWarningEntries(entries);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { alerts, warningEntries, loading, error, refresh };
}
