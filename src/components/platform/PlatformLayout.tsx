/**
 * PlatformLayout — Shell layout for /platform/* routes.
 * Visually distinct from tenant AppLayout with purple accent and "Modo Plataforma" label.
 * Reads saved menu order from localStorage to dynamically reorder sidebar navigation.
 */
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity, type PlatformRoleType } from '@/domains/platform/PlatformGuard';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import type { PlatformPermission } from '@/domains/platform/platform-permissions';
import { getSavedMenuOrder, applyOrder, type SavedMenuOrder } from '@/lib/platform-menu-order';
import {
  LayoutDashboard,
  Building2,
  Puzzle,
  ShieldCheck,
  ScrollText,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Package,
  Megaphone,
  KeyRound,
  Brain,
  Activity,
  Monitor,
  TrendingUp,
  Rocket,
  Globe,
  GitBranch,
  Settings,
  Headphones,
  Network,
  Workflow,
  Eye,
  Gauge,
  BarChart3,
  FileEdit,
  CheckSquare,
  BookOpen,
  FileSignature,
  FileText,
} from 'lucide-react';
import { CognitivePanel } from './CognitivePanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useAgentAlerts } from '@/modules/support/ui/agent/AgentAlertService';

interface NavLeaf {
  to: string;
  label: string;
  requiredPermission?: PlatformPermission;
}

interface NavGrandChild {
  to: string;
  label: string;
  requiredPermission?: PlatformPermission;
  children?: NavLeaf[];
}

interface NavChild {
  to: string;
  label: string;
  requiredPermission?: PlatformPermission;
  children?: NavGrandChild[];
}

interface PlatformNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Permission required to see this item. Omit = always visible. */
  requiredPermission?: PlatformPermission;
  /** Role required to see this item. Stricter than permission — checked against identity.role. */
  requiredRole?: PlatformRoleType;
  children?: NavChild[];
}

