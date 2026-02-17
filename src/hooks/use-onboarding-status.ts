/**
 * useOnboardingStatus — Lightweight hook for components that only need
 * to know IF onboarding is active and its progress percentage.
 *
 * Uses the progress cache (localStorage) for O(1) reads, falling back
 * to the in-memory engine only on cache miss.
 *
 * Consumers: AppSidebar, Dashboard widgets, Navigation guards
 */

import { useMemo } from 'react';
import { isOnboardingCompleteFromCache, loadProgressFromCache } from '@/domains/adaptive-onboarding/onboarding-progress-cache';
import { useTenant } from '@/contexts/TenantContext';

export interface OnboardingStatus {
  /** Whether onboarding is still in progress */
  isOnboarding: boolean;
  /** Completion percentage (0–100) */
  completionPct: number;
  /** Current step ID, if available */
  currentStepId: string | null;
  /** Tenant ID this status belongs to */
  tenantId: string | null;
}

const COMPLETED_STATUS: OnboardingStatus = {
  isOnboarding: false,
  completionPct: 100,
  currentStepId: null,
  tenantId: null,
};

export function useOnboardingStatus(): OnboardingStatus {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useMemo(() => {
    if (!tenantId) return COMPLETED_STATUS;

    // Try cache first (O(1))
    const cacheComplete = isOnboardingCompleteFromCache(tenantId);

    // Cache hit: completed
    if (cacheComplete === true) {
      return { isOnboarding: false, completionPct: 100, currentStepId: null, tenantId };
    }

    // Cache hit: in progress
    if (cacheComplete === false) {
      const snapshot = loadProgressFromCache(tenantId);
      if (snapshot) {
        return {
          isOnboarding: true,
          completionPct: snapshot.completion_pct,
          currentStepId: snapshot.current_step_id,
          tenantId,
        };
      }
    }

    // Cache miss: no onboarding data → assume completed (already onboarded tenant)
    return { isOnboarding: false, completionPct: 100, currentStepId: null, tenantId };
  }, [tenantId]);
}
