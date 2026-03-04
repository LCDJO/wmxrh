/**
 * useTripHistory — Hook para histórico de trajetos com velocidade média.
 */
import { useState, useCallback } from 'react';
import { analyzeTrips, type TripAnalysisResult } from '../../fleet-intelligence/trip-analysis.service';
import { getTenantBehavioralParams, toBehaviorConfig } from '../../fleet-intelligence/behavioral-params.service';

export interface UseTripHistoryReturn {
  result: TripAnalysisResult | null;
  loading: boolean;
  error: string | null;
  loadTrips: (from: string, to: string, deviceId?: string) => Promise<void>;
}

export function useTripHistory(tenantId: string | null): UseTripHistoryReturn {
  const [result, setResult] = useState<TripAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async (from: string, to: string, deviceId?: string) => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = await getTenantBehavioralParams(tenantId);
      const behaviorConfig = toBehaviorConfig(params);

      const res = await analyzeTrips({
        tenantId,
        from,
        to,
        deviceId,
        behaviorConfig,
        includeRadarCheck: true,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  return { result, loading, error, loadTrips };
}
