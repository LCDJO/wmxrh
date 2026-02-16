/**
 * App Sidebar — Dynamic, AccessGraph-aware
 * 
 * Navigation is filtered by SecurityKernel:
 *   - FeatureFlags: hides modules not enabled for tenant
 *   - Permissions: hides nav items user can't access
 *   - AccessGraph: shows only reachable Groups → Companies
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Building2,
  ChevronLeft, ChevronRight, Layers, LogOut, ChevronDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useCompanyGroups, useCompanies } from '@/domains/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { NavKey } from '@/domains/security/permissions';
import type { FeatureKey } from '@/domains/security/feature-flags';

// ════════════════════════════════════
// NAV ITEMS (top-level modules)
// ════════════════════════════════════

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  key: NavKey;
  featureFlag?: FeatureKey;
}

const allNavItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
  { to: '/employees', icon: Users, label: 'Funcionários', key: 'employees' },
  { to: '/companies', icon: Building2, label: 'Empresas', key: 'companies' },
  { to: '/groups', icon: Layers, label: 'Grupos', key: 'groups' },
  { to: '/positions', icon: Briefcase, label: 'Cargos', key: 'positions' },
  { to: '/compensation', icon: TrendingUp, label: 'Remuneração', key: 'compensation' },
  { to: '/departments', icon: Building2, label: 'Departamentos', key: 'departments' },
];

// ════════════════════════════════════
// SIDEBAR HIERARCHY TREE
// ════════════════════════════════════

interface ScopeTreeNode {
  id: string;
  name: string;
  type: 'group' | 'company';
  children?: ScopeTreeNode[];
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentTenant, tenants, setCurrentTenant } = useTenant();
  const { signOut } = useAuth();
  const { canNav, isFeatureEnabled, effectiveRoles, loading, accessGraph } = useSecurityKernel();

  // Fetch groups and companies for name resolution
  const { data: groups = [] } = useCompanyGroups();
  const { data: companies = [] } = useCompanies();

  // ── Build the filtered scope tree from AccessGraph ──
  const scopeTree = useMemo((): { nodes: ScopeTreeNode[]; hasTenantScope: boolean } => {
    if (!accessGraph) return { nodes: [], hasTenantScope: false };

    const hasTenantScope = accessGraph.hasTenantScope();
    const reachableGroups = accessGraph.getReachableGroups();
    const reachableCompanies = accessGraph.getReachableCompanies();

    // Build group → companies hierarchy
    const groupNodes: ScopeTreeNode[] = [];
    const companiesInGroups = new Set<string>();

    // Process groups
    for (const groupId of reachableGroups) {
      const group = groups.find(g => g.id === groupId);
      if (!group || group.deleted_at) continue;

      // Find companies in this group that the user can access
      const childCompanies: ScopeTreeNode[] = companies
        .filter(c =>
          c.company_group_id === groupId &&
          !c.deleted_at &&
          (hasTenantScope || reachableCompanies.has(c.id))
        )
        .map(c => {
          companiesInGroups.add(c.id);
          return { id: c.id, name: c.name, type: 'company' as const };
        });

      groupNodes.push({
        id: group.id,
        name: group.name,
        type: 'group',
        children: childCompanies,
      });
    }

    // Add ungrouped companies the user can access
    const ungroupedCompanies: ScopeTreeNode[] = companies
      .filter(c =>
        !c.deleted_at &&
        !companiesInGroups.has(c.id) &&
        (hasTenantScope || reachableCompanies.has(c.id))
      )
      .map(c => ({ id: c.id, name: c.name, type: 'company' as const }));

    return {
      nodes: [...groupNodes, ...ungroupedCompanies],
      hasTenantScope,
    };
  }, [accessGraph, groups, companies]);

  // Filter nav items: FeatureFlags first, then Permissions
  const navItems = loading
    ? allNavItems
    : allNavItems.filter(item => {
        if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
        return canNav(item.key);
      });

  const showTree = !collapsed && scopeTree.nodes.length > 0;

  return (
    <aside className={cn(
      "gradient-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0",
      collapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-primary">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h1 className="font-display text-base font-bold text-sidebar-primary-foreground">RH Gestão</h1>
            {tenants.length > 1 ? (
              <Select value={currentTenant?.id} onValueChange={id => { const t = tenants.find(t => t.id === id); if (t) setCurrentTenant(t); }}>
                <SelectTrigger className="h-6 px-0 border-0 bg-transparent text-xs text-sidebar-foreground/60 shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-sidebar-foreground/60 truncate">{currentTenant?.name || 'Organização'}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Role badges ── */}
      {!collapsed && effectiveRoles.length > 0 && (
        <div className="px-5 py-2 border-b border-sidebar-border">
          <div className="flex flex-wrap gap-1">
            {effectiveRoles.slice(0, 2).map(role => (
              <span key={role} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground uppercase">
                {role.replace('_', ' ')}
              </span>
            ))}
            {effectiveRoles.length > 2 && (
              <span className="text-[10px] text-sidebar-foreground/50">+{effectiveRoles.length - 2}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Nav + Scope Tree ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-sidebar-primary")} />
              {!collapsed && <span className="animate-fade-in">{item.label}</span>}
            </NavLink>
          );
        })}

        {/* ── Scope Tree (Groups → Companies) ── */}
        {showTree && (
          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {scopeTree.hasTenantScope ? 'Estrutura' : 'Meu acesso'}
            </p>
            <div className="space-y-0.5">
              {scopeTree.nodes.map(node => (
                node.type === 'group'
                  ? <ScopeGroupNode key={node.id} node={node} />
                  : <ScopeCompanyLeaf key={node.id} node={node} />
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="px-3 pb-3 space-y-1">
        <button
          onClick={signOut}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
            "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all w-full"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-4 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}

// ════════════════════════════════════
// TREE COMPONENTS
// ════════════════════════════════════

function ScopeGroupNode({ node }: { node: ScopeTreeNode }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
          "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
        )}>
          <Layers className="h-3.5 w-3.5 shrink-0 text-sidebar-primary/70" />
          <span className="truncate flex-1 text-left">{node.name}</span>
          {hasChildren && (
            <ChevronDown className={cn(
              "h-3 w-3 shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )} />
          )}
        </button>
      </CollapsibleTrigger>
      {hasChildren && (
        <CollapsibleContent>
          <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-0.5 mt-0.5">
            {node.children!.map(child => (
              <ScopeCompanyLeaf key={child.id} node={child} />
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ScopeCompanyLeaf({ node }: { node: ScopeTreeNode }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors",
      "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
    )}>
      <Building2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40" />
      <span className="truncate">{node.name}</span>
    </div>
  );
}
