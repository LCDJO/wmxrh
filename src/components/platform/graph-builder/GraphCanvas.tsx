/**
 * GraphCanvas — SVG canvas with draggable nodes, bezier edges, zoom/pan.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { GraphNode, GraphEdge, DragState, CanvasViewport } from './types';
import {
  Shield, Lock, Eye, Headphones, Wallet, Settings, Globe, Layout,
} from 'lucide-react';

// ── Node styling by slug/type ──────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  platform_super_admin: { bg: 'hsl(var(--destructive) / 0.12)', border: 'hsl(var(--destructive) / 0.5)', text: 'hsl(var(--destructive))' },
  platform_operations: { bg: 'hsl(var(--primary) / 0.12)', border: 'hsl(var(--primary) / 0.5)', text: 'hsl(var(--primary))' },
  platform_support: { bg: 'hsl(210 80% 55% / 0.12)', border: 'hsl(210 80% 55% / 0.5)', text: 'hsl(210 80% 55%)' },
  platform_finance: { bg: 'hsl(38 92% 50% / 0.12)', border: 'hsl(38 92% 50% / 0.5)', text: 'hsl(38 92% 50%)' },
  platform_fiscal: { bg: 'hsl(var(--accent) / 0.3)', border: 'hsl(var(--accent))', text: 'hsl(var(--accent-foreground))' },
  platform_read_only: { bg: 'hsl(var(--muted))', border: 'hsl(var(--border))', text: 'hsl(var(--muted-foreground))' },
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  platform_super_admin: Lock,
  platform_operations: Settings,
  platform_support: Headphones,
  platform_finance: Wallet,
  platform_fiscal: Shield,
  platform_read_only: Eye,
};

const NODE_W = 180;
const NODE_H_ROLE = 52;
const NODE_H_PERM = 36;
const NODE_H_SCOPE = 44;

// ── Edge colors ──────────────────────────────────────────

const EDGE_COLORS: Record<string, { stroke: string; dash?: string }> = {
  grants_permission: { stroke: 'hsl(var(--primary) / 0.4)' },
  inherits_role: { stroke: 'hsl(var(--destructive) / 0.5)', dash: '6 3' },
};

// ── Props ────────────────────────────────────────────────

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  onSelectNode: (id: string | null) => void;
  onNodesChange: (nodes: GraphNode[]) => void;
}

export function GraphCanvas({
  nodes, edges, selectedNodeId, highlightedNodeIds, onSelectNode, onNodesChange,
}: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [viewport, setViewport] = useState<CanvasViewport>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // ── Drag handling ────────────────────────────────────

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodeMap.get(nodeId);
    if (!node) return;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const mx = (e.clientX - svgRect.left - viewport.offsetX) / viewport.zoom;
    const my = (e.clientY - svgRect.top - viewport.offsetY) / viewport.zoom;

    setDrag({ nodeId, offsetX: mx - node.x, offsetY: my - node.y });
    onSelectNode(nodeId);
  }, [nodeMap, viewport, onSelectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (drag) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const mx = (e.clientX - svgRect.left - viewport.offsetX) / viewport.zoom;
      const my = (e.clientY - svgRect.top - viewport.offsetY) / viewport.zoom;

      const updated = nodes.map(n =>
        n.id === drag.nodeId ? { ...n, x: mx - drag.offsetX, y: my - drag.offsetY } : n
      );
      onNodesChange(updated);
    } else if (isPanning) {
      setViewport(v => ({
        ...v,
        offsetX: panStart.current.ox + (e.clientX - panStart.current.x),
        offsetY: panStart.current.oy + (e.clientY - panStart.current.y),
      }));
    }
  }, [drag, isPanning, nodes, viewport, onNodesChange]);

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

  // ── Zoom ──────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setViewport(v => ({ ...v, zoom: Math.min(2, Math.max(0.3, v.zoom + delta)) }));
  }, []);

  // ── Compute edge paths ────────────────────────────────

  const getNodeCenter = (id: string, side: 'left' | 'right') => {
    const node = nodeMap.get(id);
    if (!node) return { x: 0, y: 0 };
    const h = node.type === 'role' ? NODE_H_ROLE : node.type === 'scope' ? NODE_H_SCOPE : NODE_H_PERM;
    return {
      x: side === 'right' ? node.x + NODE_W : node.x,
      y: node.y + h / 2,
    };
  };

  const hasAnyHighlight = highlightedNodeIds.size > 0 || selectedNodeId;

  // ── Compute canvas bounds ─────────────────────────────

  const maxY = Math.max(600, ...nodes.map(n => n.y + 100));
  const maxX = Math.max(800, ...nodes.map(n => n.x + NODE_W + 40));

  return (
    <svg
      ref={svgRef}
      className="w-full bg-background rounded-lg border border-border"
      style={{ height: Math.min(maxY * viewport.zoom + 80, 800), cursor: isPanning ? 'grabbing' : drag ? 'grabbing' : 'grab' }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"
          patternTransform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}>
          <circle cx="10" cy="10" r="0.5" fill="hsl(var(--border) / 0.3)" />
        </pattern>
      </defs>
      <rect className="canvas-bg" width="100%" height="100%" fill="url(#grid)" />

      <g transform={`translate(${viewport.offsetX},${viewport.offsetY}) scale(${viewport.zoom})`}>
        {/* ── Edges ── */}
        {edges.map(edge => {
          const source = getNodeCenter(edge.sourceId, 'right');
          const target = getNodeCenter(edge.targetId, 'left');
          const edgeStyle = EDGE_COLORS[edge.type] ?? EDGE_COLORS.grants_permission;

          const isHighlighted = !hasAnyHighlight ||
            highlightedNodeIds.has(edge.sourceId) && highlightedNodeIds.has(edge.targetId);

          const dx = Math.abs(target.x - source.x) * 0.4;

          return (
            <path
              key={edge.id}
              d={`M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`}
              fill="none"
              stroke={edgeStyle.stroke}
              strokeWidth={isHighlighted ? 1.8 : 0.6}
              strokeDasharray={edgeStyle.dash}
              opacity={isHighlighted ? 0.8 : 0.1}
              className="transition-all duration-300 pointer-events-none"
            />
          );
        })}

        {/* ── Nodes ── */}
        {nodes.map(node => {
          const isSelected = selectedNodeId === node.id;
          const isHighlighted = !hasAnyHighlight || highlightedNodeIds.has(node.id);
          const h = node.type === 'role' ? NODE_H_ROLE : node.type === 'scope' ? NODE_H_SCOPE : NODE_H_PERM;

          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onMouseDown={e => handleNodeMouseDown(e, node.id)}
              className="cursor-pointer"
              opacity={isHighlighted ? 1 : 0.2}
              style={{ transition: 'opacity 0.3s' }}
            >
              {node.type === 'role' && <RoleNodeSvg node={node} w={NODE_W} h={h} isSelected={isSelected} />}
              {node.type === 'permission' && <PermNodeSvg node={node} w={NODE_W} h={h} isSelected={isSelected} />}
              {node.type === 'scope' && <ScopeNodeSvg node={node} w={NODE_W - 20} h={h} isSelected={isSelected} />}
            </g>
          );
        })}
      </g>

      {/* Zoom indicator */}
      <text
        x="12" y="20"
        fill="hsl(var(--muted-foreground))"
        fontSize="10" fontFamily="monospace"
      >
        {Math.round(viewport.zoom * 100)}%
      </text>
    </svg>
  );
}