interface NavSection {
  label: string;
  items: PlatformNavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  // ══════════════════════════════════════════════
  // 1. PLATAFORMA
  // ══════════════════════════════════════════════
  {
    label: 'Plataforma',
    items: [
      { to: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      {
        to: '/platform/control-plane',
        label: 'Control Plane',
        icon: Gauge,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/control-plane', label: 'Visão Geral' },
          { to: '/platform/control-plane/dr-tests', label: 'DR Tests' },
          { to: '/platform/control-plane/chaos', label: 'Chaos Engineering' },
        ],
      },
      { to: '/platform/modules', label: 'Módulos', icon: Puzzle, requiredPermission: 'module.view' },
      { to: '/platform/plans', label: 'Planos', icon: Package, requiredPermission: 'plan.manage' },
      { to: '/platform/communications', label: 'Comunicação', icon: Megaphone },
      {
        to: '/platform/support',
        label: 'Suporte',
        icon: Headphones,
        children: [
          { to: '/platform/support/console', label: 'Console de Suporte' },
          { to: '/platform/support/analytics', label: 'Analytics' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════
  // 2. CLIENTES
  // ══════════════════════════════════════════════
  {
    label: 'Clientes',
    items: [
      { to: '/platform/tenants', label: 'Clientes', icon: Building2, requiredPermission: 'tenant.view' },
      { to: '/platform/users/dashboard', label: 'Visão Geral Usuários', icon: BarChart3, requiredPermission: 'platform_user.view' },
      { to: '/platform/users', label: 'Usuários', icon: Users, requiredPermission: 'platform_user.view' },
    ],
  },

  // ══════════════════════════════════════════════
  // 3. RECEITA & BILLING
  // ══════════════════════════════════════════════
  {
    label: 'Receita & Billing',
    items: [
      {
        to: '/platform/billing',
        label: 'Billing',
        icon: Package,
        requiredPermission: 'billing.view',
        children: [
          { to: '/platform/billing', label: 'Visão Geral' },
          { to: '/platform/billing/coupons', label: 'Cupons' },
          { to: '/platform/billing/control-center', label: 'Control Center' },
        ],
      },
      {
        to: '/platform/revenue',
        label: 'Revenue',
        icon: TrendingUp,
        requiredPermission: 'billing.view',
        children: [
          { to: '/platform/revenue', label: 'Visão Geral' },
          { to: '/platform/referrals', label: 'Referrals' },
          { to: '/platform/revenue/intelligence', label: 'Intelligence' },
        ],
      },
      {
        to: '/platform/growth',
        label: 'Growth AI',
        icon: Rocket,
        requiredPermission: 'growth.view',
        children: [
          { to: '/platform/growth', label: 'Visão Geral' },
          { to: '/platform/growth/insights', label: 'Insights', requiredPermission: 'growth.view' },
          { to: '/platform/growth/landing-pages', label: 'Landing Pages', requiredPermission: 'landing_page.view' },
          { to: '/platform/growth/conversions', label: 'Conversões', requiredPermission: 'growth.view' },
          { to: '/platform/growth/fab-builder', label: 'FAB Builder', requiredPermission: 'landing.create' },
          { to: '/platform/growth/submissions', label: 'Meus Rascunhos', requiredPermission: 'landing.view_drafts' },
          { to: '/platform/growth/approvals', label: 'Aprovações Pendentes', requiredPermission: 'landing.approve' },
          { to: '/platform/growth/version-publish', label: 'Publicadas', requiredPermission: 'landing.publish' },
        ],
      },
      {
        to: '/platform/website',
        label: 'Website',
        icon: Globe,
        requiredPermission: 'billing.view',
        children: [
          { to: '/platform/website', label: 'Dashboard' },
          { to: '/platform/website/ai-designer', label: 'AI Designer' },
          { to: '/platform/website/templates', label: 'Templates' },
          { to: '/platform/website/versions', label: 'Versionamento' },
        ],
      },
      {
        to: '/platform/marketing',
        label: 'Marketing',
        icon: Megaphone,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/marketing/analytics', label: 'Analytics' },
        ],
      },
      {
        to: '/platform/landing',
        label: 'Landing Pages',
        icon: BookOpen,
        requiredPermission: 'landing.view_drafts',
        children: [
          { to: '/platform/landing/drafts', label: 'Rascunhos' },
          { to: '/platform/landing/review', label: 'Revisão' },
          { to: '/platform/landing/published', label: 'Publicadas' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════
  // 4. SEGURANÇA
  // ══════════════════════════════════════════════
  {
    label: 'Segurança',
    items: [
      { to: '/platform/iam', label: 'IAM', icon: KeyRound, requiredPermission: 'security.manage' },
      {
        to: '/platform/security',
        label: 'Cargos e Permissões',
        icon: ShieldCheck,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/security/dashboard', label: 'Visão Geral' },
          { to: '/platform/security/roles', label: 'Cargos' },
          { to: '/platform/security/permissions', label: 'Permissões' },
          { to: '/platform/security/access-graph', label: 'Access Graph' },
          { to: '/platform/security/unified-graph', label: 'Unified Graph' },
        ],
      },
      { to: '/platform/governance', label: 'Governance Dashboard', icon: BarChart3, requiredPermission: 'security.view' },
      {
        to: '/platform/governance/policies',
        label: 'Policy Governance',
        icon: FileText,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/governance/policies', label: 'Políticas' },
          { to: '/platform/governance/enforcement', label: 'Enforcement' },
          { to: '/platform/governance/appeals', label: 'Appeals' },
        ],
      },
      {
        to: '/platform/security/governance',
        label: 'Governança',
        icon: Shield,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/security/governance', label: 'Governança' },
          { to: '/platform/security/governance-ai', label: 'Governance AI' },
        ],
      },
      {
        to: '/platform/security/federation',
        label: 'Federation',
        icon: Globe,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/security/federation', label: 'Visão Geral' },
          { to: '/platform/security/federation/identity-providers', label: 'Identity Providers' },
          { to: '/platform/security/federation/saml-config', label: 'SAML Config' },
          { to: '/platform/security/federation/oauth-clients', label: 'OAuth Clients' },
          { to: '/platform/security/federation/token-settings', label: 'Token Settings' },
          { to: '/platform/security/federation/audit-logs', label: 'Audit Logs' },
        ],
      },
      {
        to: '/platform/security/scim',
        label: 'SCIM Provisioning',
        icon: Shield,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/security/scim', label: 'Configurations' },
          { to: '/platform/security/scim?tab=logs', label: 'Provisioning Logs' },
          { to: '/platform/security/scim?tab=role-mapping', label: 'Role Mapping' },
        ],
      },
      {
        to: '/platform/security/user-activity',
        label: 'User Activity Intelligence',
        icon: Activity,
        requiredPermission: 'security.view',
      },
      { to: '/platform/audit', label: 'Auditoria', icon: ScrollText, requiredPermission: 'security.view' },
      { to: '/platform/logs', label: 'Logs do Sistema', icon: FileText, requiredRole: 'platform_super_admin' },
    ],
  },

  // ══════════════════════════════════════════════
  // 5. APIs & INTEGRAÇÕES
  // ══════════════════════════════════════════════
  {
    label: 'APIs & Integrações',
    items: [
      {
        to: '/platform/apis',
        label: 'APIs',
        icon: Network,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/apis', label: 'Clients' },
          { to: '/platform/apis/keys', label: 'Keys' },
          { to: '/platform/apis/usage', label: 'Usage' },
          { to: '/platform/apis/rate-limits', label: 'Rate Limits' },
          { to: '/platform/apis/versions', label: 'Versions' },
        ],
      },
      {
        to: '/platform/developers',
        label: 'Developer Portal',
        icon: Users,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/developers', label: 'Developers' },
          { to: '/platform/marketplace', label: 'Marketplace' },
          { to: '/platform/apps-review', label: 'Revisão de Apps' },
        ],
      },
      { to: '/platform/document-signature', label: 'Assinatura Digital', icon: FileSignature, requiredPermission: 'security.manage' },
      { to: '/platform/integration-health', label: 'Integration Health', icon: Activity, requiredPermission: 'security.manage' },
    ],
  },

  // ══════════════════════════════════════════════
  // 6. AUTOMAÇÃO & IA
  // ══════════════════════════════════════════════
  {
    label: 'Automação & IA',
    items: [
      { to: '/platform/automation', label: 'Automação', icon: Zap, requiredPermission: 'security.manage' },
      {
        to: '/platform/integration-automation',
        label: 'iPaaS Workflows',
        icon: Workflow,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/integration-automation', label: 'Workflows' },
          { to: '/platform/integration-automation/templates', label: 'Templates' },
          { to: '/platform/integration-automation/executions', label: 'Execution Logs' },
          { to: '/platform/integration-automation/sandbox', label: 'Sandbox Tests' },
        ],
      },
      { to: '/platform/ai-operations', label: 'AI Operations', icon: Brain, requiredPermission: 'security.manage' },
    ],
  },

  // ══════════════════════════════════════════════
  // 7. ARQUITETURA
  // ══════════════════════════════════════════════
  {
    label: 'Arquitetura',
    items: [
      {
        to: '/platform/structure/architecture',
        label: 'Architecture Intelligence',
        icon: GitBranch,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/structure/architecture/dashboard', label: 'Dashboard' },
          { to: '/platform/structure/architecture/risk-analyzer', label: 'Risk Analyzer' },
          { to: '/platform/structure/architecture/saas-core', label: 'SaaS Core' },
          { to: '/platform/structure/architecture/tenant-modules', label: 'Tenant Modules' },
          { to: '/platform/structure/architecture/dependency-graph', label: 'Dependency Graph' },
          { to: '/platform/structure/architecture/health-monitor', label: 'Health Monitor' },
          { to: '/platform/structure/architecture/documentation', label: 'Documentação' },
        ],
      },
      { to: '/platform/structure/events', label: 'Eventos', icon: Zap, requiredPermission: 'security.manage' },
      { to: '/platform/structure/menus', label: 'Menus', icon: FileEdit, requiredPermission: 'security.manage' },
      { to: '/platform/structure/modules', label: 'Módulos', icon: Puzzle, requiredPermission: 'security.manage' },
      {
        to: '/platform/settings',
        label: 'Settings',
        icon: Settings,
        children: [
          { to: '/platform/settings/saas', label: 'Parametrizações' },
          { to: '/platform/settings/gamification', label: 'Gamificação' },
          { to: '/platform/settings/versioning', label: 'Versionamento' },
          { to: '/platform/settings/footer', label: 'Rodapé (Footer)' },
          { to: '/platform/tenants', label: 'Personalização / WhiteLabel' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════
  // 8. CONTINUIDADE
  // ══════════════════════════════════════════════
  {
    label: 'Continuidade',
    items: [
      {
        to: '/platform/incidents',
        label: 'Incident Management',
        icon: Shield,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/incidents', label: 'Incidentes' },
          { to: '/platform/incidents?tab=sla', label: 'SLA' },
          { to: '/platform/incidents?tab=postmortems', label: 'Postmortems' },
          { to: '/platform/incidents?tab=availability', label: 'Disponibilidade' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════
  // 9. MONITORAMENTO
  // ══════════════════════════════════════════════
  {
    label: 'Monitoramento',
    items: [
      {
        to: '/platform/monitoring',
        label: 'Monitoramento',
        icon: Monitor,
        requiredPermission: 'security.view',
        children: [
          { to: '/platform/monitoring', label: 'Status' },
          { to: '/platform/monitoring/modules', label: 'Módulos' },
          { to: '/platform/monitoring/errors', label: 'Erros' },
          { to: '/platform/monitoring/performance', label: 'Performance' },
          { to: '/platform/monitoring/incidents', label: 'Incidentes' },
        ],
      },
      { to: '/platform/observability', label: 'Observabilidade', icon: Eye, requiredPermission: 'security.view' },
      {
        to: '/platform/worktime',
        label: 'Ponto & Jornada',
        icon: Activity,
        requiredPermission: 'security.manage',
        children: [
          { to: '/platform/worktime', label: 'Jornada de Trabalho' },
          { to: '/platform/worktime/biometrics', label: 'Biometria' },
          { to: '/platform/worktime/behavior-ai', label: 'Behavior AI' },
          { to: '/platform/worktime/inspection', label: 'Fiscalização & Exportação' },
        ],
      },
    ],
  },
];

// Flatten sections into a single array for backward compat with ordering logic
const NAV_ITEMS: PlatformNavItem[] = NAV_SECTIONS.flatMap(s => s.items);

function GrandchildNavItem({ gc, currentPath }: { gc: NavGrandChild; currentPath: string }) {
  const hasLeaves = gc.children && gc.children.length > 0;
  const isGcActive = currentPath.startsWith(gc.to);
  const [expanded, setExpanded] = useState(isGcActive);

  if (hasLeaves) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className={cn(
            'flex items-center w-full px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200',
            isGcActive
              ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
              : 'text-[hsl(250_15%_55%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
          )}
        >
          <span className="flex-1 text-left">{gc.label}</span>
          <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-90')} />
        </button>
        {expanded && (
          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[hsl(250_25%_26%)] pl-3">
            {gc.children!.map(leaf => (
              <NavLink
                key={leaf.to}
                to={leaf.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-3 py-1.5 rounded-md text-[10px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                      : 'text-[hsl(250_15%_50%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                  )
                }
              >
                {leaf.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={gc.to}
      className={({ isActive }) =>
        cn(
          'flex items-center px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200',
          isActive
            ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
            : 'text-[hsl(250_15%_55%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
        )
      }
    >
      {gc.label}
    </NavLink>
  );
}

export default function PlatformLayout() {
  const { signOut, user } = useAuth();
  const { identity } = usePlatformIdentity();
  const { can } = usePlatformPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const [expandedChild, setExpandedChild] = useState<string | null>(null);
  const alertService = useAgentAlerts(user?.id ?? '');

  // Reset any saved menu order so the default NAV_SECTIONS order is used
  useEffect(() => {
    localStorage.removeItem('platform_menu_order');
  }, []);
  const savedOrder: SavedMenuOrder | null = null;

  const visibleSections = useMemo(() => {
    return NAV_SECTIONS.map(section => {
      let items = section.items.filter(item => {
        if (item.requiredRole && identity?.role !== item.requiredRole) return false;
        if (!item.requiredPermission) return true;
        return can(item.requiredPermission);
      }).map(item => {
        if (!item.children) return item;
        return {
          ...item,
          children: item.children.filter(child =>
            !child.requiredPermission || can(child.requiredPermission)
          ),
        };
      });

      // Menu order reset — always use default NAV_SECTIONS order

      return { ...section, items };
    }).filter(section => section.items.length > 0);
  }, [can, savedOrder, identity?.role]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  const roleLabel: Record<string, string> = {
    platform_super_admin: 'Super Admin',
    platform_operations: 'Operações',
    platform_support: 'Suporte',
    platform_finance: 'Financeiro',
    platform_read_only: 'Somente Leitura',
    platform_delegated_support: 'Suporte Delegado',
    platform_marketplace_admin: 'Marketplace Admin',
    platform_compliance: 'Compliance',
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ── */}
      <aside className={cn(
        "gradient-platform-sidebar flex flex-col border-r border-[hsl(250_25%_20%)] transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-[hsl(250_25%_20%)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg gradient-platform-accent">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="font-display text-base font-bold text-white">RH Gestão</h1>
              <p className="text-[10px] font-semibold text-[hsl(265_80%_70%)] uppercase tracking-[0.15em]">
                Platform
              </p>
            </div>
          )}
        </div>

        {/* Mode badge */}
        {!collapsed && (
          <div className="mx-3 mt-4 mb-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(265_60%_50%/0.15)] border border-[hsl(265_60%_50%/0.25)]">
              <Zap className="h-3.5 w-3.5 text-[hsl(265_80%_70%)]" />
              <span className="text-[11px] font-semibold text-[hsl(265_80%_75%)] uppercase tracking-wider">
                Modo Plataforma
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mt-4 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(265_60%_50%/0.15)] border border-[hsl(265_60%_50%/0.25)]">
              <Zap className="h-3.5 w-3.5 text-[hsl(265_80%_70%)]" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {visibleSections.map((section, sectionIdx) => (
            <div key={section.label}>
              {/* Section separator + label */}
              {sectionIdx > 0 && (
                <div className="my-3 mx-1 border-t border-[hsl(250_25%_22%)]" />
              )}
              {!collapsed && (
                <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[hsl(250_15%_45%)]">
                  {section.label}
                </p>
              )}
              {collapsed && sectionIdx > 0 && (
                <div className="flex justify-center py-1">
                  <div className="w-5 border-t border-[hsl(250_25%_25%)]" />
                </div>
              )}

              <div className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, children }) => {
                  const isParentActive = location.pathname.startsWith(to);
                  const hasChildren = children && children.length > 0;
                  const isExpanded = expandedNav === to || (hasChildren && isParentActive);

                  return (
                    <div key={to}>
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (collapsed) {
                              navigate(to);
                            } else {
                              setExpandedNav(prev => prev === to ? null : to);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full',
                            collapsed && 'justify-center',
                            isParentActive
                              ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                              : 'text-[hsl(250_15%_65%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                          )}
                        >
                          <div className="relative">
                            <Icon className="h-4.5 w-4.5 shrink-0" />
                            {collapsed && to === '/platform/support' && alertService.unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 rounded-full bg-[hsl(0_70%_50%)] text-[7px] font-bold text-white flex items-center justify-center px-0.5">
                                {alertService.unreadCount > 9 ? '9+' : alertService.unreadCount}
                              </span>
                            )}
                          </div>
                          {!collapsed && (
                            <>
                              <span className="truncate flex-1 text-left">{label}</span>
                              {to === '/platform/support' && alertService.unreadCount > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[hsl(0_70%_50%)] text-[9px] font-bold text-white px-1">
                                  {alertService.unreadCount > 9 ? '9+' : alertService.unreadCount}
                                </span>
                              )}
                              <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                            </>
                          )}
                        </button>
                      ) : (
                        <NavLink
                          to={to}
                          end={to === '/platform/security'}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                              collapsed && 'justify-center',
                              isActive
                                ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                                : 'text-[hsl(250_15%_65%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                            )
                          }
                        >
                          <Icon className="h-4.5 w-4.5 shrink-0" />
                          {!collapsed && <span className="truncate">{label}</span>}
                        </NavLink>
                      )}

                      {/* Sub-items */}
                      {hasChildren && isExpanded && !collapsed && (
                        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-[hsl(250_25%_22%)] pl-3">
                          {children.map(child => {
                            // Separator support
                            if (child.to.startsWith('---separator')) {
                              return <div key={child.to} className="my-1.5 mx-1 border-t border-[hsl(250_25%_22%)]" />;
                            }

                            const hasGrandchildren = child.children && child.children.length > 0;
                            const isChildActive = location.pathname.startsWith(child.to);
                            const isChildExpanded = expandedChild === child.to || (hasGrandchildren && isChildActive);

                            return (
                              <div key={child.to}>
                                {hasGrandchildren ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedChild(prev => prev === child.to ? null : child.to)}
                                    className={cn(
                                      'flex items-center w-full px-3 py-2 rounded-md text-xs font-medium transition-all duration-200',
                                      isChildActive
                                        ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                                        : 'text-[hsl(250_15%_60%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                                    )}
                                  >
                                    <span className="flex-1 text-left">{child.label}</span>
                                    <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isChildExpanded && 'rotate-90')} />
                                  </button>
                                ) : (
                                  <NavLink
                                    to={child.to}
                                    className={({ isActive }) =>
                                      cn(
                                        'flex items-center px-3 py-2 rounded-md text-xs font-medium transition-all duration-200',
                                        isActive
                                          ? 'bg-[hsl(265_60%_50%/0.18)] text-[hsl(265_80%_75%)]'
                                          : 'text-[hsl(250_15%_60%)] hover:text-[hsl(250_15%_85%)] hover:bg-[hsl(250_25%_18%)]'
                                      )
                                    }
                                  >
                                    {child.label}
                                  </NavLink>
                                )}

                                {/* Grandchildren (3rd level) */}
                                {hasGrandchildren && isChildExpanded && (
                                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[hsl(250_25%_24%)] pl-3">
                                    {child.children!.map(gc => (
                                      <GrandchildNavItem key={gc.to} gc={gc} currentPath={location.pathname} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="px-3 pb-2 border-t border-[hsl(250_25%_20%)] pt-4 space-y-3">
          {!collapsed && (
            <div className="px-2">
              <p className="text-xs font-medium text-[hsl(250_15%_85%)] truncate">{identity?.email}</p>
              <p className="text-[10px] text-[hsl(250_15%_55%)] mt-0.5">
                {identity ? roleLabel[identity.role] ?? identity.role : '—'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full gap-2 text-[hsl(250_15%_55%)] hover:text-destructive hover:bg-[hsl(250_25%_18%)]",
              collapsed ? "justify-center" : "justify-start"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && 'Sair'}
          </Button>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-4 border-t border-[hsl(250_25%_20%)] text-[hsl(250_15%_55%)] hover:text-[hsl(250_15%_85%)] transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar with platform mode indicator */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(265_60%_50%/0.08)] border border-[hsl(265_60%_50%/0.15)]">
              <div className="h-2 w-2 rounded-full bg-[hsl(265_80%_55%)] animate-pulse" />
              <span className="text-xs font-semibold text-[hsl(265_60%_45%)] uppercase tracking-wider">
                Modo Plataforma
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CognitivePanel />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <span>{identity ? roleLabel[identity.role] ?? identity.role : ''}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
