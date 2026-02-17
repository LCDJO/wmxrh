/**
 * MenuStructureEngine — Types
 *
 * Hierarchical menu management with versioning, permissions, and validation.
 */

export interface MenuTreeNode {
  id: string;
  label: string;
  path: string;
  icon?: string;
  /** Permission key required to see this menu */
  requiredPermission?: string;
  /** Allowed platform roles (empty = all) */
  allowedRoles?: string[];
  /** Whether this node is locked from being moved */
  locked?: boolean;
  children?: MenuTreeNode[];
  /** Depth level in the tree (computed) */
  depth?: number;
}

export interface MenuVersion {
  id: string;
  version: number;
  tree: MenuTreeNode[];
  createdAt: string;
  createdBy: string;
  label?: string;
}

export interface MenuDiff {
  type: 'added' | 'removed' | 'moved' | 'renamed' | 'permission_changed';
  nodeId: string;
  nodeLabel: string;
  details: string;
}

export interface MenuValidationResult {
  valid: boolean;
  errors: MenuValidationError[];
  warnings: MenuValidationWarning[];
}

export interface MenuValidationError {
  nodeId: string;
  message: string;
  type: 'duplicate_path' | 'orphan' | 'max_depth' | 'circular' | 'missing_path';
}

export interface MenuValidationWarning {
  nodeId: string;
  message: string;
  type: 'deep_nesting' | 'too_many_children' | 'no_permission';
}

export const MAX_TREE_DEPTH = 3;
export const MAX_CHILDREN = 15;
