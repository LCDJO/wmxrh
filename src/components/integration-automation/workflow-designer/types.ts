/**
 * Visual Workflow Designer — Types
 */

export type WfNodeCategory = 'trigger' | 'action' | 'condition';

export interface WfNodeTemplate {
  key: string;
  category: WfNodeCategory;
  label: string;
  description: string;
  icon: string; // lucide icon name
  configFields: WfConfigField[];
}

export interface WfConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'json';
  options?: string[];
  required?: boolean;
}

export interface WfCanvasNode {
  id: string;
  templateKey: string;
  category: WfNodeCategory;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
}

export interface WfCanvasEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: 'default' | 'success' | 'failure' | 'condition_true' | 'condition_false';
  label?: string;
}

export interface WfCanvasViewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface WfDragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}
