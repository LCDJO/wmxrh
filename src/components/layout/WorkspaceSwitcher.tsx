/**
 * WorkspaceSwitcher — Enterprise workspace selector
 *
 * Notion / Slack / Stripe style:
 *   - Tenant avatar + name chip as trigger
 *   - Full popover with tenant list, scope selectors, active modules
 *   - Breadcrumb-style scope chips in the header bar
 *
 * Context switch rules:
 *   - NO logout / token recreation
 *   - Only updates OperationalContext via ScopeContext
 */

import { useMemo, useState } from 'react';
import {
  Building2, Layers, Globe, ChevronDown, Monitor, ShieldAlert,
  Check, Search, ChevronRight,
  Users, DollarSign, Heart, Shield, Activity, FileText, Calculator,
  FileSignature, Brain, Scale, GraduationCap, Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useScope } from '@/contexts/ScopeContext';
import { useCompanyGroups, useCompanies } from '@/domains/hooks';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { PLATFORM_MODULES } from '@/domains/platform/platform-modules';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const ALL_VALUE = '__all__';

// ════════════════════════════════════
// MODULE ICON MAPPING
// ════════════════════════════════════
const MODULE_ICON_MAP: Record<string, React.ElementType> = {
  Users, DollarSign, Heart, Shield, Activity, FileText,
  Calculator, FileSignature, Brain, Scale, GraduationCap, Key,
};

function getModuleIcon(iconName: string): React.ElementType {
  return MODULE_ICON_MAP[iconName] || Globe;
}

// ════════════════════════════════════
// TENANT AVATAR
// ════════════════════════════════════
function TenantAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  // Deterministic color from name
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  return (
    <div
      className={cn(
        'rounded-lg flex items-center justify-center font-bold text-white shrink-0 shadow-sm',
        sizeClasses[size],
      )}
      style={{ backgroundColor: `hsl(${hue}, 65%, 45%)` }}
    >
      {initials}
    </div>
  );
}

