/**
 * ScopeContext — Resolução de escopo operacional e roles efetivas.
 *
 * Responsabilidades:
 *   1. Manter o escopo operacional atual (tenant → grupo → empresa)
 *   2. Resolver as roles efetivas do usuário (membership role + user_roles)
 *   3. Expor `hasRole()` e `canAccessNav()` para controle de acesso na UI
 *
 * Hierarquia de escopo:
 *   ┌──────────┐
 *   │  Tenant  │  ← Nível mais amplo (vê tudo do tenant)
 *   ├──────────┤
 *   │  Group   │  ← Filtrado por grupo econômico
 *   ├──────────┤
 *   │ Company  │  ← Filtrado por empresa específica
 *   └──────────┘
 *
 * Resolução de roles efetivas:
 *   effectiveRoles = Set(membershipRole) ∪ Set(userRoles[].role)
 *
 *   - `membershipRole`: vem da tabela `tenant_memberships` (ex: "owner", "admin")
 *   - `userRoles`: vem da tabela `user_roles` (pode ter múltiplas roles adicionais)
 *   - A união garante que todas as permissões se acumulam
 *
 * Decisões de design:
 *   - O escopo é local ao cliente (não persistido no banco) para permitir
 *     navegação rápida entre níveis sem round-trips ao servidor.
 *   - `canAccessNav` delega para a função centralizada `canAccessNavItem`
 *     do módulo de permissões, garantindo consistência com o Permission Matrix.
 *
 * @see AuthContext — fornece `user` para buscar roles
 * @see TenantContext — fornece `currentTenant` e `membership`
 * @see permissions.ts — contém a Permission Matrix e `canAccessNavItem`
 */

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { canAccessNavItem, type NavKey } from '@/domains/security/permissions';
import type { TenantRole, UserRole } from '@/domains/shared/types';

/** Nível de escopo atual: tenant (raiz), grupo ou empresa */
type ScopeLevel = 'tenant' | 'group' | 'company';

/**
 * Estado do escopo operacional.
 * Determina o contexto de filtragem para queries e visualizações.
 */
interface ScopeState {
  level: ScopeLevel;
  groupId: string | null;
  groupName: string | null;
  companyId: string | null;
  companyName: string | null;
}

/**
 * Contrato público do ScopeContext.
 *
 * @property scope          - Estado atual do escopo (level, IDs selecionados)
 * @property setGroupScope  - Restringe visualização a um grupo econômico
 * @property setCompanyScope - Restringe visualização a uma empresa
 * @property resetToTenant  - Volta ao escopo mais amplo (tenant)
 * @property resetToGroup   - Volta ao escopo de grupo (limpa empresa)
 * @property userRoles      - Roles adicionais da tabela `user_roles`
 * @property membershipRole - Role da membership (tabela `tenant_memberships`)
 * @property effectiveRoles - União de todas as roles ativas
 * @property hasRole        - Verifica se o usuário possui alguma das roles informadas
 * @property canAccessNav   - Verifica se o usuário pode ver um item de navegação
 * @property rolesLoading   - `true` enquanto as roles estão sendo carregadas
 */
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

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentTenant, membership } = useTenant();

  // Estado do escopo operacional — inicia no nível mais amplo (tenant)
  const [scope, setScope] = useState<ScopeState>({
    level: 'tenant',
    groupId: null,
    groupName: null,
    companyId: null,
    companyName: null,
  });

  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Buscar roles adicionais da tabela `user_roles` sempre que user ou tenant mudar
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

  // Role da membership (ex: "owner", "admin", "viewer")
  const membershipRole = (membership?.role as TenantRole) || null;

  /**
   * Roles efetivas = membership role + todas as user_roles adicionais.
   * Usa Set para deduplicar, depois converte para array.
   * Memoizado para evitar recriação a cada render.
   */
  const effectiveRoles = useMemo(() => {
    const roles = new Set<TenantRole>();
    if (membershipRole) roles.add(membershipRole);
    userRoles.forEach(r => roles.add(r.role));
    return Array.from(roles);
  }, [membershipRole, userRoles]);

  /**
   * Verifica se o usuário possui pelo menos uma das roles informadas.
   * Usado em guards de UI (ex: mostrar/esconder botões de admin).
   */
  const hasRole = (...roles: TenantRole[]) => {
    return effectiveRoles.some(r => roles.includes(r));
  };

  /**
   * Verifica se o usuário pode ver um item de navegação.
   * Delega para a Permission Matrix centralizada em `permissions.ts`.
   * Nav access = 'view' permission na entidade mapeada.
   */
  const canAccessNav = (navKey: string) => {
    return canAccessNavItem(navKey as NavKey, effectiveRoles);
  };

  // ── Métodos de navegação de escopo ──

  /** Filtra para um grupo econômico específico (limpa empresa) */
  const setGroupScope = (groupId: string, groupName: string) => {
    setScope({ level: 'group', groupId, groupName, companyId: null, companyName: null });
  };

  /** Filtra para uma empresa específica dentro do grupo atual */
  const setCompanyScope = (companyId: string, companyName: string) => {
    setScope(prev => ({ ...prev, level: 'company', companyId, companyName }));
  };

  /** Volta ao escopo de tenant (visão mais ampla) */
  const resetToTenant = () => {
    setScope({ level: 'tenant', groupId: null, groupName: null, companyId: null, companyName: null });
  };

  /** Volta ao escopo de grupo (mantém grupo, limpa empresa) */
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

/**
 * Hook para consumir o ScopeContext.
 * Lança erro se usado fora do ScopeProvider.
 */
export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used within ScopeProvider');
  return ctx;
}
