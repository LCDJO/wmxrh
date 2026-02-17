/**
 * useGrowthInsights — React hook for the GrowthInsightEngine.
 * Fetches real data from Revenue Intelligence, Referral, Churn, Upgrade, and Landing Pages.
 */
import { useState, useEffect, useCallback } from 'react';
import { growthInsightEngine, type GrowthInsightResult } from '@/domains/platform-growth/growth-insight-engine';
import { landingPageBuilder } from '@/domains/platform-growth/landing-page-builder';

export function useGrowthInsights() {
  const [result, setResult] = useState<GrowthInsightResult>({
    insights: [],
    metrics: {
      totalMRR: 0, payingTenants: 0, churnRate: 0, upgradeCandidates: 0,
      mrrAtRisk: 0, referralConversionRate: 0, bestPlan: '—', bestModule: '—',
    },
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setResult(prev => ({ ...prev, loading: true, error: null }));
    const pages = await landingPageBuilder.getAll();
    const data = await growthInsightEngine.generateInsights(pages);
    setResult(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...result, refresh };
}