// ════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════

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

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

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
      setOpen(false);
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

  // ── Impersonation mode ──
  if (isImpersonating) {
    const imp = session.impersonation_state;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--impersonation))]/15 border border-[hsl(var(--impersonation-border))] text-xs font-semibold text-[hsl(var(--impersonation))]">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Modo Suporte Ativo</span>
        </div>
        {imp && (
          <>
            <ScopeDivider />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[hsl(var(--impersonation))]">
              <Globe className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{imp.target_tenant_name}</span>
            </div>
            <ScopeDivider />
            <span className="text-[10px] text-muted-foreground italic">
              {imp.simulated_role}
            </span>
          </>
        )}
      </div>
    );
  }

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Active modules (mock — in production would come from tenant config)
  const activeModules = PLATFORM_MODULES.slice(0, 6);

  return (
    <div className="flex items-center gap-1">
      {/* Platform chip */}
      {showPlatformChip && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/60 text-accent-foreground text-xs font-semibold mr-1">
          <Monitor className="h-3.5 w-3.5" />
          <span>Plataforma</span>
        </div>
      )}

      {/* ── Tenant Trigger (Notion style) ── */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-all',
              'hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'active:scale-[0.98]',
            )}
          >
            {currentTenant && <TenantAvatar name={currentTenant.name} size="sm" />}
            <span className="max-w-[160px] truncate text-foreground">
              {currentTenant?.name || 'Workspace'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-[340px] p-0 shadow-xl border-border/60 bg-popover z-50 rounded-xl overflow-hidden"
        >
          {/* Current tenant header */}
          <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              {currentTenant && <TenantAvatar name={currentTenant.name} size="lg" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {currentTenant?.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {groups.length} grupos · {companies.length} empresas
                </p>
              </div>
            </div>

            {/* Active modules row */}
            <div className="flex items-center gap-1 mt-3 flex-wrap">
              {activeModules.map(mod => {
                const Icon = getModuleIcon(mod.icon);
                return (
                  <div
                    key={mod.key}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/50 text-accent-foreground text-[10px] font-medium"
                    title={mod.description}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{mod.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search (only if multiple tenants) */}
          {tenants.length > 1 && (
            <div className="px-3 py-2 border-b border-border/30">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar workspace..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs border-0 bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring/30 shadow-none"
                />
              </div>
            </div>
          )}

          {/* Tenant list */}
          {tenants.length > 1 && (
            <div className="max-h-[200px] overflow-y-auto">
              <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  Workspaces
                </p>
              </div>
              {filteredTenants.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTenantChange(t.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    'hover:bg-accent/40',
                    t.id === currentTenant?.id && 'bg-accent/30',
                  )}
                >
                  <TenantAvatar name={t.name} size="sm" />
                  <span className="flex-1 text-xs font-medium text-foreground truncate">
                    {t.name}
                  </span>
                  {t.id === currentTenant?.id && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Scope selectors inside popover */}
          <div className="border-t border-border/40">
            {groups.length > 0 && (
              <ScopeSection
                icon={Layers}
                label="Grupo"
                currentValue={scope.groupName || 'Todos os grupos'}
                items={[
                  { value: ALL_VALUE, label: 'Todos os grupos' },
                  ...groups.map(g => ({ value: g.id, label: g.name })),
                ]}
                selectedValue={scope.groupId || ALL_VALUE}
                onSelect={handleGroupChange}
              />
            )}
            {filteredCompanies.length > 0 && (
              <ScopeSection
                icon={Building2}
                label="Empresa"
                currentValue={scope.companyName || 'Todas as empresas'}
                items={[
                  { value: ALL_VALUE, label: 'Todas as empresas' },
                  ...filteredCompanies.map(c => ({ value: c.id, label: c.name })),
                ]}
                selectedValue={scope.companyId || ALL_VALUE}
                onSelect={handleCompanyChange}
              />
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* ── Scope breadcrumb chips ── */}
      {scope.groupId && (
        <>
          <ScopeDivider />
          <ScopeChip
            icon={Layers}
            label={scope.groupName || 'Grupo'}
            onClear={() => resetToTenant()}
          />
        </>
      )}
      {scope.companyId && (
        <>
          <ScopeDivider />
          <ScopeChip
            icon={Building2}
            label={scope.companyName || 'Empresa'}
            onClear={() => scope.groupId ? resetToGroup() : resetToTenant()}
          />
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════
// INTERNAL COMPONENTS
// ════════════════════════════════════

function ScopeDivider() {
  return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
}

/** Breadcrumb-style chip shown in header bar */
function ScopeChip({
  icon: Icon,
  label,
  onClear,
}: {
  icon: React.ElementType;
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      onClick={onClear}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
        'bg-accent/40 text-accent-foreground hover:bg-accent/60',
      )}
      title={`Clique para remover filtro: ${label}`}
    >
      <Icon className="h-3 w-3" />
      <span className="max-w-[120px] truncate">{label}</span>
    </button>
  );
}

/** Expandable scope row inside the popover */
function ScopeSection({
  icon: Icon,
  label,
  currentValue,
  items,
  selectedValue,
  onSelect,
}: {
  icon: React.ElementType;
  label: string;
  currentValue: string;
  items: Array<{ value: string; label: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/20 last:border-b-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
      >
        <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xs font-medium text-foreground truncate">{currentValue}</p>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="max-h-[160px] overflow-y-auto pb-1">
          {items.map(item => (
            <button
              key={item.value}
              onClick={() => {
                onSelect(item.value);
                setExpanded(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-8 py-1.5 text-xs text-left transition-colors',
                'hover:bg-accent/30',
                item.value === selectedValue && 'text-primary font-medium bg-accent/20',
              )}
            >
              <span className="flex-1 truncate">{item.label}</span>
              {item.value === selectedValue && (
                <Check className="h-3 w-3 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
