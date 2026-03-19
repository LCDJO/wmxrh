/**
 * usePendingPolicies — checks if the current tenant has pending mandatory policies.
 */
import { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PendingPolicy } from '@/domains/platform-policy-governance/types';

export function usePendingPolicies() {
  const { currentTenant } = useTenant();
  const [pending, setPending] = useState<PendingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id) {
      setLoading(false);
      setChecked(true);
      return;
    }

    let cancelled = false;
    const engine = getPlatformPolicyGovernanceEngine();

    engine.getPendingForTenant(currentTenant.id).then((result) => {
      if (!cancelled) {
        setPending(result);
        setLoading(false);
        setChecked(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setChecked(true);
      }
    });

    return () => { cancelled = true; };
  }, [currentTenant?.id]);

  const refresh = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const engine = getPlatformPolicyGovernanceEngine();
    const result = await engine.getPendingForTenant(currentTenant.id);
    setPending(result);
    setLoading(false);
  };

  return { pending, loading, checked, hasPending: pending.length > 0, refresh };
}
