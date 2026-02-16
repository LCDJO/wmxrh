/**
 * App Sidebar — Dynamic, AccessGraph-aware
 * 
 * Navigation is filtered by SecurityKernel:
 *   - FeatureFlags: hides modules not enabled for tenant
 *   - Permissions: hides nav items user can't access
 * 
 * Context switching (Tenant/Group/Company) is handled by ContextSelector.
 * Switching context does NOT logout or regenerate tokens.
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Building2,
  ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { ContextSelector } from './ContextSelector';
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
  { to: '/groups', icon: Building2, label: 'Grupos', key: 'groups' },
  { to: '/positions', icon: Briefcase, label: 'Cargos', key: 'positions' },
  { to: '/compensation', icon: TrendingUp, label: 'Remuneração', key: 'compensation' },
  { to: '/departments', icon: Building2, label: 'Departamentos', key: 'departments' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();
  const { canNav, isFeatureEnabled, effectiveRoles, loading } = useSecurityKernel();

  // Filter nav items: FeatureFlags first, then Permissions
  const navItems = loading
    ? allNavItems
    : allNavItems.filter(item => {
        if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
        return canNav(item.key);
      });

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
          </div>
        )}
      </div>

      {/* ── Context Selector (Tenant ▼ / Group ▼ / Company ▼) ── */}
      <ContextSelector collapsed={collapsed} />

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

      {/* ── Navigation ── */}
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
