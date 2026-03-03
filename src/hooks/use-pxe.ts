/**
 * usePXE — React hook for the PlatformExperienceEngine
 *
 * Provides DB-backed plan resolution, module access checks,
 * and experience profile for the current tenant.
 *
 * PERFORMANCE: Seeds PlanRegistry from saas_plans once,
 * resolves tenant plan on context switch only.
 */

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { createPlatformExperienceEngine, type ExtendedPlatformExperienceEngineAPI } from '@/domains/platform-experience/platform-experience-engine';
import type {
  PlanDefinition,
  TenantPlanSnapshot,
  ExperienceProfile,
  ModuleAccessResult,
  UpgradePrompt as UpgradePromptType,
} from '@/domains/platform-experience/types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

// ── Singleton engine ─────────────────────────────────────────────
let engineInstance: ExtendedPlatformExperienceEngineAPI | null = null;
let seedPromise: Promise<void> | null = null;

function getEngine(): ExtendedPlatformExperienceEngineAPI {
  if (!engineInstance) {
    engineInstance = createPlatformExperienceEngine();
  }
  return engineInstance;
}

/** Seed PlanRegistry from saas_plans (once, returns promise) */
function ensureSeeded(engine: ExtendedPlatformExperienceEngineAPI): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const { data } = await supabase
      .from('saas_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (!data) return;
    (data as any[]).forEach((row, idx) => {
      const def: PlanDefinition = {
        id: row.id,
        name: row.name,
        tier: inferTier(row.price, idx),
        description: row.description ?? '',
        included_modules: row.allowed_modules ?? [],
        addon_modules: [],
        enabled_features: row.feature_flags ?? [],
        max_users: null,
        max_companies: null,
        max_employees: (row as any).max_employees ?? null,
        storage_quota_mb: null,
        pricing: {
          monthly_brl: row.billing_cycle === 'monthly' ? row.price : row.price / 12,
          annual_brl: row.billing_cycle === 'yearly' ? row.price : row.price * 12,
        },
        allowed_payment_methods: (row.allowed_payment_methods ?? []) as any[],
        trial_days: 0,
        is_public: true,
        display_order: idx,
      };
      engine.plans.register(def);
    });
  })();

  return seedPromise;
}

interface PxeState {
  ready: boolean;
  planSnapshot: TenantPlanSnapshot | null;
  experienceProfile: ExperienceProfile | null;
}

export function usePXE() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const engine = getEngine();

  const [state, setState] = useState<PxeState>({
    ready: false,
    planSnapshot: null,
    experienceProfile: null,
  });

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ── Seed plans + resolve tenant binding (sequenced correctly) ──
  useEffect(() => {
    if (!tenantId) {
      setState({ ready: true, planSnapshot: null, experienceProfile: null });
      return;
    }

    let cancelled = false;

    // 1. Ensure plans are seeded first, THEN resolve tenant
    ensureSeeded(engine).then(() => {
      if (cancelled) return;

      // 2. Fetch tenant's active plan binding from DB
      return supabase
        .from('tenant_plans')
        .select('plan_id, status, billing_cycle')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle();
    }).then((result) => {
      if (cancelled || !result) return;
      const { data } = result;

      if (data) {
        const planId = (data as any).plan_id;
        const billingCycle = (data as any).billing_cycle ?? 'monthly';

        // 3. Bind the tenant to the plan in the in-memory resolver
        engine.tenantPlan.bind(tenantId, {
          planId,
          addons: [],
          billing_cycle: billingCycle,
        });

        // 4. Set lifecycle status to active
        try {
          engine.lifecycle.transition(tenantId, 'activate', planId);
        } catch {
          // Already active — ignore
        }
      }

      // 5. Resolve snapshot and experience profile
      const planSnapshot = engine.tenantPlan.resolve(tenantId);
      const experienceProfile = engine.experience.resolveProfile(tenantId);

      console.log('[PXE] Resolved plan for tenant:', tenantId, {
        plan_id: planSnapshot.plan_id,
        plan_tier: planSnapshot.plan_tier,
        status: planSnapshot.status,
        active_modules: planSnapshot.active_modules.length,
        features: planSnapshot.effective_features.length,
      });

      setState({
        ready: true,
        planSnapshot,
        experienceProfile,
      });
    });

    return () => { cancelled = true; };
  }, [tenantId, engine, refreshTrigger]);

  const refreshPlan = useCallback(() => {
    // Reset seed cache so plans are re-fetched from DB
    seedPromise = null;
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // ── Convenience methods ──

  const isModuleAccessible = useCallback(
    (moduleKey: ModuleKey | string): boolean => {
      if (!tenantId) return false;
      return engine.moduleAccess.check(tenantId, moduleKey).accessible;
    },
    [tenantId, engine],
  );

  const getModuleAccess = useCallback(
    (moduleKey: ModuleKey | string): ModuleAccessResult => {
      return engine.moduleAccess.check(tenantId ?? '', moduleKey);
    },
    [tenantId, engine],
  );

  const getUpgradePrompt = useCallback(
    (moduleKey: ModuleKey | string): UpgradePromptType | null => {
      if (!tenantId) return null;
      return engine.moduleAccess.getUpgradePrompt(tenantId, moduleKey);
    },
    [tenantId, engine],
  );

  const canUpgrade = useCallback(
    (toPlanId: string) => engine.payment.canUpgrade(tenantId ?? '', toPlanId),
    [tenantId, engine],
  );

  const canDowngrade = useCallback(
    (toPlanId: string) => engine.payment.canDowngrade(tenantId ?? '', toPlanId),
    [tenantId, engine],
  );

  return {
    engine,
    ready: state.ready,
    planSnapshot: state.planSnapshot,
    experienceProfile: state.experienceProfile,
    planTier: state.planSnapshot?.plan_tier ?? 'free',
    planStatus: state.planSnapshot?.status ?? 'cancelled',
    isModuleAccessible,
    getModuleAccess,
    getUpgradePrompt,
    canUpgrade,
    canDowngrade,
    refreshPlan,
  };
}

// ── Helpers ──

function inferTier(price: number, index: number): 'free' | 'starter' | 'professional' | 'enterprise' | 'custom' {
  if (price === 0) return 'free';
  if (index <= 1) return 'starter';
  if (index === 2) return 'professional';
  if (index >= 3) return 'enterprise';
  return 'custom';
}
