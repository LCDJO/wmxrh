/**
 * AtlasRelationsGraph — Interactive graph showing table relationships using React Flow.
 */
import { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSchemaData, type SchemaTable, type ForeignKey } from '@/domains/platform/system-atlas/use-schema-data';
import { getModuleForTable } from '@/domains/platform/system-atlas/module-table-mapping';
import { GitBranch, Loader2, Search, Database } from 'lucide-react';

const MODULE_COLORS: Record<string, string> = {
  core_hr: '#3b82f6',
  compensation: '#10b981',
  benefits: '#f59e0b',
  agreements: '#8b5cf6',
  compliance: '#ef4444',
  recruitment: '#06b6d4',
  fleet: '#f97316',
  billing: '#ec4899',
  iam: '#6366f1',
  automation: '#14b8a6',
  audit: '#a855f7',
  observability: '#64748b',
  growth: '#22c55e',
  governance: '#e11d48',
  api_management: '#0ea5e9',
};

function buildGraph(tables: SchemaTable[], foreignKeys: ForeignKey[], filter: string) {
  // Get unique tables involved in FK relationships
  const fkTables = new Set<string>();
  foreignKeys.forEach(fk => {
    fkTables.add(fk.source_table);
    fkTables.add(fk.target_table);
  });

  const tablesToShow = tables.filter(t => {
    if (filter && !t.table_name.toLowerCase().includes(filter.toLowerCase())) return false;
    return filter ? true : fkTables.has(t.table_name);
  });

  // Arrange in a grid
  const cols = Math.ceil(Math.sqrt(tablesToShow.length));
  const nodes: Node[] = tablesToShow.map((t, i) => {
    const mod = getModuleForTable(t.table_name);
    const color = mod ? MODULE_COLORS[mod.key] ?? '#64748b' : '#64748b';
    return {
      id: t.table_name,
      position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 100 },
      data: {
        label: t.table_name,
      },
      style: {
        background: `${color}15`,
        border: `1px solid ${color}40`,
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: color,
        fontWeight: 600,
        minWidth: '140px',
        textAlign: 'center' as const,
      },
    };
  });

  const nodeIds = new Set(nodes.map(n => n.id));
  const edges: Edge[] = foreignKeys
    .filter(fk => nodeIds.has(fk.source_table) && nodeIds.has(fk.target_table))
    .map((fk, i) => ({
      id: `fk-${i}`,
      source: fk.source_table,
      target: fk.target_table,
      label: fk.source_column,
      type: 'default',
      animated: false,
      style: { stroke: '#64748b', strokeWidth: 1 },
      labelStyle: { fontSize: '9px', fill: '#94a3b8' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
    }));

  return { nodes, edges };
}

export default function AtlasRelationsGraph() {
  const { data: schema, loading, error } = useSchemaData();
  const [filter, setFilter] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!schema) return { nodes: [], edges: [] };
    return buildGraph(schema.tables, schema.foreign_keys, filter);
  }, [schema, filter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when filter changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando grafo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-center text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  const selectedTableData = schema?.tables.find(t => t.table_name === selectedNode);
  const selectedFKs = schema?.foreign_keys.filter(fk => fk.source_table === selectedNode || fk.target_table === selectedNode) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filtrar tabelas no grafo..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline" className="text-xs">
          {nodes.length} nós · {edges.length} conexões
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          <Card className="border-border/50 bg-card/80 backdrop-blur overflow-hidden">
            <div style={{ height: '600px' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                fitView
                attributionPosition="bottom-left"
              >
                <Background color="hsl(var(--muted-foreground) / 0.1)" gap={20} />
                <Controls />
                <MiniMap
                  style={{ background: 'hsl(var(--card))' }}
                  nodeColor={(n) => n.style?.border?.toString().replace('1px solid ', '') ?? '#64748b'}
                />
              </ReactFlow>
            </div>
          </Card>
        </div>

        {/* Detail Panel */}
        <div className="xl:col-span-1">
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                {selectedNode ? selectedNode : 'Detalhes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode && selectedTableData ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Colunas</p>
                    <div className="space-y-0.5">
                      {selectedTableData.columns.slice(0, 15).map(c => (
                        <div key={c.column_name} className="flex items-center gap-1 text-[10px] font-mono">
                          <span className="text-foreground truncate">{c.column_name}</span>
                          <span className="text-muted-foreground ml-auto">{c.udt_name}</span>
                        </div>
                      ))}
                      {selectedTableData.columns.length > 15 && (
                        <p className="text-[10px] text-muted-foreground">+{selectedTableData.columns.length - 15} mais</p>
                      )}
                    </div>
                  </div>
                  {selectedFKs.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Relações</p>
                      {selectedFKs.map((fk, i) => (
                        <div key={i} className="text-[10px] font-mono text-muted-foreground">
                          {fk.source_table}.{fk.source_column} → {fk.target_table}.{fk.target_column}
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const mod = getModuleForTable(selectedNode);
                    if (!mod) return null;
                    return (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Módulo</p>
                        <Badge variant="secondary" className="text-[10px]">{mod.label}</Badge>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Clique em um nó do grafo para ver detalhes</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
