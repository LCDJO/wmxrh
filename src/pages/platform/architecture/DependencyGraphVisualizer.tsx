/**
 * DependencyGraphVisualizer — Interactive SVG-based dependency graph
 *
 * Shows all modules as nodes connected by dependency edges.
 * Differentiates SaaS vs Tenant via color coding.
 * Highlights critical (mandatory) vs optional dependencies.
 */
import { useMemo, useState, useCallback } from 'react';
import { createArchitectureIntelligenceEngine } from '@/domains/architecture-intelligence';
import type { ArchModuleInfo, DependencyEdge } from '@/domains/architecture-intelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { GitBranch, Server, Briefcase, AlertTriangle, ArrowRight, X } from 'lucide-react';

// ── Layout constants ──
const NODE_W = 160;
const NODE_H = 52;
const PAD_X = 40;
const PAD_Y = 32;
const COL_GAP = 220;
const ROW_GAP = 80;

interface NodePos {
  x: number;
  y: number;
  mod: ArchModuleInfo;
}

/**
 * Simple two-column layout: SaaS (left) and Tenant (right).
 */
function layoutNodes(modules: ArchModuleInfo[]): { nodes: NodePos[]; width: number; height: number } {
  const saas = modules.filter(m => m.domain === 'saas');
  const tenant = modules.filter(m => m.domain === 'tenant');

  const maxRows = Math.max(saas.length, tenant.length, 1);

  const nodes: NodePos[] = [];

  saas.forEach((mod, i) => {
    nodes.push({ x: PAD_X, y: PAD_Y + 40 + i * ROW_GAP, mod });
  });

  tenant.forEach((mod, i) => {
    nodes.push({ x: PAD_X + COL_GAP + NODE_W, y: PAD_Y + 40 + i * ROW_GAP, mod });
  });

  const width = PAD_X * 2 + COL_GAP + NODE_W * 2;
  const height = PAD_Y * 2 + 40 + maxRows * ROW_GAP;

  return { nodes, width, height };
}

