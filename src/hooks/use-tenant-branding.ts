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

    supabase
      .from('tenant_branding_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const p = data as unknown as TenantBrandingProfile;
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

  const theme: GeneratedTheme | null = useMemo(
    () => (ready && tenantId ? engine.theme.generate(tenantId) : null),
    [ready, tenantId, engine, profile],
  );

  const reportContext: ReportBrandingContext | null = useMemo(
    () => (ready && tenantId ? engine.reports.getContext(tenantId) : null),
    [ready, tenantId, engine, profile],
  );

  return {
    engine,
    ready,
    profile,
    theme,
    reportContext,
    isCustomBranded: theme?.source === 'tenant',
    systemName: profile?.system_display_name ?? 'Plataforma RH',
  };
}
