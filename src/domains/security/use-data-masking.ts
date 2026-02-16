/**
 * React hook for data masking based on current user's roles.
 */

import { useMemo } from 'react';
import { usePermissions } from './use-permissions';
import {
  getMaskingPolicy,
  displaySalary,
  displayCPF,
  displayBankAccount,
  type MaskingPolicy,
} from './data-masking';

export interface UseDataMaskingReturn {
  policy: MaskingPolicy;
  /** Display salary (masked or formatted based on role) */
  salary: (value: number | null | undefined) => string;
  /** Display CPF (masked or formatted based on role) */
  cpf: (value: string | null | undefined) => string;
  /** Display bank account (masked or shown based on role) */
  bankAccount: (value: string | null | undefined) => string;
}

export function useDataMasking(): UseDataMaskingReturn {
  const { effectiveRoles } = usePermissions();

  const policy = useMemo(() => getMaskingPolicy(effectiveRoles), [effectiveRoles]);

  return useMemo(() => ({
    policy,
    salary: (v: number | null | undefined) => displaySalary(v, policy),
    cpf: (v: string | null | undefined) => displayCPF(v, policy),
    bankAccount: (v: string | null | undefined) => displayBankAccount(v, policy),
  }), [policy]);
}
