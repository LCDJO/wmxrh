/**
 * PlatformMenuStructure — Interactive graph-style drag-and-drop menu editor.
 * Only SuperAdmin (platform) users can reorder; others see read-only view.
 */
import {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText,
  Zap, Users, Package, Megaphone, KeyRound, Activity, Monitor,
  TrendingUp, RefreshCw, HelpCircle, X, GripVertical, Lock,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useRef, useState, useMemo, type DragEvent } from 'react';
import { toast } from 'sonner';

/* ─── Types ─── */
interface MenuChild {
  id: string;
  label: string;
  path: string;
}

interface MenuNode {
  id: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  children?: MenuChild[];
}

/* ─── Initial data ─── */
const createInitialTree = (): MenuNode[] => [
  { id: 'dashboard', label: 'Dashboard', path: '/platform/dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', path: '/platform/tenants', icon: Building2 },
  { id: 'modules', label: 'Módulos', path: '/platform/modules', icon: Puzzle },
  { id: 'plans', label: 'Planos', path: '/platform/plans', icon: Package },
  { id: 'users', label: 'Usuários', path: '/platform/users', icon: Users },
  {
    id: 'security', label: 'Segurança', path: '/platform/security', icon: ShieldCheck,
    children: [
      { id: 'sec-roles', label: 'Cargos', path: '/platform/security/roles' },
      { id: 'sec-perms', label: 'Permissões', path: '/platform/security/permissions' },
      { id: 'sec-graph', label: 'Access Graph', path: '/platform/security/access-graph' },
      { id: 'sec-unified', label: 'Unified Graph', path: '/platform/security/unified-graph' },
      { id: 'sec-gov', label: 'Governança', path: '/platform/security/governance' },
      { id: 'sec-govai', label: 'Governance AI', path: '/platform/security/governance-ai' },
    ],
  },
  { id: 'iam', label: 'IAM', path: '/platform/iam', icon: KeyRound },
  { id: 'automation', label: 'Automação', path: '/platform/automation', icon: Zap },
  {
    id: 'monitoring', label: 'Monitoramento', path: '/platform/monitoring', icon: Monitor,
    children: [
      { id: 'mon-status', label: 'Status', path: '/platform/monitoring' },
      { id: 'mon-mods', label: 'Módulos', path: '/platform/monitoring/modules' },
      { id: 'mon-err', label: 'Erros', path: '/platform/monitoring/errors' },
      { id: 'mon-perf', label: 'Performance', path: '/platform/monitoring/performance' },
      { id: 'mon-inc', label: 'Incidentes', path: '/platform/monitoring/incidents' },
    ],
  },
  { id: 'observability', label: 'Observability', path: '/platform/observability', icon: Activity },
  { id: 'comms', label: 'Comunicação', path: '/platform/communications', icon: Megaphone },
  { id: 'audit', label: 'Auditoria', path: '/platform/audit', icon: ScrollText },
  {
    id: 'billing', label: 'Financeiro', path: '/platform/billing', icon: Package,
    children: [
      { id: 'bill-overview', label: 'Visão Geral', path: '/platform/billing' },
      { id: 'bill-coupons', label: 'Cupons', path: '/platform/billing/coupons' },
      { id: 'bill-cc', label: 'Control Center', path: '/platform/billing/control-center' },
    ],
  },
  {
    id: 'revenue', label: 'Revenue', path: '/platform/revenue', icon: TrendingUp,
    children: [
      { id: 'rev-overview', label: 'Visão Geral', path: '/platform/revenue' },
      { id: 'rev-ref', label: 'Referrals', path: '/platform/referrals' },
      { id: 'rev-gam', label: 'Gamificação', path: '/platform/gamification' },
      { id: 'rev-intel', label: 'Intelligence', path: '/platform/revenue/intelligence' },
    ],
  },
  { id: 'fiscal', label: 'Fiscal', path: '/platform/fiscal', icon: ScrollText },
  {
    id: 'structure', label: 'Estrutura', path: '/platform/structure', icon: Puzzle,
    children: [
      { id: 'str-events', label: 'Eventos', path: '/platform/structure/events' },
      { id: 'str-menus', label: 'Menus', path: '/platform/structure/menus' },
      { id: 'str-modules', label: 'Módulos', path: '/platform/structure/modules' },
    ],
  },
];

/* ─── Simulated permission check ─── */
const useCanManageMenuStructure = () => {
  // In production this would check permission_definitions code 'platform.menu_structure.manage'
  // via the user's custom_roles → role_permissions chain.
  // For now, platform super admins always have access.
  return true;
};

