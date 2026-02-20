/**
 * /platform/security/unified-graph — Unified Graph Engine visualization.
 * Interactive SVG graph with domain filters, node inspection, and inheritance paths.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Network, Filter, ZoomIn, ZoomOut, Maximize2, Info, AlertTriangle, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  platform_access: { label: 'Platform Access', color: 'hsl(265 80% 55%)', bgClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  tenant_access: { label: 'Acesso Cliente', color: 'hsl(210 100% 52%)', bgClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  permission: { label: 'Permissões', color: 'hsl(38 92% 50%)', bgClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  module_access: { label: 'Módulos', color: 'hsl(150 60% 45%)', bgClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  identity: { label: 'Identidade', color: 'hsl(0 72% 51%)', bgClass: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const INHERITANCE_RELATIONS = new Set<UnifiedEdgeRelation>([
  'INHERITS_ROLE', 'PLATFORM_INHERITS',
]);

const NODE_ICONS: Record<string, string> = {
  platform_user: '👤',
  tenant_user: '👥',
  role: '🔑',
  permission: '🛡️',
  module: '📦',
  tenant: '🏢',
  identity_session: '🪪',
  scope: '🎯',
  company_group: '🏗️',
  company: '🏭',
  resource: '📄',
};

// ════════════════════════════════════
// FORCE LAYOUT (simple spring simulation)
// ════════════════════════════════════

interface LayoutNode extends VisualizationNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function computeForceLayout(
  nodes: VisualizationNode[],
  edges: VisualizationEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  // Initialize positions in a circle
  const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.35;
    return {
      ...n,
      x: width / 2 + r * Math.cos(angle),
      y: height / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    };
  });

  const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));

  // Run simulation steps
  const ITERATIONS = 120;
  const REPULSION = 3000;
  const ATTRACTION = 0.008;
  const DAMPING = 0.85;
  const CENTER_GRAVITY = 0.01;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS;

    // Repulsion between all pairs
    for (let i = 0; i < layoutNodes.length; i++) {
      for (let j = i + 1; j < layoutNodes.length; j++) {
        const a = layoutNodes[i];
        const b = layoutNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = (REPULSION * cooling) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = dist * ATTRACTION * cooling;
      const fx = (dx / Math.max(dist, 1)) * force;
      const fy = (dy / Math.max(dist, 1)) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Center gravity
    for (const node of layoutNodes) {
      node.vx += (width / 2 - node.x) * CENTER_GRAVITY;
      node.vy += (height / 2 - node.y) * CENTER_GRAVITY;
    }

    // Apply velocities
    for (const node of layoutNodes) {
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;
      // Clamp to bounds
      node.x = Math.max(40, Math.min(width - 40, node.x));
      node.y = Math.max(40, Math.min(height - 40, node.y));
    }
  }

  return layoutNodes;
}

// ════════════════════════════════════
// COMPONENT
// ════════════════════════════════════

export default function PlatformUnifiedGraph() {
  const [activeDomains, setActiveDomains] = useState<Set<GraphDomain>>(
    new Set(['platform_access', 'tenant_access', 'permission', 'module_access', 'identity']),
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
  const SVG_HEIGHT = 700;

  // Build data
  const vizData: VisualizationData = useMemo(() => {
    const domainsArray = Array.from(activeDomains);
    try {
      const snapshot = unifiedGraphEngine.compose(domainsArray.length > 0 ? domainsArray : undefined);
      return unifiedGraphEngine.toVisualization(snapshot, { domains: domainsArray });
    } catch {
      return { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, domainBreakdown: {} as any } };
    }
  }, [activeDomains]);

  const riskData = useMemo(() => {
    try {
      const snapshot = unifiedGraphEngine.compose();
      return unifiedGraphEngine.assessRisk(snapshot);
    } catch {
      return null;
    }
  }, []);

  // Layout
  const layoutNodes = useMemo(
    () => computeForceLayout(vizData.nodes, vizData.edges, SVG_WIDTH, SVG_HEIGHT),
    [vizData.nodes, vizData.edges],
  );
  const nodeMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, n])), [layoutNodes]);

  // Filtered edges
  const visibleEdges = useMemo(() => {
    if (showInheritance) return vizData.edges;
    return vizData.edges.filter(e => !INHERITANCE_RELATIONS.has(e.relation));
  }, [vizData.edges, showInheritance]);

  // Connected nodes for highlighting
  const connectedToHovered = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    for (const e of visibleEdges) {
      if (e.source === hoveredNode) connected.add(e.target);
      if (e.target === hoveredNode) connected.add(e.source);
    }
    return connected;
  }, [hoveredNode, visibleEdges]);

  // Domain toggle
  const toggleDomain = useCallback((domain: GraphDomain) => {
    setActiveDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
    setSelectedNode(null);
  }, []);

  // Zoom
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.3));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };
  const handleMouseUp = () => setIsPanning(false);

  // Wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const getEdgePath = (edge: VisualizationEdge) => {
    const s = nodeMap.get(edge.source);
    const t = nodeMap.get(edge.target);
    if (!s || !t) return '';
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const cx = (s.x + t.x) / 2 + dy * 0.15;
    const cy = (s.y + t.y) / 2 - dx * 0.15;
    return `M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`;
  };

  const isInheritanceEdge = (e: VisualizationEdge) => INHERITANCE_RELATIONS.has(e.relation);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-600">
            <Network className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Unified Graph</h1>
            <p className="text-sm text-muted-foreground">
              Visualização unificada de todos os grafos de acesso, permissões e identidade.
            </p>
          </div>
        </div>
        {riskData && (
          <Badge
            variant="outline"
            className={
              riskData.overallLevel === 'critical' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
              riskData.overallLevel === 'high' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
              riskData.overallLevel === 'medium' ? 'border-yellow-500/50 text-yellow-400 bg-yellow-500/10' :
              'border-green-500/50 text-green-400 bg-green-500/10'
            }
          >
            <Shield className="h-3 w-3 mr-1" />
            Risco: {riskData.overallLevel.toUpperCase()} ({riskData.signals.length} sinais)
          </Badge>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Domain filters */}
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {(Object.entries(DOMAIN_CONFIG) as [GraphDomain, typeof DOMAIN_CONFIG[GraphDomain]][]).map(
            ([domain, config]) => (
              <button
                key={domain}
                onClick={() => toggleDomain(domain)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                  activeDomains.has(domain)
                    ? config.bgClass
                    : 'bg-muted/30 text-muted-foreground border-border/50 opacity-50'
                }`}
              >
                {config.label}
              </button>
            ),
          )}
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Inheritance toggle */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Switch checked={showInheritance} onCheckedChange={setShowInheritance} />
          Herança
        </label>

        <div className="h-5 w-px bg-border" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}><Maximize2 className="h-3.5 w-3.5" /></Button>
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span>{vizData.stats.totalNodes} nós</span>
          <span>{vizData.stats.totalEdges} arestas</span>
        </div>
      </div>

      {/* Graph canvas */}
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-0">
          <svg
            ref={svgRef}
            width="100%"
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className={`select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              {/* Arrow markers */}
              <marker id="arrow-default" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--muted-foreground) / 0.4)" />
              </marker>
              <marker id="arrow-inheritance" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(38 92% 50%)" />
              </marker>
              <marker id="arrow-highlight" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--primary))" />
              </marker>
              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {visibleEdges.map((edge, i) => {
                const isInherit = isInheritanceEdge(edge);
                const isHighlighted = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode);
                const isDimmed = hoveredNode && !isHighlighted;

                return (
                  <path
                    key={`edge-${i}`}
                    d={getEdgePath(edge)}
                    fill="none"
                    stroke={
                      isHighlighted ? 'hsl(var(--primary))'
                        : isInherit ? 'hsl(38 92% 50%)'
                        : 'hsl(var(--muted-foreground) / 0.25)'
                    }
                    strokeWidth={isHighlighted ? 2.5 : isInherit ? 1.8 : 1}
                    strokeDasharray={isInherit ? '6 3' : undefined}
                    opacity={isDimmed ? 0.1 : 1}
                    markerEnd={
                      isHighlighted ? 'url(#arrow-highlight)'
                        : isInherit ? 'url(#arrow-inheritance)'
                        : 'url(#arrow-default)'
                    }
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
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : node); }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                    opacity={isDimmed ? 0.15 : 1}
                    style={{ transition: 'opacity 200ms' }}
                  >
                    {/* Glow ring */}
                    {(isSelected || isHovered) && (
                      <circle r={r + 6} fill="none" stroke={node.color} strokeWidth="2" opacity={0.5} filter="url(#glow)" />
                    )}
                    {/* Node circle */}
                    <circle
                      r={r}
                      fill={`${node.color}22`}
                      stroke={node.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    {/* Icon */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={r * 0.8}
                      className="pointer-events-none"
                    >
                      {NODE_ICONS[node.type] ?? '●'}
                    </text>
                    {/* Label */}
                    <text
                      y={r + 14}
                      textAnchor="middle"
                      fill="hsl(var(--foreground))"
                      fontSize="9"
                      fontWeight={isSelected ? 600 : 400}
                      className="pointer-events-none"
                      opacity={zoom > 0.6 ? 1 : 0}
                    >
                      {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Empty state */}
            {layoutNodes.length === 0 && (
              <text x={SVG_WIDTH / 2} y={SVG_HEIGHT / 2} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="14">
                Nenhum grafo disponível. Ative domínios acima para visualizar.
              </text>
            )}
          </svg>
        </CardContent>
      </Card>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Domain breakdown */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Domínios</CardTitle>
            <CardDescription className="text-xs">Distribuição de nós e arestas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(Object.entries(DOMAIN_CONFIG) as [GraphDomain, typeof DOMAIN_CONFIG[GraphDomain]][]).map(
              ([domain, config]) => {
                const stats = vizData.stats.domainBreakdown[domain];
                return (
                  <div key={domain} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-foreground">{config.label}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {stats?.nodes ?? 0}n · {stats?.edges ?? 0}e
                    </span>
                  </div>
                );
              },
            )}
          </CardContent>
        </Card>

        {/* Selected node detail */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              {selectedNode ? 'Detalhe do Nó' : 'Selecione um Nó'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedNode ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{NODE_ICONS[selectedNode.type]}</span>
                  <span className="font-semibold text-foreground">{selectedNode.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="text-muted-foreground">Tipo</div>
                  <div className="text-foreground">{selectedNode.type}</div>
                  <div className="text-muted-foreground">Domínio</div>
                  <Badge variant="outline" className={`text-[10px] w-fit ${DOMAIN_CONFIG[selectedNode.domain].bgClass}`}>
                    {DOMAIN_CONFIG[selectedNode.domain].label}
                  </Badge>
                  <div className="text-muted-foreground">UID</div>
                  <div className="text-foreground font-mono text-[10px] break-all">{selectedNode.id}</div>
                </div>
                <div className="pt-1 border-t border-border/50">
                  <div className="text-muted-foreground mb-1">Conexões</div>
                  <div className="space-y-0.5">
                    {visibleEdges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .slice(0, 8)
                      .map((e, i) => {
                        const otherId = e.source === selectedNode.id ? e.target : e.source;
                        const otherNode = nodeMap.get(otherId);
                        const direction = e.source === selectedNode.id ? '→' : '←';
                        return (
                          <div key={i} className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground">{direction}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{e.relation}</Badge>
                            <span className="text-foreground truncate">{otherNode?.label ?? otherId}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Clique em um nó no grafo para ver detalhes.</p>
            )}
          </CardContent>
        </Card>

        {/* Risk signals */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Sinais de Risco
            </CardTitle>
            <CardDescription className="text-xs">
              {riskData ? `${riskData.signals.length} sinal(is) detectado(s)` : 'Calculando...'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {riskData && riskData.signals.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {riskData.signals.slice(0, 6).map((signal, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1 py-0 shrink-0 mt-0.5 ${
                        signal.level === 'critical' ? 'border-red-500/50 text-red-400' :
                        signal.level === 'high' ? 'border-orange-500/50 text-orange-400' :
                        signal.level === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                        'border-green-500/50 text-green-400'
                      }`}
                    >
                      {signal.level}
                    </Badge>
                    <div>
                      <div className="font-medium text-foreground">{signal.title}</div>
                      <div className="text-muted-foreground text-[10px] line-clamp-2">{signal.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum sinal de risco detectado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="border-border/50">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground text-xs">Legenda:</span>
            {Object.entries(NODE_ICONS).map(([type, icon]) => (
              <span key={type} className="flex items-center gap-1">
                <span>{icon}</span>
                <span>{type.replace(/_/g, ' ')}</span>
              </span>
            ))}
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1">
              <span className="h-px w-4 bg-muted-foreground" />
              <span>relação</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-4 border-t border-dashed border-amber-500" />
              <span>herança</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
