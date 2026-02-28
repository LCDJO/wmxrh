/**
 * usePlatformPolicyGovernance — React hook for PlatformPolicyGovernanceEngine
 */
import { useMemo } from 'react';
import { getPlatformPolicyGovernanceEngine } from '@/domains/platform-policy-governance';
import type { PlatformPolicyGovernanceAPI } from '@/domains/platform-policy-governance';

export function usePlatformPolicyGovernance(): PlatformPolicyGovernanceAPI {
  return useMemo(() => getPlatformPolicyGovernanceEngine(), []);
}
