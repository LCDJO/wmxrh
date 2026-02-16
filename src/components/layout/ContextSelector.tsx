/**
 * ContextSelector — Global scope switcher
 * 
 * Allows switching Tenant → Group → Company WITHOUT:
 *   - Logout
 *   - Token regeneration
 *   - Page reload
 * 
 * Only OperationalContext is updated via ScopeContext.
 */

import { useMemo } from 'react';
import { Building2, Layers, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useCompanyGroups, useCompanies } from '@/domains/hooks';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ContextSelectorProps {
  collapsed?: boolean;
}

const ALL_VALUE = '__all__';

export function ContextSelector({ collapsed = false }: ContextSelectorProps) {
  const { currentTenant, tenants, setCurrentTenant } = useTenant();
  const { scope, setGroupScope, setCompanyScope, resetToTenant, resetToGroup } = useScope();
  const { accessGraph } = useSecurityKernel();
  const { data: allGroups = [] } = useCompanyGroups();
  const { data: allCompanies = [] } = useCompanies();

  // Filter groups/companies by AccessGraph reachability
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

  // Companies filtered by selected group
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
    if (value === ALL_VALUE) {
      resetToTenant();
      return;
    }
    const group = groups.find(g => g.id === value);
    if (group) {
      setGroupScope(group.id, group.name);
    }
  };

  const handleCompanyChange = (value: string) => {
    if (value === ALL_VALUE) {
      if (scope.groupId) {
        resetToGroup();
      } else {
        resetToTenant();
      }
      return;
    }
    const company = filteredCompanies.find(c => c.id === value);
    if (company) {
      setCompanyScope(company.id, company.name);
    }
  };

  if (collapsed) {
    return (
      <div className="px-3 py-3 border-b border-sidebar-border space-y-2">
        <div className="flex justify-center" title={currentTenant?.name || 'Tenant'}>
          <Globe className="h-4 w-4 text-sidebar-primary" />
        </div>
        {groups.length > 0 && (
          <div className="flex justify-center" title={scope.groupName || 'Todos os grupos'}>
            <Layers className="h-4 w-4 text-sidebar-foreground/50" />
          </div>
        )}
        <div className="flex justify-center" title={scope.companyName || 'Todas as empresas'}>
          <Building2 className="h-4 w-4 text-sidebar-foreground/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 border-b border-sidebar-border space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-1.5">
        Contexto ativo
      </p>

      {/* Tenant Selector */}
      {tenants.length > 1 ? (
        <ScopeSelect
          icon={Globe}
          label="Tenant"
          value={currentTenant?.id || ''}
          onValueChange={handleTenantChange}
          items={tenants.map(t => ({ value: t.id, label: t.name }))}
        />
      ) : (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/30">
          <Globe className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
          <span className="text-xs text-sidebar-foreground truncate">
            {currentTenant?.name || 'Organização'}
          </span>
        </div>
      )}

      {/* Group Selector */}
      {groups.length > 0 && (
        <ScopeSelect
          icon={Layers}
          label="Grupo"
          value={scope.groupId || ALL_VALUE}
          onValueChange={handleGroupChange}
          items={[
            { value: ALL_VALUE, label: 'Todos os grupos' },
            ...groups.map(g => ({ value: g.id, label: g.name })),
          ]}
        />
      )}

      {/* Company Selector */}
      {filteredCompanies.length > 0 && (
        <ScopeSelect
          icon={Building2}
          label="Empresa"
          value={scope.companyId || ALL_VALUE}
          onValueChange={handleCompanyChange}
          items={[
            { value: ALL_VALUE, label: 'Todas as empresas' },
            ...filteredCompanies.map(c => ({ value: c.id, label: c.name })),
          ]}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════
// INTERNAL SELECT COMPONENT
// ════════════════════════════════════

interface ScopeSelectProps {
  icon: typeof Globe;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
}

function ScopeSelect({ icon: Icon, label, value, onValueChange, items }: ScopeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-8 gap-2 border-0 bg-sidebar-accent/30 text-xs text-sidebar-foreground",
          "hover:bg-sidebar-accent/50 focus:ring-1 focus:ring-sidebar-ring/30",
          "shadow-none transition-colors"
        )}
      >
        <Icon className="h-3.5 w-3.5 text-sidebar-primary/70 shrink-0" />
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {items.map(item => (
          <SelectItem key={item.value} value={item.value} className="text-xs">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
