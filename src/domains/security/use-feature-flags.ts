/**
 * useFeatureFlags — Hook to load feature flags from DB and provide query API.
 * 
 * Loads flags for the current tenant on mount and caches them in the engine.
 * Provides convenience methods bound to the current SecurityContext.
 */

import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { featureFlagEngine, type FeatureFlagRecord } from './kernel';
import type { FeatureKey } from './feature-flags';

export interface UseFeatureFlagsReturn {
  /** Check if a feature is enabled for current tenant scope */
  isEnabled: (feature: FeatureKey) => boolean;
  /** All flags for current tenant */
  flags: FeatureFlagRecord[];
  /** Loading state */
  loading: boolean;
  /** Refresh flags from DB */
  refresh: () => Promise<void>;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const { currentTenant } = useTenant();
  const [flags, setFlags] = useState<FeatureFlagRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    if (!currentTenant) {
      setFlags([]);
      featureFlagEngine.clearCache();
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('tenant_id', currentTenant.id);

    const records = (data || []) as FeatureFlagRecord[];
    setFlags(records);
    featureFlagEngine.loadFlags(records);
    setLoading(false);
  }, [currentTenant]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const isEnabled = useCallback(
    (feature: FeatureKey) =>
      featureFlagEngine.isEnabled(feature, {
        tenantId: currentTenant?.id,
      }),
    [currentTenant, flags],
  );

  return { isEnabled, flags, loading, refresh: fetchFlags };
}
