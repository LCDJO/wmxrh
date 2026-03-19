/**
 * useEmployeeLimit — Check if tenant can add more employees based on plan limits
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { usePXE } from './use-pxe';

interface EmployeeLimitState {
  loading: boolean;
  currentCount: number;
  maxAllowed: number | null; // null = unlimited
  canAddMore: boolean;
  remaining: number | null; // null = unlimited
}

export function useEmployeeLimit() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const { planSnapshot, ready: pxeReady } = usePXE();

  const [state, setState] = useState<EmployeeLimitState>({
    loading: true,
    currentCount: 0,
    maxAllowed: null,
    canAddMore: true,
    remaining: null,
  });

  useEffect(() => {
    if (!tenantId || !pxeReady) return;

    let cancelled = false;

    async function fetchCount() {
      const { count, error } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .is('deleted_at', null);

      if (cancelled) return;

      const currentCount = error ? 0 : (count ?? 0);
      const maxAllowed = planSnapshot?.usage?.max_employees ?? null;
      const canAddMore = maxAllowed === null || currentCount < maxAllowed;
      const remaining = maxAllowed === null ? null : Math.max(0, maxAllowed - currentCount);

      setState({ loading: false, currentCount, maxAllowed, canAddMore, remaining });
    }

    fetchCount();
    return () => { cancelled = true; };
  }, [tenantId, pxeReady, planSnapshot]);

  return state;
}
