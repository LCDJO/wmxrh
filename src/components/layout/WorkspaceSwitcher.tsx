/**
 * WorkspaceSwitcher — Horizontal header-level context switcher
 *
 * Renders: [ Tenant ▼ ] [ Grupo ▼ ] [ Empresa ▼ ]
 *
 * Context switch rules:
 *   - NO logout
 *   - NO token recreation
 *   - Only updates OperationalContext via ScopeContext
 */

import { useMemo } from 'react';
import { Building2, Layers, Globe, ChevronDown, Monitor, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useCompanyGroups, useCompanies } from '@/domains/hooks';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ALL_VALUE = '__all__';

interface WorkspaceSwitcherProps {
  showPlatformChip?: boolean;
}

export function WorkspaceSwitcher({ showPlatformChip = false }: WorkspaceSwitcherProps) {
  const { isImpersonating, session } = useIdentityIntelligence();
  const { currentTenant, tenants, setCurrentTenant } = useTenant();
  const { scope, setGroupScope, setCompanyScope, resetToTenant, resetToGroup } = useScope();
  const { accessGraph } = useSecurityKernel();
  const { data: allGroups = [] } = useCompanyGroups();
  const { data: allCompanies = [] } = useCompanies();

  const { groups, companies } = useMemo(() => {
    if (!accessGraph) return { groups: allGroups, companies: allCompanies };
    const hasTenant = accessGraph.hasTenantScope();
    const reachableGroups = accessGraph.getReachableGroups();
    const reachableCompanies = accessGraph.getReachableCompanies();
    return {
      groups: allGroups.filter(g => !g.deleted_at && (hasTenant || reachableGroups.has(g.id))),
      companies: allCompanies.filter(c => !c.deleted_at && (hasTenant || reachableCompanies.has(c.id))),
    };
  }, [accessGraph, allGroups, allCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!scope.groupId) return companies;
    return companies.filter(c => c.company_group_id === scope.groupId);
  }, [companies, scope.groupId]);

  const handleTenantChange = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      setCurrentTenant(tenant);
      resetToTenant();
    }
  };

  const handleGroupChange = (value: string) => {
    if (value === ALL_VALUE) { resetToTenant(); return; }
    const group = groups.find(g => g.id === value);
    if (group) setGroupScope(group.id, group.name);
  };

  const handleCompanyChange = (value: string) => {
    if (value === ALL_VALUE) {
      scope.groupId ? resetToGroup() : resetToTenant();
      return;
    }
    const company = filteredCompanies.find(c => c.id === value);
    if (company) setCompanyScope(company.id, company.name);
  };

  // ── Impersonation mode: show support badge, lock selectors ──
  if (isImpersonating) {
    const imp = session.impersonation_state;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(var(--impersonation))]/15 border border-[hsl(var(--impersonation-border))] text-xs font-semibold text-[hsl(var(--impersonation))]">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Modo Suporte Ativo</span>
        </div>
        {imp && (
          <>
            <Divider />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[hsl(var(--impersonation))]">
              <Globe className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{imp.target_tenant_name}</span>
            </div>
            <Divider />
            <span className="text-[10px] text-muted-foreground italic">
              {imp.simulated_role}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Platform chip (optional, shown for platform users) */}
      {showPlatformChip && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/60 text-accent-foreground text-xs font-semibold mr-1">
          <Monitor className="h-3.5 w-3.5" />
          <span>Plataforma</span>
        </div>
      )}

      {/* ── Tenant Selector ── */}
      <SwitcherDropdown
        icon={Globe}
        label={currentTenant?.name || 'Tenant'}
        active
        items={tenants.map(t => ({ value: t.id, label: t.name }))}
        selectedValue={currentTenant?.id || ''}
        onSelect={handleTenantChange}
        sectionLabel="Tenants"
        disabled={tenants.length <= 1}
      />

      {groups.length > 0 && <Divider />}

      {groups.length > 0 && (
        <SwitcherDropdown
          icon={Layers}
          label={scope.groupName || 'Todos os grupos'}
          active={!!scope.groupId}
          items={[
            { value: ALL_VALUE, label: 'Todos os grupos' },
            ...groups.map(g => ({ value: g.id, label: g.name })),
          ]}
          selectedValue={scope.groupId || ALL_VALUE}
          onSelect={handleGroupChange}
          sectionLabel="Grupos"
        />
      )}

      {filteredCompanies.length > 0 && <Divider />}

      {filteredCompanies.length > 0 && (
        <SwitcherDropdown
          icon={Building2}
          label={scope.companyName || 'Todas as empresas'}
          active={!!scope.companyId}
          items={[
            { value: ALL_VALUE, label: 'Todas as empresas' },
            ...filteredCompanies.map(c => ({ value: c.id, label: c.name })),
          ]}
          selectedValue={scope.companyId || ALL_VALUE}
          onSelect={handleCompanyChange}
          sectionLabel="Empresas"
        />
      )}
    </div>
  );
}

// ════════════════════════════════════
// INTERNAL COMPONENTS
// ════════════════════════════════════

function Divider() {
  return <span className="text-muted-foreground/30 mx-0.5 select-none">/</span>;
}

interface SwitcherDropdownProps {
  icon: typeof Globe;
  label: string;
  active: boolean;
  items: Array<{ value: string; label: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
  sectionLabel: string;
  disabled?: boolean;
}

function SwitcherDropdown({
  icon: Icon,
  label,
  active,
  items,
  selectedValue,
  onSelect,
  sectionLabel,
  disabled,
}: SwitcherDropdownProps) {
  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-foreground/80">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
        <span className="max-w-[140px] truncate">{label}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            "hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            active
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
          <span className="max-w-[140px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px] bg-popover z-50">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {sectionLabel}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map(item => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => onSelect(item.value)}
            className={cn(
              "text-xs cursor-pointer",
              item.value === selectedValue && "bg-accent text-accent-foreground font-medium"
            )}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
