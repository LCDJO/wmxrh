/**
 * MenuStructureEngine
 *
 * ├── MenuTreeManager       — CRUD + tree manipulation
 * ├── HierarchicalDragController — level changes & reorder logic
 * ├── MenuPermissionResolver — role-based visibility
 * ├── MenuVersionTracker    — snapshot history
 * ├── MenuDiffAnalyzer      — diff between versions
 * ├── MenuLayoutValidator   — tree integrity checks
 */

import type {
  MenuTreeNode,
  MenuVersion,
  MenuDiff,
  MenuValidationResult,
  MenuValidationError,
  MenuValidationWarning,
} from './types';
import { MAX_TREE_DEPTH, MAX_CHILDREN } from './types';

// ════════════════════════════════════
// MenuTreeManager
// ════════════════════════════════════

export class MenuTreeManager {
  private tree: MenuTreeNode[];

  constructor(initial: MenuTreeNode[]) {
    this.tree = structuredClone(initial);
    this.recomputeDepths(this.tree, 0, null);
  }

  getTree(): MenuTreeNode[] {
    return this.tree;
  }

  setTree(tree: MenuTreeNode[]): void {
    this.tree = structuredClone(tree);
    this.recomputeDepths(this.tree, 0, null);
  }

  findNode(id: string, nodes: MenuTreeNode[] = this.tree): MenuTreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = this.findNode(id, n.children);
        if (found) return found;
      }
    }
    return null;
  }

  findParent(id: string, nodes: MenuTreeNode[] = this.tree, parent: MenuTreeNode | null = null): MenuTreeNode | null {
    for (const n of nodes) {
      if (n.id === id) return parent;
      if (n.children) {
        const found = this.findParent(id, n.children, n);
        if (found) return found;
      }
    }
    return null;
  }

  /** Remove node from tree, returning the removed node */
  removeNode(id: string, nodes: MenuTreeNode[] = this.tree): MenuTreeNode | null {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        const [removed] = nodes.splice(i, 1);
        return removed;
      }
      if (nodes[i].children) {
        const found = this.removeNode(id, nodes[i].children!);
        if (found) return found;
      }
    }
    return null;
  }

  /** Insert node at position within a parent (null = root) */
  insertNode(node: MenuTreeNode, parentId: string | null, index: number): boolean {
    if (!parentId) {
      this.tree.splice(Math.min(index, this.tree.length), 0, node);
      this.recomputeDepths(this.tree, 0, null);
      return true;
    }
    const parent = this.findNode(parentId);
    if (!parent) return false;
    if (!parent.children) parent.children = [];
    parent.children.splice(Math.min(index, parent.children.length), 0, node);
    this.recomputeDepths(this.tree, 0, null);
    return true;
  }

  /** Move node to new position */
  moveNode(nodeId: string, newParentId: string | null, newIndex: number): boolean {
    const node = this.findNode(nodeId);
    if (!node || node.locked) return false;
    const removed = this.removeNode(nodeId);
    if (!removed) return false;
    return this.insertNode(removed, newParentId, newIndex);
  }

  /** Promote a child to its parent's level (indent left) */
  promoteNode(nodeId: string): boolean {
    const parent = this.findParent(nodeId);
    if (!parent) return false; // already root
    const grandparent = this.findParent(parent.id);
    const parentIdx = grandparent
      ? (grandparent.children ?? []).findIndex(n => n.id === parent.id)
      : this.tree.findIndex(n => n.id === parent.id);
    const removed = this.removeNode(nodeId);
    if (!removed) return false;
    return this.insertNode(removed, grandparent?.id ?? null, parentIdx + 1);
  }

  /** Demote a root/sibling to become child of previous sibling (indent right) */
  demoteNode(nodeId: string): boolean {
    const parent = this.findParent(nodeId);
    const siblings = parent?.children ?? this.tree;
    const idx = siblings.findIndex(n => n.id === nodeId);
    if (idx <= 0) return false; // no previous sibling
    const prevSibling = siblings[idx - 1];
    const removed = this.removeNode(nodeId);
    if (!removed) return false;
    return this.insertNode(removed, prevSibling.id, (prevSibling.children?.length ?? 0));
  }

  flattenAll(nodes: MenuTreeNode[] = this.tree): MenuTreeNode[] {
    const result: MenuTreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children) result.push(...this.flattenAll(n.children));
    }
    return result;
  }

  private recomputeDepths(nodes: MenuTreeNode[], depth: number, parentId: string | null): void {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      n.depth_level = depth;
      n.parent_id = parentId;
      n.order_index = i;
      if (n.children) this.recomputeDepths(n.children, depth + 1, n.id);
    }
  }
}

// ════════════════════════════════════
// MenuPermissionResolver
// ════════════════════════════════════

export class MenuPermissionResolver {
  filterByRole(tree: MenuTreeNode[], userRole: string): MenuTreeNode[] {
    return tree
      .filter(n => !n.role_permissions || n.role_permissions.length === 0 || n.role_permissions.includes(userRole))
      .map(n => ({
        ...n,
        children: n.children ? this.filterByRole(n.children, userRole) : undefined,
      }));
  }

  getNodePermissions(nodeId: string, tree: MenuTreeNode[]): string[] {
    const mgr = new MenuTreeManager(tree);
    const node = mgr.findNode(nodeId);
    return node?.role_permissions ?? [];
  }
}

// ════════════════════════════════════
// MenuVersionTracker
// ════════════════════════════════════

const VERSION_STORAGE_KEY = 'menu_structure_versions';

export class MenuVersionTracker {
  private versions: MenuVersion[] = [];

