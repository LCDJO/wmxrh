/**
 * PlatformMenuStructure — Advanced Menu Structure Builder
 *
 * Uses <MenuTreeBuilder /> for the tree UI and MenuPermissionResolver for role-based access.
 */
import {
  Puzzle, RefreshCw, GripVertical, Save, ArrowRight, ArrowLeft,
  AlertTriangle, CheckCircle2, History, GitBranch, Shield, FileDiff, Monitor, Zap, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCallback, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { saveMenuOrder, type SavedMenuOrder } from '@/lib/platform-menu-order';
import {
  createMenuStructureEngine,
  type MenuStructureEngineAPI,
  type MenuEditorRole,
} from '@/domains/menu-structure/menu-structure-engine';
import type { MenuTreeNode, MenuValidationResult, MenuDiff } from '@/domains/menu-structure/types';
import type { NavigationEntry } from '@/domains/platform-os/types';
import { PLATFORM_EVENTS } from '@/domains/platform-os/platform-events';
import { usePlatformOS } from '@/domains/platform-os/platform-context';
import { MenuTreeBuilder } from '@/components/platform/MenuTreeBuilder';
import { MenuDiffViewer } from '@/components/platform/MenuDiffViewer';
import { MenuMobilePreview } from '@/components/platform/MenuMobilePreview';

/* ─── Helpers ─── */
const mn = (
  id: string, label: string, slug: string,
  opts?: Partial<Pick<MenuTreeNode, 'icon' | 'role_permissions' | 'locked' | 'children' | 'visibility_rules'>>,
): MenuTreeNode => ({
  id, label, slug, parent_id: null, order_index: 0, depth_level: 0, role_permissions: [], ...opts,
});

/** Convert MenuTreeNode[] → NavigationEntry[] for NavigationOrchestrator */
function menuTreeToNavigationEntries(nodes: MenuTreeNode[]): NavigationEntry[] {
  return nodes.map((n, i) => ({
    path: n.slug,
    label: n.label,
    icon: n.icon,
    source: 'core' as const,
    required_permissions: n.role_permissions.length > 0 ? n.role_permissions : undefined,
    priority: i,
    children: n.children ? menuTreeToNavigationEntries(n.children) : undefined,
  }));
}

/* ─── Default tree — mirrors NAV_SECTIONS in PlatformLayout.tsx ─── */
const createDefaultTree = (): MenuTreeNode[] => [
  // ── Overview ──
  mn('section-overview', '── OVERVIEW ──', '#', { locked: true }),
  mn('dashboard', 'Dashboard', '/platform/dashboard', { icon: 'LayoutDashboard' }),
  mn('control-plane', 'Control Plane', '/platform/control-plane', { icon: 'Gauge', role_permissions: ['platform_super_admin'] }),

  // ── Gestão ──
  mn('section-gestao', '── GESTÃO ──', '#', { locked: true }),
  mn('tenants', 'Clientes', '/platform/tenants', { icon: 'Building2', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('users', 'Usuários', '/platform/users', { icon: 'Users', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('modules', 'Módulos', '/platform/modules', { icon: 'Puzzle', role_permissions: ['platform_super_admin', 'platform_operations'] }),
  mn('plans', 'Planos', '/platform/plans', { icon: 'Package', role_permissions: ['platform_super_admin', 'platform_finance'] }),

  // ── Segurança ──
  mn('section-seguranca', '── SEGURANÇA ──', '#', { locked: true }),
  mn('security', 'Segurança', '/platform/security', {
    icon: 'ShieldCheck', role_permissions: ['platform_super_admin', 'platform_operations'],
    children: [
      mn('sec-roles', 'Cargos', '/platform/security/roles'),
      mn('sec-perms', 'Permissões', '/platform/security/permissions'),
      mn('sec-graph', 'Access Graph', '/platform/security/access-graph'),
      mn('sec-unified', 'Unified Graph', '/platform/security/unified-graph'),
      mn('sec-gov', 'Governança', '/platform/security/governance'),
      mn('sec-govai', 'Governance AI', '/platform/security/governance-ai'),
    ],
  }),
  mn('federation', 'Federation', '/platform/security/federation', {
    icon: 'Globe', role_permissions: ['platform_super_admin', 'platform_operations'],
    children: [
      mn('fed-idps', 'Identity Providers', '/platform/security/federation/identity-providers'),
      mn('fed-saml', 'SAML Config', '/platform/security/federation/saml-config'),
      mn('fed-oauth', 'OAuth Clients', '/platform/security/federation/oauth-clients'),
      mn('fed-tokens', 'Token Settings', '/platform/security/federation/token-settings'),
      mn('fed-audit', 'Audit Logs', '/platform/security/federation/audit-logs'),
    ],
  }),
  mn('iam', 'IAM', '/platform/iam', { icon: 'KeyRound', role_permissions: ['platform_super_admin'] }),
  mn('audit', 'Auditoria', '/platform/audit', { icon: 'ScrollText', role_permissions: ['platform_super_admin'] }),
  mn('gov-dashboard', 'Governance Dashboard', '/platform/governance-dashboard', { icon: 'BarChart3', role_permissions: ['platform_super_admin'] }),

  // ── Operações ──
  mn('section-operacoes', '── OPERAÇÕES ──', '#', { locked: true }),
  mn('monitoring', 'Monitoramento', '/platform/monitoring', {
    icon: 'Monitor',
    children: [
      mn('mon-status', 'Status', '/platform/monitoring'),
      mn('mon-mods', 'Módulos', '/platform/monitoring/modules'),
      mn('mon-err', 'Erros', '/platform/monitoring/errors'),
      mn('mon-perf', 'Performance', '/platform/monitoring/performance'),
      mn('mon-inc', 'Incidentes', '/platform/monitoring/incidents'),
      mn('mon-live', 'Usuários Online', '/platform/monitoring/live-users'),
      mn('mon-displays', 'Live Displays', '/platform/monitoring/live-displays'),
      mn('mon-sec', 'Alertas Segurança', '/platform/monitoring/security-alerts'),
    ],
  }),
  mn('observability', 'Observabilidade', '/platform/observability', { icon: 'Eye' }),
  mn('automation', 'Automação', '/platform/automation', { icon: 'Zap', role_permissions: ['platform_super_admin'] }),
  mn('ipaas', 'iPaaS Workflows', '/platform/integration-automation', {
    icon: 'Workflow', role_permissions: ['platform_super_admin'],
    children: [
      mn('ipaas-wf', 'Workflows', '/platform/integration-automation'),
      mn('ipaas-tpl', 'Templates', '/platform/integration-automation/templates'),
      mn('ipaas-exec', 'Execution Logs', '/platform/integration-automation/executions'),
      mn('ipaas-sandbox', 'Sandbox Tests', '/platform/integration-automation/sandbox'),
    ],
  }),
  mn('ai-ops', 'AI Operations', '/platform/ai-operations', { icon: 'Brain', role_permissions: ['platform_super_admin'] }),

  // ── Financeiro ──
  mn('section-financeiro', '── FINANCEIRO ──', '#', { locked: true }),
  mn('billing', 'Billing', '/platform/billing', {
    icon: 'Package', role_permissions: ['platform_super_admin', 'platform_finance'],
    children: [
      mn('bill-overview', 'Visão Geral', '/platform/billing'),
      mn('bill-coupons', 'Cupons', '/platform/billing/coupons'),
      mn('bill-cc', 'Control Center', '/platform/billing/control-center'),
    ],
  }),
  mn('revenue', 'Revenue', '/platform/revenue', {
    icon: 'TrendingUp', role_permissions: ['platform_super_admin', 'platform_finance'],
    children: [
      mn('rev-overview', 'Visão Geral', '/platform/revenue'),
      mn('rev-ref', 'Referrals', '/platform/referrals'),
      mn('rev-intel', 'Intelligence', '/platform/revenue/intelligence'),
    ],
  }),
  mn('fiscal', 'Fiscal', '/platform/fiscal', { icon: 'ScrollText', role_permissions: ['platform_super_admin', 'platform_finance'] }),

  // ── Growth & Marketing ──
  mn('section-growth', '── GROWTH & MARKETING ──', '#', { locked: true }),
  mn('growth-ai', 'Growth AI', '/platform/growth', {
    icon: 'Rocket',
    children: [
      mn('growth-overview', 'Visão Geral', '/platform/growth'),
      mn('growth-insights', 'Insights', '/platform/growth/insights'),
      mn('growth-landing', 'Landing Pages', '/platform/growth/landing-pages'),
      mn('growth-conversions', 'Conversões', '/platform/growth/conversions'),
      mn('growth-fab', 'FAB Builder', '/platform/growth/fab-builder'),
      mn('growth-submissions', 'Meus Rascunhos', '/platform/growth/submissions'),
      mn('growth-approvals', 'Aprovações Pendentes', '/platform/growth/approvals'),
      mn('growth-versions', 'Publicadas', '/platform/growth/version-publish'),
    ],
  }),
  mn('marketing', 'Marketing', '/platform/marketing', {
    icon: 'Megaphone',
    children: [
      mn('mkt-analytics', 'Analytics', '/platform/marketing/analytics'),
    ],
  }),
  mn('landing', 'Landing Pages', '/platform/landing', {
    icon: 'BookOpen',
    children: [
      mn('landing-drafts', 'Rascunhos', '/platform/landing/drafts'),
      mn('landing-review', 'Revisão', '/platform/landing/review'),
      mn('landing-pub', 'Publicadas', '/platform/landing/published'),
    ],
  }),

  // ── Canais ──
  mn('section-canais', '── CANAIS ──', '#', { locked: true }),
  mn('website', 'Website', '/platform/website', {
    icon: 'Globe',
    children: [
      mn('web-dash', 'Dashboard', '/platform/website'),
      mn('web-ai', 'AI Designer', '/platform/website/ai-designer'),
      mn('web-tpl', 'Templates', '/platform/website/templates'),
      mn('web-ver', 'Versionamento', '/platform/website/versions'),
    ],
  }),
  mn('comms', 'Comunicação', '/platform/communications', { icon: 'Megaphone' }),

  // ── Developers ──
  mn('section-developers', '── DEVELOPERS ──', '#', { locked: true }),
  mn('apis', 'APIs', '/platform/apis', {
    icon: 'Network', role_permissions: ['platform_super_admin'],
    children: [
      mn('api-clients', 'Clients', '/platform/apis'),
      mn('api-keys', 'Keys', '/platform/apis/keys'),
      mn('api-usage', 'Usage', '/platform/apis/usage'),
      mn('api-rate', 'Rate Limits', '/platform/apis/rate-limits'),
      mn('api-ver', 'Versions', '/platform/apis/versions'),
    ],
  }),
  mn('dev-portal', 'Developer Portal', '/platform/developers', {
    icon: 'Users', role_permissions: ['platform_super_admin'],
    children: [
      mn('dev-devs', 'Developers', '/platform/developers'),
      mn('dev-mkt', 'Marketplace', '/platform/marketplace'),
      mn('dev-review', 'Revisão de Apps', '/platform/apps-review'),
    ],
  }),

  // ── Suporte ──
  mn('section-suporte', '── SUPORTE ──', '#', { locked: true }),
  mn('support', 'Suporte', '/platform/support', {
    icon: 'Headphones',
    children: [
      mn('support-console', 'Console de Suporte', '/platform/support/console'),
      mn('support-analytics', 'Analytics', '/platform/support/analytics'),
    ],
  }),

  // ── Sistema ──
  mn('section-sistema', '── SISTEMA ──', '#', { locked: true }),
  mn('settings', 'Settings', '/platform/settings', {
    icon: 'Settings',
    children: [
      mn('set-saas', 'Parametrizações', '/platform/settings/saas'),
      mn('set-gam', 'Gamificação', '/platform/settings/gamification'),
      mn('set-ver', 'Versionamento', '/platform/settings/versioning'),
      mn('structure', 'Estrutura', '/platform/structure', {
        children: [
          mn('str-events', 'Eventos', '/platform/structure/events'),
          mn('str-menus', 'Menus', '/platform/structure/menus'),
          mn('str-modules', 'Módulos', '/platform/structure/modules'),
          mn('str-dashboards', 'Dashboards', '/platform/structure/dashboards', {
            icon: 'LayoutDashboard',
            children: [
              mn('dash-platform', 'Platform Dashboard', '/platform/dashboard'),
              mn('dash-tenant', 'Cliente Dashboard', '/dashboard'),
              mn('dash-website', 'Website Dashboard', '/platform/website'),
              mn('dash-monitoring', 'Monitoramento Status', '/platform/monitoring'),
              mn('dash-billing', 'Financeiro Overview', '/platform/billing'),
              mn('dash-revenue', 'Revenue Overview', '/platform/revenue'),
              mn('dash-growth', 'Growth AI Overview', '/platform/growth'),
              mn('dash-marketing', 'Marketing Analytics', '/platform/marketing/analytics'),
              mn('dash-gamification', 'Gamificação', '/platform/settings/gamification'),
              mn('dash-labor', 'Labor Compliance', '/labor-dashboard'),
              mn('dash-workforce', 'Workforce Intelligence', '/workforce-intelligence'),
              mn('dash-strategic', 'Strategic Intelligence', '/strategic-intelligence'),
            ],
          }),
        ],
      }),
    ],
  }),
];

const ROLE_OPTIONS: { value: MenuEditorRole; label: string }[] = [
  { value: 'PlatformSuperAdmin', label: 'Super Admin' },
  { value: 'PlatformMarketing', label: 'Marketing' },
  { value: 'PlatformOperations', label: 'Operations' },
  { value: 'TenantAdmin', label: 'Admin Cliente' },
  { value: 'TenantUser', label: 'Usuário Cliente' },
];

/* ═══════════════ Component ═══════════════ */
export default function PlatformMenuStructure() {
  const os = usePlatformOS();

  const [engine] = useState<MenuStructureEngineAPI>(() => createMenuStructureEngine(createDefaultTree()));
  const [tree, setTree] = useState<MenuTreeNode[]>(() => engine.tree.getTree());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState('tree');
  const [validation, setValidation] = useState<MenuValidationResult | null>(null);
  const [editorRole, setEditorRole] = useState<MenuEditorRole>('PlatformSuperAdmin');
  const [diffResult, setDiffResult] = useState<{ diffs: MenuDiff[]; beforeTree: MenuTreeNode[]; afterTree: MenuTreeNode[]; beforeLabel: string; afterLabel: string } | null>(null);
  const [diffVersionA, setDiffVersionA] = useState<string>('');
  const [diffVersionB, setDiffVersionB] = useState<string>('current');

  const flatNodes = useMemo(() => engine.tree.flattenAll(tree), [tree]);
  const totalRoots = tree.length;
  const totalNodes = flatNodes.length;
  const withRoles = flatNodes.filter(n => n.role_permissions && n.role_permissions.length > 0).length;
  const versions = engine.versions.getVersions();

  const syncTree = useCallback(() => {
    setTree(structuredClone(engine.tree.getTree()));
    setHasChanges(true);
  }, [engine]);

  const handleValidate = () => {
    const result = engine.validator.validate(tree);
    setValidation(result); setTab('validation');
    result.valid ? toast.success('Estrutura válida ✓') : toast.error(`${result.errors.length} erro(s)`);
  };

  const handleSave = () => {
    if (!engine.permissions.canEditTree(editorRole)) {
      toast.error('Sem permissão para salvar');
      return;
    }
    const result = engine.validator.validate(tree);
    if (!result.valid) { setValidation(result); setTab('validation'); toast.error('Corrija os erros'); return; }
    setIsSaving(true);
    engine.versions.snapshot(tree, editorRole, `v${(versions[0]?.version ?? 0) + 1}`);
    const order: SavedMenuOrder = {
      rootOrder: tree.map(n => n.slug),
      childrenOrder: tree.reduce((acc, n) => {
        if (n.children && n.children.length > 0) acc[n.slug] = n.children.map(c => c.slug);
        return acc;
      }, {} as Record<string, string[]>),
      savedAt: new Date().toISOString(),
    };
    saveMenuOrder(order);

    // ── Sync with Navigation Intelligence ──
    try {
      const navEntries = menuTreeToNavigationEntries(tree);
      os?.navigation.registerCoreRoutes(navEntries);
    } catch { /* PlatformOS may not be ready */ }

    // ── Observability: emit menu events ──
    const newVersion = (versions[0]?.version ?? 0) + 1;
    try {
      os?.events.emit(PLATFORM_EVENTS.MenuVersionCreated, 'MenuStructure', {
        version_id: `v${newVersion}`,
        version_number: newVersion,
        created_by: editorRole,
        node_count: flatNodes.length,
      });
      os?.events.emit(PLATFORM_EVENTS.MenuStructureUpdated, 'MenuStructure', {
        total_nodes: flatNodes.length,
        root_count: tree.length,
        max_depth: Math.max(...flatNodes.map(n => n.depth_level), 0),
        updated_by: editorRole,
      });
    } catch { /* PlatformOS may not be ready */ }

    setTimeout(() => { setIsSaving(false); setHasChanges(false); toast.success('Salvo & Versionado!'); }, 400);
  };

  const handleRestore = (versionId: string) => {
    const restored = engine.versions.restore(versionId);
    if (!restored) return;
    engine.tree.setTree(restored); syncTree(); toast.success('Versão restaurada');
  };

  const handleAutoFix = () => {
    const { fixed, fixes } = engine.validator.autoFix(tree);
    if (fixes.length === 0) { toast.info('Nenhuma correção necessária'); return; }
    engine.tree.setTree(fixed);
    syncTree();
    const result = engine.validator.validate(engine.tree.getTree());
    setValidation(result);
    toast.success(`${fixes.length} correção(ões) aplicada(s)`);
  };

  const handleAutoFixWarnings = () => {
    const { fixed, fixes } = engine.validator.autoFix(tree, true);
    if (fixes.length === 0) { toast.info('Nenhum aviso corrigível'); return; }
    engine.tree.setTree(fixed);
    syncTree();
    const result = engine.validator.validate(engine.tree.getTree());
    setValidation(result);
    toast.success(`${fixes.length} aviso(s) corrigido(s)`);
  };

  const canSave = engine.permissions.canEditTree(editorRole);

  const handleCompareDiff = () => {
    const vList = engine.versions.getVersions();
    const beforeTree = diffVersionA ? vList.find(v => v.id === diffVersionA)?.tree : vList[vList.length - 1]?.tree;
    const afterTree = diffVersionB === 'current' ? tree : vList.find(v => v.id === diffVersionB)?.tree;
    if (!beforeTree || !afterTree) { toast.error('Selecione versões válidas'); return; }
    const diffs = engine.diff.diff(beforeTree, afterTree);
    const beforeLabel = diffVersionA ? `v${vList.find(v => v.id === diffVersionA)?.version}` : `v${vList[vList.length - 1]?.version ?? '?'}`;
    const afterLabel = diffVersionB === 'current' ? 'Atual' : `v${vList.find(v => v.id === diffVersionB)?.version}`;
    setDiffResult({ diffs, beforeTree, afterTree, beforeLabel, afterLabel });
    setTab('diff');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
                  Arraste ⠿ para reordenar · → tornar filho · ← promover
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Role selector */}
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={editorRole} onValueChange={(v) => setEditorRole(v as MenuEditorRole)}>
                <SelectTrigger className="h-8 text-xs w-[140px] border-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleValidate} className="border-platform hover:bg-accent/50 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />Validar
            </Button>
            {hasChanges && canSave && (
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gradient-platform-accent text-white hover:opacity-90 gap-1.5">
                <Save className={cn('h-3.5 w-3.5', isSaving && 'animate-spin')} />Salvar & Versionar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
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

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 border border-border/40">
          <TabsTrigger value="tree" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Puzzle className="h-3.5 w-3.5" />Árvore
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <History className="h-3.5 w-3.5" />Versões ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />Validação
          </TabsTrigger>
          <TabsTrigger value="diff" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <FileDiff className="h-3.5 w-3.5" />Diff Visual
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Monitor className="h-3.5 w-3.5" />Preview
          </TabsTrigger>
        </TabsList>

        {/* Tree — uses <MenuTreeBuilder /> */}
        <TabsContent value="tree" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <GitBranch className="h-4 w-4" />Hierarquia de Menus
                </CardTitle>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <Shield className="h-2.5 w-2.5" />{engine.permissions.getEditScopeLabel(editorRole)}
                  </Badge>
                  <span className="flex items-center gap-1"><GripVertical className="h-3 w-3" /> Arrastar</span>
                  <span className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /> Indent</span>
                  <span className="flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Outdent</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] pr-2">
                <MenuTreeBuilder
                  tree={tree}
                  treeManager={engine.tree}
                  permissionResolver={engine.permissions}
                  editorRole={editorRole}
                  onTreeChange={syncTree}
                  onItemMoved={(item, fromParent, toParent, newIndex) => {
                    try {
                      os?.events.emit(PLATFORM_EVENTS.MenuItemMoved, 'MenuStructure', {
                        item_id: item.id,
                        item_label: item.label,
                        from_parent: fromParent,
                        to_parent: toParent,
                        new_index: newIndex,
                      });
                    } catch { /* safe */ }
                  }}
                  selectedId={selectedId}
                  onSelectNode={setSelectedId}
                />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Versions */}
        <TabsContent value="versions" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <History className="h-4 w-4" />Histórico de Versões
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Nenhuma versão salva ainda.</p>
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
                        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleRestore(v.id)}>
                          <RefreshCw className="h-3 w-3" />Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validation */}
        <TabsContent value="validation" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4" />Resultado da Validação
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!validation ? (
                <p className="text-sm text-muted-foreground text-center py-12">Clique em "Validar" para verificar.</p>
              ) : (
                <div className="space-y-4">
                  <div className={cn(
                    'flex items-center gap-2 rounded-lg border p-3 text-sm',
                    validation.valid ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-400' : 'border-destructive/30 bg-destructive/8 text-destructive'
                  )}>
                    {validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {validation.valid ? 'Estrutura válida ✓' : `${validation.errors.length} erro(s) encontrado(s).`}
                  </div>
                  {validation.errors.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-destructive uppercase tracking-wider">Erros ({validation.errors.length})</p>
                        <Button variant="outline" size="sm" className="text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleAutoFix}>
                          <Zap className="h-3 w-3" />
                          Corrigir Automaticamente
                        </Button>
                      </div>
                      {validation.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 rounded border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="font-mono">{err.nodeId}</span>
                          <span className="text-foreground/70">{err.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const fixableWarnings = validation.warnings.filter(w => w.type === 'no_permission');
                    const infoWarnings = validation.warnings.filter(w => w.type !== 'no_permission');
                    return (
                      <>
                        {fixableWarnings.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Avisos ({fixableWarnings.length})</p>
                              <Button variant="outline" size="sm" className="text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handleAutoFixWarnings}>
                                <Zap className="h-3 w-3" />
                                Corrigir Avisos
                              </Button>
                            </div>
                            <ScrollArea className="h-[200px]">
                              {fixableWarnings.map((warn, i) => (
                                <div key={i} className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-400 mb-1">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  <span className="font-mono">{warn.nodeId}</span>
                                  <span className="text-foreground/70">{warn.message}</span>
                                </div>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                        {infoWarnings.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Informativos ({infoWarnings.length})</p>
                            <ScrollArea className="h-[200px]">
                              {infoWarnings.map((warn, i) => (
                                <div key={i} className="flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400 mb-1">
                                  <Info className="h-3 w-3 shrink-0" />
                                  <span className="font-mono">{warn.nodeId}</span>
                                  <span className="text-foreground/70">{warn.message}</span>
                                </div>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diff Visual */}
        <TabsContent value="diff" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <FileDiff className="h-4 w-4" />Diff Visual — Antes vs Depois
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Salve pelo menos uma versão para comparar.</p>
              ) : (
                <div className="space-y-4">
                  {/* Version selectors */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Antes</label>
                      <Select value={diffVersionA} onValueChange={setDiffVersionA}>
                        <SelectTrigger className="h-8 text-xs border-border/50">
                          <SelectValue placeholder="Selecione versão..." />
                        </SelectTrigger>
                        <SelectContent>
                          {versions.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              v{v.version} — {v.label ?? new Date(v.createdAt).toLocaleString('pt-BR')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <span className="text-muted-foreground text-xs mt-4">vs</span>
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Depois</label>
                      <Select value={diffVersionB} onValueChange={setDiffVersionB}>
                        <SelectTrigger className="h-8 text-xs border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="current" className="text-xs">Estado atual (não salvo)</SelectItem>
                          {versions.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              v{v.version} — {v.label ?? new Date(v.createdAt).toLocaleString('pt-BR')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCompareDiff} className="mt-4 gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                      <FileDiff className="h-3.5 w-3.5" />Comparar
                    </Button>
                  </div>

                  {/* Diff result */}
                  {diffResult && (
                    <ScrollArea className="h-[450px] pr-2">
                      <MenuDiffViewer
                        diffs={diffResult.diffs}
                        beforeTree={diffResult.beforeTree}
                        afterTree={diffResult.afterTree}
                        beforeLabel={diffResult.beforeLabel}
                        afterLabel={diffResult.afterLabel}
                      />
                    </ScrollArea>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview — Desktop / Mobile */}
        <TabsContent value="preview" className="mt-4">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Monitor className="h-4 w-4" />Preview Responsivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MenuMobilePreview tree={tree} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
