/**
 * Graph Builder Types — Node, Edge, and Canvas types for the visual permission builder.
 */

export type NodeType = 'role' | 'permission' | 'scope';
export type EdgeType = 'grants_permission' | 'inherits_role';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  /** DB entity ID */
  entityId: string;
  /** Extra metadata */
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceId: string;
  targetId: string;
}

export interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

export interface CanvasViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}