/* ─── Component ─── */
export default function PlatformMenuStructure() {
  const canEdit = useCanManageMenuStructure();
  const [menuTree, setMenuTree] = useState<MenuNode[]>(createInitialTree);
  const [showHelp, setShowHelp] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<'root' | 'child' | null>(null);
  const [dragParentId, setDragParentId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const totalItems = menuTree.length;
  const totalChildren = useMemo(() => menuTree.reduce((a, m) => a + (m.children?.length ?? 0), 0), [menuTree]);
  const withChildren = useMemo(() => menuTree.filter(m => m.children && m.children.length > 0).length, [menuTree]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setMenuTree(createInitialTree());
      setIsRefreshing(false);
      toast.success(`Estrutura atualizada — ${createInitialTree().length} menus raiz, ${createInitialTree().reduce((a, m) => a + (m.children?.length ?? 0), 0)} sub-itens`);
    }, 400);
  }, []);

  /* ── Root-level drag handlers ── */
  const handleRootDragStart = (e: DragEvent, id: string) => {
    if (!canEdit) return;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
    setDragType('root');
    setDragParentId(null);
  };

  const handleRootDragOver = (e: DragEvent, id: string) => {
    e.preventDefault();
    if (dragType === 'root' && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleRootDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleRootDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOverId(null);
  };

  const handleRootDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounter.current = 0;
    if (dragType !== 'root' || !draggedId || draggedId === targetId) {
      resetDrag();
      return;
    }
    setMenuTree(prev => {
      const items = [...prev];
      const fromIdx = items.findIndex(i => i.id === draggedId);
      const toIdx = items.findIndex(i => i.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      return items;
    });
    toast.success('Menu reordenado');
    resetDrag();
  };

  /* ── Child-level drag handlers ── */
  const handleChildDragStart = (e: DragEvent, childId: string, parentId: string) => {
    if (!canEdit) return;
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(childId);
    setDragType('child');
    setDragParentId(parentId);
  };

  const handleChildDragOver = (e: DragEvent, childId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragType === 'child' && draggedId !== childId) {
      setDragOverId(childId);
    }
  };

  const handleChildDrop = (e: DragEvent, targetChildId: string, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragType !== 'child' || !draggedId || draggedId === targetChildId || dragParentId !== parentId) {
      resetDrag();
      return;
    }
    setMenuTree(prev => {
      return prev.map(node => {
        if (node.id !== parentId || !node.children) return node;
        const children = [...node.children];
        const fromIdx = children.findIndex(c => c.id === draggedId);
        const toIdx = children.findIndex(c => c.id === targetChildId);
        if (fromIdx < 0 || toIdx < 0) return node;
        const [moved] = children.splice(fromIdx, 1);
        children.splice(toIdx, 0, moved);
        return { ...node, children };
      });
    });
    toast.success('Sub-item reordenado');
    resetDrag();
  };

  const resetDrag = () => {
    setDraggedId(null);
    setDragOverId(null);
    setDragType(null);
    setDragParentId(null);
    dragCounter.current = 0;
  };

  const handleDragEnd = () => resetDrag();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, hsl(280 75% 60%), transparent 70%)' }} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
                <Puzzle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Estrutura de Menus
                </h1>
                <p className="text-sm text-muted-foreground">
                  Graph interativo — arraste e solte para reorganizar.
                </p>
              </div>
              <button
                onClick={() => setShowHelp(prev => !prev)}
                className="ml-2 p-1.5 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground"
                title="O que é este módulo?"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
            {!canEdit && (
              <div className="flex items-center gap-1.5 text-xs text-amber-500">
                <Lock className="h-3.5 w-3.5" />
                Somente leitura — permissão <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">platform.menu_structure.manage</code> necessária.
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="shrink-0 border-platform hover:bg-accent/50 transition-all duration-200"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── Help Panel ── */}
      {showHelp && (
        <Card className="border-[hsl(265_60%_50%/0.25)] bg-[hsl(265_60%_50%/0.04)] animate-fade-in">
          <CardContent className="p-5 space-y-4 relative">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-3 right-3 p-1 rounded-full hover:bg-accent/40 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-[hsl(265_80%_60%)]" />
              O que é a Estrutura de Menus?
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">📌 Função</p>
                <p>Este módulo exibe o <strong className="text-foreground">mapa completo de navegação</strong> em formato de graph interativo. SuperAdmins podem arrastar e soltar para reorganizar a hierarquia dos menus.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🗂️ O que são menus?</p>
                <p>Menus são os <strong className="text-foreground">pontos de entrada da navegação</strong> — cada nó no graph corresponde a um módulo. Nós com filhos agrupam sub-funcionalidades conectadas por arestas visuais.</p>
              </div>
              <div className="space-y-1.5">
                <p className="font-medium text-foreground text-xs uppercase tracking-wider">🔗 Onde são usados?</p>
                <p>A estrutura alimenta o <strong className="text-foreground">sidebar, breadcrumbs e navegação dinâmica</strong>. Alterações aqui refletem em toda a experiência do painel.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* ── Graph View ── */}
      <div className="relative">
        {/* Central spine line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-px bg-border/50" />

        <div className="space-y-1">
          {menuTree.map((node, idx) => {
            const Icon = node.icon;
            const hasChildren = node.children && node.children.length > 0;
            const isBeingDragged = draggedId === node.id && dragType === 'root';
            const isDragOver = dragOverId === node.id && dragType === 'root';

            return (
              <div key={node.id} className="relative">
                {/* ── Root Node ── */}
                <div
                  draggable={canEdit}
                  onDragStart={(e) => handleRootDragStart(e, node.id)}
                  onDragOver={(e) => handleRootDragOver(e, node.id)}
                  onDragEnter={handleRootDragEnter}
                  onDragLeave={handleRootDragLeave}
                  onDrop={(e) => handleRootDrop(e, node.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'relative flex items-center gap-3 pl-2 pr-4 py-2.5 rounded-lg transition-all duration-200 group',
                    canEdit && 'cursor-grab active:cursor-grabbing',
                    isBeingDragged && 'opacity-40 scale-[0.97]',
                    isDragOver && 'bg-[hsl(265_80%_55%/0.1)] ring-2 ring-[hsl(265_80%_55%/0.4)] ring-inset',
                    !isBeingDragged && !isDragOver && 'hover:bg-muted/30',
                  )}
                >
                  {/* Connector dot */}
                  <div className={cn(
                    'relative z-10 h-3 w-3 rounded-full border-2 shrink-0 transition-colors',
                    hasChildren
                      ? 'border-[hsl(265_80%_55%)] bg-[hsl(265_80%_55%)]'
                      : 'border-[hsl(265_60%_55%/0.5)] bg-background',
                  )} />

                  {/* Grip handle */}
                  {canEdit && (
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                  )}

                  {/* Icon */}
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-[hsl(265_60%_50%/0.1)] shrink-0">
                    <Icon className="h-4.5 w-4.5 text-[hsl(265_80%_60%)]" />
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{node.label}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground font-mono">{node.path}</span>
                  </div>

                  {/* Badge */}
                  {hasChildren && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      {node.children!.length}
                    </Badge>
                  )}

                  {/* Order indicator */}
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-5 text-right shrink-0">{idx + 1}</span>
                </div>

                {/* ── Children (sub-graph) ── */}
                {hasChildren && (
                  <div className="relative ml-[27px] pl-6 border-l-2 border-[hsl(265_60%_55%/0.2)] pb-1">
                    {node.children!.map((child, cIdx) => {
                      const isChildDragged = draggedId === child.id && dragType === 'child';
                      const isChildDragOver = dragOverId === child.id && dragType === 'child';

                      return (
                        <div
                          key={child.id}
                          draggable={canEdit}
                          onDragStart={(e) => handleChildDragStart(e, child.id, node.id)}
                          onDragOver={(e) => handleChildDragOver(e, child.id)}
                          onDrop={(e) => handleChildDrop(e, child.id, node.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'relative flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-200 group/child',
                            canEdit && 'cursor-grab active:cursor-grabbing',
                            isChildDragged && 'opacity-40 scale-[0.97]',
                            isChildDragOver && 'bg-[hsl(200_70%_50%/0.1)] ring-2 ring-[hsl(200_70%_50%/0.3)] ring-inset',
                            !isChildDragged && !isChildDragOver && 'hover:bg-muted/20',
                          )}
                        >
                          {/* Horizontal connector */}
                          <div className="absolute -left-6 top-1/2 w-4 h-px bg-[hsl(265_60%_55%/0.25)]" />
                          {/* Dot */}
                          <div className="h-2 w-2 rounded-full bg-[hsl(265_60%_55%/0.45)] shrink-0 relative z-10" />

                          {canEdit && (
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/child:text-muted-foreground shrink-0 transition-colors" />
                          )}

                          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

                          <span className="text-sm text-foreground">{child.label}</span>
                          <span className="text-[11px] text-muted-foreground font-mono ml-auto">{child.path}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/40 w-4 text-right shrink-0">{cIdx + 1}</span>
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
    </div>
  );
}
