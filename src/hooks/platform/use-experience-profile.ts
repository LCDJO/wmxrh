/**
 * useExperienceProfile — Consumes experience_profiles from DB
 * to adapt UI (sidebar, dashboard, widgets) based on tenant plan.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface ExperienceProfileData {
  plan_tier: string;
  visible_navigation: string[];
  hidden_navigation: string[];
  locked_navigation: Array<{ path: string; required_plan: string; message: string }>;
  max_widgets: number;
  ui_features: Record<string, boolean>;
  cognitive_context_level: string;
}

const DEFAULT_PROFILE: ExperienceProfileData = {
  plan_tier: 'free',
  visible_navigation: [],
  hidden_navigation: [],
  locked_navigation: [],
  max_widgets: 2,
  ui_features: {},
  cognitive_context_level: 'basic',
};

export function useExperienceProfile() {
  const { currentTenant } = useTenant();
  const [profile, setProfile] = useState<ExperienceProfileData>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentTenant?.id) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('experience_profiles')
      .select('*, saas_plans!experience_profiles_plan_id_fkey(name)')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // Fallback: try to get plan from tenant_plans
          supabase
            .from('tenant_plans')
            .select('status, saas_plans!tenant_plans_plan_id_fkey(name)')
            .eq('tenant_id', currentTenant.id!)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data: tp }) => {
              if (cancelled) return;
              const planName = (tp as any)?.saas_plans?.name?.toLowerCase() ?? 'free';
              setProfile({ ...DEFAULT_PROFILE, plan_tier: planName });
              setLoading(false);
            });
          return;
        }

        const planName = (data as any)?.saas_plans?.name?.toLowerCase() ?? 'free';
        setProfile({
          plan_tier: planName,
          visible_navigation: (data as any).visible_navigation ?? [],
          hidden_navigation: (data as any).hidden_navigation ?? [],
          locked_navigation: Array.isArray((data as any).locked_navigation) ? (data as any).locked_navigation : [],
          max_widgets: (data as any).max_widgets ?? 2,
          ui_features: (data as any).ui_features ?? {},
          cognitive_context_level: (data as any).cognitive_context_level ?? 'basic',
        });
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  /** Check if a path is visible (not hidden or locked) */
  const isPathVisible = (path: string): boolean => {
    if (profile.hidden_navigation.some(h => path.startsWith(h))) return false;
    return true;
  };

  /** Check if a path is locked (shown but disabled with upgrade prompt) */
  const isPathLocked = (path: string): { locked: boolean; message?: string; requiredPlan?: string } => {
    const entry = profile.locked_navigation.find(l => path.startsWith(l.path));
    if (entry) return { locked: true, message: entry.message, requiredPlan: entry.required_plan };
    return { locked: false };
  };

  /** Check if a UI feature is enabled */
  const isUIFeatureEnabled = (key: string): boolean => {
    return profile.ui_features[key] ?? false;
  };

  const isPlanAtLeast = (tier: string): boolean => {
    const tiers = ['free', 'starter', 'professional', 'enterprise', 'custom'];
    return tiers.indexOf(profile.plan_tier) >= tiers.indexOf(tier);
  };

  return {
    profile,
    loading,
    isPathVisible,
    isPathLocked,
    isUIFeatureEnabled,
    isPlanAtLeast,
  };
}