export default function DependencyGraphVisualizer() {
  const engine = useMemo(() => createArchitectureIntelligenceEngine(), []);
  const modules = useMemo(() => engine.getModules(), [engine]);
  const edges = useMemo(() => engine.getDependencyEdges(), [engine]);

  const [showOptional, setShowOptional] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, width, height } = useMemo(() => layoutNodes(modules), [modules]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodePos>();
    nodes.forEach(n => map.set(n.mod.key, n));
    return map;
  }, [nodes]);

  const visibleEdges = useMemo((): DependencyEdge[] => {
    let e: DependencyEdge[] = edges;
    if (!showOptional) e = e.filter((ed: DependencyEdge) => ed.is_mandatory);
    if (selected) e = e.filter((ed: DependencyEdge) => ed.from === selected || ed.to === selected);
    return e;
  }, [edges, showOptional, selected]);

  const highlightedKeys = useMemo((): Set<string> => {
    if (!selected) return new Set<string>();
    const keys = new Set<string>([selected]);
    visibleEdges.forEach((ed: DependencyEdge) => { keys.add(ed.from); keys.add(ed.to); });
    return keys;
  }, [selected, visibleEdges]);

  const handleNodeClick = useCallback((key: string) => {
    setSelected(prev => (prev === key ? null : key));
  }, []);

  // Stats
  const totalEdges = edges.length;
  const mandatoryEdges = edges.filter((e: DependencyEdge) => e.is_mandatory).length;
  const optionalEdges = totalEdges - mandatoryEdges;
  const saasCount = modules.filter((m: ArchModuleInfo) => m.domain === 'saas').length;
  const tenantCount = modules.filter((m: ArchModuleInfo) => m.domain === 'tenant').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Módulos" value={modules.length} />
        <StatCard label="SaaS Core" value={saasCount} color="text-blue-600" />
        <StatCard label="Tenant" value={tenantCount} color="text-emerald-600" />
        <StatCard label="Dep. Críticas" value={mandatoryEdges} color="text-destructive" />
        <StatCard label="Dep. Opcionais" value={optionalEdges} color="text-amber-600" />
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Grafo de Dependências
            </CardTitle>
            <div className="flex items-center gap-4">
              {selected && (
                <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" /> Limpar filtro
                </button>
              )}
              <div className="flex items-center gap-2">
                <Switch id="show-optional" checked={showOptional} onCheckedChange={setShowOptional} />
                <Label htmlFor="show-optional" className="text-xs">Mostrar opcionais</Label>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/40" />
              SaaS Core
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
              Tenant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-0.5 bg-destructive" />
              Dependência Crítica
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-0.5 bg-amber-400 border-dashed border-t-2 border-amber-400 bg-transparent" />
              Dependência Opcional
            </span>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[600px]"
          >
            {/* Column headers */}
            <text x={PAD_X + NODE_W / 2} y={PAD_Y + 12} textAnchor="middle" className="fill-blue-600 text-xs font-semibold">
              SaaS Core
            </text>
            <text x={PAD_X + COL_GAP + NODE_W + NODE_W / 2} y={PAD_Y + 12} textAnchor="middle" className="fill-emerald-600 text-xs font-semibold">
              Tenant
            </text>

            {/* Edges */}
            {visibleEdges.map((edge: DependencyEdge, i: number) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              if (!from || !to) return null;

              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;

              // If same column, route through side
              const sameCol = from.x === to.x;
              const cpx1 = sameCol ? from.x + NODE_W + 40 : (x1 + x2) / 2;
              const cpy1 = y1;
              const cpx2 = sameCol ? to.x + NODE_W + 40 : (x1 + x2) / 2;
              const cpy2 = y2;

              const isCritical = edge.is_mandatory;

              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={isCritical ? 'hsl(var(--destructive))' : '#f59e0b'}
                    strokeWidth={isCritical ? 2 : 1.5}
                    strokeDasharray={isCritical ? undefined : '6 3'}
                    opacity={selected ? 0.9 : 0.5}
                    markerEnd={isCritical ? 'url(#arrow-critical)' : 'url(#arrow-optional)'}
                  />
                </g>
              );
            })}

            {/* Arrow markers */}
            <defs>
              <marker id="arrow-critical" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--destructive))" />
              </marker>
              <marker id="arrow-optional" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
            </defs>

            {/* Nodes */}
            {nodes.map(({ x, y, mod }) => {
              const isSaas = mod.domain === 'saas';
              const isSelected = selected === mod.key;
              const isHighlighted = !selected || highlightedKeys.has(mod.key);
              const opacity = isHighlighted ? 1 : 0.3;

              const outCount = edges.filter((e: DependencyEdge) => e.from === mod.key).length;
              const inCount = edges.filter((e: DependencyEdge) => e.to === mod.key).length;
              const criticalIn = edges.filter((e: DependencyEdge) => e.to === mod.key && e.is_mandatory).length;

              return (
                <g
                  key={mod.key}
                  opacity={opacity}
                  onClick={() => handleNodeClick(mod.key)}
                  className="cursor-pointer"
                >
                  <rect
                    x={x}
                    y={y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={isSaas ? 'hsl(217 91% 60% / 0.08)' : 'hsl(160 60% 45% / 0.08)'}
                    stroke={isSelected
                      ? 'hsl(var(--primary))'
                      : isSaas
                        ? 'hsl(217 91% 60% / 0.3)'
                        : 'hsl(160 60% 45% / 0.3)'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={x + NODE_W / 2}
                    y={y + 20}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-semibold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {mod.label.length > 18 ? mod.label.slice(0, 16) + '…' : mod.label}
                  </text>
                  <text
                    x={x + NODE_W / 2}
                    y={y + 36}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                    style={{ pointerEvents: 'none' }}
                  >
                    ↑{inCount} ↓{outCount}{criticalIn > 0 ? ` ⚠${criticalIn}` : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </CardContent>
      </Card>

      {/* Selected module detail */}
      {selected && (
        <SelectedModuleDetail
          mod={modules.find(m => m.key === selected)!}
          edges={edges}
          modules={modules}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ── Selected module sidebar ──

function SelectedModuleDetail({
  mod,
  edges,
  modules,
  onClose,
}: {
  mod: ArchModuleInfo;
  edges: DependencyEdge[];
  modules: ArchModuleInfo[];
  onClose: () => void;
}) {
  const outgoing = edges.filter(e => e.from === mod.key);
  const incoming = edges.filter(e => e.to === mod.key);

  const resolveLabel = (key: string): string => modules.find((m: ArchModuleInfo) => m.key === key)?.label ?? key;

  return (
    <Card className="border-primary/30 animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {mod.domain === 'saas' ? <Server className="h-4 w-4 text-blue-600" /> : <Briefcase className="h-4 w-4 text-emerald-600" />}
            {mod.label}
            <Badge variant="outline" className="text-[10px] font-mono">{mod.key}</Badge>
          </CardTitle>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Outgoing */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> Depende de ({outgoing.length})
          </p>
          {outgoing.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhuma dependência</p>
          ) : (
            <div className="space-y-1.5">
              {outgoing.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                  {e.is_mandatory ? (
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  ) : (
                    <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <span className="font-medium">{resolveLabel(e.to)}</span>
                  <Badge variant={e.is_mandatory ? 'destructive' : 'secondary'} className="text-[10px] ml-auto">
                    {e.is_mandatory ? 'Crítica' : 'Opcional'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <ArrowRight className="h-3 w-3 rotate-180" /> Dependido por ({incoming.length})
          </p>
          {incoming.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum módulo depende deste</p>
          ) : (
            <div className="space-y-1.5">
              {incoming.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                  {e.is_mandatory ? (
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                  ) : (
                    <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <span className="font-medium">{resolveLabel(e.from)}</span>
                  <Badge variant={e.is_mandatory ? 'destructive' : 'secondary'} className="text-[10px] ml-auto">
                    {e.is_mandatory ? 'Crítica' : 'Opcional'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stat card ──

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card className="p-3 text-center">
      <p className={`text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}
