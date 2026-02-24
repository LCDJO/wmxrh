/**
 * Security Guard — Frontend enforcement layer
 *
 * Provides:
 *   1. Immutability enforcement helpers (prevent UI from allowing edits on locked records)
 *   2. Access control checks (wraps DB functions for UI gating)
 *   3. Audit trail for sensitive operations
 */

import { supabase } from '@/integrations/supabase/client';
import { logExEmployeeAccess } from '@/domains/lgpd';

// ── Immutability Rules ──

export interface ImmutabilityRule {
  entity: string;
  description: string;
  protection: 'full' | 'partial';
  details: string;
}

/** All immutability rules enforced by DB triggers */
export const IMMUTABILITY_RULES: ImmutabilityRule[] = [
  {
    entity: 'audit_logs',
    description: 'Logs de auditoria',
    protection: 'full',
    details: 'UPDATE e DELETE bloqueados. Registros são append-only.',
  },
  {
    entity: 'offboarding_audit_log',
    description: 'Logs de auditoria de desligamento',
    protection: 'full',
    details: 'UPDATE e DELETE bloqueados. Registros são append-only.',
  },
  {
    entity: 'security_logs',
    description: 'Logs de segurança',
    protection: 'full',
    details: 'UPDATE e DELETE bloqueados. Registros são append-only.',
  },
  {
    entity: 'esocial_governance_logs',
    description: 'Logs de governança eSocial',
    protection: 'full',
    details: 'UPDATE e DELETE bloqueados. Registros são append-only.',
  },
  {
    entity: 'lgpd_ex_employee_access_logs',
    description: 'Logs de acesso LGPD',
    protection: 'full',
    details: 'UPDATE e DELETE bloqueados. Registros são append-only.',
  },
  {
    entity: 'signed_documents',
    description: 'Documentos assinados',
    protection: 'full',
    details: 'Hash, URL e dados de assinatura são imutáveis. DELETE bloqueado.',
  },
  {
    entity: 'blockchain_hash_registry',
    description: 'Registros blockchain',
    protection: 'full',
    details: 'Hash e referência do documento são imutáveis. DELETE bloqueado.',
  },
  {
    entity: 'employee_agreements',
    description: 'Acordos de colaboradores',
    protection: 'partial',
    details: 'DELETE bloqueado. Acordos assinados não podem ter conteúdo modificado.',
  },
  {
    entity: 'salary_history',
    description: 'Histórico salarial',
    protection: 'partial',
    details: 'Registros passados não podem ter salário/data retroativamente editados. DELETE bloqueado.',
  },
  {
    entity: 'reference_letters',
    description: 'Cartas de referência',
    protection: 'partial',
    details: 'Cartas assinadas/entregues não podem ter conteúdo ou elegibilidade modificados.',
  },
  {
    entity: 'archived_employee_profiles',
    description: 'Perfis arquivados',
    protection: 'partial',
    details: 'Perfis anonimizados não podem ser revertidos. DELETE bloqueado.',
  },
];

// ── Access Control Checks ──

export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_has_permission', {
    p_user_id: userId,
    p_permission: permission,
  });
  if (error) {
    console.warn('[SecurityGuard] Permission check failed:', error.message);
    return false;
  }
  return !!data;
}

export async function checkEmployeeDataAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_access_employee_data', {
    p_user_id: userId,
    p_tenant_id: tenantId,
  });
  if (error) {
    console.warn('[SecurityGuard] Employee data access check failed:', error.message);
    return false;
  }
  return !!data;
}

// ── Record-level immutability check (client-side) ──

export function isRecordLocked(entity: string, record: Record<string, unknown>): { locked: boolean; reason?: string } {
  switch (entity) {
    case 'signed_documents':
    case 'blockchain_hash_registry':
    case 'audit_logs':
    case 'offboarding_audit_log':
    case 'security_logs':
      return { locked: true, reason: 'Registro imutável — não pode ser editado ou excluído' };

    case 'employee_agreements':
      if (record.status === 'signed' || record.status === 'expired') {
        return { locked: true, reason: 'Acordo assinado — conteúdo protegido' };
      }
      return { locked: false };

    case 'salary_history':
      if (record.effective_date && new Date(record.effective_date as string) < new Date()) {
        return { locked: true, reason: 'Registro salarial passado — não pode ser editado retroativamente' };
      }
      return { locked: false };

    case 'reference_letters':
      if (record.status === 'signed' || record.status === 'delivered') {
        return { locked: true, reason: 'Carta assinada — conteúdo protegido' };
      }
      return { locked: false };

    case 'archived_employee_profiles':
      if (record.is_anonymized) {
        return { locked: true, reason: 'Perfil anonimizado — irreversível' };
      }
      return { locked: false };

    default:
      return { locked: false };
  }
}

export const securityGuard = {
  checkPermission,
  checkEmployeeDataAccess,
  isRecordLocked,
  IMMUTABILITY_RULES,
};