// ── SVG Node Components ─────────────────────────────────────────

function RoleNodeSvg({ node, w, h, isSelected }: { node: GraphNode; w: number; h: number; isSelected: boolean }) {
  const slug = (node.meta?.slug as string) ?? '';
  const colors = ROLE_COLORS[slug] ?? ROLE_COLORS.platform_read_only;

  return (
    <>
      <rect
        width={w} height={h} rx={10}
        fill={colors.bg}
        stroke={isSelected ? 'hsl(var(--primary))' : colors.border}
        strokeWidth={isSelected ? 2.5 : 1.2}
      />
      {/* Icon placeholder */}
      <circle cx={20} cy={h / 2} r={10} fill={colors.border} opacity={0.3} />
      <text x={36} y={h / 2 - 4} fontSize="11" fontWeight="600" fill={colors.text}>
        {node.label}
      </text>
      <text x={36} y={h / 2 + 10} fontSize="8" fill={colors.text} opacity={0.6} fontFamily="monospace">
        {node.sublabel}
      </text>
    </>
  );
}

function PermNodeSvg({ node, w, h, isSelected }: { node: GraphNode; w: number; h: number; isSelected: boolean }) {
  return (
    <>
      <rect
        width={w} height={h} rx={6}
        fill={isSelected ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--card))'}
        stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
        strokeWidth={isSelected ? 2 : 1}
      />
      <text x={10} y={h / 2 + 1} fontSize="10" fontWeight="500" fill="hsl(var(--foreground))" fontFamily="monospace" dominantBaseline="middle">
        {node.label}
      </text>
    </>
  );
}

function ScopeNodeSvg({ node, w, h, isSelected }: { node: GraphNode; w: number; h: number; isSelected: boolean }) {
  return (
    <>
      <rect
        width={w} height={h} rx={22}
        fill="hsl(var(--secondary) / 0.5)"
        stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray="4 2"
      />
      <text x={16} y={h / 2 - 4} fontSize="10" fontWeight="600" fill="hsl(var(--secondary-foreground))" dominantBaseline="middle">
        {node.label}
      </text>
      <text x={16} y={h / 2 + 10} fontSize="8" fill="hsl(var(--muted-foreground))" dominantBaseline="middle">
        {node.sublabel}
      </text>
    </>
  );
}
