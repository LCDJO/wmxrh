/**
 * App Sidebar — Section-based professional navigation
 *
 * Mirrors the platform sidebar pattern with:
 *   - Uppercase section labels with separators
 *   - Collapsible sub-groups with border-left indicators
 *   - Permission-aware visibility
 *   - Experience Profile locking
 */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Building2,
  ChevronLeft, ChevronRight, ChevronDown, LogOut, FileText, Heart, Clock,
  ShieldCheck, ClipboardCheck, ScrollText, Scale, Gavel, Landmark,
  Calculator, Brain, Sparkles, Send, Settings, Plug, UserCog, FileSignature,
  GraduationCap, ShieldAlert, Globe, Layers, Pin, PinOff, Lock, Megaphone,
  Zap, Trophy, Gift, Headphones, MessageSquarePlus, BookOpen, Webhook, Store, Bot,
  HardHat, Activity, Stethoscope, Car, Monitor, Radio, UserMinus, PanelBottom,
  Shield, Crown,
} from 'lucide-react';
import { useState } from 'react';
import { useAnnouncements } from '@/hooks/use-announcements';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityKernel } from '@/domains/security/use-security-kernel';
import { useIdentityIntelligence } from '@/domains/security/kernel/identity-intelligence';
import { useNavigationPins } from '@/hooks/use-navigation-pins';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useExperienceProfile } from '@/hooks/use-experience-profile';
import { usePXE } from '@/hooks/use-pxe';
// NavigationSuggestionsPanel moved to NotificationBell flyout
import { Progress } from '@/components/ui/progress';
import { ContextSelector } from './ContextSelector';
import { PlanBadge } from '@/components/shared/PlanBadge';
import type { NavKey } from '@/domains/security/permissions';
import type { FeatureKey } from '@/domains/security/feature-flags';

// ════════════════════════════════════
// TYPES
// ════════════════════════════════════

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  key: NavKey;
  featureFlag?: FeatureKey;
  /** Module key from saas_plans.allowed_modules — if set, item is hidden when module is not in tenant plan */
  moduleKey?: string;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ════════════════════════════════════
// NAV STRUCTURE — Section-based
// ════════════════════════════════════

