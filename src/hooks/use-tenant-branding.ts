/**
 * useTenantBranding — React hook for WhiteLabel Engine
 *
 * Loads branding from DB, seeds in-memory engine,
 * and exposes theme + report context with platform fallback.
 */

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { createTenantBrandingEngine } from '@/domains/whitelabel';
import type {
  TenantBrandingEngineAPI,
  TenantBrandingProfile,
  GeneratedTheme,
  ReportBrandingContext,
  WhiteLabelPlanLimits,
} from '@/domains/whitelabel';

let engineInstance: TenantBrandingEngineAPI | null = null;
function getEngine(): TenantBrandingEngineAPI {
  if (!engineInstance) engineInstance = createTenantBrandingEngine();
  return engineInstance;
}

export function useTenantBranding() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const engine = getEngine();

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<TenantBrandingProfile | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setReady(true);
      setProfile(null);
      return;
    }

    let cancelled = false;

    // Load branding profile AND plan limits in parallel
    Promise.all([
      supabase
        .from('tenant_branding_profiles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('tenant_plans')
        .select('plan_id, saas_plans(allow_whitelabel, allow_custom_reports, allow_custom_domain)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .maybeSingle(),
    ]).then(([brandingResult, planResult]) => {
      if (cancelled) return;

      // Seed plan gate
      const planRow = planResult.data as any;
      const limits: WhiteLabelPlanLimits = {
        allow_whitelabel: planRow?.saas_plans?.allow_whitelabel ?? false,
        allow_custom_reports: planRow?.saas_plans?.allow_custom_reports ?? false,
        allow_custom_domain: planRow?.saas_plans?.allow_custom_domain ?? false,
      };
      engine.planGate.setLimits(tenantId, limits);

      // Seed branding — only if plan allows whitelabel
      if (brandingResult.data && limits.allow_whitelabel) {
        const p = brandingResult.data as unknown as TenantBrandingProfile;
        engine.profiles.set(tenantId, p);
        setProfile(p);
      } else {
        engine.profiles.clear(tenantId);
        setProfile(null);
      }

      setReady(true);
    });

    return () => { cancelled = true; };
  }, [tenantId, engine]);

  const canWhiteLabel = tenantId ? engine.planGate.canWhiteLabel(tenantId) : false;
  const canCustomReports = tenantId ? engine.planGate.canCustomReports(tenantId) : false;
  const canCustomDomain = tenantId ? engine.planGate.canCustomDomain(tenantId) : false;

  const theme: GeneratedTheme | null = useMemo(
    () => (ready && tenantId ? engine.theme.generate(tenantId) : null),
    [ready, tenantId, engine, profile],
  );

  // If plan doesn't allow custom reports, only expose logo (no colors/footer)
  const reportContext: ReportBrandingContext | null = useMemo(() => {
    if (!ready || !tenantId) return null;
    const ctx = engine.reports.getContext(tenantId);
    if (!canCustomReports) {
      // Fallback: only logo allowed in reports
      return {
        header_logo_url: profile?.logo_url ?? null,
        footer_text: null,
        primary_color: '#0D9668',
        system_name: 'Plataforma RH',
      };
    }
    return ctx;
  }, [ready, tenantId, engine, profile, canCustomReports]);

  return {
    engine,
    ready,
    profile,
    theme,
    reportContext,
    isCustomBranded: theme?.source === 'tenant',
    systemName: profile?.system_display_name ?? 'Plataforma RH',
    canWhiteLabel,
    canCustomReports,
    canCustomDomain,
  };
}
