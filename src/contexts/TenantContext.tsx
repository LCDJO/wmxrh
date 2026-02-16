import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { Tables } from '@/integrations/supabase/types';

type Tenant = Tables<'tenants'>;
type TenantMembership = Tables<'tenant_memberships'>;

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  membership: TenantMembership | null;
  loading: boolean;
  setCurrentTenant: (tenant: Tenant) => void;
  refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [membership, setMembership] = useState<TenantMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from('tenant_memberships')
      .select('*, tenants(*)')
      .eq('user_id', user.id);

    if (memberships && memberships.length > 0) {
      const tenantList = memberships.map((m: any) => m.tenants).filter(Boolean) as Tenant[];
      setTenants(tenantList);

      const saved = localStorage.getItem('currentTenantId');
      const found = tenantList.find(t => t.id === saved) || tenantList[0];
      setCurrentTenant(found);

      const currentMembership = memberships.find((m: any) => m.tenant_id === found.id);
      setMembership(currentMembership || null);
    } else {
      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshTenants();
  }, [user]);

  const handleSetTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem('currentTenantId', tenant.id);
  };

  return (
    <TenantContext.Provider value={{ currentTenant, tenants, membership, loading, setCurrentTenant: handleSetTenant, refreshTenants }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
