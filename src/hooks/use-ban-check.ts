/**
 * useBanCheck — Checks if the current tenant is banned/suspended.
 * Returns restriction status to block system access at the App level.
 */
import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { getAccountEnforcementEngine } from '@/domains/account-enforcement/account-enforcement-engine';
import type { AccountEnforcement } from '@/domains/account-enforcement/types';

export interface BanCheckResult {
  loading: boolean;
  checked: boolean;
  restricted: boolean;
  status: 'active' | 'banned' | 'suspended' | 'restricted' | 'under_review';
  enforcements: AccountEnforcement[];
}

export function useBanCheck(): BanCheckResult {
  const { currentTenant } = useTenant();
  const [state, setState] = useState<BanCheckResult>({
    loading: true,
    checked: false,
    restricted: false,
    status: 'active',
    enforcements: [],
  });

  useEffect(() => {
    if (!currentTenant?.id) {
      setState({ loading: false, checked: true, restricted: false, status: 'active', enforcements: [] });
      return;
    }

    let cancelled = false;
    const engine = getAccountEnforcementEngine();

    engine.isTenantRestricted(currentTenant.id).then(({ restricted, enforcements }) => {
      if (cancelled) return;

      let status: BanCheckResult['status'] = 'active';
      if (enforcements.some(e => e.action_type === 'ban')) status = 'banned';
      else if (enforcements.some(e => e.action_type === 'suspend')) status = 'suspended';
      else if (enforcements.some(e => e.action_type === 'restrict')) status = 'restricted';
      else if (restricted) status = 'under_review';

      setState({ loading: false, checked: true, restricted, status, enforcements });
    }).catch(() => {
      if (!cancelled) setState(prev => ({ ...prev, loading: false, checked: true }));
    });

    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  return state;
}
