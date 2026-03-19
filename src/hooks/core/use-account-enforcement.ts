/**
 * useAccountEnforcement — React hook for AccountEnforcementEngine
 */
import { useMemo } from 'react';
import { getAccountEnforcementEngine } from '@/domains/account-enforcement';
import type { AccountEnforcementEngineAPI } from '@/domains/account-enforcement';

export function useAccountEnforcement(): AccountEnforcementEngineAPI {
  return useMemo(() => getAccountEnforcementEngine(), []);
}
