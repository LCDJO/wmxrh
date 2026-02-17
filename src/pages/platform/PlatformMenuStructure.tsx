/**
 * PlatformMenuStructure — Displays the full navigation menu tree of the platform.
 */
import {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText, Shield,
  Zap, Users, Package, Megaphone, KeyRound, Brain, Activity, Monitor,
  TrendingUp, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface MenuNode {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  children?: { label: string; path: string }[];
}

const MENU_TREE: MenuNode[] = [
  { label: 'Dashboard', path: '/platform/dashboard', icon: LayoutDashboard },
  { label: 'Tenants', path: '/platform/tenants', icon: Building2 },
  { label: 'Módulos', path: '/platform/modules', icon: Puzzle },
  { label: 'Planos', path: '/platform/plans', icon: Package },
  { label: 'Usuários', path: '/platform/users', icon: Users },
  {
    label: 'Segurança', path: '/platform/security', icon: ShieldCheck,
    children: [
      { label: 'Cargos', path: '/platform/security/roles' },
      { label: 'Permissões', path: '/platform/security/permissions' },
      { label: 'Access Graph', path: '/platform/security/access-graph' },
      { label: 'Unified Graph', path: '/platform/security/unified-graph' },
      { label: 'Governança', path: '/platform/security/governance' },
      { label: 'Governance AI', path: '/platform/security/governance-ai' },
    ],
  },
  { label: 'IAM', path: '/platform/iam', icon: KeyRound },
  { label: 'Automação', path: '/platform/automation', icon: Zap },
  {
    label: 'Monitoramento', path: '/platform/monitoring', icon: Monitor,
    children: [
      { label: 'Status', path: '/platform/monitoring' },
      { label: 'Módulos', path: '/platform/monitoring/modules' },
      { label: 'Erros', path: '/platform/monitoring/errors' },
      { label: 'Performance', path: '/platform/monitoring/performance' },
      { label: 'Incidentes', path: '/platform/monitoring/incidents' },
    ],
  },
  { label: 'Observability', path: '/platform/observability', icon: Activity },
  { label: 'Comunicação', path: '/platform/communications', icon: Megaphone },
  { label: 'Auditoria', path: '/platform/audit', icon: ScrollText },
  {
    label: 'Financeiro', path: '/platform/billing', icon: Package,
    children: [
      { label: 'Visão Geral', path: '/platform/billing' },
      { label: 'Cupons', path: '/platform/billing/coupons' },
      { label: 'Control Center', path: '/platform/billing/control-center' },
    ],
  },
  {
    label: 'Revenue', path: '/platform/revenue', icon: TrendingUp,
    children: [
      { label: 'Visão Geral', path: '/platform/revenue' },
      { label: 'Referrals', path: '/platform/referrals' },
      { label: 'Gamificação', path: '/platform/gamification' },
      { label: 'Intelligence', path: '/platform/revenue/intelligence' },
    ],
  },
  { label: 'Fiscal', path: '/platform/fiscal', icon: ScrollText },
  {
    label: 'Estrutura', path: '/platform/structure', icon: Puzzle,
    children: [
      { label: 'Eventos', path: '/platform/structure/events' },
      { label: 'Menus', path: '/platform/structure/menus' },
    ],
  },
];

export default function PlatformMenuStructure() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const totalItems = MENU_TREE.length;
  const totalChildren = MENU_TREE.reduce((acc, m) => acc + (m.children?.length ?? 0), 0);
  const withChildren = MENU_TREE.filter(m => m.children).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estrutura de Menus</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mapa completo da navegação do painel de plataforma
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Menus Raiz', value: totalItems, color: 'hsl(265 80% 55%)' },
          { label: 'Sub-itens', value: totalChildren, color: 'hsl(200 70% 50%)' },
          { label: 'Com Filhos', value: withChildren, color: 'hsl(145 60% 42%)' },
        ].map(s => (
          <Card key={s.label} className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <span className="text-lg font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Menu Tree */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {MENU_TREE.map((item) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = expanded.has(item.path);

              return (
                <div key={item.path}>
                  <button
                    type="button"
                    onClick={() => hasChildren && toggle(item.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors',
                      hasChildren ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default',
                      isOpen && 'bg-muted/30'
                    )}
                  >
                    <div className="h-8 w-8 rounded-md flex items-center justify-center bg-[hsl(265_60%_50%/0.12)]">
                      <Icon className="h-4 w-4 text-[hsl(265_80%_60%)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono">{item.path}</span>
                    </div>
                    {hasChildren && (
                      <>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.children!.length}
                        </Badge>
                        {isOpen
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        }
                      </>
                    )}
                  </button>

                  {hasChildren && isOpen && (
                    <div className="bg-muted/20 border-t border-border/30">
                      {item.children!.map((child, idx) => (
                        <div
                          key={child.path}
                          className="flex items-center gap-3 pl-16 pr-5 py-2.5"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-[hsl(265_60%_55%)]" />
                          <span className="text-sm text-foreground">{child.label}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-auto">{child.path}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
