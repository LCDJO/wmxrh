import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  needsOnboarding: boolean;
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
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const claimAttempted = useRef(false);

  const refreshTenants = async () => {
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
      setNeedsOnboarding(false);
      setLoading(false);
      claimAttempted.current = false;
      return;
    }

    // Step 1: Claim any invited memberships (only once per session)
    if (!claimAttempted.current && user.email) {
      claimAttempted.current = true;
      await supabase.rpc('claim_invited_memberships', {
        p_user_id: user.id,
        p_email: user.email,
      });
    }

    // Step 2: Fetch active memberships
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

      // Step 3: Check if current tenant needs onboarding (no companies)
      const { data: needsOb } = await supabase
        .rpc('check_tenant_needs_onboarding', { p_tenant_id: found.id });
      setNeedsOnboarding(needsOb === true);
    } else {
      // Step 3b: No memberships — check if user has self-registration metadata
      const meta = user.user_metadata;
      if (meta?.company_name && meta?.full_name) {
        const { data: result } = await supabase.rpc('self_register_tenant', {
          p_user_id: user.id,
          p_user_email: user.email ?? '',
          p_user_name: meta.full_name,
          p_company_name: meta.company_name,
          p_company_document: meta.company_document ?? null,
          p_company_phone: meta.company_phone ?? null,
        });

        if (result && !(result as any).already_registered) {
          // Tenant created — re-fetch memberships
          const { data: newMemberships } = await supabase
            .from('tenant_memberships')
            .select('*, tenants(*)')
            .eq('user_id', user.id);

          if (newMemberships && newMemberships.length > 0) {
            const tenantList = newMemberships.map((m: any) => m.tenants).filter(Boolean) as Tenant[];
            setTenants(tenantList);
            setCurrentTenant(tenantList[0]);
            localStorage.setItem('currentTenantId', tenantList[0].id);
            setMembership(newMemberships[0] || null);
            setNeedsOnboarding(true); // fresh tenant, needs onboarding
            setLoading(false);
            return;
          }
        }
      }

      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
      setNeedsOnboarding(false);
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
    <TenantContext.Provider value={{ currentTenant, tenants, membership, loading, needsOnboarding, setCurrentTenant: handleSetTenant, refreshTenants }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
