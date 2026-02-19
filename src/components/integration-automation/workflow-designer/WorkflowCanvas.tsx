/**
 * WorkflowCanvas — SVG canvas with draggable workflow nodes and bezier edges.
 */
import { useState, useRef, useCallback } from 'react';
import type { WfCanvasNode, WfCanvasEdge, WfCanvasViewport, WfDragState } from './types';
import { getTemplateByKey } from './node-catalog';
import {
  Building2, Globe, Receipt, UserPlus, Webhook, Send, CreditCard, Ticket,
  ExternalLink, GitBranch, BarChart3, Zap,
} from 'lucide-react';

const NODE_W = 200;
const NODE_H = 60;
const COND_H = 50;

const CATEGORY_COLORS = {
  trigger: { fill: 'hsl(210 80% 55% / 0.12)', stroke: 'hsl(210 80% 55% / 0.5)', text: 'hsl(210 80% 55%)' },
  action: { fill: 'hsl(142 60% 45% / 0.12)', stroke: 'hsl(142 60% 45% / 0.5)', text: 'hsl(142 60% 45%)' },
  condition: { fill: 'hsl(38 92% 50% / 0.12)', stroke: 'hsl(38 92% 50% / 0.5)', text: 'hsl(38 92% 50%)' },
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  default: 'hsl(var(--primary) / 0.5)',
  success: 'hsl(142 60% 45% / 0.6)',
  failure: 'hsl(var(--destructive) / 0.5)',
  condition_true: 'hsl(142 60% 45% / 0.6)',
  condition_false: 'hsl(var(--destructive) / 0.5)',
};

interface Props {
  nodes: WfCanvasNode[];
  edges: WfCanvasEdge[];
  selectedNodeId: string | null;
  connectingFrom: string | null;
  onSelectNode: (id: string | null) => void;
  onNodesChange: (nodes: WfCanvasNode[]) => void;
  onStartConnect: (nodeId: string) => void;
  onEndConnect: (nodeId: string) => void;
}

