/**
 * App Sidebar — Grouped navigation with collapsible parent menus
 *
 * Reacts to UnifiedIdentitySession.active_context:
 *   - Shows active tenant/scope info in header
 *   - Filters navigation by active_context.effective_roles
 *   - Visual indicator for scope level (tenant/group/company)
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Building2,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, FileText, Heart,
  ShieldCheck, ClipboardCheck, ScrollText, Scale, Gavel, Landmark,
  Calculator, Brain, Sparkles, Send, Settings, Plug, UserCog, FileSignature,
  GraduationCap, ShieldAlert, Globe, Layers, Pin, PinOff, Lock, Megaphone,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { useNavigationPins } from '@/hooks/use-navigation-pins';
import { useExperienceProfile } from '@/hooks/use-experience-profile';
import { NavigationSuggestionsPanel } from './NavigationSuggestionsPanel';
import { Progress } from '@/components/ui/progress';
import { ContextSelector } from './ContextSelector';
import { PlanBadge } from '@/components/shared/PlanBadge';
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
      { to: '/nr-compliance', icon: ShieldAlert, label: 'NR Compliance', key: 'health' },
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

  // ── Configurações ──
  {
    id: 'configuracoes',
    icon: Settings,
    label: 'Configurações',
    children: [
      { to: '/settings/users', icon: Users, label: 'Usuários', key: 'iam_users' },
      { to: '/settings/roles', icon: ShieldCheck, label: 'Cargos & Permissões', key: 'iam_roles' },
      { to: '/announcements', icon: Megaphone, label: 'Avisos do Sistema', key: 'dashboard' },
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
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { canNav, isFeatureEnabled, effectiveRoles, loading } = useSecurityKernel();
  const { activeContext, isImpersonating, session } = useIdentityIntelligence();
  const { pins, removePin, isPinned } = useNavigationPins();
  const { announcements } = useAnnouncements();
  const hasCriticalAnnouncement = announcements.some(a => a.severity === 'critical');
  const { isPathVisible, isPathLocked, profile: expProfile } = useExperienceProfile();

  // ── Onboarding progress (mock-safe: reads from PXE profile or defaults) ──
  const onboardingComplete = (expProfile as any)?.onboarding_complete ?? true;
  const onboardingPct = (expProfile as any)?.onboarding_pct ?? 100;

  const isVisible = (item: NavChild) => {
    if (loading) return true;
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
    if (!canNav(item.key)) return false;
    // PXE: hide if plan hides this path
    if (!isPathVisible(item.to)) return false;
    return true;
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
    const lockInfo = isPathLocked(item.to);
    const isCriticalHighlight = item.to === '/announcements' && hasCriticalAnnouncement;

    // Locked: show but greyed out with lock icon
    if (lockInfo.locked) {
      return (
        <div
          key={item.to}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-not-allowed group relative",
            collapsed ? "justify-center" : "pl-10",
            "text-sidebar-foreground/30"
          )}
          title={lockInfo.message || `Disponível no plano ${lockInfo.requiredPlan}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              <Lock className="h-3 w-3 ml-auto shrink-0 text-sidebar-foreground/20" />
            </>
          )}
          {/* Upgrade tooltip on hover */}
          {!collapsed && (
            <div className="absolute left-full ml-2 top-0 z-50 hidden group-hover:block">
              <div className="bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border p-3 w-48">
                <p className="font-semibold mb-1">🔒 Recurso bloqueado</p>
                <p className="text-muted-foreground">{lockInfo.message || `Faça upgrade para o plano ${lockInfo.requiredPlan}.`}</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          collapsed ? "justify-center" : "pl-10",
          active
            ? "bg-sidebar-accent text-sidebar-primary"
            : isCriticalHighlight
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <item.icon className={cn(
          "h-4 w-4 shrink-0",
          active && "text-sidebar-primary",
          isCriticalHighlight && !active && "text-destructive animate-pulse",
        )} />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {isCriticalHighlight && (
              <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
            )}
          </>
        )}
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
    const groupHasCritical = entry.id === 'configuracoes' && hasCriticalAnnouncement;

    return (
      <div key={entry.id}>
        <button
          onClick={() => collapsed ? undefined : toggleGroup(entry.id)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 w-full",
            groupHasCritical
              ? "text-destructive bg-destructive/5 hover:bg-destructive/10"
              : groupActive
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
        >
          <entry.icon className={cn(
            "h-5 w-5 shrink-0",
            groupHasCritical ? "text-destructive" : groupActive && "text-sidebar-primary",
          )} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left truncate">{entry.label}</span>
              {groupHasCritical && !open && (
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0 mr-1" />
              )}
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
      {/* ── Header with active_context indicator ── */}
      <div className={cn(
        "flex items-center gap-3 px-5 py-6 border-b",
        isImpersonating
          ? "border-[hsl(var(--impersonation-border))] bg-[hsl(var(--impersonation-muted))]/20"
          : "border-sidebar-border"
      )}>
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isImpersonating ? "bg-[hsl(var(--impersonation))]" : "gradient-primary"
        )}>
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden min-w-0">
            <h1 className="font-display text-base font-bold text-sidebar-primary-foreground">RH Gestão</h1>
            {/* Active context summary from IIL */}
            {activeContext && (
              <p className="text-[10px] text-sidebar-foreground/50 truncate flex items-center gap-1 mt-0.5">
                {activeContext.scope_level === 'company' && <Building2 className="h-2.5 w-2.5 shrink-0" />}
                {activeContext.scope_level === 'company_group' && <Layers className="h-2.5 w-2.5 shrink-0" />}
                {activeContext.scope_level === 'tenant' && <Globe className="h-2.5 w-2.5 shrink-0" />}
                <span className="truncate">{activeContext.tenant_name}</span>
              </p>
            )}
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

      {/* ── Pinned Shortcuts ── */}
      {pins.length > 0 && (
        <div className={cn("px-3 pt-3 pb-1 border-b border-sidebar-border", collapsed && "px-2")}>
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-1 mb-1.5 flex items-center gap-1">
              <Pin className="h-2.5 w-2.5" />
              Atalhos fixados
            </p>
          )}
          <div className="space-y-0.5">
            {pins.map(pin => {
              const active = location.pathname === pin.to || (pin.to !== '/' && location.pathname.startsWith(pin.to));
              return (
                <div key={pin.to} className="group flex items-center">
                  <NavLink
                    to={pin.to}
                    className={cn(
                      "flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      collapsed ? "justify-center" : "",
                      active
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Pin className={cn("h-3.5 w-3.5 shrink-0", active && "text-sidebar-primary")} />
                    {!collapsed && <span className="truncate text-xs">{pin.label}</span>}
                  </NavLink>
                  {!collapsed && (
                    <button
                      onClick={() => removePin(pin.to)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded flex items-center justify-center text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-all shrink-0"
                      title="Remover atalho"
                    >
                      <PinOff className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navStructure.map((entry, idx) => renderEntry(entry, idx))}
      </nav>

      {/* ── Navigation Suggestions ── */}
      <NavigationSuggestionsPanel collapsed={collapsed} />

      {/* ── Onboarding CTA — visible until onboarding is complete ── */}
      {!onboardingComplete && (
        <div className={cn("mx-3 mb-2", collapsed && "mx-2")}>
          <button
            onClick={() => navigate('/onboarding')}
            className={cn(
              "w-full rounded-lg border transition-all duration-200 group",
              "bg-primary/10 border-primary/20 hover:bg-primary/15 hover:border-primary/30",
              collapsed ? "p-2 flex items-center justify-center" : "p-3 text-left"
            )}
          >
            {collapsed ? (
              <Zap className="h-4 w-4 text-primary animate-pulse" />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-primary">
                    Concluir Configuração
                  </span>
                </div>
                <Progress value={onboardingPct} className="h-1.5 mb-1.5" />
                <p className="text-[10px] text-sidebar-foreground/50 leading-relaxed">
                  {onboardingPct}% concluído — clique para continuar
                </p>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Plan Badge + Upgrade Banner ── */}
      {!collapsed && expProfile.plan_tier && (
        <div className="mx-3 mb-2 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">Plano</span>
            <PlanBadge tier={expProfile.plan_tier} size="sm" />
          </div>
          {!['enterprise', 'custom'].includes(expProfile.plan_tier) && (
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-[10px] font-semibold text-primary">⚡ Upgrade disponível</p>
              <p className="text-[10px] text-sidebar-foreground/50 mt-0.5 leading-relaxed">
                {expProfile.plan_tier === 'free' && 'Desbloqueie módulos de Inteligência e Compliance.'}
                {expProfile.plan_tier === 'starter' && 'Acesse Analytics avançado e dashboards extras.'}
                {expProfile.plan_tier === 'professional' && 'Libere branding customizado e IA completa.'}
              </p>
            </div>
          )}
        </div>
      )}

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