  constructor() {
    this.load();
  }

  snapshot(tree: MenuTreeNode[], createdBy: string, label?: string): MenuVersion {
    const version: MenuVersion = {
      id: crypto.randomUUID(),
      version: (this.versions[0]?.version ?? 0) + 1,
      tree: structuredClone(tree),
      createdAt: new Date().toISOString(),
      createdBy,
      label,
    };
    this.versions.unshift(version);
    if (this.versions.length > 20) this.versions.pop();
    this.save();
    return version;
  }

  getVersions(): MenuVersion[] {
    return this.versions;
  }

  getVersion(id: string): MenuVersion | undefined {
    return this.versions.find(v => v.id === id);
  }

  restore(id: string): MenuTreeNode[] | null {
    const v = this.getVersion(id);
    return v ? structuredClone(v.tree) : null;
  }

  private save(): void {
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(this.versions));
    } catch { /* quota */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(VERSION_STORAGE_KEY);
      if (raw) this.versions = JSON.parse(raw);
    } catch { /* corrupt */ }
  }
}

// ════════════════════════════════════
// MenuDiffAnalyzer
// ════════════════════════════════════

export class MenuDiffAnalyzer {
  diff(before: MenuTreeNode[], after: MenuTreeNode[]): MenuDiff[] {
    const diffs: MenuDiff[] = [];
    const beforeFlat = this.flatten(before);
    const afterFlat = this.flatten(after);
    const beforeMap = new Map(beforeFlat.map(n => [n.id, n]));
    const afterMap = new Map(afterFlat.map(n => [n.id, n]));

    // Added
    for (const [id, node] of afterMap) {
      if (!beforeMap.has(id)) {
        diffs.push({ type: 'added', nodeId: id, nodeLabel: node.label, details: `Adicionado: ${node.slug}` });
      }
    }

    // Removed
    for (const [id, node] of beforeMap) {
      if (!afterMap.has(id)) {
        diffs.push({ type: 'removed', nodeId: id, nodeLabel: node.label, details: `Removido: ${node.slug}` });
      }
    }

    // Moved / Renamed
    for (const [id, afterNode] of afterMap) {
      const beforeNode = beforeMap.get(id);
      if (!beforeNode) continue;
      if (beforeNode.label !== afterNode.label) {
        diffs.push({ type: 'renamed', nodeId: id, nodeLabel: afterNode.label, details: `${beforeNode.label} → ${afterNode.label}` });
      }
      if (beforeNode.slug !== afterNode.slug || beforeNode.depth_level !== afterNode.depth_level) {
        diffs.push({ type: 'moved', nodeId: id, nodeLabel: afterNode.label, details: `Depth ${beforeNode.depth_level} → ${afterNode.depth_level}` });
      }
    }

    return diffs;
  }

  private flatten(nodes: MenuTreeNode[]): MenuTreeNode[] {
    const result: MenuTreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children) result.push(...this.flatten(n.children));
    }
    return result;
  }
}

// ════════════════════════════════════
// MenuLayoutValidator
// ════════════════════════════════════

export class MenuLayoutValidator {
  validate(tree: MenuTreeNode[]): MenuValidationResult {
    const errors: MenuValidationError[] = [];
    const warnings: MenuValidationWarning[] = [];
    const slugs = new Set<string>();

    this.walk(tree, 0, slugs, errors, warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  private walk(
    nodes: MenuTreeNode[],
    depth: number,
    slugs: Set<string>,
    errors: MenuValidationError[],
    warnings: MenuValidationWarning[],
  ): void {
    for (const n of nodes) {
      // Duplicate slug
      if (slugs.has(n.slug)) {
        errors.push({ nodeId: n.id, message: `Slug duplicado: ${n.slug}`, type: 'duplicate_path' });
      }
      slugs.add(n.slug);

      // Missing slug
      if (!n.slug || n.slug.trim() === '') {
        errors.push({ nodeId: n.id, message: `Slug vazio para "${n.label}"`, type: 'missing_path' });
      }

      // Max depth
      if (depth >= MAX_TREE_DEPTH) {
        errors.push({ nodeId: n.id, message: `Profundidade máxima (${MAX_TREE_DEPTH}) excedida`, type: 'max_depth' });
      }

      // Warnings
      if (depth >= 2) {
        warnings.push({ nodeId: n.id, message: `Aninhamento profundo (nível ${depth + 1})`, type: 'deep_nesting' });
      }

      if (n.children && n.children.length > MAX_CHILDREN) {
        warnings.push({ nodeId: n.id, message: `${n.children.length} filhos (max recomendado: ${MAX_CHILDREN})`, type: 'too_many_children' });
      }

      if (!n.role_permissions || n.role_permissions.length === 0) {
        warnings.push({ nodeId: n.id, message: `Sem restrição de role`, type: 'no_permission' });
      }

      if (n.children) {
        this.walk(n.children, depth + 1, slugs, errors, warnings);
      }
    }
  }
}

// ════════════════════════════════════
// Factory
// ════════════════════════════════════

export interface MenuStructureEngineAPI {
  tree: MenuTreeManager;
  permissions: MenuPermissionResolver;
  versions: MenuVersionTracker;
  diff: MenuDiffAnalyzer;
  validator: MenuLayoutValidator;
}

export function createMenuStructureEngine(initialTree: MenuTreeNode[]): MenuStructureEngineAPI {
  return {
    tree: new MenuTreeManager(initialTree),
    permissions: new MenuPermissionResolver(),
    versions: new MenuVersionTracker(),
    diff: new MenuDiffAnalyzer(),
    validator: new MenuLayoutValidator(),
  };
}
