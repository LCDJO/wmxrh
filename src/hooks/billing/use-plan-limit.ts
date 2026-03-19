/**
 * usePlanLimit — Generic hook to check any plan limit via the DB RPC.
 * 
 * Usage:
 *   const { allowed, current, max, remaining, planName, loading } = usePlanLimit('employees');
 *   const { allowed: canAddUsers } = usePlanLimit('active_users');
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { emitBillingEvent } from '@/domains/billing-core/billing-events';

export type PlanLimitKey = 'employees' | 'active_users' | 'api_calls' | 'workflows' | 'storage_mb';

interface PlanLimitState {
  loading: boolean;
  allowed: boolean;
  current: number;
  max: number | null;
  remaining: number | null;
  planName: string | null;
  error: string | null;
}

const INITIAL: PlanLimitState = {
  loading: true,
  allowed: true,
  current: 0,
  max: null,
  remaining: null,
  planName: null,
  error: null,
};

export function usePlanLimit(limitKey: PlanLimitKey) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const [state, setState] = useState<PlanLimitState>(INITIAL);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setState(prev => ({ ...prev, loading: true }));

    const { data, error } = await supabase.rpc('check_plan_limit', {
      p_tenant_id: tenantId,
      p_limit_key: limitKey,
    });

    if (error) {
      setState({ ...INITIAL, loading: false, error: error.message });
      return;
    }

    const result = data as any;
    const allowed = result.allowed ?? true;
    const current = result.current ?? 0;
    const max = result.max ?? null;

    // Emit PlanLimitExceeded when blocked
    if (!allowed && tenantId && max !== null) {
      emitBillingEvent({
        type: 'PlanLimitExceeded',
        timestamp: Date.now(),
        tenant_id: tenantId,
        limit_type: limitKey,
        current_value: current,
        max_value: max,
      });
    }

    setState({
      loading: false,
      allowed,
      current,
      max,
      remaining: result.remaining ?? null,
      planName: result.plan ?? null,
      error: result.error ?? null,
    });
  }, [tenantId, limitKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
