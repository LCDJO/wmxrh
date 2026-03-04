/**
 * useDriverRanking — Hook para ranking comportamental de motoristas.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DriverRiskScore } from '../../engines/types';

export interface UseDriverRankingReturn {
  scores: DriverRiskScore[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDriverRanking(tenantId: string | null, periodDays = 30): UseDriverRankingReturn {
  const [scores, setScores] = useState<DriverRiskScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - periodDays);

      const { data, error: dbError } = await supabase
        .from('fleet_driver_scores')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', from.toISOString().split('T')[0])
        .order('overall_score', { ascending: true });

      if (dbError) throw new Error(dbError.message);

      setScores((data || []).map((d: any) => ({
        employee_id: d.employee_id,
        employee_name: d.employee_name,
        overall_score: d.overall_score,
        grade: d.grade,
        speed_score: d.speed_score,
        braking_score: d.braking_score,
        compliance_score: d.compliance_score,
        idle_score: d.idle_score,
        total_trips: d.total_trips,
        total_distance_km: d.total_distance_km,
        total_violations: d.total_violations,
        risk_level: d.risk_level,
        factors: d.factors || [],
        period_start: d.period_start,
        period_end: d.period_end,
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, periodDays]);

  useEffect(() => { refresh(); }, [refresh]);

  return { scores, loading, error, refresh };
}
