/**
 * UnifiedAccessGraphView — Interactive SVG visualization of the UGE unified graph.
 *
 * READ-ONLY: This component only reads and visualizes data from the UGE.
 * All authorization decisions remain in the SecurityKernel.
 *
 * Features:
 *   - Force-directed layout with spring simulation
 *   - Domain filters (platform, tenant, permission, module, identity)
 *   - Visual inheritance (dashed edges)
 *   - Hover highlighting of connected nodes
 *   - Click-to-select node inspection
 *   - Zoom/pan (buttons + wheel + drag)
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Network, Filter, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { unifiedGraphEngine } from '@/domains/security/kernel/unified-graph-engine';
import type {
  GraphDomain,
  VisualizationNode,
  VisualizationEdge,
  VisualizationData,
  UnifiedEdgeRelation,
} from '@/domains/security/kernel/unified-graph-engine';

// ════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════

const DOMAIN_CONFIG: Record<GraphDomain, { label: string; color: string; bgClass: string }> = {
  platform_access: { label: 'Platform', color: 'hsl(265 80% 55%)', bgClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  tenant_access: { label: 'Tenant', color: 'hsl(210 100% 52%)', bgClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  permission: { label: 'Permissões', color: 'hsl(38 92% 50%)', bgClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  module_access: { label: 'Módulos', color: 'hsl(150 60% 45%)', bgClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  identity: { label: 'Identidade', color: 'hsl(0 72% 51%)', bgClass: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const INHERITANCE_RELATIONS = new Set<UnifiedEdgeRelation>(['INHERITS_ROLE', 'PLATFORM_INHERITS']);

const NODE_ICONS: Record<string, string> = {
  platform_user: '👤', tenant_user: '👥', role: '🔑', permission: '🛡️',
  module: '📦', tenant: '🏢', identity_session: '🪪', scope: '🎯',
  company_group: '🏗️', company: '🏭', resource: '📄',
};

// ════════════════════════════════════
// FORCE LAYOUT
// ════════════════════════════════════

interface LayoutNode extends VisualizationNode {
  x: number; y: number; vx: number; vy: number;
}

function computeForceLayout(
  nodes: VisualizationNode[], edges: VisualizationEdge[],
  width: number, height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.35;
    return { ...n, x: width / 2 + r * Math.cos(angle), y: height / 2 + r * Math.sin(angle), vx: 0, vy: 0 };
  });

  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));
  const ITERATIONS = 120, REPULSION = 3000, ATTRACTION = 0.008, DAMPING = 0.85, CENTER_GRAVITY = 0.01;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS;

    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i], b = layoutNodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (REPULSION * cooling) / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
    }

    for (const edge of edges) {
      const source = nodeMap.get(edge.source), target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x, dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = dist * ATTRACTION * cooling;
      const fx = (dx / Math.max(dist, 1)) * force, fy = (dy / Math.max(dist, 1)) * force;
      source.vx += fx; source.vy += fy; target.vx -= fx; target.vy -= fy;
    }

    for (const node of layoutNodes) {
      node.vx += (width / 2 - node.x) * CENTER_GRAVITY;
      node.vy += (height / 2 - node.y) * CENTER_GRAVITY;
      node.vx *= DAMPING; node.vy *= DAMPING;
      node.x += node.vx; node.y += node.vy;
      node.x = Math.max(40, Math.min(width - 40, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    }
  }
  return layoutNodes;
}

// ════════════════════════════════════
// PROPS
// ════════════════════════════════════

export interface UnifiedAccessGraphViewProps {
  /** Override default active domains */
  initialDomains?: GraphDomain[];
  /** SVG canvas height (default 600) */
  height?: number;
  /** Callback when a node is selected */
  onNodeSelect?: (node: LayoutNode | null) => void;
  className?: string;
}

// ════════════════════════════════════
// COMPONENT
// ════════════════════════════════════

