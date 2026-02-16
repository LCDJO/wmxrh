/**
 * Data Masking Utility
 * 
 * Masks sensitive fields (salary, CPF, bank data) based on user roles.
 * Used in UI components to hide financial data from unauthorized viewers.
 */

import type { TenantRole } from '@/domains/shared/types';
import { hasPermission } from './permissions';

// ═══════════════════════════════════
// Masking Functions
// ═══════════════════════════════════

/** Mask a salary value: R$ ***.***,** */
export function maskSalary(value: number | null | undefined): string {
  if (value == null) return '—';
  return 'R$ •••.•••,••';
}

/** Format salary for display */
export function formatSalary(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Mask a CPF: ***.***.**-** → shows only last 2 digits */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return '•••.•••.•••-••';
  return `•••.•••.•••-${clean.slice(9)}`;
}

/** Format CPF for display */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

/** Mask bank account: shows only last 4 digits */
export function maskBankAccount(account: string | null | undefined): string {
  if (!account) return '—';
  if (account.length <= 4) return '••••';
  return `${'•'.repeat(account.length - 4)}${account.slice(-4)}`;
}

// ═══════════════════════════════════
// Role-Based Masking Decisions
// ═══════════════════════════════════

export interface MaskingPolicy {
  canViewSalary: boolean;
  canViewCPF: boolean;
  canViewBankData: boolean;
}

/**
 * Determine what a user can see based on their roles.
 */
export function getMaskingPolicy(roles: TenantRole[]): MaskingPolicy {
  return {
    canViewSalary: hasPermission('compensation', 'view', roles),
    canViewCPF: hasPermission('employees', 'update', roles), // Only managers+ see full CPF
    canViewBankData: hasPermission('compensation', 'create', roles), // Only compensation managers
  };
}

// ═══════════════════════════════════
// Smart Display Functions (mask or show based on policy)
// ═══════════════════════════════════

export function displaySalary(value: number | null | undefined, policy: MaskingPolicy): string {
  return policy.canViewSalary ? formatSalary(value) : maskSalary(value);
}

export function displayCPF(cpf: string | null | undefined, policy: MaskingPolicy): string {
  return policy.canViewCPF ? formatCPF(cpf) : maskCPF(cpf);
}

export function displayBankAccount(account: string | null | undefined, policy: MaskingPolicy): string {
  return policy.canViewBankData ? (account || '—') : maskBankAccount(account);
}
