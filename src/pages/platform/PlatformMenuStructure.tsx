/**
 * PlatformMenuStructure — Advanced Menu Structure Builder
 *
 * Hierarchical drag-and-drop tree editor with:
 * - Indent/outdent (level changes)
 * - Role-based permission per node
 * - Automatic version snapshots
 * - Diff viewer between versions
 * - Layout validation
 */
import {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText,
  Zap, Users, Package, Megaphone, KeyRound, Activity, Monitor,
  TrendingUp, RefreshCw, HelpCircle, X, GripVertical, Lock,
  ChevronRight, ChevronDown, Save, ChevronUp, ArrowRight, ArrowLeft,
  Shield, AlertTriangle, CheckCircle2, History, GitBranch, Eye,
  Rocket, Globe, Settings, Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCallback, useRef, useState, useMemo, type DragEvent } from 'react';
import { toast } from 'sonner';
import { saveMenuOrder, type SavedMenuOrder } from '@/lib/platform-menu-order';
import {
  createMenuStructureEngine,
  type MenuStructureEngineAPI,
} from '@/domains/menu-structure/menu-structure-engine';
import type { MenuTreeNode, MenuDiff, MenuValidationResult, MenuVersion } from '@/domains/menu-structure/types';

/* ─── Icon map ─── */
const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, Building2, Puzzle, ShieldCheck, ScrollText,
  Zap, Users, Package, Megaphone, KeyRound, Activity, Monitor,
  TrendingUp, Rocket, Globe, Settings, Shield, GitBranch,
};

const getIcon = (key?: string) => ICON_MAP[key ?? ''] ?? Puzzle;

/* ─── Helper to create a MenuTreeNode ─── */
const mn = (
  id: string,
  label: string,
  slug: string,
  opts?: Partial<Pick<MenuTreeNode, 'icon' | 'role_permissions' | 'locked' | 'children' | 'visibility_rules'>>,
): MenuTreeNode => ({
  id,
  label,
  slug,
  parent_id: null,
  order_index: 0,
  depth_level: 0,
  role_permissions: [],
  ...opts,
});

