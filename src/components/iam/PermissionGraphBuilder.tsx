/**
 * Permission Graph Builder — Interactive node-based graph visualization
 *
 * Nodes: RoleNode, PermissionNode, ScopeNode, ResourceNode
 * Edges: grants_access, inherits_role, scoped_to
 *
 * Pure visualization — no security logic lives here.
 * Data flows from IdentityGateway → read-models → this component.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { identityGateway } from '@/domains/iam/identity.gateway';
import { type CustomRole, type PermissionDefinition, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Shield, Users, Building2, Key, Network, Eye, Layers,
  ZoomIn, ZoomOut, Maximize2, Lock, ChevronRight,
  Briefcase, DollarSign, ShieldCheck, Heart, Send, ScrollText,
  Brain, GraduationCap, AlertTriangle, Calculator, Settings,
} from 'lucide-react';

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

interface SelectedNode {
  node: GraphNode;
  edges: GraphEdge[];
  connectedNodes: GraphNode[];
}

// ══════════════════════════════════
// CONSTANTS
// ══════════════════════════════════

const NODE_COLORS: Record<GraphNodeType, { bg: string; border: string; text: string; icon: string }> = {
  role: { bg: 'hsl(var(--primary) / 0.1)', border: 'hsl(var(--primary) / 0.4)', text: 'hsl(var(--primary))', icon: 'text-primary' },
  permission: { bg: 'hsl(var(--info) / 0.08)', border: 'hsl(var(--info) / 0.3)', text: 'hsl(var(--info))', icon: 'text-info' },
  scope: { bg: 'hsl(var(--warning) / 0.08)', border: 'hsl(var(--warning) / 0.3)', text: 'hsl(var(--warning))', icon: 'text-warning' },
  resource: { bg: 'hsl(var(--accent-foreground) / 0.08)', border: 'hsl(var(--accent-foreground) / 0.25)', text: 'hsl(var(--accent-foreground))', icon: 'text-accent-foreground' },
};

const EDGE_COLORS: Record<EdgeType, string> = {
  grants_access: 'hsl(var(--primary) / 0.5)',
  inherits_role: 'hsl(var(--warning) / 0.5)',
  scoped_to: 'hsl(var(--info) / 0.4)',
};

const EDGE_LABELS: Record<EdgeType, string> = {
  grants_access: 'concede',
  inherits_role: 'herda',
  scoped_to: 'escopo',
};

const RESOURCE_ICON_MAP: Record<string, typeof Users> = {
  employees: Users, companies: Building2, company: Building2,
  departments: Briefcase, positions: Briefcase, salary: DollarSign,
  benefits: ShieldCheck, health: Heart, esocial: Send, audit: ScrollText,
  iam: Lock, intelligence: Brain, agreements: ScrollText,
  training: GraduationCap, risk: AlertTriangle, payroll: Calculator, user: Users,
};

const RESOURCE_LABELS: Record<string, string> = {
  employees: 'Funcionários', companies: 'Empresas', company: 'Empresa',
  departments: 'Departamentos', positions: 'Cargos', salary: 'Salário',
  benefits: 'Benefícios', health: 'Saúde', esocial: 'eSocial',
  audit: 'Auditoria', iam: 'Acesso (IAM)', intelligence: 'Inteligência',
  agreements: 'Termos', training: 'Treinamentos', risk: 'Riscos',
  payroll: 'Folha', user: 'Usuários',
};

const SCOPE_LABELS: Record<string, string> = { tenant: 'Tenant', company_group: 'Grupo', company: 'Empresa' };

const NODE_W = 180;
const NODE_H = 56;

// ══════════════════════════════════
// PROPS
// ══════════════════════════════════

interface Props {
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
}

// ══════════════════════════════════
// GRAPH BUILDER LOGIC
// ══════════════════════════════════

function buildGraph(
  roles: CustomRole[],
  permissions: PermissionDefinition[],
  assignments: UserCustomRole[],
  rolePermMap: Map<string, string[]>,
  selectedRoleId: string | null,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (n: GraphNode) => {
    if (!nodeIds.has(n.id)) { nodes.push(n); nodeIds.add(n.id); }
  };

  // Determine which roles to show
  const visibleRoles = selectedRoleId ? roles.filter(r => r.id === selectedRoleId) : roles;

  // 1. Role nodes (center column)
  visibleRoles.forEach((role, i) => {
    addNode({
      id: `role:${role.id}`,
      type: 'role',
      label: role.name,
      sublabel: role.is_system ? 'Sistema' : 'Custom',
      x: 400,
      y: 80 + i * 100,
      meta: { roleId: role.id, isSystem: role.is_system },
    });
  });

  // 2. Scope nodes from assignments (left column)
  const scopeSet = new Map<string, { type: string; id: string | null }>();
  assignments.forEach(a => {
    if (selectedRoleId && a.role_id !== selectedRoleId) return;
    const key = `${a.scope_type}:${a.scope_id || 'all'}`;
    if (!scopeSet.has(key)) {
      scopeSet.set(key, { type: a.scope_type, id: a.scope_id });
    }
    // Edge: role → scope (scoped_to)
    edges.push({
      id: `scope_edge:${a.role_id}:${key}`,
      from: `role:${a.role_id}`,
      to: `scope:${key}`,
      type: 'scoped_to',
    });
  });

  let scopeIdx = 0;
  scopeSet.forEach((scope, key) => {
    addNode({
      id: `scope:${key}`,
      type: 'scope',
      label: SCOPE_LABELS[scope.type] || scope.type,
      sublabel: scope.id ? scope.id.slice(0, 8) + '…' : 'Global',
      x: 80,
      y: 80 + scopeIdx * 90,
      meta: { scopeType: scope.type, scopeId: scope.id },
    });
    scopeIdx++;
  });

  // 3. Resource + Permission nodes from role permissions (right columns)
  const resourceSet = new Set<string>();
  const permNodeSet = new Set<string>();

  visibleRoles.forEach(role => {
    const permIds = rolePermMap.get(role.id) || [];
    const rolePerms = permissions.filter(p => permIds.includes(p.id));

    // Group by resource
    const byResource = new Map<string, PermissionDefinition[]>();
    rolePerms.forEach(p => {
      if (!byResource.has(p.resource)) byResource.set(p.resource, []);
      byResource.get(p.resource)!.push(p);
    });

    byResource.forEach((perms, resource) => {
      // Resource node
      if (!resourceSet.has(resource)) {
        resourceSet.add(resource);
      }

      // Edge: role → resource (grants_access)
      edges.push({
        id: `grant:${role.id}:${resource}`,
        from: `role:${role.id}`,
        to: `resource:${resource}`,
        type: 'grants_access',
        label: `${perms.length} ações`,
      });

      // Permission nodes (only in detail mode)
      if (selectedRoleId) {
        perms.forEach(p => {
          const permNodeId = `perm:${p.id}`;
          if (!permNodeSet.has(permNodeId)) {
            permNodeSet.add(permNodeId);
          }

          // Edge: resource → permission
          edges.push({
            id: `perm_edge:${resource}:${p.id}`,
            from: `resource:${resource}`,
            to: permNodeId,
            type: 'grants_access',
          });
        });
      }
    });
  });

  // Layout resource nodes
  let resIdx = 0;
  resourceSet.forEach(resource => {
    addNode({
      id: `resource:${resource}`,
      type: 'resource',
      label: RESOURCE_LABELS[resource] || resource,
      sublabel: resource,
      x: 720,
      y: 60 + resIdx * 70,
      meta: { resource },
    });
    resIdx++;
  });

  // Layout permission nodes (rightmost)
  if (selectedRoleId) {
    let permIdx = 0;
    permNodeSet.forEach(permNodeId => {
      const permId = permNodeId.replace('perm:', '');
      const perm = permissions.find(p => p.id === permId);
      if (!perm) return;
      addNode({
        id: permNodeId,
        type: 'permission',
        label: perm.name,
        sublabel: `${perm.resource}.${perm.action}`,
        x: 1020,
        y: 60 + permIdx * 50,
        meta: { permId: perm.id, action: perm.action, resource: perm.resource },
      });
      permIdx++;
    });
  }

  // Deduplicate edges
  const edgeKeys = new Set<string>();
  const dedupedEdges = edges.filter(e => {
    if (edgeKeys.has(e.id)) return false;
    edgeKeys.add(e.id);
    return true;
  });

  return { nodes, edges: dedupedEdges };
}

// ══════════════════════════════════
// COMPONENT
// ══════════════════════════════════

export function PermissionGraphBuilder({ members, assignments, roles, permissions, tenantId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusRoleId, setFocusRoleId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Load all role permissions
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

  // Build graph
  const { nodes, edges } = useMemo(
    () => buildGraph(roles, permissions, assignments, rolePermMap, focusRoleId),
    [roles, permissions, assignments, rolePermMap, focusRoleId]
  );

  // Connected edges for hover highlighting
  const connectedEdges = useMemo(() => {
    if (!hoveredNodeId && !selectedNodeId) return new Set<string>();
    const targetId = hoveredNodeId || selectedNodeId;
    return new Set(
      edges.filter(e => e.from === targetId || e.to === targetId).map(e => e.id)
    );
  }, [hoveredNodeId, selectedNodeId, edges]);

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId && !selectedNodeId) return new Set<string>();
    const targetId = hoveredNodeId || selectedNodeId;
    const ids = new Set<string>();
    ids.add(targetId!);
    edges.forEach(e => {
      if (e.from === targetId) ids.add(e.to);
      if (e.to === targetId) ids.add(e.from);
    });
    return ids;
  }, [hoveredNodeId, selectedNodeId, edges]);

  // Selected node info panel
  const selectedInfo = useMemo<SelectedNode | null>(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;
    const nodeEdges = edges.filter(e => e.from === node.id || e.to === node.id);
    const connIds = new Set<string>();
    nodeEdges.forEach(e => {
      connIds.add(e.from === node.id ? e.to : e.from);
    });
    return {
      node,
      edges: nodeEdges,
      connectedNodes: nodes.filter(n => connIds.has(n.id)),
    };
  }, [selectedNodeId, nodes, edges]);

  // SVG viewport bounds
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 1200 600';
    const maxX = Math.max(...nodes.map(n => n.x)) + NODE_W + 60;
    const maxY = Math.max(...nodes.map(n => n.y)) + NODE_H + 60;
    return `0 0 ${Math.max(maxX, 1200)} ${Math.max(maxY, 600)}`;
  }, [nodes]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Node icon
  const getNodeIcon = (node: GraphNode) => {
    switch (node.type) {
      case 'role': return node.meta?.isSystem ? Lock : Shield;
      case 'scope': return Building2;
      case 'resource': return RESOURCE_ICON_MAP[node.meta?.resource as string] || Layers;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Permission Graph
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualize nós de Cargo → Recurso → Permissão e suas conexões de acesso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z + 0.15, 2.5))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z - 0.15, 0.3))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Role focus selector */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFocusRoleId(null)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            !focusRoleId
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
          )}
        >
          Todos os cargos
        </button>
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setFocusRoleId(prev => prev === r.id ? null : r.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5",
              focusRoleId === r.id
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {r.is_system ? <Lock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
            {r.name}
          </button>
        ))}
      </div>

      {/* Graph Canvas + Detail Panel */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* SVG Canvas */}
        <Card className="overflow-hidden">
          <div
            ref={containerRef}
            className="relative bg-muted/10 cursor-grab active:cursor-grabbing"
            style={{ height: '65vh', minHeight: 420 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              ref={svgRef}
              viewBox={viewBox}
              className="w-full h-full"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: '0 0',
              }}
            >
              <defs>
                <marker id="arrow-grants" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill={EDGE_COLORS.grants_access} />
                </marker>
                <marker id="arrow-inherits" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill={EDGE_COLORS.inherits_role} />
                </marker>
                <marker id="arrow-scoped" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill={EDGE_COLORS.scoped_to} />
                </marker>
              </defs>

              {/* Edges */}
              {edges.map(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const fromX = fromNode.x + NODE_W;
                const fromY = fromNode.y + NODE_H / 2;
                const toX = toNode.x;
                const toY = toNode.y + NODE_H / 2;

                // Determine if left-to-right or right-to-left
                const dx = toX - fromX;
                const adjustedFromX = dx < 0 ? fromNode.x : fromX;
                const adjustedToX = dx < 0 ? toNode.x + NODE_W : toX;

                const cpOffset = Math.abs(adjustedToX - adjustedFromX) * 0.4;

                const isHighlighted = connectedEdges.has(edge.id);
                const isDimmed = (hoveredNodeId || selectedNodeId) && !isHighlighted;

                const markerId = edge.type === 'grants_access' ? 'arrow-grants'
                  : edge.type === 'inherits_role' ? 'arrow-inherits'
                  : 'arrow-scoped';

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${adjustedFromX} ${fromY} C ${adjustedFromX + cpOffset} ${fromY}, ${adjustedToX - cpOffset} ${toY}, ${adjustedToX} ${toY}`}
                      fill="none"
                      stroke={EDGE_COLORS[edge.type]}
                      strokeWidth={isHighlighted ? 2.5 : 1.5}
                      strokeDasharray={edge.type === 'scoped_to' ? '6,4' : undefined}
                      opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.6}
                      markerEnd={`url(#${markerId})`}
                      className="transition-all duration-200"
                    />
                    {edge.label && !isDimmed && (
                      <text
                        x={(adjustedFromX + adjustedToX) / 2}
                        y={(fromY + toY) / 2 - 8}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        fontSize="9"
                        fontFamily="var(--font-body)"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const colors = NODE_COLORS[node.type];
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isConnected = connectedNodeIds.has(node.id);
                const isDimmed = (hoveredNodeId || selectedNodeId) && !isConnected;
                const NodeIcon = getNodeIcon(node);

                return (
                  <g
                    key={node.id}
                    data-node={node.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(prev => prev === node.id ? null : node.id);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    opacity={isDimmed ? 0.25 : 1}
                    style={{ transition: 'opacity 200ms' }}
                  >
                    {/* Node background */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={NODE_W}
                      height={NODE_H}
                      rx={12}
                      fill={colors.bg}
                      stroke={isSelected || isHovered ? colors.text : colors.border}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                      className="transition-all duration-150"
                    />
                    {/* Icon circle */}
                    <circle
                      cx={node.x + 26}
                      cy={node.y + NODE_H / 2}
                      r={14}
                      fill={isSelected ? colors.text : colors.border}
                      opacity={isSelected ? 0.2 : 0.3}
                    />
                    {/* Icon (using foreignObject) */}
                    <foreignObject x={node.x + 14} y={node.y + NODE_H / 2 - 10} width={24} height={20}>
                      <div className={cn("flex items-center justify-center w-full h-full", colors.icon)}>
                        <NodeIcon size={14} />
                      </div>
                    </foreignObject>
                    {/* Label */}
                    <text
                      x={node.x + 48}
                      y={node.y + (node.sublabel ? 22 : NODE_H / 2 + 4)}
                      fontSize="12"
                      fontWeight="600"
                      fontFamily="var(--font-display)"
                      fill={colors.text}
                      className="select-none"
                    >
                      {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                    </text>
                    {node.sublabel && (
                      <text
                        x={node.x + 48}
                        y={node.y + 38}
                        fontSize="9"
                        fontFamily="var(--font-body)"
                        fill="hsl(var(--muted-foreground))"
                        className="select-none"
                      >
                        {node.sublabel.length > 20 ? node.sublabel.slice(0, 19) + '…' : node.sublabel}
                      </text>
                    )}
                    {/* Selection ring */}
                    {isSelected && (
                      <rect
                        x={node.x - 3}
                        y={node.y - 3}
                        width={NODE_W + 6}
                        height={NODE_H + 6}
                        rx={14}
                        fill="none"
                        stroke={colors.text}
                        strokeWidth={1.5}
                        strokeDasharray="4,3"
                        opacity={0.5}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Legend overlay */}
            <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border border-border/40 rounded-xl px-3.5 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider w-full mb-0.5">Nós</span>
              <LegendItem color="bg-primary/20 border-primary/40" label="Cargo (Role)" />
              <LegendItem color="bg-[hsl(var(--info)/0.15)] border-[hsl(var(--info)/0.3)]" label="Permissão" />
              <LegendItem color="bg-[hsl(var(--warning)/0.15)] border-[hsl(var(--warning)/0.3)]" label="Escopo" />
              <LegendItem color="bg-accent border-accent-foreground/25" label="Recurso" />
              <span className="text-muted-foreground font-semibold uppercase tracking-wider w-full mt-1 mb-0.5">Arestas</span>
              <EdgeLegendItem color="hsl(var(--primary) / 0.5)" label="grants_access" solid />
              <EdgeLegendItem color="hsl(var(--warning) / 0.5)" label="inherits_role" solid />
              <EdgeLegendItem color="hsl(var(--info) / 0.4)" label="scoped_to" dashed />
            </div>
          </div>
        </Card>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedInfo ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    selectedInfo.node.type === 'role' ? "bg-primary/10" :
                    selectedInfo.node.type === 'permission' ? "bg-info/10" :
                    selectedInfo.node.type === 'scope' ? "bg-warning/10" :
                    "bg-accent"
                  )}>
                    {(() => { const Icon = getNodeIcon(selectedInfo.node); return <Icon className="h-4 w-4" />; })()}
                  </div>
                  <div>
                    <CardTitle className="text-sm">{selectedInfo.node.label}</CardTitle>
                    <p className="text-[11px] text-muted-foreground capitalize">{selectedInfo.node.type} Node</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {selectedInfo.node.sublabel && (
                  <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded">
                    {selectedInfo.node.sublabel}
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                    Conexões ({selectedInfo.edges.length})
                  </p>
                  <ScrollArea className="max-h-[30vh]">
                    <div className="space-y-1.5">
                      {selectedInfo.connectedNodes.map(cn_node => {
                        const edge = selectedInfo.edges.find(e => e.from === cn_node.id || e.to === cn_node.id);
                        const ConnIcon = getNodeIcon(cn_node);
                        return (
                          <button
                            key={cn_node.id}
                            onClick={() => setSelectedNodeId(cn_node.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-muted/40 transition-colors"
                          >
                            <ConnIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{cn_node.label}</p>
                              {edge && (
                                <p className="text-[10px] text-muted-foreground">{EDGE_LABELS[edge.type]}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[9px] shrink-0 capitalize">{cn_node.type}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Clique em um nó para ver detalhes e conexões.</p>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-2 gap-3">
                <StatMini label="Nós" value={nodes.length} />
                <StatMini label="Arestas" value={edges.length} />
                <StatMini label="Cargos" value={roles.length} />
                <StatMini label="Permissões" value={permissions.length} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-5 rounded border inline-block", color)} />
      <span className="text-foreground">{label}</span>
    </span>
  );
}

function EdgeLegendItem({ color, label, solid, dashed }: { color: string; label: string; solid?: boolean; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="8">
        <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4,3' : undefined} />
      </svg>
      <span className="text-foreground font-mono">{label}</span>
    </span>
  );
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold font-mono tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
