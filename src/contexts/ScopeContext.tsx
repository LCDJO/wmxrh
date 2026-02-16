import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { supabase } from '@/integrations/supabase/client';
import type { TenantRole, UserRole } from '@/domains/shared/types';

type ScopeLevel = 'tenant' | 'group' | 'company';

interface ScopeState {
  level: ScopeLevel;
  groupId: string | null;
  groupName: string | null;
  companyId: string | null;
  companyName: string | null;
}

interface ScopeContextType {
  scope: ScopeState;
  setGroupScope: (groupId: string, groupName: string) => void;
  setCompanyScope: (companyId: string, companyName: string) => void;
  resetToTenant: () => void;
  resetToGroup: () => void;
  userRoles: UserRole[];
  membershipRole: TenantRole | null;
  effectiveRoles: TenantRole[];
  hasRole: (...roles: TenantRole[]) => boolean;
  canAccessNav: (navKey: string) => boolean;
  rolesLoading: boolean;
}

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

// Maps nav items to allowed roles
const NAV_ACCESS: Record<string, TenantRole[]> = {
  dashboard: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh', 'gestor', 'financeiro', 'manager', 'viewer'],
  employees: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh', 'gestor', 'manager'],
  companies: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin'],
  groups: ['owner', 'admin', 'superadmin', 'tenant_admin'],
  positions: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh'],
  compensation: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh', 'financeiro'],
  departments: ['owner', 'admin', 'superadmin', 'tenant_admin', 'group_admin', 'company_admin', 'rh'],
};

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant, membership } = useTenant();

  const [scope, setScope] = useState<ScopeState>({
    level: 'tenant',
    groupId: null,
    groupName: null,
    companyId: null,
    companyName: null,
  });

  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Fetch user_roles for current tenant
  useEffect(() => {
    if (!user || !currentTenant) {
      setUserRoles([]);
      setRolesLoading(false);
      return;
    }

    const fetchRoles = async () => {
      setRolesLoading(true);
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', currentTenant.id);
      setUserRoles((data || []) as UserRole[]);
      setRolesLoading(false);
    };

    fetchRoles();
  }, [user, currentTenant]);

  const membershipRole = (membership?.role as TenantRole) || null;

  const effectiveRoles = useMemo(() => {
    const roles = new Set<TenantRole>();
    if (membershipRole) roles.add(membershipRole);
    userRoles.forEach(r => roles.add(r.role));
    return Array.from(roles);
  }, [membershipRole, userRoles]);

  const hasRole = (...roles: TenantRole[]) => {
    return effectiveRoles.some(r => roles.includes(r));
  };

  const canAccessNav = (navKey: string) => {
    const allowed = NAV_ACCESS[navKey];
    if (!allowed) return true;
    // Owner / superadmin can always access
    if (hasRole('owner', 'superadmin', 'admin')) return true;
    return effectiveRoles.some(r => allowed.includes(r));
  };

  const setGroupScope = (groupId: string, groupName: string) => {
    setScope({ level: 'group', groupId, groupName, companyId: null, companyName: null });
  };

  const setCompanyScope = (companyId: string, companyName: string) => {
    setScope(prev => ({ ...prev, level: 'company', companyId, companyName }));
  };

  const resetToTenant = () => {
    setScope({ level: 'tenant', groupId: null, groupName: null, companyId: null, companyName: null });
  };

  const resetToGroup = () => {
    setScope(prev => ({ ...prev, level: 'group', companyId: null, companyName: null }));
  };

  return (
    <ScopeContext.Provider value={{
      scope, setGroupScope, setCompanyScope, resetToTenant, resetToGroup,
      userRoles, membershipRole, effectiveRoles, hasRole, canAccessNav, rolesLoading,
    }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within ScopeProvider');
  return ctx;
}