/* ─── Default tree ─── */
const createDefaultTree = (): MenuTreeNode[] => [
  mn('dashboard', 'Dashboard', '/platform/dashboard', { icon: 'LayoutDashboard' }),
  mn('tenants', 'Tenants', '/platform/tenants', { icon: 'Building2', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('modules', 'Módulos', '/platform/modules', { icon: 'Puzzle', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('plans', 'Planos', '/platform/plans', { icon: 'Package', role_permissions: ['platform_super_admin', 'platform_finance'] }),
  mn('users', 'Usuários', '/platform/users', { icon: 'Users', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('security', 'Segurança', '/platform/security', {
    icon: 'ShieldCheck',
    role_permissions: ['platform_super_admin', 'platform_operations'],
    children: [
      mn('sec-roles', 'Cargos', '/platform/security/roles'),
      mn('sec-perms', 'Permissões', '/platform/security/permissions'),
      mn('sec-graph', 'Access Graph', '/platform/security/access-graph'),
      mn('sec-unified', 'Unified Graph', '/platform/security/unified-graph'),
      mn('sec-gov', 'Governança', '/platform/security/governance'),
      mn('sec-govai', 'Governance AI', '/platform/security/governance-ai'),
    ],
  }),
  mn('iam', 'IAM', '/platform/iam', { icon: 'KeyRound', role_permissions: ['platform_super_admin'] }),
  mn('automation', 'Automação', '/platform/automation', { icon: 'Zap', role_permissions: ['platform_super_admin'] }),
  mn('monitoring', 'Monitoramento', '/platform/monitoring', {
    icon: 'Monitor',
    children: [
      mn('mon-status', 'Status', '/platform/monitoring'),
      mn('mon-mods', 'Módulos', '/platform/monitoring/modules'),
      mn('mon-err', 'Erros', '/platform/monitoring/errors'),
      mn('mon-perf', 'Performance', '/platform/monitoring/performance'),
      mn('mon-inc', 'Incidentes', '/platform/monitoring/incidents'),
    ],
  }),
  mn('observability', 'Observability', '/platform/observability', { icon: 'Activity' }),
  mn('comms', 'Comunicação', '/platform/communications', { icon: 'Megaphone' }),
  mn('audit', 'Auditoria', '/platform/audit', { icon: 'ScrollText' }),
  mn('billing', 'Financeiro', '/platform/billing', {
    icon: 'Package',
    role_permissions: ['platform_super_admin', 'platform_finance'],
    children: [
      mn('bill-overview', 'Visão Geral', '/platform/billing'),
      mn('bill-coupons', 'Cupons', '/platform/billing/coupons'),
      mn('bill-cc', 'Control Center', '/platform/billing/control-center'),
    ],
  }),
  mn('revenue', 'Revenue', '/platform/revenue', {
    icon: 'TrendingUp',
    children: [
      mn('rev-overview', 'Visão Geral', '/platform/revenue'),
      mn('rev-ref', 'Referrals', '/platform/referrals'),
      mn('rev-gam', 'Gamificação', '/platform/gamification'),
      mn('rev-intel', 'Intelligence', '/platform/revenue/intelligence'),
    ],
  }),
  mn('growth-ai', 'Growth AI', '/platform/growth', {
    icon: 'Rocket',
    children: [
      mn('growth-overview', 'Visão Geral', '/platform/growth'),
      mn('growth-insights', 'Insights', '/platform/growth/insights'),
      mn('growth-landing', 'Landing Pages', '/platform/growth/landing-pages'),
      mn('growth-conversions', 'Conversões', '/platform/growth/conversions'),
      mn('growth-fab', 'FAB Builder', '/platform/growth/fab-builder'),
      mn('growth-submissions', 'Meus Rascunhos', '/platform/growth/submissions'),
      mn('growth-approvals', 'Aprovações', '/platform/growth/approvals'),
      mn('growth-versions', 'Versionamento & Publicação', '/platform/growth/version-publish'),
      mn('growth-mkt', 'Marketing Analytics', '/platform/marketing/analytics'),
    ],
  }),
  mn('website', 'Website', '/platform/website', {
    icon: 'Globe',
    children: [
      mn('web-dash', 'Dashboard', '/platform/website'),
      mn('web-ai', 'AI Designer', '/platform/website/ai-designer'),
      mn('web-tpl', 'Templates', '/platform/website/templates'),
      mn('web-ver', 'Versionamento', '/platform/website/versions'),
    ],
  }),
  mn('fiscal', 'Fiscal', '/platform/fiscal', { icon: 'ScrollText' }),
  mn('settings', 'Settings', '/platform/settings', {
    icon: 'Settings',
    children: [
      mn('set-ver', 'Versionamento', '/platform/settings/versioning'),
      mn('structure', 'Estrutura', '/platform/structure', {
        children: [
          mn('str-events', 'Eventos', '/platform/structure/events'),
          mn('str-menus', 'Menus', '/platform/structure/menus'),
          mn('str-modules', 'Módulos', '/platform/structure/modules'),
        ],
      }),
    ],
  }),
];

/* ─── Component ─── */
export default function PlatformMenuStructure() {
  const canEdit = true; // gated by route guard
  const [engine] = useState<MenuStructureEngineAPI>(() => createMenuStructureEngine(createDefaultTree()));
  const [tree, setTree] = useState<MenuTreeNode[]>(() => engine.tree.getTree());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    const walk = (nodes: MenuTreeNode[]) => {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          expanded.add(n.id);
          walk(n.children);
        }
      }
    };
    walk(createDefaultTree());
    return expanded;
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState('tree');
  const [validation, setValidation] = useState<MenuValidationResult | null>(null);

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const flatNodes = useMemo(() => engine.tree.flattenAll(tree), [tree]);
  const totalRoots = tree.length;
  const totalNodes = flatNodes.length;
  const withRoles = flatNodes.filter(n => n.role_permissions && n.role_permissions.length > 0).length;

  const versions = engine.versions.getVersions();

  // ─── Sync engine ───
  const syncTree = useCallback(() => {
    const newTree = structuredClone(engine.tree.getTree());
    setTree(newTree);
    setHasChanges(true);
  }, [engine]);

  // ─── Actions ───
  const handleMoveUp = (id: string) => {
    const parent = engine.tree.findParent(id);
    const siblings = parent?.children ?? engine.tree.getTree();
    const idx = siblings.findIndex(n => n.id === id);
    if (idx <= 0) return;
    engine.tree.moveNode(id, parent?.id ?? null, idx - 1);
    syncTree();
  };

  const handleMoveDown = (id: string) => {
    const parent = engine.tree.findParent(id);
    const siblings = parent?.children ?? engine.tree.getTree();
    const idx = siblings.findIndex(n => n.id === id);
    if (idx < 0 || idx >= siblings.length - 1) return;
    engine.tree.moveNode(id, parent?.id ?? null, idx + 2);
    syncTree();
  };

  const handleIndentRight = (id: string) => {
    engine.tree.demoteNode(id);
    syncTree();
    toast.success('Nível aumentado');
  };

  const handleIndentLeft = (id: string) => {
    engine.tree.promoteNode(id);
    syncTree();
    toast.success('Nível reduzido');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleValidate = () => {
    const result = engine.validator.validate(tree);
    setValidation(result);
    setTab('validation');
    if (result.valid) toast.success('Estrutura válida ✓');
    else toast.error(`${result.errors.length} erro(s) encontrado(s)`);
  };

  const handleSave = () => {
    const result = engine.validator.validate(tree);
    if (!result.valid) {
      setValidation(result);
      setTab('validation');
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setIsSaving(true);
    engine.versions.snapshot(tree, 'admin', `v${(versions[0]?.version ?? 0) + 1}`);

    // Persist for sidebar
    const order: SavedMenuOrder = {
      rootOrder: tree.map(n => n.slug),
      childrenOrder: tree.reduce((acc, n) => {
        if (n.children && n.children.length > 0) {
          acc[n.slug] = n.children.map(c => c.slug);
        }
        return acc;
      }, {} as Record<string, string[]>),
      savedAt: new Date().toISOString(),
    };
    saveMenuOrder(order);

    setTimeout(() => {
      setIsSaving(false);
      setHasChanges(false);
      toast.success('Estrutura salva e versionada!');
    }, 400);
  };

  const handleRestore = (versionId: string) => {
    const restored = engine.versions.restore(versionId);
    if (!restored) return;
    engine.tree.setTree(restored);
    syncTree();
    toast.success('Versão restaurada');
  };

  // ─── Drag handlers ───
  const handleDragStart = (e: DragEvent, id: string) => {
    if (!canEdit) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== id) setDragOverId(id);
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) setDragOverId(null);
  };

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    if (!draggedId || draggedId === targetId) {
      resetDrag();
      return;
    }

    const targetParent = engine.tree.findParent(targetId);
    const targetSiblings = targetParent?.children ?? engine.tree.getTree();
    const targetIdx = targetSiblings.findIndex(n => n.id === targetId);

    engine.tree.moveNode(draggedId, targetParent?.id ?? null, targetIdx);
    syncTree();
    toast.success('Menu movido');
    resetDrag();
  };

  const handleDropInto = (e: DragEvent, parentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    if (!draggedId || draggedId === parentId) {
      resetDrag();
      return;
    }
    const parent = engine.tree.findNode(parentId);
    engine.tree.moveNode(draggedId, parentId, parent?.children?.length ?? 0);
    syncTree();
    toast.success('Movido como filho');
    resetDrag();
  };

  const resetDrag = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = 0;
  };

  // ─── Recursive tree renderer ───
  const renderNode = (node: MenuTreeNode, depth: number, index: number, siblings: MenuTreeNode[]) => {
    const Icon = getIcon(node.icon);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isDragged = draggedId === node.id;
    const isDragOver = dragOverId === node.id;
    const isFirst = index === 0;
    const isLast = index === siblings.length - 1;

    return (
      <div key={node.id} className="select-none">
        <div
          draggable={canEdit && !node.locked}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={resetDrag}
          onClick={() => setSelectedId(isSelected ? null : node.id)}
          className={cn(
            'group flex items-center gap-2 py-2 px-3 rounded-lg transition-all duration-150 cursor-pointer',
            isDragged && 'opacity-30 scale-[0.97]',
            isDragOver && 'ring-2 ring-primary/50 bg-primary/5',
            isSelected && !isDragOver && 'bg-primary/10 ring-1 ring-primary/30',
            !isSelected && !isDragOver && !isDragged && 'hover:bg-muted/40',
          )}
          style={{ marginLeft: depth * 24 }}
        >
          {/* Grip */}
          {canEdit && !node.locked && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing" />
          )}
          {node.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}

          {/* Expand toggle */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
              className="p-0.5 rounded hover:bg-muted/60 shrink-0"
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              }
            </button>
          ) : (
            <div className="w-[18px]" />
          )}

          {/* Icon */}
          <div className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
            depth === 0 ? 'bg-primary/10' : depth === 1 ? 'bg-accent/40' : 'bg-muted/40',
          )}>
            <Icon className={cn('h-3.5 w-3.5', depth === 0 ? 'text-primary' : 'text-muted-foreground')} />
          </div>

          {/* Label & slug */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-medium truncate', depth === 0 ? 'font-semibold text-foreground' : 'text-foreground/80')}>
                {node.label}
              </span>
              {node.locked && (
                <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10">
                  locked
                </Badge>
              )}
              {node.role_permissions && node.role_permissions.length > 0 && (
                <Badge variant="outline" className="text-[9px] border-primary/30 text-primary/70 gap-0.5">
                  <Shield className="h-2.5 w-2.5" />
                  {node.role_permissions.length}
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono block truncate">{node.slug}</span>
          </div>

          {/* Depth badge */}
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
            L{depth}
          </Badge>

          {/* Action buttons (visible on hover or selected) */}
          {canEdit && isSelected && (
            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleMoveUp(node.id)}
                disabled={isFirst}
                className="p-1 rounded hover:bg-muted/60 disabled:opacity-20"
                title="Mover para cima"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleMoveDown(node.id)}
                disabled={isLast}
                className="p-1 rounded hover:bg-muted/60 disabled:opacity-20"
                title="Mover para baixo"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleIndentRight(node.id)}
                className="p-1 rounded hover:bg-muted/60"
                title="Aumentar nível (tornar filho)"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleIndentLeft(node.id)}
                disabled={depth === 0}
                className="p-1 rounded hover:bg-muted/60 disabled:opacity-20"
                title="Reduzir nível (promover)"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Children count */}
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground shrink-0">{node.children!.length}</span>
          )}
        </div>

        {/* Drop zone into parent */}
        {hasChildren && isExpanded && draggedId && draggedId !== node.id && (
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => handleDropInto(e, node.id)}
            className="mx-4 my-0.5 h-6 rounded border border-dashed border-primary/30 flex items-center justify-center text-[10px] text-primary/50 hover:bg-primary/5 transition-colors"
            style={{ marginLeft: (depth + 1) * 24 + 16 }}
          >
            Soltar como filho de {node.label}
          </div>
        )}

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child, cIdx) => renderNode(child, depth + 1, cIdx, node.children!))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-xl gradient-platform-surface border border-platform p-6">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, hsl(265 80% 55%), transparent 70%)' }} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg gradient-platform-accent shadow-platform">
                <Puzzle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  Advanced Menu Structure Builder
                </h1>
                <p className="text-sm text-muted-foreground">
                  Editor hierárquico com drag & drop, versionamento e segurança por roles.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              className="border-platform hover:bg-accent/50 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Validar
            </Button>
            {hasChanges && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="gradient-platform-accent text-white hover:opacity-90 gap-1.5"
              >
                <Save className={cn('h-3.5 w-3.5', isSaving && 'animate-spin')} />
                Salvar & Versionar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Nós Raiz', value: totalRoots, color: 'hsl(265 80% 55%)' },
          { label: 'Total de Nós', value: totalNodes, color: 'hsl(200 70% 50%)' },
          { label: 'Com Roles', value: withRoles, color: 'hsl(145 60% 42%)' },
          { label: 'Versões', value: versions.length, color: 'hsl(35 80% 50%)' },
        ].map(s => (
          <Card key={s.label} className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <span className="text-base font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 border border-border/40">
          <TabsTrigger value="tree" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Puzzle className="h-3.5 w-3.5" />
            Árvore
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <History className="h-3.5 w-3.5" />
            Versões ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Validação
          </TabsTrigger>
        </TabsList>

        {/* ── Tree Tab ── */}
        <TabsContent value="tree" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  Hierarquia de Menus
                </CardTitle>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><GripVertical className="h-3 w-3" /> Arrastar</span>
                  <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Indent</span>
                  <span className="flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Outdent</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-0.5">
                  {tree.map((node, idx) => renderNode(node, 0, idx, tree))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Versions Tab ── */}
        <TabsContent value="versions" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <History className="h-4 w-4" />
                Histórico de Versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Nenhuma versão salva ainda. Faça alterações e clique em "Salvar & Versionar".
                </p>
              ) : (
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {versions.map(v => (
                      <div key={v.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">v{v.version}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{v.label ?? `Versão ${v.version}`}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(v.createdAt).toLocaleString('pt-BR')} · {v.createdBy} · {v.tree.length} raízes
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleRestore(v.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Validation Tab ── */}
        <TabsContent value="validation" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />
                Resultado da Validação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!validation ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Clique em "Validar" para verificar a estrutura.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Status */}
                  <div className={cn(
                    'flex items-center gap-2 rounded-lg border p-3 text-sm',
                    validation.valid
                      ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400'
                      : 'border-destructive/30 bg-destructive/8 text-destructive'
                  )}>
                    {validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {validation.valid
                      ? 'Estrutura válida — nenhum erro encontrado.'
                      : `${validation.errors.length} erro(s) encontrado(s).`
                    }
                  </div>

                  {/* Errors */}
                  {validation.errors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Erros</p>
                      {validation.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 rounded border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{err.nodeId}</span>
                          <span className="text-foreground/70">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {validation.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Avisos ({validation.warnings.length})</p>
                      <ScrollArea className="h-[200px]">
                        {validation.warnings.map((warn, i) => (
                          <div key={i} className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-400 mb-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="font-mono">{warn.nodeId}</span>
                            <span className="text-foreground/70">{warn.message}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
