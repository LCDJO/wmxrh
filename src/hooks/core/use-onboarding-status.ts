/**
 * useOnboardingStatus — Lightweight hook for components that only need
 * to know IF onboarding is active and its progress percentage.
 *
 * Uses the progress cache (localStorage) for O(1) reads, falling back
 * to the in-memory engine only on cache miss.
 *
 * Consumers: AppSidebar, Dashboard widgets, Navigation guards
 */

import { useMemo, useState, useEffect } from 'react';
import { isOnboardingCompleteFromCache, loadProgressFromCache } from '@/domains/adaptive-onboarding/onboarding-progress-cache';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingStatus {
  isOnboarding: boolean;
  completionPct: number;
  currentStepId: string | null;
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
  const [dbNeedsOnboarding, setDbNeedsOnboarding] = useState<boolean | null>(null);

  // Check DB reliably via SECURITY DEFINER function (bypasses RLS)
  useEffect(() => {
    if (!tenantId) { setDbNeedsOnboarding(false); return; }

    supabase.rpc('check_tenant_needs_onboarding', { p_tenant_id: tenantId })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[OnboardingStatus] RPC error, assuming completed:', error.message);
          setDbNeedsOnboarding(false);
        } else {
          setDbNeedsOnboarding(data === true);
        }
      });
  }, [tenantId]);

  return useMemo(() => {
    if (!tenantId) return COMPLETED_STATUS;

    // DB says no onboarding needed → done
    if (dbNeedsOnboarding === false) {
      return { isOnboarding: false, completionPct: 100, currentStepId: null, tenantId };
    }

    // DB says onboarding needed → check cache for progress details
    if (dbNeedsOnboarding === true) {
      const snapshot = loadProgressFromCache(tenantId);
      if (snapshot) {
        return {
          isOnboarding: true,
          completionPct: snapshot.completion_pct,
          currentStepId: snapshot.current_step_id,
          tenantId,
        };
      }
      // No cache but DB says needs onboarding
      return { isOnboarding: true, completionPct: 0, currentStepId: null, tenantId };
    }

    // Still loading from DB → assume completed to avoid flash
    return COMPLETED_STATUS;
  }, [tenantId, dbNeedsOnboarding]);
}
