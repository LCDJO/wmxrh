import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePXE } from '@/hooks/use-pxe';
import { AdSlot } from '@/components/ads/AdSlot';

interface ContextualAdSlotProps {
  slot: string;
  className?: string;
  enabled?: boolean;
}

function inferModuleKey(pathname: string): string | undefined {
  if (!pathname || pathname === '/' || pathname === '/platform/dashboard') return undefined;

  const normalized = pathname.replace(/^\//, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;

  if (segments[0] === 'platform') {
    return segments[1] ?? undefined;
  }

  const routeMap: Record<string, string> = {
    employees: 'employees',
    companies: 'companies',
    groups: 'groups',
    departments: 'departments',
    positions: 'positions',
    compensation: 'compensation',
    benefits: 'benefits',
    health: 'health',
    'labor-dashboard': 'labor',
    'labor-compliance': 'labor',
    'labor-rules': 'labor',
    'legal-dashboard': 'legal',
    'legal-intelligence': 'legal',
    'regulatory-dashboard': 'legal',
    agreements: 'agreements',
    'communication-center': 'communications',
    announcements: 'communications',
    apps: 'apps',
    integrations: 'integrations',
    referral: 'referral',
    engajamento: 'engagement',
    settings: 'settings',
    support: 'support',
    'fleet-dashboard': 'fleet',
    'fleet-live': 'fleet',
    'fleet-analytics': 'fleet',
    'fleet-policies': 'fleet',
    'live-display': 'live_display',
    'command-center': 'operations',
    esocial: 'esocial',
    'esocial-governance': 'esocial',
    'epi-catalog': 'health',
    'epi-delivery': 'health',
    'epi-dashboard': 'health',
    'epi-audit': 'health',
    'occupational-compliance': 'health',
    'nr-compliance': 'health',
    'safety-automation': 'health',
    'document-validation': 'compliance',
    lgpd: 'compliance',
    compliance: 'compliance',
    audit: 'audit',
    'time-tracking': 'employees',
  };

  return routeMap[segments[0]] ?? segments[0];
}

export function ContextualAdSlot({ slot, className, enabled = true }: ContextualAdSlotProps) {
  const location = useLocation();
  const { currentTenant } = useTenant();
  const { planTier } = usePXE();

  const isTenantScopedSlot = slot.startsWith('tenant_') || slot.startsWith('module_');
  const moduleKey = useMemo(() => inferModuleKey(location.pathname), [location.pathname]);

  const { data: tenantAdsProfile } = useQuery({
    queryKey: ['tenant-ads-profile', currentTenant?.id],
    enabled: isTenantScopedSlot && !!currentTenant?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: tenantPlan } = await (supabase
        .from('tenant_plans' as any)
        .select('plan_id')
        .eq('tenant_id', currentTenant!.id)
        .in('status', ['active', 'trial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      if (!tenantPlan?.plan_id) {
        return { adsEnabled: true, planName: planTier };
      }

      const { data: plan } = await (supabase
        .from('saas_plans' as any)
        .select('name, ads_enabled')
        .eq('id', tenantPlan.plan_id)
        .maybeSingle() as any);

      return {
        adsEnabled: plan?.ads_enabled ?? true,
        planName: plan?.name ?? planTier,
      };
    },
  });

  if (isTenantScopedSlot && !currentTenant?.id) return null;

  return (
    <AdSlot
      slot={slot}
      className={className}
      enabled={enabled && (tenantAdsProfile?.adsEnabled ?? true)}
      planName={tenantAdsProfile?.planName ?? planTier}
      moduleKey={moduleKey}
    />
  );
}
