/**
 * TenantContext — Resolução e gerenciamento do tenant ativo.
 *
 * Responsabilidades:
 *   1. Resolver a qual tenant o usuário autenticado pertence
 *   2. Gerenciar troca de tenant (multi-tenant)
 *   3. Self-registration: criar tenant automaticamente no primeiro login
 *      quando o usuário forneceu metadata de empresa no cadastro
 *   4. Claim de convites: associar memberships pré-criadas (por email)
 *
 * Fluxo de resolução (executado em refreshTenants):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 1. Claim invited memberships (RPC, uma vez por sessão)  │
 *   │ 2. Fetch memberships ativas do usuário                  │
 *   │    ├─ Se encontrou → seleciona tenant (localStorage)    │
 *   │    │   └─ Verifica se precisa de onboarding             │
 *   │    └─ Se não encontrou:                                 │
 *   │       ├─ Se metadata de empresa → self_register_tenant  │
 *   │       └─ Se não → estado vazio (sem tenant)             │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Decisões de design:
 *   - `claimAttempted` (useRef) garante que o RPC `claim_invited_memberships`
 *     só roda uma vez por sessão, evitando chamadas duplicadas.
 *   - O tenant selecionado é persistido em `localStorage` para manter
 *     a preferência entre refreshes da página.
 *   - `needsOnboarding` é determinado via RPC `check_tenant_needs_onboarding`
 *     (verifica se o tenant tem pelo menos uma empresa cadastrada).
 *
 * @see AuthContext — fornece o `user` que dispara a resolução
 * @see ScopeContext — consome `currentTenant` e `membership` para resolver roles
 */

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { tenantStorage } from '@/lib/tenant-storage';
import type { Tables } from '@/integrations/supabase/types';

/** Tipo da tabela `tenants` gerado automaticamente pelo Supabase */
type Tenant = Tables<'tenants'>;
/** Tipo da tabela `tenant_memberships` (relação user ↔ tenant com role) */
type TenantMembership = Tables<'tenant_memberships'>;

/**
 * Contrato público do TenantContext.
 *
 * @property currentTenant   - Tenant atualmente selecionado (null durante loading)
 * @property tenants         - Lista de todos os tenants que o usuário tem acesso
 * @property membership      - Membership do usuário no tenant atual (contém role)
 * @property loading         - `true` até a resolução inicial completar
 * @property needsOnboarding - `true` se o tenant não tem empresas cadastradas
 * @property setCurrentTenant - Troca o tenant ativo (persiste em localStorage)
 * @property refreshTenants  - Re-executa todo o fluxo de resolução
 */
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

  /**
   * Flag para garantir que `claim_invited_memberships` só executa uma vez.
   * Evita race conditions quando o useEffect re-executa durante hidratação.
   */
  const claimAttempted = useRef(false);

  /**
   * refreshTenants — Fluxo principal de resolução de tenant.
   *
   * Chamado automaticamente quando `user` muda (login/logout)
   * e pode ser chamado manualmente via `refreshTenants()`.
   */
  const refreshTenants = async () => {
    // Se não há usuário autenticado, limpar todo o estado
    if (!user) {
      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
      setNeedsOnboarding(false);
      setLoading(false);
      claimAttempted.current = false;
      return;
    }

    try {
      // Step 1: Claim memberships convidadas por email (apenas na primeira execução).
      if (!claimAttempted.current && user.email) {
        claimAttempted.current = true;
        await supabase.rpc('claim_invited_memberships', {
          p_user_id: user.id,
          p_email: user.email,
        });
      }

      // Step 2: Buscar todas as memberships ativas do usuário, com dados do tenant
      const { data: memberships, error: membershipsError } = await supabase
        .from('tenant_memberships')
        .select('*, tenants(*)')
        .eq('user_id', user.id);

      if (membershipsError) {
        console.error('[TenantContext] Erro ao buscar memberships:', membershipsError.message);
        setTenants([]);
        setCurrentTenant(null);
        setMembership(null);
        setNeedsOnboarding(false);
        return;
      }

      if (memberships && memberships.length > 0) {
        const tenantList = memberships.map((m: any) => m.tenants).filter(Boolean) as Tenant[];
        setTenants(tenantList);

        const saved = tenantStorage.get();
        const found = tenantList.find(t => t.id === saved) || tenantList[0];
        setCurrentTenant(found);

        const currentMembership = memberships.find((m: any) => m.tenant_id === found.id);
        setMembership(currentMembership || null);

        const { data: needsOb } = await supabase
          .rpc('check_tenant_needs_onboarding', { p_tenant_id: found.id });
        setNeedsOnboarding(needsOb === true);
      } else {
        // Nenhuma membership — tentar self-registration
        const meta = user.user_metadata;
        if (meta?.company_name && meta?.full_name) {
          const { data: result, error: regError } = await supabase.rpc('self_register_tenant', {
            p_user_id: user.id,
            p_user_email: user.email ?? '',
            p_user_name: meta.full_name,
            p_company_name: meta.company_name,
            p_company_document: meta.company_document ?? null,
            p_company_phone: meta.company_phone ?? null,
          });

          if (regError) {
            console.error('[TenantContext] Erro no self-register:', regError.message);
          } else if (result && !(result as any).already_registered) {
            const { data: newMemberships } = await supabase
              .from('tenant_memberships')
              .select('*, tenants(*)')
              .eq('user_id', user.id);

            if (newMemberships && newMemberships.length > 0) {
              const tenantList = newMemberships.map((m: any) => m.tenants).filter(Boolean) as Tenant[];
              setTenants(tenantList);
              setCurrentTenant(tenantList[0]);
              tenantStorage.set(tenantList[0].id);
              setMembership(newMemberships[0] || null);
              setNeedsOnboarding(true);
              return;
            }
          }
        }

        // Nenhum tenant disponível
        setTenants([]);
        setCurrentTenant(null);
        setMembership(null);
        setNeedsOnboarding(false);
      }
    } catch (err) {
      console.error('[TenantContext] Erro inesperado em refreshTenants:', err);
      setTenants([]);
      setCurrentTenant(null);
      setMembership(null);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  // Disparar resolução sempre que o usuário mudar (login, logout, refresh)
  useEffect(() => {
    refreshTenants();
  }, [user]);

  /**
   * Troca o tenant ativo e persiste a escolha em localStorage.
   * Usado pelo seletor de workspace na sidebar.
   */
  const handleSetTenant = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    tenantStorage.set(tenant.id);
  };

  return (
    <TenantContext.Provider value={{ currentTenant, tenants, membership, loading, needsOnboarding, setCurrentTenant: handleSetTenant, refreshTenants }}>
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook para consumir o TenantContext.
 * Lança erro se usado fora do TenantProvider.
 */
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within TenantProvider');
  return context;
}