const navSections: NavSection[] = [
  // ══════════════════════════════════════════════
  // 1. DASHBOARD
  // ══════════════════════════════════════════════
  {
    label: 'Dashboard',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
      { to: '/executive-dashboard', icon: TrendingUp, label: 'Dashboard Executivo', key: 'intelligence', moduleKey: 'workforce_intelligence' },
    ],
  },

  // ══════════════════════════════════════════════
  // 2. PESSOAS
  // ══════════════════════════════════════════════
  {
    label: 'Pessoas',
    items: [
      { to: '/employees', icon: Users, label: 'Colaboradores', key: 'employees', moduleKey: 'employees' },
      { to: '/companies', icon: Building2, label: 'Empresas', key: 'companies', moduleKey: 'companies' },
      { to: '/groups', icon: Layers, label: 'Grupos Econômicos', key: 'groups', moduleKey: 'groups' },
      { to: '/departments', icon: Briefcase, label: 'Departamentos', key: 'departments', moduleKey: 'departments' },
      {
        to: '/positions', icon: UserCog, label: 'Cargos', key: 'positions', moduleKey: 'positions',
        children: [
          { to: '/positions', icon: UserCog, label: 'Lista de Cargos', key: 'positions', moduleKey: 'positions' },
          { to: '/pccs-dashboard', icon: TrendingUp, label: 'PCCS', key: 'positions', moduleKey: 'positions' },
        ],
      },
      { to: '/time-tracking', icon: Clock, label: 'Controle de Ponto', key: 'employees', moduleKey: 'employees' },
      { to: '/agreements', icon: ScrollText, label: 'Termos e Acordos', key: 'employees', moduleKey: 'agreements' },
      {
        to: '/offboarding', icon: UserMinus, label: 'Desligamento', key: 'employees', moduleKey: 'employees',
        children: [
          { to: '/offboarding', icon: UserMinus, label: 'Visão Geral', key: 'employees', moduleKey: 'employees' },
          { to: '/termination-simulator', icon: Calculator, label: 'Simulador Rescisão', key: 'employees', moduleKey: 'employees' },
          { to: '/terminated-employees', icon: Users, label: 'Desligados', key: 'employees', moduleKey: 'employees' },
          { to: '/reference-letters', icon: FileSignature, label: 'Cartas de Referência', key: 'employees', moduleKey: 'employees' },
        ],
      },
      {
        to: '/health', icon: Stethoscope, label: 'Saúde Ocupacional', key: 'health' as NavKey, moduleKey: 'health',
        children: [
          { to: '/health', icon: Stethoscope, label: 'Programas (PCMSO)', key: 'health' as NavKey, moduleKey: 'health' },
          { to: '/occupational-compliance', icon: GraduationCap, label: 'Riscos Ocupacionais', key: 'health' as NavKey, moduleKey: 'health' },
        ],
      },
      {
        to: '/epi-catalog', icon: HardHat, label: 'EPI', key: 'health' as NavKey, moduleKey: 'health',
        children: [
          { to: '/epi-catalog', icon: HardHat, label: 'Catálogo', key: 'health' as NavKey, moduleKey: 'health' },
          { to: '/epi-delivery', icon: ClipboardCheck, label: 'Entregas', key: 'health' as NavKey, moduleKey: 'health' },
          { to: '/epi-dashboard', icon: ShieldCheck, label: 'Dashboard', key: 'health' as NavKey, moduleKey: 'health' },
          { to: '/epi-audit', icon: ScrollText, label: 'Auditoria', key: 'health' as NavKey, moduleKey: 'health' },
        ],
      },
      {
        to: '/nr-compliance', icon: ShieldAlert, label: 'Normas & Automação', key: 'health' as NavKey, moduleKey: 'health',
        children: [
          { to: '/nr-compliance', icon: ShieldAlert, label: 'NR Compliance', key: 'health' as NavKey, moduleKey: 'health' },
          { to: '/safety-automation', icon: Zap, label: 'Automação SST', key: 'health' as NavKey, moduleKey: 'health' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════
  // 3. FINANCEIRO RH
  // ══════════════════════════════════════════════
  {
    label: 'Financeiro RH',
    items: [
      {
        to: '/compensation', icon: TrendingUp, label: 'Remuneração', key: 'compensation', moduleKey: 'compensation',
        children: [
          { to: '/compensation', icon: TrendingUp, label: 'Visão Geral', key: 'compensation', moduleKey: 'compensation' },
          { to: '/payroll-simulation', icon: Calculator, label: 'Simulação Folha', key: 'compensation', moduleKey: 'payroll_simulation' },
        ],
      },
      { to: '/benefits', icon: Gift, label: 'Benefícios', key: 'benefits', moduleKey: 'benefits' },
      { to: '/labor-dashboard', icon: ClipboardCheck, label: 'Painel Trabalhista', key: 'labor_dashboard', moduleKey: 'labor_rules' },
      { to: '/labor-compliance', icon: Scale, label: 'Conformidade', key: 'labor_compliance', moduleKey: 'labor_compliance' },
      { to: '/labor-rules', icon: Gavel, label: 'Regras & Convenções', key: 'labor_rules', moduleKey: 'labor_rules' },
      { to: '/legal-dashboard', icon: Landmark, label: 'Dashboard Legal', key: 'legal_dashboard', moduleKey: 'labor_compliance' },
      { to: '/regulatory-dashboard', icon: Activity, label: 'Regulatório', key: 'legal_dashboard', moduleKey: 'labor_compliance' },
      { to: '/legal-intelligence', icon: Scale, label: 'Inteligência Jurídica', key: 'legal_dashboard', moduleKey: 'labor_compliance' },
      { to: '/agreement-compliance', icon: ClipboardCheck, label: 'Compliance de Acordos', key: 'legal_dashboard', moduleKey: 'labor_compliance' },
      { to: '/document-validation', icon: FileText, label: 'Validação de Documentos', key: 'audit', moduleKey: 'compliance' },
      { to: '/lgpd', icon: ShieldCheck, label: 'LGPD', key: 'compliance', moduleKey: 'compliance' },
      { to: '/compliance', icon: FileText, label: 'Rubricas', key: 'compliance', moduleKey: 'compliance' },
      { to: '/audit', icon: ScrollText, label: 'Auditoria', key: 'audit', moduleKey: 'audit' },
      { to: '/esocial', icon: Send, label: 'eSocial', key: 'esocial' as NavKey, moduleKey: 'esocial' },
      { to: '/esocial-governance', icon: ShieldCheck, label: 'eSocial Governance', key: 'esocial' as NavKey, moduleKey: 'esocial' },
    ],
  },

  // ══════════════════════════════════════════════
  // 4. RECRUTAMENTO
  // ══════════════════════════════════════════════
  {
    label: 'Recrutamento',
    items: [
      { to: '/workforce-intelligence', icon: Brain, label: 'Inteligência RH', key: 'intelligence', moduleKey: 'workforce_intelligence' },
      { to: '/strategic-intelligence', icon: Sparkles, label: 'IA Estratégica', key: 'intelligence', moduleKey: 'workforce_intelligence' },
    ],
  },

  // ══════════════════════════════════════════════
  // 5. AUTOMAÇÃO
  // ══════════════════════════════════════════════
  {
    label: 'Automação',
    items: [
      { to: '/fleet-dashboard', icon: Car, label: 'Frota & Compliance', key: 'fleet' as NavKey, moduleKey: 'fleet' },
      { to: '/live-display', icon: Monitor, label: 'Live Display (TV)', key: 'live_display' as NavKey, moduleKey: 'fleet' },
      { to: '/command-center', icon: Radio, label: 'Command Center', key: 'operations' as NavKey, moduleKey: 'fleet' },
      { to: '/apps', icon: Store, label: 'Apps & Integrações', key: 'iam_users' as NavKey },
      { to: '/integrations/telegram', icon: Bot, label: 'Telegram', key: 'integrations' as NavKey },
      { to: '/integrations/traccar', icon: Car, label: 'Traccar (GPS)', key: 'integrations' as NavKey, moduleKey: 'fleet' },
      { to: '/integrations/document-signature', icon: FileSignature, label: 'Assinatura Digital', key: 'integrations' as NavKey, moduleKey: 'agreements' },
    ],
  },

  // ══════════════════════════════════════════════
  // 6. RELATÓRIOS
  // ══════════════════════════════════════════════
  {
    label: 'Relatórios',
    items: [
      { to: '/support/wiki', icon: BookOpen, label: 'Base de Conhecimento', key: 'support' },
    ],
  },

  // ══════════════════════════════════════════════
  // 7. MARKETING
  // ══════════════════════════════════════════════
  {
    label: 'Marketing',
    items: [
      { to: '/referral', icon: Trophy, label: 'Indique e Ganhe', key: 'referral' },
      { to: '/engajamento', icon: Zap, label: 'Meu Engajamento', key: 'referral' },
      { to: '/communication-center', icon: Send, label: 'Central de Comunicação', key: 'dashboard' },
    ],
  },

  // ══════════════════════════════════════════════
  // 8. CONFIGURAÇÕES
  // ══════════════════════════════════════════════
  {
    label: 'Configurações',
    items: [
      { to: '/plans', icon: Crown, label: 'Meu Plano', key: 'iam_users' },
      { to: '/settings/personalization', icon: Sparkles, label: 'Personalização', key: 'iam_users' },
      { to: '/settings/users', icon: Users, label: 'Usuários', key: 'iam_users' },
      { to: '/settings/roles', icon: ShieldCheck, label: 'Cargos & Permissões', key: 'iam_roles' },
      { to: '/settings/pdf-layout', icon: FileText, label: 'Layout do PDF', key: 'iam_users' },
      { to: '/settings/webhooks', icon: Webhook, label: 'Webhooks', key: 'iam_users' },
      { to: '/settings/sso', icon: Shield, label: 'SSO / Federação', key: 'iam_users', moduleKey: 'iam' },
      { to: '/settings/scim', icon: Shield, label: 'SCIM Provisioning', key: 'iam_users', moduleKey: 'iam' },
      { to: '/announcements', icon: Megaphone, label: 'Avisos do Sistema', key: 'dashboard' },
      { to: '/support/chat', icon: MessageSquarePlus, label: 'Chat ao Vivo', key: 'support' },
      { to: '/support/new', icon: MessageSquarePlus, label: 'Abrir Chamado', key: 'support' },
      { to: '/support/tickets', icon: Headphones, label: 'Meus Chamados', key: 'support' },
    ],
  },
];

// ════════════════════════════════════
// SIDEBAR COMPONENT
// ════════════════════════════════════

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { canNav, isFeatureEnabled, effectiveRoles, loading } = useSecurityKernel();
  const { activeContext, isImpersonating, session } = useIdentityIntelligence();
  const { pins, removePin, isPinned } = useNavigationPins();
  const { announcements } = useAnnouncements();
  const hasCriticalAnnouncement = announcements.some(a => a.severity === 'critical');
  const { isPathVisible, isPathLocked, profile: expProfile } = useExperienceProfile();
  const { isModuleAccessible, getModuleAccess, getUpgradePrompt, ready: pxeReady } = usePXE();
  const { isOnboarding, completionPct: onboardingPct } = useOnboardingStatus();
  const onboardingComplete = !isOnboarding;

  /** Visibility: returns 'visible' | 'gated' (show with CTA) | 'hidden' */
  const getItemVisibility = (item: NavItem): 'visible' | 'gated' | 'hidden' => {
    if (loading) return 'visible';
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return 'hidden';
    if (!canNav(item.key)) return 'hidden';
    if (!isPathVisible(item.to)) return 'hidden';
    // Plan-based: show as gated (upgrade CTA) instead of fully hiding
    if (item.moduleKey && pxeReady && !isModuleAccessible(item.moduleKey)) return 'gated';
    return 'visible';
  };

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  // Filter sections: keep items that are visible OR gated (for CTA)
  const visibleSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => getItemVisibility(item) !== 'hidden'),
    }))
    .filter(section => section.items.length > 0);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to);
    const lockInfo = isPathLocked(item.to);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedNav === item.to || (hasChildren && item.children!.some(c => isActive(c.to)));
    const isCriticalHighlight = item.to === '/announcements' && hasCriticalAnnouncement;
    const visibility = getItemVisibility(item);

    // Gated by plan: show item dimmed with upgrade CTA
    if (visibility === 'gated') {
      const upgradePrompt = item.moduleKey ? getUpgradePrompt(item.moduleKey) : null;
      return (
        <div
          key={item.to}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer group relative",
            collapsed ? "justify-center" : "",
            "text-sidebar-foreground/30 hover:text-sidebar-foreground/40"
          )}
          onClick={() => navigate('/plans')}
          title={upgradePrompt ? `Upgrade necessário` : 'Módulo não disponível no seu plano'}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              <span className="shrink-0 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                Upgrade
              </span>
            </>
          )}
          {!collapsed && (
            <div className="absolute left-full ml-2 top-0 z-50 hidden group-hover:block">
              <div className="bg-popover text-popover-foreground text-xs rounded-lg shadow-lg border border-border p-3 w-52">
                <p className="font-semibold mb-1">⚡ Módulo não incluído</p>
                <p className="text-muted-foreground mb-2">
                  Este recurso não está disponível no seu plano atual.
                </p>
                <p className="text-primary font-medium text-[11px]">Clique para ver planos →</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Locked item
    if (lockInfo.locked) {
      return (
        <div
          key={item.to}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium cursor-not-allowed group relative",
            collapsed ? "justify-center" : "",
            "text-sidebar-foreground/30"
          )}
          title={lockInfo.message || `Disponível no plano ${lockInfo.requiredPlan}`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate flex-1">{item.label}</span>
              <Lock className="h-3 w-3 shrink-0 text-sidebar-foreground/20" />
            </>
          )}
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

    // Item with children (expandable)
    if (hasChildren) {
      return (
        <div key={item.to}>
          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                navigate(item.to);
              } else {
                setExpandedNav(prev => prev === item.to ? null : item.to);
              }
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 w-full",
              collapsed && "justify-center",
              active
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", active && "text-sidebar-primary")} />
            {!collapsed && (
              <>
                <span className="truncate flex-1 text-left">{item.label}</span>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform",
                  isExpanded && "rotate-90"
                )} />
              </>
            )}
          </button>

          {/* Sub-items with border-left indicator */}
          {isExpanded && !collapsed && (
            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
              {item.children!.filter(c => getItemVisibility(c) !== 'hidden').map(child => {
                const childActive = isActive(child.to);
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={cn(
                      "flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                      childActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
                    )}
                  >
                    {child.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Regular item
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
          collapsed && "justify-center",
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
            <span className="truncate flex-1">{item.label}</span>
            {isCriticalHighlight && (
              <span className="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" />
            )}
          </>
        )}
      </NavLink>
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

      {/* ── Section-based Navigation ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {visibleSections.map((section, sectionIdx) => (
          <div key={section.label}>
            {/* Section separator */}
            {sectionIdx > 0 && (
              <div className="my-3 mx-1 border-t border-sidebar-border" />
            )}
            {/* Section label */}
            {!collapsed && (
              <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/35">
                {section.label}
              </p>
            )}
            {collapsed && sectionIdx > 0 && (
              <div className="flex justify-center py-1">
                <div className="w-5 border-t border-sidebar-border" />
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Navigation Suggestions moved to NotificationBell flyout */}

      {/* ── Onboarding CTA ── */}
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
