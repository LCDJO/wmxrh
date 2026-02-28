/**
 * usePXE — React hook for the PlatformExperienceEngine
 *
 * Provides DB-backed plan resolution, module access checks,
 * and experience profile for the current tenant.
 *
 * PERFORMANCE: Seeds PlanRegistry from saas_plans once,
 * resolves tenant plan on context switch only.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { createPlatformExperienceEngine } from '@/domains/platform-experience/platform-experience-engine';
import type {
  PlatformExperienceEngineAPI,
  PlanDefinition,
  TenantPlanSnapshot,
  ExperienceProfile,
  ModuleAccessResult,
  UpgradePrompt as UpgradePromptType,
} from '@/domains/platform-experience/types';
import type { ModuleKey } from '@/domains/platform/platform-modules';

// ── Singleton engine ─────────────────────────────────────────────
let engineInstance: PlatformExperienceEngineAPI | null = null;
let seededFromDb = false;

function getEngine(): PlatformExperienceEngineAPI {
  if (!engineInstance) {
    engineInstance = createPlatformExperienceEngine();
  }
  return engineInstance;
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

  // ── Seed PlanRegistry from saas_plans (once) ──
  useEffect(() => {
    if (seededFromDb) return;
    seededFromDb = true;

    supabase
      .from('saas_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })
      .then(({ data }) => {
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
      });
  }, [engine]);

  // ── Resolve tenant plan + experience on context switch ──
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!tenantId) {
      setState({ ready: true, planSnapshot: null, experienceProfile: null });
      return;
    }

    let cancelled = false;

    // Fetch tenant's active plan binding
    supabase
      .from('tenant_plans')
      .select('plan_id, status, billing_cycle')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;

        if (data) {
          // Activate in lifecycle
          try {
            engine.lifecycle.transition(tenantId, 'activate', (data as any).plan_id);
          } catch {
            // Already active — ignore
          }
        }

        const planSnapshot = engine.tenantPlan.resolve(tenantId);
        const experienceProfile = engine.experience.resolveProfile(tenantId);

        setState({
          ready: true,
          planSnapshot,
          experienceProfile,
        });
      });

    return () => { cancelled = true; };
  }, [tenantId, engine, refreshTrigger]);

  const refreshPlan = useCallback(() => {
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
