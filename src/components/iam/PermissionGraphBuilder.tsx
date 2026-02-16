/**
 * Permission Graph Builder — Interactive node-based graph with drag-and-drop
 *
 * Nodes: RoleNode, PermissionNode, ScopeNode, ResourceNode
 * Edges: grants_access, inherits_role, scoped_to
 *
 * Features:
 *   - Drag-and-drop node repositioning
 *   - Animated edge flow particles
 *   - Hover highlighting with connection tracing
 *   - Zoom/pan canvas controls
 *   - Click to inspect node details
 *   - Role-based focus filtering
 *   - Grid snapping on drop
 *
 * Pure visualization — no security logic lives here.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield, Users, Building2, Key, Network, Eye, Layers,
  ZoomIn, ZoomOut, Maximize2, Lock, Move, GripVertical,
  Briefcase, DollarSign, ShieldCheck, Heart, Send, ScrollText,
  Brain, GraduationCap, AlertTriangle, Calculator,
  ChevronDown, ChevronRight, Search, Library,
  Check, X, Scan,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ══════════════════════════════════
// TYPES
// ══════════════════════════════════

type GraphNodeType = 'role' | 'permission' | 'scope' | 'resource';
type EdgeType = 'grants_access' | 'inherits_role' | 'scoped_to';

interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  meta?: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
}

// ══════════════════════════════════
// CONSTANTS
// ══════════════════════════════════

const NODE_STYLES: Record<GraphNodeType, { bg: string; border: string; text: string; icon: string; hoverBorder: string; glow: string }> = {
  role:       { bg: 'hsl(var(--primary)/0.08)',           border: 'hsl(var(--primary)/0.25)',           text: 'hsl(var(--primary))',           icon: 'text-primary',           hoverBorder: 'hsl(var(--primary)/0.7)',    glow: 'hsl(var(--primary)/0.15)' },
  permission: { bg: 'hsl(var(--info)/0.06)',              border: 'hsl(var(--info)/0.2)',               text: 'hsl(var(--info))',              icon: 'text-info',              hoverBorder: 'hsl(var(--info)/0.6)',       glow: 'hsl(var(--info)/0.12)' },
  scope:      { bg: 'hsl(var(--warning)/0.06)',           border: 'hsl(var(--warning)/0.2)',            text: 'hsl(var(--warning))',           icon: 'text-warning',           hoverBorder: 'hsl(var(--warning)/0.6)',    glow: 'hsl(var(--warning)/0.12)' },
  resource:   { bg: 'hsl(var(--accent-foreground)/0.06)', border: 'hsl(var(--accent-foreground)/0.18)', text: 'hsl(var(--accent-foreground))', icon: 'text-accent-foreground', hoverBorder: 'hsl(var(--accent-foreground)/0.5)', glow: 'hsl(var(--accent-foreground)/0.1)' },
};

const EDGE_STYLES: Record<EdgeType, { color: string; dash?: string; width: number }> = {
  grants_access: { color: 'hsl(var(--primary)/0.45)', width: 1.8 },
  inherits_role: { color: 'hsl(var(--warning)/0.45)', width: 1.8 },
  scoped_to:     { color: 'hsl(var(--info)/0.35)',    width: 1.5, dash: '6,4' },
};

const EDGE_LABELS: Record<EdgeType, string> = {
  grants_access: 'concede acesso',
  inherits_role: 'herda papel',
  scoped_to: 'escopo',
};

const RES_ICONS: Record<string, typeof Users> = {
  employees: Users, companies: Building2, company: Building2,
  departments: Briefcase, positions: Briefcase, salary: DollarSign,
  benefits: ShieldCheck, health: Heart, esocial: Send, audit: ScrollText,
  iam: Lock, intelligence: Brain, agreements: ScrollText,
  training: GraduationCap, risk: AlertTriangle, payroll: Calculator, user: Users,
};

const RES_LABELS: Record<string, string> = {
  employees: 'Funcionários', companies: 'Empresas', company: 'Empresa',
  departments: 'Departamentos', positions: 'Cargos', salary: 'Salário',
  benefits: 'Benefícios', health: 'Saúde', esocial: 'eSocial',
  audit: 'Auditoria', iam: 'Acesso (IAM)', intelligence: 'Inteligência',
  agreements: 'Termos', training: 'Treinamentos', risk: 'Riscos',
  payroll: 'Folha', user: 'Usuários',
};

const SCOPE_LBL: Record<string, string> = { tenant: 'Tenant', company_group: 'Grupo', company: 'Empresa' };

// ══════════════════════════════════
// PERMISSION LIBRARY — Domain grouping
// ══════════════════════════════════

type PermDomain = 'HR' | 'Compensation' | 'Tenant' | 'Reporting' | 'Security' | 'Compliance' | 'Health';

const RESOURCE_TO_DOMAIN: Record<string, PermDomain> = {
  employees: 'HR', departments: 'HR', positions: 'HR',
  salary: 'Compensation', benefits: 'Compensation', payroll: 'Compensation',
  companies: 'Tenant', company: 'Tenant', tenant: 'Tenant',
  audit: 'Reporting', intelligence: 'Reporting',
  iam: 'Security', user: 'Security', agreements: 'Security',
  health: 'Health', training: 'Health', risk: 'Compliance',
  esocial: 'Compliance',
};

const DOMAIN_META: Record<PermDomain, { icon: typeof Users; color: string }> = {
  HR:           { icon: Users,          color: 'text-primary' },
  Compensation: { icon: DollarSign,     color: 'text-warning' },
  Tenant:       { icon: Building2,      color: 'text-info' },
  Reporting:    { icon: Brain,          color: 'text-accent-foreground' },
  Security:     { icon: Lock,           color: 'text-destructive' },
  Compliance:   { icon: ShieldCheck,    color: 'text-muted-foreground' },
  Health:       { icon: Heart,          color: 'text-primary' },
};

const NODE_W = 190;
const NODE_H = 60;
const GRID = 10;

const snap = (v: number) => Math.round(v / GRID) * GRID;

// ══════════════════════════════════
// GRAPH BUILD
// ══════════════════════════════════

function buildGraph(
  roles: CustomRole[],
  permissions: PermissionDefinition[],
  assignments: UserCustomRole[],
  rolePermMap: Map<string, string[]>,
  focusRoleId: string | null,
  scopeFilter: 'all' | 'tenant' | 'company_group' | 'company' = 'all',
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const add = (n: GraphNode) => { if (!seen.has(n.id)) { nodes.push(n); seen.add(n.id); } };

  const visibleRoles = focusRoleId ? roles.filter(r => r.id === focusRoleId) : roles;

  // Roles — center
  visibleRoles.forEach((role, i) => {
    add({ id: `role:${role.id}`, type: 'role', label: role.name, sublabel: role.is_system ? 'Sistema' : 'Custom', x: 420, y: 60 + i * 110, meta: { roleId: role.id, isSystem: role.is_system } });
  });

  // Scopes — left
  const scopeSet = new Map<string, { type: string; id: string | null }>();
  assignments.forEach(a => {
    if (focusRoleId && a.role_id !== focusRoleId) return;
    if (scopeFilter !== 'all' && a.scope_type !== scopeFilter) return;
    const key = `${a.scope_type}:${a.scope_id || 'all'}`;
    scopeSet.set(key, { type: a.scope_type, id: a.scope_id });
    edges.push({ id: `se:${a.role_id}:${key}`, from: `role:${a.role_id}`, to: `scope:${key}`, type: 'scoped_to' });
  });

  let si = 0;
  scopeSet.forEach((scope, key) => {
    add({ id: `scope:${key}`, type: 'scope', label: SCOPE_LBL[scope.type] || scope.type, sublabel: scope.id ? scope.id.slice(0, 8) + '…' : 'Global', x: 60, y: 60 + si * 100, meta: { scopeType: scope.type, scopeId: scope.id } });
    si++;
  });

  // Resources & Permissions — right
  const resSet = new Set<string>();
  const permSet = new Set<string>();

  visibleRoles.forEach(role => {
    const pids = rolePermMap.get(role.id) || [];
    const rPerms = permissions.filter(p => pids.includes(p.id));
    const byRes = new Map<string, PermissionDefinition[]>();
    rPerms.forEach(p => { if (!byRes.has(p.resource)) byRes.set(p.resource, []); byRes.get(p.resource)!.push(p); });

    byRes.forEach((perms, resource) => {
      resSet.add(resource);
      edges.push({ id: `ga:${role.id}:${resource}`, from: `role:${role.id}`, to: `resource:${resource}`, type: 'grants_access', label: `${perms.length} ações` });

      if (focusRoleId) {
        perms.forEach(p => {
          const pid = `perm:${p.id}`;
          permSet.add(pid);
          edges.push({ id: `pe:${resource}:${p.id}`, from: `resource:${resource}`, to: pid, type: 'grants_access' });
        });
      }
    });
  });

  let ri = 0;
  resSet.forEach(resource => {
    add({ id: `resource:${resource}`, type: 'resource', label: RES_LABELS[resource] || resource, sublabel: resource, x: 760, y: 40 + ri * 72, meta: { resource } });
    ri++;
  });

  if (focusRoleId) {
    let pi = 0;
    permSet.forEach(pid => {
      const id = pid.replace('perm:', '');
      const perm = permissions.find(p => p.id === id);
      if (!perm) return;
      add({ id: pid, type: 'permission', label: perm.name, sublabel: `${perm.resource}.${perm.action}`, x: 1080, y: 40 + pi * 52, meta: { permId: id, action: perm.action, resource: perm.resource } });
      pi++;
    });
  }

  // Deduplicate edges
  const eSet = new Set<string>();
  return { nodes, edges: edges.filter(e => { if (eSet.has(e.id)) return false; eSet.add(e.id); return true; }) };
}

// ══════════════════════════════════
// COMPONENT
// ══════════════════════════════════

interface Props {
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
}

export function PermissionGraphBuilder({ members, assignments, roles, permissions, tenantId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Drag state
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusRoleId, setFocusRoleId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'tenant' | 'company_group' | 'company'>('all');

  // Load role permissions
  const roleIds = roles.map(r => r.id);
  const { data: allRolePerms = [] } = useQuery({
    queryKey: ['iam_graph_role_perms', tenantId],
    queryFn: async () => {
      const results = await Promise.all(roleIds.map(id => identityGateway.getPermissionsMatrix({ role_id: id })));
      return roleIds.map((id, i) => ({ roleId: id, perms: results[i] }));
    },
    enabled: roleIds.length > 0,
  });

  const rolePermMap = useMemo(() => {
    const map = new Map<string, string[]>();
    allRolePerms.forEach(rp => map.set(rp.roleId, rp.perms.map(p => p.permission_id)));
    return map;
  }, [allRolePerms]);

  // Build graph (base positions)
  const baseGraph = useMemo(
    () => buildGraph(roles, permissions, assignments, rolePermMap, focusRoleId, scopeFilter),
    [roles, permissions, assignments, rolePermMap, focusRoleId, scopeFilter]
  );

  // Apply drag offsets to nodes
  const nodes = useMemo(() => baseGraph.nodes.map(n => {
    const pos = nodePositions.get(n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : n;
  }), [baseGraph.nodes, nodePositions]);

  const edges = baseGraph.edges;

  // Connected sets for highlighting
  const activeId = hoveredNodeId || selectedNodeId;

  const connectedEdgeIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    return new Set(edges.filter(e => e.from === activeId || e.to === activeId).map(e => e.id));
  }, [activeId, edges]);

  const connectedNodeIds = useMemo(() => {
    if (!activeId) return new Set<string>();
    const ids = new Set<string>([activeId]);
    edges.forEach(e => { if (e.from === activeId) ids.add(e.to); if (e.to === activeId) ids.add(e.from); });
    return ids;
  }, [activeId, edges]);

  // Selected node detail
  const selectedInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;
    const nodeEdges = edges.filter(e => e.from === node.id || e.to === node.id);
    const connIds = new Set<string>();
    nodeEdges.forEach(e => connIds.add(e.from === node.id ? e.to : e.from));
    return { node, edges: nodeEdges, connectedNodes: nodes.filter(n => connIds.has(n.id)) };
  }, [selectedNodeId, nodes, edges]);

  // Viewport
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 1200 600';
    const maxX = Math.max(...nodes.map(n => n.x)) + NODE_W + 80;
    const maxY = Math.max(...nodes.map(n => n.y)) + NODE_H + 80;
    return `0 0 ${Math.max(maxX, 1200)} ${Math.max(maxY, 600)}`;
  }, [nodes]);

  // ── Canvas Handlers ──

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Check if over a drag handle
    const handle = (e.target as HTMLElement).closest('[data-drag-handle]');
    if (handle) {
      const nodeId = handle.getAttribute('data-drag-handle')!;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const svgPt = getSvgPoint(e.clientX, e.clientY);
      dragOffsetRef.current = { x: svgPt.x - node.x, y: svgPt.y - node.y };
      setDragNodeId(nodeId);
      e.preventDefault();
      return;
    }
    // Otherwise start panning
    if (!(e.target as HTMLElement).closest('[data-node]')) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [nodes, getSvgPoint, pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNodeId) {
      const svgPt = getSvgPoint(e.clientX, e.clientY);
      const newX = snap(svgPt.x - dragOffsetRef.current.x);
      const newY = snap(svgPt.y - dragOffsetRef.current.y);
      setNodePositions(prev => {
        const next = new Map(prev);
        next.set(dragNodeId, { x: Math.max(0, newX), y: Math.max(0, newY) });
        return next;
      });
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
    }
  }, [dragNodeId, isPanning, getSvgPoint]);

  const handleCanvasMouseUp = useCallback(() => {
    setDragNodeId(null);
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 3));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNodePositions(new Map());
  }, []);

  // Node icon helper
  const getIcon = (node: GraphNode) => {
    switch (node.type) {
      case 'role': return node.meta?.isSystem ? Lock : Shield;
      case 'scope': return Building2;
      case 'resource': return RES_ICONS[node.meta?.resource as string] || Layers;
      case 'permission': return Key;
      default: return Layers;
    }
  };

  if (roles.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>Nenhum cargo configurado para visualizar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Permission Graph
          </h2>
          <p className="text-sm text-muted-foreground">
            Arraste os nós para reorganizar • Clique para inspecionar • Scroll para zoom
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.15, 3))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.15, 0.25))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="outline" className="text-[10px] font-mono ml-1">{Math.round(zoom * 100)}%</Badge>
        </div>
      </div>

      {/* Filters: Role chips + Scope selector */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Role filter chips */}
        <div className="flex flex-wrap gap-1.5 flex-1">
          <button
            onClick={() => { setFocusRoleId(null); setNodePositions(new Map()); setSelectedNodeId(null); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              !focusRoleId ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            Todos os cargos
          </button>
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => { setFocusRoleId(prev => prev === r.id ? null : r.id); setNodePositions(new Map()); setSelectedNodeId(null); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5",
                focusRoleId === r.id ? "bg-primary/10 border-primary/30 text-primary shadow-sm" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {r.is_system ? <Lock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              {r.name}
            </button>
          ))}
        </div>

        {/* Scope Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">Escopo:</span>
          <Select value={scopeFilter} onValueChange={(v) => { setScopeFilter(v as typeof scopeFilter); setNodePositions(new Map()); }}>
            <SelectTrigger className="h-8 w-[160px] text-xs bg-card border-border/50">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border shadow-lg z-50">
              <SelectItem value="all" className="text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Todos os escopos</span>
                </div>
              </SelectItem>
              <SelectItem value="tenant" className="text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-warning" />
                  <span>Tenant</span>
                </div>
              </SelectItem>
              <SelectItem value="company_group" className="text-xs">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-info" />
                  <span>Group</span>
                </div>
              </SelectItem>
              <SelectItem value="company" className="text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>Company</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Permission Library + Canvas + Panel */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr_280px]">
        {/* ── Permission Library ── */}
        <PermissionLibraryPanel permissions={permissions} rolePermMap={rolePermMap} focusRoleId={focusRoleId} onSelectPermission={(permId) => setSelectedNodeId(`perm:${permId}`)} />
        <Card className="overflow-hidden border-border/50">
          <div
            ref={containerRef}
            className={cn(
              "relative select-none",
              dragNodeId ? "cursor-grabbing" : isPanning ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{ height: '68vh', minHeight: 460, background: 'repeating-conic-gradient(hsl(var(--muted)/0.15) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
          >
            <svg
              viewBox={viewBox}
              className="w-full h-full"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: '0 0',
              }}
            >
              <defs>
                {/* Animated flow gradient */}
                <linearGradient id="flow-primary" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary)/0.1)" />
                  <stop offset="50%" stopColor="hsl(var(--primary)/0.6)">
                    <animate attributeName="offset" values="0;1;0" dur="3s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="hsl(var(--primary)/0.1)" />
                </linearGradient>
                <linearGradient id="flow-warning" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--warning)/0.1)" />
                  <stop offset="50%" stopColor="hsl(var(--warning)/0.6)">
                    <animate attributeName="offset" values="0;1;0" dur="3s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="hsl(var(--warning)/0.1)" />
                </linearGradient>
                <linearGradient id="flow-info" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--info)/0.1)" />
                  <stop offset="50%" stopColor="hsl(var(--info)/0.5)">
                    <animate attributeName="offset" values="0;1;0" dur="3s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="hsl(var(--info)/0.1)" />
                </linearGradient>
                {/* Arrowheads */}
                <marker id="ah-ga" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <path d="M0,0 L10,3.5 L0,7 Z" fill="hsl(var(--primary)/0.5)" />
                </marker>
                <marker id="ah-ir" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <path d="M0,0 L10,3.5 L0,7 Z" fill="hsl(var(--warning)/0.5)" />
                </marker>
                <marker id="ah-st" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <path d="M0,0 L10,3.5 L0,7 Z" fill="hsl(var(--info)/0.4)" />
                </marker>
                {/* Glow filters */}
                <filter id="glow-primary" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Column labels */}
              {nodes.length > 0 && (
                <g className="select-none" opacity={0.4}>
                  {[
                    { x: 60, label: 'ESCOPO' },
                    { x: 420, label: 'CARGO' },
                    { x: 760, label: 'RECURSO' },
                    ...(focusRoleId ? [{ x: 1080, label: 'PERMISSÃO' }] : []),
                  ].map(col => (
                    <text key={col.label} x={col.x + NODE_W / 2} y={24} textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--font-display)" fill="hsl(var(--muted-foreground))" letterSpacing="1.5">
                      {col.label}
                    </text>
                  ))}
                </g>
              )}

              {/* ── EDGES ── */}
              {edges.map(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const style = EDGE_STYLES[edge.type];
                const isHighlighted = connectedEdgeIds.has(edge.id);
                const isDimmed = activeId && !isHighlighted;

                // Compute connection points (right side → left side)
                const fromRight = fromNode.x + NODE_W;
                const fromY = fromNode.y + NODE_H / 2;
                const toLeft = toNode.x;
                const toY = toNode.y + NODE_H / 2;

                const dx = toLeft - fromRight;
                const fX = dx < 0 ? fromNode.x : fromRight;
                const tX = dx < 0 ? toNode.x + NODE_W : toLeft;
                const cpOff = Math.max(Math.abs(tX - fX) * 0.35, 40);

                const pathD = `M ${fX} ${fromY} C ${fX + cpOff} ${fromY}, ${tX - cpOff} ${toY}, ${tX} ${toY}`;
                const markerId = edge.type === 'grants_access' ? 'ah-ga' : edge.type === 'inherits_role' ? 'ah-ir' : 'ah-st';
                const flowId = edge.type === 'grants_access' ? 'flow-primary' : edge.type === 'inherits_role' ? 'flow-warning' : 'flow-info';

                return (
                  <g key={edge.id} style={{ transition: 'opacity 200ms' }} opacity={isDimmed ? 0.08 : 1}>
                    {/* Base edge */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={isHighlighted ? style.width + 1.2 : style.width}
                      strokeDasharray={style.dash}
                      markerEnd={`url(#${markerId})`}
                    />
                    {/* Animated flow overlay (only highlighted) */}
                    {isHighlighted && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke={`url(#${flowId})`}
                        strokeWidth={style.width + 2}
                        strokeLinecap="round"
                        opacity={0.6}
                      />
                    )}
                    {/* Flow particle */}
                    {isHighlighted && (
                      <circle r="3.5" fill={style.color} opacity={0.9}>
                        <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
                      </circle>
                    )}
                    {/* Edge label */}
                    {edge.label && !isDimmed && (
                      <text x={(fX + tX) / 2} y={(fromY + toY) / 2 - 10} textAnchor="middle" fontSize="9" fontFamily="var(--font-body)" fill="hsl(var(--muted-foreground))" opacity={0.8}>
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── NODES ── */}
              {nodes.map(node => {
                const s = NODE_STYLES[node.type];
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isConnected = connectedNodeIds.has(node.id);
                const isDimmed = activeId && !isConnected;
                const isDragging = dragNodeId === node.id;
                const NodeIcon = getIcon(node);

                return (
                  <g
                    key={node.id}
                    data-node={node.id}
                    style={{ transition: isDragging ? 'none' : 'opacity 200ms, filter 200ms' }}
                    opacity={isDimmed ? 0.18 : 1}
                    filter={isSelected ? 'url(#glow-primary)' : undefined}
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(prev => prev === node.id ? null : node.id); }}
                    onMouseEnter={() => !dragNodeId && setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    {/* Drop shadow */}
                    <rect
                      x={node.x + 2}
                      y={node.y + 3}
                      width={NODE_W}
                      height={NODE_H}
                      rx={14}
                      fill="hsl(var(--foreground)/0.04)"
                    />
                    {/* Node body */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={14}
                      fill={s.bg}
                      stroke={isSelected || isHovered ? s.hoverBorder : s.border}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                      className="transition-colors"
                    />
                    {/* Left accent bar */}
                    <rect
                      x={node.x}
                      y={node.y + 8}
                      width={3.5}
                      height={NODE_H - 16}
                      rx={2}
                      fill={s.text}
                      opacity={isSelected ? 1 : 0.5}
                    />
                    {/* Icon bg */}
                    <rect
                      x={node.x + 14}
                      y={node.y + (NODE_H - 30) / 2}
                      width={30}
                      height={30}
                      rx={8}
                      fill={isSelected ? s.text : s.border}
                      opacity={isSelected ? 0.15 : 0.3}
                    />
                    {/* Icon */}
                    <foreignObject x={node.x + 17} y={node.y + (NODE_H - 24) / 2} width={24} height={24}>
                      <div className={cn("flex items-center justify-center w-full h-full", s.icon)}>
                        <NodeIcon size={14} />
                      </div>
                    </foreignObject>
                    {/* Label */}
                    <text
                      x={node.x + 52}
                      y={node.y + (node.sublabel ? 24 : NODE_H / 2 + 4)}
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="var(--font-display)"
                      fill={s.text}
                      className="select-none"
                    >
                      {node.label.length > 15 ? node.label.slice(0, 14) + '…' : node.label}
                    </text>
                    {node.sublabel && (
                      <text x={node.x + 52} y={node.y + 40} fontSize="9" fontFamily="var(--font-body)" fill="hsl(var(--muted-foreground))" className="select-none">
                        {node.sublabel.length > 18 ? node.sublabel.slice(0, 17) + '…' : node.sublabel}
                      </text>
                    )}
                    {/* Drag handle */}
                    <foreignObject
                      x={node.x + NODE_W - 28}
                      y={node.y + (NODE_H - 20) / 2}
                      width={20}
                      height={20}
                      data-drag-handle={node.id}
                      className={cn("cursor-grab", isDragging && "cursor-grabbing")}
                    >
                      <div className="flex items-center justify-center w-full h-full text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors">
                        <GripVertical size={12} />
                      </div>
                    </foreignObject>
                    {/* Selection indicator */}
                    {isSelected && (
                      <rect
                        x={node.x - 4}
                        y={node.y - 4}
                        width={NODE_W + 8}
                        height={NODE_H + 8}
                        rx={16}
                        fill="none"
                        stroke={s.text}
                        strokeWidth={1.5}
                        strokeDasharray="5,4"
                        opacity={0.4}
                      >
                        <animate attributeName="stroke-dashoffset" values="0;18" dur="1.5s" repeatCount="indefinite" />
                      </rect>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 bg-card/95 backdrop-blur-sm border border-border/40 rounded-xl px-3.5 py-2.5 space-y-1 text-[10px] shadow-sm">
              <p className="text-muted-foreground font-semibold uppercase tracking-wider">Nós</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <LegendDot color="bg-primary/30" label="Cargo" />
                <LegendDot color="bg-info/30" label="Permissão" />
                <LegendDot color="bg-warning/30" label="Escopo" />
                <LegendDot color="bg-accent-foreground/20" label="Recurso" />
              </div>
              <p className="text-muted-foreground font-semibold uppercase tracking-wider pt-0.5">Arestas</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <EdgeLeg color="hsl(var(--primary)/0.5)" label="grants_access" />
                <EdgeLeg color="hsl(var(--warning)/0.5)" label="inherits_role" />
                <EdgeLeg color="hsl(var(--info)/0.4)" label="scoped_to" dashed />
              </div>
              <p className="text-muted-foreground pt-1 flex items-center gap-1">
                <Move className="h-3 w-3" /> Arraste o <GripVertical className="h-3 w-3 inline" /> para mover nós
              </p>
            </div>

            {/* Dragging indicator */}
            {dragNodeId && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary/10 border border-primary/30 text-primary text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <Move className="h-3 w-3" />
                Arrastando nó… solte para fixar
              </div>
            )}
          </div>
        </Card>

        {/* Right Panel: Live Access Preview + Node Detail + Stats */}
        <div className="space-y-3 flex flex-col overflow-hidden" style={{ height: '68vh', minHeight: 460 }}>
          {/* Live Access Preview */}
          <LiveAccessPreview
            focusRoleId={focusRoleId}
            roles={roles}
            permissions={permissions}
            rolePermMap={rolePermMap}
          />

          {/* Node detail (compact) */}
          {selectedInfo && (
            <Card className="animate-in fade-in slide-in-from-right-2 duration-200 shrink-0">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg",
                    selectedInfo.node.type === 'role' ? "bg-primary/10" :
                    selectedInfo.node.type === 'permission' ? "bg-info/10" :
                    selectedInfo.node.type === 'scope' ? "bg-warning/10" :
                    "bg-accent"
                  )}>
                    {(() => { const I = getIcon(selectedInfo.node); return <I className="h-3.5 w-3.5" />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xs truncate">{selectedInfo.node.label}</CardTitle>
                    <Badge variant="outline" className="text-[9px] capitalize">{selectedInfo.node.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-3">
                <ScrollArea className="max-h-[18vh]">
                  <div className="space-y-0.5">
                    {selectedInfo.connectedNodes.slice(0, 8).map(cNode => {
                      const edge = selectedInfo.edges.find(e => e.from === cNode.id || e.to === cNode.id);
                      const CIcon = getIcon(cNode);
                      const isOutgoing = edge && edge.from === selectedInfo.node.id;
                      return (
                        <button
                          key={cNode.id}
                          onClick={() => setSelectedNodeId(cNode.id)}
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left hover:bg-muted/40 transition-colors"
                        >
                          <CIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-foreground truncate flex-1">{cNode.label}</span>
                          <span className="text-[9px] text-muted-foreground">{isOutgoing ? '→' : '←'}</span>
                        </button>
                      );
                    })}
                    {selectedInfo.connectedNodes.length > 8 && (
                      <p className="text-[10px] text-muted-foreground text-center py-1">+{selectedInfo.connectedNodes.length - 8} mais</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card className="shrink-0 mt-auto">
            <CardContent className="py-3 px-3">
              <div className="grid grid-cols-4 gap-1">
                <StatBox label="Nós" value={nodes.length} />
                <StatBox label="Arestas" value={edges.length} />
                <StatBox label="Cargos" value={roles.length} />
                <StatBox label="Perms" value={permissions.length} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════
// LIVE ACCESS PREVIEW
// ══════════════════════════════════

const ACCESS_CHECKS: { resource: string; action: string; label: string }[] = [
  { resource: 'employees', action: 'view', label: 'Ver funcionários' },
  { resource: 'employees', action: 'create', label: 'Criar funcionários' },
  { resource: 'employees', action: 'update', label: 'Editar funcionários' },
  { resource: 'employees', action: 'delete', label: 'Excluir funcionários' },
  { resource: 'salary', action: 'adjust', label: 'Ajustar salário' },
  { resource: 'salary', action: 'manage', label: 'Gerenciar salários' },
  { resource: 'salary', action: 'view', label: 'Ver salários' },
  { resource: 'companies', action: 'create', label: 'Criar empresas' },
  { resource: 'companies', action: 'view', label: 'Ver empresas' },
  { resource: 'companies', action: 'update', label: 'Editar empresas' },
  { resource: 'companies', action: 'delete', label: 'Excluir empresas' },
  { resource: 'departments', action: 'view', label: 'Ver departamentos' },
  { resource: 'departments', action: 'create', label: 'Criar departamentos' },
  { resource: 'positions', action: 'view', label: 'Ver cargos' },
  { resource: 'positions', action: 'create', label: 'Criar cargos' },
  { resource: 'benefits', action: 'view', label: 'Ver benefícios' },
  { resource: 'benefits', action: 'create', label: 'Criar benefícios' },
  { resource: 'health', action: 'view', label: 'Ver saúde' },
  { resource: 'audit', action: 'view', label: 'Ver auditoria' },
  { resource: 'iam', action: 'view', label: 'Ver acesso (IAM)' },
  { resource: 'iam', action: 'manage', label: 'Gerenciar acesso' },
  { resource: 'agreements', action: 'view', label: 'Ver termos' },
  { resource: 'agreements', action: 'create', label: 'Criar termos' },
  { resource: 'esocial', action: 'view', label: 'Ver eSocial' },
  { resource: 'esocial', action: 'create', label: 'Criar eventos eSocial' },
  { resource: 'payroll', action: 'simulate', label: 'Simular folha' },
  { resource: 'intelligence', action: 'view', label: 'Ver inteligência' },
  { resource: 'training', action: 'view', label: 'Ver treinamentos' },
  { resource: 'risk', action: 'view', label: 'Ver riscos' },
  { resource: 'user', action: 'invite', label: 'Convidar usuários' },
];

interface LiveAccessPreviewProps {
  focusRoleId: string | null;
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  rolePermMap: Map<string, string[]>;
}

function LiveAccessPreview({ focusRoleId, roles, permissions, rolePermMap }: LiveAccessPreviewProps) {
  const focusedRole = focusRoleId ? roles.find(r => r.id === focusRoleId) : null;

  const grantedSet = useMemo(() => {
    if (!focusRoleId) return new Set<string>();
    const permIds = rolePermMap.get(focusRoleId) || [];
    const set = new Set<string>();
    permIds.forEach(pid => {
      const p = permissions.find(pp => pp.id === pid);
      if (p) set.add(`${p.resource}.${p.action}`);
    });
    return set;
  }, [focusRoleId, rolePermMap, permissions]);

  const results = useMemo(() => {
    return ACCESS_CHECKS.map(check => ({
      ...check,
      granted: grantedSet.has(`${check.resource}.${check.action}`),
    }));
  }, [grantedSet]);

  const granted = results.filter(r => r.granted);
  const denied = results.filter(r => !r.granted);

  if (!focusedRole) {
    return (
      <Card className="border-dashed border-border/50 shrink-0">
        <CardContent className="py-6 text-center">
          <Scan className="h-7 w-7 mx-auto mb-2 text-muted-foreground/20" />
          <p className="text-[11px] text-muted-foreground">Selecione um cargo para ver o preview de acesso.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 flex flex-col overflow-hidden border-border/50 animate-in fade-in slide-in-from-right-2 duration-200">
      <CardHeader className="pb-2 pt-3 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Scan className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xs">Live Access Preview</CardTitle>
            <p className="text-[10px] text-muted-foreground truncate">
              Usuário com cargo <span className="font-semibold text-foreground">{focusedRole.name}</span> poderá:
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="secondary" className="text-[9px] gap-1">
            <Check className="h-2.5 w-2.5 text-primary" />
            {granted.length} permitido{granted.length !== 1 ? 's' : ''}
          </Badge>
          <Badge variant="secondary" className="text-[9px] gap-1">
            <X className="h-2.5 w-2.5 text-destructive" />
            {denied.length} negado{denied.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 px-1.5">
        <div className="space-y-0.5 pb-3">
          {granted.map(r => (
            <div key={`${r.resource}.${r.action}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md">
              <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary/10 shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-[11px] text-foreground flex-1">{r.label}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{r.resource}.{r.action}</span>
            </div>
          ))}
          {granted.length > 0 && denied.length > 0 && (
            <div className="border-t border-border/30 my-1.5" />
          )}
          {denied.map(r => (
            <div key={`${r.resource}.${r.action}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md opacity-60">
              <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-destructive/10 shrink-0">
                <X className="h-3 w-3 text-destructive" />
              </div>
              <span className="text-[11px] text-muted-foreground flex-1 line-through decoration-destructive/30">{r.label}</span>
              <span className="text-[9px] text-muted-foreground/50 font-mono">{r.resource}.{r.action}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ══════════════════════════════════
// PERMISSION LIBRARY PANEL
// ══════════════════════════════════

interface PermLibProps {
  permissions: PermissionDefinition[];
  rolePermMap: Map<string, string[]>;
  focusRoleId: string | null;
  onSelectPermission: (permId: string) => void;
}

function PermissionLibraryPanel({ permissions, rolePermMap, focusRoleId, onSelectPermission }: PermLibProps) {
  const [search, setSearch] = useState('');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set(['HR', 'Security', 'Compensation']));

  // Group permissions by domain
  const grouped = useMemo(() => {
    const map = new Map<PermDomain, PermissionDefinition[]>();
    const q = search.toLowerCase();
    permissions.forEach(p => {
      const domain = RESOURCE_TO_DOMAIN[p.resource] || 'Tenant';
      const key = `${p.resource}.${p.action}`;
      if (q && !key.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return;
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(p);
    });
    // Sort domains
    const order: PermDomain[] = ['HR', 'Compensation', 'Tenant', 'Reporting', 'Security', 'Compliance', 'Health'];
    return order.filter(d => map.has(d)).map(d => ({ domain: d, perms: map.get(d)! }));
  }, [permissions, search]);

  // Which permissions are assigned to the focused role
  const assignedPermIds = useMemo(() => {
    if (!focusRoleId) return new Set<string>();
    return new Set(rolePermMap.get(focusRoleId) || []);
  }, [focusRoleId, rolePermMap]);

  const toggleDomain = (d: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const totalCount = permissions.length;
  const filteredCount = grouped.reduce((s, g) => s + g.perms.length, 0);

  return (
    <Card className="border-border/50 flex flex-col overflow-hidden" style={{ height: '68vh', minHeight: 460 }}>
      <CardHeader className="pb-2 pt-3 px-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Library className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xs">Permission Library</CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {filteredCount}/{totalCount} permissões
            </p>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="employee.create…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/20 border-border/40"
          />
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 px-1.5">
        <div className="space-y-0.5 pb-3">
          {grouped.map(({ domain, perms }) => {
            const meta = DOMAIN_META[domain];
            const DIcon = meta.icon;
            const isOpen = expandedDomains.has(domain);
            return (
              <Collapsible key={domain} open={isOpen} onOpenChange={() => toggleDomain(domain)}>
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-muted/30 transition-colors group">
                  {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <DIcon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                  <span className="text-xs font-semibold text-foreground flex-1 text-left">{domain}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 tabular-nums">{perms.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-5 pl-2 border-l border-border/30 space-y-px py-1">
                    {perms.map(p => {
                      const key = `${p.resource}.${p.action}`;
                      const isAssigned = assignedPermIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => onSelectPermission(p.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                            isAssigned
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/30"
                          )}
                        >
                          <Key className={cn("h-3 w-3 shrink-0", isAssigned ? "text-primary" : "text-muted-foreground/40")} />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-[11px] font-mono truncate",
                              isAssigned ? "text-primary font-medium" : "text-foreground"
                            )}>
                              {key}
                            </p>
                          </div>
                          {isAssigned && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          {grouped.length === 0 && (
            <div className="py-8 text-center">
              <Search className="h-6 w-6 mx-auto mb-2 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground">Nenhuma permissão encontrada</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// ══════════════════════════════════
// HELPERS
// ══════════════════════════════════

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2.5 w-2.5 rounded-full border inline-block", color)} />
      <span className="text-foreground">{label}</span>
    </span>
  );
}

function EdgeLeg({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '3,2' : undefined} /></svg>
      <span className="text-foreground font-mono">{label}</span>
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold font-mono tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
