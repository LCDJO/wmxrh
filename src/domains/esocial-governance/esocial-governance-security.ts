/**
 * eSocial Governance — Security Layer
 *
 * Enforces access control via Access Graph:
 *  - SuperAdmin: visão global (all tenants)
 *  - Tenant Admin: apenas suas empresas
 *
 * Uses the platform `has_platform_role` DB function for role checks.
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export type EsocialAccessLevel = 'superadmin' | 'tenant_admin' | 'viewer' | 'none';

export interface EsocialAccessCheckResult {
  allowed: boolean;
  level: EsocialAccessLevel;
  tenant_id: string | null;
  reason?: string;
}

// ── Access Check ──

/**
 * Determine the current user's access level for eSocial Governance.
 *
 * - PlatformSuperAdmin → global view (all tenants)
 * - Authenticated user with tenant_id → tenant-scoped view
 * - Otherwise → no access
 */
export async function checkEsocialGovernanceAccess(): Promise<EsocialAccessCheckResult> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, level: 'none', tenant_id: null, reason: 'Não autenticado' };
  }

  // Check if user is PlatformSuperAdmin via DB function
  const { data: isSuperAdmin } = await supabase.rpc('has_platform_role', {
    _role: 'platform_super_admin',
    _user_id: user.id,
  });

  if (isSuperAdmin) {
    return { allowed: true, level: 'superadmin', tenant_id: null };
  }

  // Resolve tenant_id from tenant_memberships
  const { data: membership } = await supabase
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { allowed: false, level: 'none', tenant_id: null, reason: 'Sem tenant vinculado' };
  }

  return { allowed: true, level: 'tenant_admin', tenant_id: membership.tenant_id };
}

/**
 * Guard wrapper: runs access check and throws if not allowed.
 */
export async function guardEsocialAccess(
  requiredLevel: EsocialAccessLevel = 'tenant_admin',
): Promise<EsocialAccessCheckResult> {
  const result = await checkEsocialGovernanceAccess();

  if (!result.allowed) {
    throw new Error(`Acesso negado ao eSocial Governance: ${result.reason}`);
  }

  if (requiredLevel === 'superadmin' && result.level !== 'superadmin') {
    throw new Error('Acesso restrito a SuperAdmin');
  }

  return result;
}

/**
 * Check if user can view a specific tenant's data.
 * SuperAdmin can view any tenant; tenant users can only view their own.
 */
export function canViewTenant(
  access: EsocialAccessCheckResult,
  targetTenantId: string,
): boolean {
  if (access.level === 'superadmin') return true;
  return access.tenant_id === targetTenantId;
}