export function WorkflowCanvas({
  nodes, edges, selectedNodeId, connectingFrom,
  onSelectNode, onNodesChange, onStartConnect, onEndConnect,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<WfDragState | null>(null);
  const [viewport, setViewport] = useState<WfCanvasViewport>({ offsetX: 40, offsetY: 40, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const toCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.offsetX) / viewport.zoom,
      y: (clientY - rect.top - viewport.offsetY) / viewport.zoom,
    };
  }, [viewport]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const p = toCanvas(e.clientX, e.clientY);
    setDrag({ nodeId, offsetX: p.x - node.x, offsetY: p.y - node.y });
    onSelectNode(nodeId);
  }, [nodeMap, toCanvas, onSelectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (drag) {
      const p = toCanvas(e.clientX, e.clientY);
      onNodesChange(nodes.map(n =>
        n.id === drag.nodeId ? { ...n, x: p.x - drag.offsetX, y: p.y - drag.offsetY } : n
      ));
    } else if (isPanning) {
      setViewport(v => ({
        ...v,
        offsetX: panStart.current.ox + (e.clientX - panStart.current.x),
        offsetY: panStart.current.oy + (e.clientY - panStart.current.y),
      }));
    }
  }, [drag, isPanning, nodes, toCanvas, onNodesChange]);

  const handleMouseUp = useCallback(() => {
    setDrag(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).classList.contains('canvas-bg')) {
      onSelectNode(null);
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: viewport.offsetX, oy: viewport.offsetY };
    }
  }, [viewport, onSelectNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setViewport(v => ({ ...v, zoom: Math.min(2, Math.max(0.3, v.zoom + delta)) }));
  }, []);

  const getNodePort = (id: string, side: 'left' | 'right' | 'bottom') => {
    const node = nodeMap.get(id);
    if (!node) return { x: 0, y: 0 };
    const h = node.category === 'condition' ? COND_H : NODE_H;
    if (side === 'right') return { x: node.x + NODE_W, y: node.y + h / 2 };
    if (side === 'bottom') return { x: node.x + NODE_W / 2, y: node.y + h };
    return { x: node.x, y: node.y + h / 2 };
  };

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-background"
      style={{ cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : drag ? 'grabbing' : 'grab' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <defs>
        <pattern id="wf-grid" width="20" height="20" patternUnits="userSpaceOnUse"
          patternTransform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}>
          <circle cx="10" cy="10" r="0.5" fill="hsl(var(--border) / 0.3)" />
        </pattern>
        <marker id="arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 3 L 0 6 z" fill="hsl(var(--primary) / 0.5)" />
        </marker>
      </defs>
      <rect className="canvas-bg" width="100%" height="100%" fill="url(#wf-grid)" />

      <g transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}>
        {/* Edges */}
        {edges.map(edge => {
          const src = getNodePort(edge.sourceId, 'right');
          const tgt = getNodePort(edge.targetId, 'left');
          const dx = Math.abs(tgt.x - src.x) * 0.4;
          const color = EDGE_TYPE_COLORS[edge.edgeType] ?? EDGE_TYPE_COLORS.default;

          return (
            <g key={edge.id}>
              <path
                d={`M ${src.x} ${src.y} C ${src.x + dx} ${src.y}, ${tgt.x - dx} ${tgt.y}, ${tgt.x} ${tgt.y}`}
                fill="none"
                stroke={color}
                strokeWidth={2}
                markerEnd="url(#arrow)"
                className="pointer-events-none"
              />
              {edge.label && (
                <text
                  x={(src.x + tgt.x) / 2}
                  y={(src.y + tgt.y) / 2 - 6}
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isSelected = selectedNodeId === node.id;
          const isConnecting = connectingFrom === node.id;
          const colors = CATEGORY_COLORS[node.category];
          const h = node.category === 'condition' ? COND_H : NODE_H;
          const template = getTemplateByKey(node.templateKey);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={e => handleNodeMouseDown(e, node.id)}
              className="cursor-pointer"
            >
              {/* Node body */}
              {node.category === 'condition' ? (
                <polygon
                  points={`${NODE_W / 2},0 ${NODE_W},${h / 2} ${NODE_W / 2},${h} 0,${h / 2}`}
                  fill={colors.fill}
                  stroke={isSelected ? 'hsl(var(--primary))' : isConnecting ? 'hsl(var(--primary) / 0.8)' : colors.stroke}
                  strokeWidth={isSelected || isConnecting ? 2.5 : 1.2}
                />
              ) : (
                <rect
                  width={NODE_W} height={h} rx={10}
                  fill={colors.fill}
                  stroke={isSelected ? 'hsl(var(--primary))' : isConnecting ? 'hsl(var(--primary) / 0.8)' : colors.stroke}
                  strokeWidth={isSelected || isConnecting ? 2.5 : 1.2}
                />
              )}

              {/* Category badge */}
              <rect
                x={node.category === 'condition' ? NODE_W / 2 - 28 : 8}
                y={4}
                width={56} height={14} rx={7}
                fill={colors.stroke} opacity={0.3}
              />
              <text
                x={node.category === 'condition' ? NODE_W / 2 : 36}
                y={14}
                fontSize="7"
                fill={colors.text}
                textAnchor="middle"
                fontWeight="700"
                letterSpacing="0.5"
                style={{ textTransform: 'uppercase' }}
              >
                {node.category.toUpperCase()}
              </text>

              {/* Label */}
              <text
                x={node.category === 'condition' ? NODE_W / 2 : NODE_W / 2}
                y={node.category === 'condition' ? h / 2 + 4 : h / 2 + 6}
                fontSize="11"
                fontWeight="600"
                fill={colors.text}
                textAnchor="middle"
              >
                {node.label}
              </text>

              {/* Connect port (right) */}
              <circle
                cx={node.category === 'condition' ? NODE_W : NODE_W}
                cy={h / 2}
                r={5}
                fill={connectingFrom ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                className="cursor-crosshair hover:fill-[hsl(var(--primary))]"
                onMouseDown={e => { e.stopPropagation(); onStartConnect(node.id); }}
                onMouseUp={e => { e.stopPropagation(); if (connectingFrom && connectingFrom !== node.id) onEndConnect(node.id); }}
              />

              {/* Input port (left) */}
              {node.category !== 'trigger' && (
                <circle
                  cx={0}
                  cy={h / 2}
                  r={5}
                  fill="hsl(var(--muted))"
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                  className="cursor-crosshair"
                  onMouseUp={e => { e.stopPropagation(); if (connectingFrom && connectingFrom !== node.id) onEndConnect(node.id); }}
                />
              )}
            </g>
          );
        })}
      </g>

      {/* Zoom indicator */}
      <text x="12" y="20" fill="hsl(var(--muted-foreground))" fontSize="10" fontFamily="monospace">
        {Math.round(viewport.zoom * 100)}%
      </text>

      {/* Help text */}
      {nodes.length === 0 && (
        <text
          x="50%" y="50%"
          fill="hsl(var(--muted-foreground))"
          fontSize="14" textAnchor="middle" dominantBaseline="middle"
          opacity={0.5}
        >
          Adicione nós do painel lateral para começar
        </text>
      )}
    </svg>
  );
}
