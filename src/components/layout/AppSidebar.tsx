/**
 * App Sidebar — Grouped navigation with collapsible parent menus
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Building2,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, FileText, Heart,
  ShieldCheck, ClipboardCheck, ScrollText, Scale, Gavel, Landmark,
  Calculator, Brain, Sparkles, Send, Settings, Plug, UserCog, FileSignature,
  GraduationCap,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { ContextSelector } from './ContextSelector';
import type { NavKey } from '@/domains/security/permissions';
import type { FeatureKey } from '@/domains/security/feature-flags';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

interface NavChild {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  key: NavKey;
  featureFlag?: FeatureKey;
}

interface NavGroup {
  id: string;
  icon: typeof LayoutDashboard;
  label: string;
  children: NavChild[];
}

type NavEntry = NavChild | NavGroup;

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

// ════════════════════════════════════
// NAV STRUCTURE
// ════════════════════════════════════

const navStructure: NavEntry[] = [
  // ── Standalone ──
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },

  // ── Empresa ──
  {
    id: 'empresa',
    icon: Building2,
    label: 'Empresa',
    children: [
      { to: '/companies', icon: Building2, label: 'Empresas', key: 'companies' },
      { to: '/groups', icon: Building2, label: 'Grupos', key: 'groups' },
      { to: '/departments', icon: Briefcase, label: 'Departamentos', key: 'departments' },
      { to: '/positions', icon: Briefcase, label: 'Cargos', key: 'positions' },
    ],
  },

  // ── Funcionário ──
  {
    id: 'funcionario',
    icon: Users,
    label: 'Funcionários',
    children: [
      { to: '/employees', icon: Users, label: 'Cadastro', key: 'employees' },
      { to: '/agreements', icon: ScrollText, label: 'Termos e Acordos', key: 'employees' },
      { to: '/compensation', icon: TrendingUp, label: 'Remuneração', key: 'compensation' },
      { to: '/benefits', icon: ShieldCheck, label: 'Benefícios', key: 'benefits' },
      { to: '/health', icon: Heart, label: 'Saúde Ocupacional', key: 'health' },
      { to: '/occupational-compliance', icon: GraduationCap, label: 'Compliance Ocupacional', key: 'health' },
      { to: '/compliance', icon: FileText, label: 'Rubricas', key: 'compliance' },
      { to: '/payroll-simulation', icon: Calculator, label: 'Simulação Folha', key: 'compensation' },
    ],
  },

  // ── Trabalhista & Legal ──
  {
    id: 'trabalhista',
    icon: Scale,
    label: 'Trabalhista',
    children: [
      { to: '/labor-dashboard', icon: ClipboardCheck, label: 'Painel Trabalhista', key: 'labor_dashboard' },
      { to: '/labor-compliance', icon: Scale, label: 'Conformidade', key: 'labor_compliance' },
      { to: '/labor-rules', icon: Gavel, label: 'Regras Trabalhistas', key: 'labor_rules' },
      { to: '/legal-dashboard', icon: Landmark, label: 'Dashboard Legal', key: 'legal_dashboard' },
      { to: '/audit', icon: ScrollText, label: 'Auditoria', key: 'audit' },
    ],
  },

  // ── Inteligência ──
  {
    id: 'inteligencia',
    icon: Brain,
    label: 'Inteligência',
    children: [
      { to: '/workforce-intelligence', icon: Brain, label: 'Inteligência RH', key: 'dashboard' },
      { to: '/strategic-intelligence', icon: Sparkles, label: 'IA Estratégica', key: 'dashboard' },
    ],
  },

  // ── Integrações ──
  {
    id: 'integracoes',
    icon: Plug,
    label: 'Integrações',
    children: [
      { to: '/esocial', icon: Send, label: 'eSocial', key: 'esocial' },
      { to: '/document-signature', icon: FileSignature, label: 'Assinatura de Documentos', key: 'esocial' },
    ],
  },
];

// ════════════════════════════════════
// SIDEBAR COMPONENT
// ════════════════════════════════════

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { signOut } = useAuth();
  const { canNav, isFeatureEnabled, effectiveRoles, loading } = useSecurityKernel();

  const isVisible = (item: NavChild) => {
    if (loading) return true;
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
    return canNav(item.key);
  };

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  const isGroupActive = (group: NavGroup) =>
    group.children.some(c => isActive(c.to));

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isGroupOpen = (group: NavGroup) =>
    openGroups[group.id] ?? isGroupActive(group);

  const renderChild = (item: NavChild) => {
    if (!isVisible(item)) return null;
    const active = isActive(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          collapsed ? "justify-center" : "pl-10",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  };

  const renderEntry = (entry: NavEntry, idx: number) => {
    // Standalone item
    if (!isGroup(entry)) {
      if (!isVisible(entry)) return null;
      const active = isActive(entry.to);
      return (
        <NavLink
          key={entry.to}
          to={entry.to}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
            active
              ? "bg-sidebar-accent text-sidebar-primary"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <entry.icon className={cn("h-5 w-5 shrink-0", active && "text-sidebar-primary")} />
          {!collapsed && <span>{entry.label}</span>}
        </NavLink>
      );
    }

    // Group — hide if no visible children
    const visibleChildren = entry.children.filter(isVisible);
    if (visibleChildren.length === 0) return null;

    const groupActive = isGroupActive(entry);
    const open = isGroupOpen(entry);

    return (
      <div key={entry.id}>
        <button
          onClick={() => collapsed ? undefined : toggleGroup(entry.id)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 w-full",
            groupActive
              ? "text-sidebar-primary"
              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <entry.icon className={cn("h-5 w-5 shrink-0", groupActive && "text-sidebar-primary")} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{entry.label}</span>
              <ChevronDown className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                open ? "rotate-0" : "-rotate-90"
              )} />
            </>
          )}
        </button>

        {/* Children */}
        {(collapsed || open) && (
          <div className={cn("space-y-0.5", !collapsed && "mt-0.5")}>
            {visibleChildren.map(renderChild)}
          </div>
        )}
      </div>
    );
  };

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

      {/* ── Context Selector ── */}
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
        {navStructure.map((entry, idx) => renderEntry(entry, idx))}
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
