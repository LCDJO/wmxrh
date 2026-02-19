/**
 * WorkflowDesigner — Full visual drag-and-drop workflow builder.
 * Combines node palette + SVG canvas + config panel.
 */
import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Save, Play, Pause, RotateCcw, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowNodePalette } from './WorkflowNodePalette';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowNodeConfig } from './WorkflowNodeConfig';
import type { WfCanvasNode, WfCanvasEdge, WfNodeTemplate } from './types';

interface Props {
  tenantId: string;
  workflowId?: string;
  workflowName?: string;
  initialNodes?: WfCanvasNode[];
  initialEdges?: WfCanvasEdge[];
  onSave?: (data: { name: string; nodes: WfCanvasNode[]; edges: WfCanvasEdge[] }) => void;
}

let nodeCounter = 0;

export function WorkflowDesigner({
  tenantId, workflowId, workflowName: initialName,
  initialNodes = [], initialEdges = [], onSave,
}: Props) {
  const [name, setName] = useState(initialName ?? 'Novo Workflow');
  const [nodes, setNodes] = useState<WfCanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<WfCanvasEdge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'active' | 'paused'>('draft');

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // ── Add node from palette ───────────────────────────
  const handleAddNode = useCallback((template: WfNodeTemplate) => {
    const lastNode = nodes[nodes.length - 1];
    const newNode: WfCanvasNode = {
      id: `wfn_${++nodeCounter}_${Date.now()}`,
      templateKey: template.key,
      category: template.category,
      label: template.label,
      x: lastNode ? lastNode.x + 250 : 80,
      y: lastNode ? lastNode.y : 100 + nodes.filter(n => n.category === template.category).length * 90,
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    toast.success(`Nó "${template.label}" adicionado`);
  }, [nodes]);

  // ── Update node ─────────────────────────────────────
  const handleUpdateNode = useCallback((updated: WfCanvasNode) => {
    setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
  }, []);

  // ── Delete node ─────────────────────────────────────
  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setEdges(prev => prev.filter(e => e.sourceId !== selectedNodeId && e.targetId !== selectedNodeId));
    setSelectedNodeId(null);
    toast.success('Nó removido');
  }, [selectedNodeId]);

  // ── Connect nodes ───────────────────────────────────
  const handleStartConnect = useCallback((nodeId: string) => {
    setConnectingFrom(nodeId);
  }, []);

  const handleEndConnect = useCallback((targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) {
      setConnectingFrom(null);
      return;
    }
    // Check for duplicate
    const exists = edges.some(e => e.sourceId === connectingFrom && e.targetId === targetId);
    if (exists) {
      toast.error('Conexão já existe');
      setConnectingFrom(null);
      return;
    }

    const sourceNode = nodes.find(n => n.id === connectingFrom);
    let edgeType: WfCanvasEdge['edgeType'] = 'default';
    let label: string | undefined;

    if (sourceNode?.category === 'condition') {
      // First edge from condition = true, second = false
      const existingCondEdges = edges.filter(e => e.sourceId === connectingFrom);
      if (existingCondEdges.length === 0) {
        edgeType = 'condition_true';
        label = 'true';
      } else {
        edgeType = 'condition_false';
        label = 'false';
      }
    }

    const newEdge: WfCanvasEdge = {
      id: `wfe_${Date.now()}`,
      sourceId: connectingFrom,
      targetId: targetId,
      edgeType,
      label,
    };
    setEdges(prev => [...prev, newEdge]);
    setConnectingFrom(null);
    toast.success('Nós conectados');
  }, [connectingFrom, edges, nodes]);

  // ── Save ────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave?.({ name, nodes, edges });
    toast.success('Workflow salvo!');
  }, [name, nodes, edges, onSave]);

  // ── Reset ───────────────────────────────────────────
  const handleReset = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setConnectingFrom(null);
    toast.info('Canvas limpo');
  }, []);

  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-green-500/20 text-green-700 dark:text-green-400',
    paused: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card rounded-t-lg">
        <div className="flex items-center gap-3">
          <Workflow className="h-5 w-5 text-primary" />
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-8 w-64 text-sm font-semibold border-none bg-transparent focus-visible:ring-1"
          />
          <Badge className={`text-[10px] ${statusColors[status]}`}>{status.toUpperCase()}</Badge>
          <Badge variant="outline" className="text-[10px]">
            {nodes.length} nós • {edges.length} conexões
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Limpar
          </Button>
          {status === 'active' ? (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setStatus('paused')}>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setStatus('active')}>
              <Play className="h-3.5 w-3.5" /> Ativar
            </Button>
          )}
          <Button size="sm" className="gap-1 text-xs" onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden border border-t-0 border-border rounded-b-lg">
        {/* Left: Node Palette */}
        <WorkflowNodePalette onAddNode={handleAddNode} />

        {/* Center: Canvas */}
        <div className="flex-1 overflow-hidden">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            connectingFrom={connectingFrom}
            onSelectNode={id => { setSelectedNodeId(id); if (!id) setConnectingFrom(null); }}
            onNodesChange={setNodes}
            onStartConnect={handleStartConnect}
            onEndConnect={handleEndConnect}
          />
        </div>

        {/* Right: Config Panel */}
        {selectedNode && (
          <WorkflowNodeConfig
            node={selectedNode}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            onStartConnect={() => handleStartConnect(selectedNode.id)}
          />
        )}
      </div>
    </div>
  );
}