export function UnifiedAccessGraphView({
  initialDomains,
  height: canvasHeight = 600,
  onNodeSelect,
  className,
}: UnifiedAccessGraphViewProps) {
  const allDomains: GraphDomain[] = ['platform_access', 'tenant_access', 'permission', 'module_access', 'identity'];
  const [activeDomains, setActiveDomains] = useState<Set<GraphDomain>>(
    new Set(initialDomains ?? allDomains),
  );
  const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showInheritance, setShowInheritance] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const SVG_WIDTH = 1200;

  // Build data
  const vizData: VisualizationData = useMemo(() => {
    const domainsArr = Array.from(activeDomains);
    try {
      const snapshot = unifiedGraphEngine.compose(domainsArr.length > 0 ? domainsArr : undefined);
      return unifiedGraphEngine.toVisualization(snapshot, { domains: domainsArr });
    } catch {
      return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, domainBreakdown: {} as any } };
    }
  }, [activeDomains]);

  const layoutNodes = useMemo(
    () => computeForceLayout(vizData.nodes, vizData.edges, SVG_WIDTH, canvasHeight),
    [vizData.nodes, vizData.edges, canvasHeight],
  );
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);

  const visibleEdges = useMemo(() => {
    if (showInheritance) return vizData.edges;
    return vizData.edges.filter(e => !INHERITANCE_RELATIONS.has(e.relation));
  }, [vizData.edges, showInheritance]);

  const connectedToHovered = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    for (const e of visibleEdges) {
      if (e.source === hoveredNode) connected.add(e.target);
      if (e.target === hoveredNode) connected.add(e.source);
    }
    return connected;
  }, [hoveredNode, visibleEdges]);

  const toggleDomain = useCallback((domain: GraphDomain) => {
    setActiveDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain); else next.add(domain);
      return next;
    });
    setSelectedNode(null);
  }, []);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.3));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) });
  };
  const handleMouseUp = () => setIsPanning(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001))); };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const handleNodeClick = useCallback((node: LayoutNode) => {
    const next = selectedNode?.id === node.id ? null : node;
    setSelectedNode(next);
    onNodeSelect?.(next);
  }, [selectedNode, onNodeSelect]);

  const getEdgePath = (edge: VisualizationEdge) => {
    const s = nodeMap.get(edge.source), t = nodeMap.get(edge.target);
    if (!s || !t) return '';
    const dx = t.x - s.x, dy = t.y - s.y;
    return `M ${s.x} ${s.y} Q ${(s.x + t.x) / 2 + dy * 0.15} ${(s.y + t.y) / 2 - dx * 0.15} ${t.x} ${t.y}`;
  };

  return (
    <div className={className}>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {(Object.entries(DOMAIN_CONFIG) as [GraphDomain, typeof DOMAIN_CONFIG[GraphDomain]][]).map(
          ([domain, config]) => (
            <button
              key={domain}
              onClick={() => toggleDomain(domain)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-all ${
                activeDomains.has(domain) ? config.bgClass : 'bg-muted/30 text-muted-foreground border-border/50 opacity-50'
              }`}
            >
              {config.label}
            </button>
          ),
        )}

        <div className="h-4 w-px bg-border mx-1" />
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Switch checked={showInheritance} onCheckedChange={setShowInheritance} className="scale-75" />
          Herança
        </label>

        <div className="h-4 w-px bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut}><ZoomOut className="h-3 w-3" /></Button>
        <span className="text-[10px] text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn}><ZoomIn className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset}><Maximize2 className="h-3 w-3" /></Button>

        <span className="ml-auto text-[10px] text-muted-foreground">
          {vizData.stats.totalNodes}n · {vizData.stats.totalEdges}e
        </span>
      </div>

      {/* SVG Canvas */}
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-0">
          <svg
            ref={svgRef}
            width="100%"
            height={canvasHeight}
            viewBox={`0 0 ${SVG_WIDTH} ${canvasHeight}`}
            className={`select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <marker id="uge-arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--muted-foreground) / 0.4)" />
              </marker>
              <marker id="uge-arrow-inherit" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(38 92% 50%)" />
              </marker>
              <marker id="uge-arrow-hl" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--primary))" />
              </marker>
              <filter id="uge-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {visibleEdges.map((edge, i) => {
                const isInherit = INHERITANCE_RELATIONS.has(edge.relation);
                const isHL = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                const isDimmed = hoveredNode && !isHL;
                return (
                  <path
                    key={`e-${i}`}
                    d={getEdgePath(edge)}
                    fill="none"
                    stroke={isHL ? 'hsl(var(--primary))' : isInherit ? 'hsl(38 92% 50%)' : 'hsl(var(--muted-foreground) / 0.25)'}
                    strokeWidth={isHL ? 2.5 : isInherit ? 1.8 : 1}
                    strokeDasharray={isInherit ? '6 3' : undefined}
                    opacity={isDimmed ? 0.1 : 1}
                    markerEnd={isHL ? 'url(#uge-arrow-hl)' : isInherit ? 'url(#uge-arrow-inherit)' : 'url(#uge-arrow)'}
                    className="transition-opacity duration-200"
                  />
                );
              })}

              {/* Nodes */}
              {layoutNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode === node.id;
                const isConnected = connectedToHovered.has(node.id);
                const isDimmed = hoveredNode !== null && !isHovered && !isConnected;
                const r = (node.size ?? 14) / 2 + 4;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={(e) => { e.stopPropagation(); handleNodeClick(node); }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                    opacity={isDimmed ? 0.15 : 1}
                    style={{ transition: 'opacity 200ms' }}
                  >
                    {(isSelected || isHovered) && (
                      <circle r={r + 6} fill="none" stroke={node.color} strokeWidth="2" opacity={0.5} filter="url(#uge-glow)" />
                    )}
                    <circle r={r} fill={`${node.color}22`} stroke={node.color} strokeWidth={isSelected ? 2.5 : 1.5} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={r * 0.8} className="pointer-events-none">
                      {NODE_ICONS[node.type] ?? '●'}
                    </text>
                    {zoom > 0.6 && (
                      <text y={r + 14} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="9" fontWeight={isSelected ? 600 : 400} className="pointer-events-none">
                        {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {layoutNodes.length === 0 && (
              <text x={SVG_WIDTH / 2} y={canvasHeight / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="13">
                Nenhum grafo disponível. Ative domínios acima.
              </text>
            )}
          </svg>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        {Object.entries(NODE_ICONS).map(([type, icon]) => (
          <span key={type} className="flex items-center gap-0.5">
            <span>{icon}</span>
            <span>{type.replace(/_/g, ' ')}</span>
          </span>
        ))}
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1"><span className="h-px w-4 bg-muted-foreground" /> relação</span>
        <span className="flex items-center gap-1"><span className="h-px w-4 border-t border-dashed border-amber-500" /> herança</span>
      </div>
    </div>
  );
}
