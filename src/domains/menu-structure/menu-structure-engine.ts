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

export type MenuEditorRole =
  | 'PlatformSuperAdmin'
  | 'PlatformMarketing'
  | 'PlatformOperations'
  | 'TenantAdmin'
  | 'TenantUser';

/** Slug prefixes that PlatformMarketing can edit */
const MARKETING_EDITABLE_PREFIXES = [
  '/platform/website',
  '/platform/growth',
  '/platform/marketing',
];

export class MenuPermissionResolver {
  /** Filter tree to only visible nodes for a given role */
  filterByRole(tree: MenuTreeNode[], userRole: string): MenuTreeNode[] {
    return tree
      .filter(n => !n.role_permissions || n.role_permissions.length === 0 || n.role_permissions.includes(userRole))
      .map(n => ({
        ...n,
        children: n.children ? this.filterByRole(n.children, userRole) : undefined,
      }));
  }

  /** Check if a role can edit a specific node */
  canEditNode(node: MenuTreeNode, editorRole: MenuEditorRole): boolean {
    switch (editorRole) {
      case 'PlatformSuperAdmin':
        return true; // full access
      case 'PlatformMarketing':
        return MARKETING_EDITABLE_PREFIXES.some(prefix => node.slug.startsWith(prefix));
      case 'PlatformOperations':
        return !node.slug.startsWith('/platform/billing') && !node.slug.startsWith('/platform/fiscal');
      case 'TenantAdmin':
      case 'TenantUser':
        return false; // tenants cannot alter platform structure
    }
  }

  /** Check if a role can edit ANY node (global write access) */
  canEditTree(editorRole: MenuEditorRole): boolean {
    return editorRole !== 'TenantAdmin' && editorRole !== 'TenantUser';
  }

  /** Get human-readable scope description */
  getEditScopeLabel(editorRole: MenuEditorRole): string {
    switch (editorRole) {
      case 'PlatformSuperAdmin': return 'Acesso total';
      case 'PlatformMarketing': return 'Website & Growth';
      case 'PlatformOperations': return 'Operacional (exceto billing/fiscal)';
      case 'TenantAdmin':
      case 'TenantUser': return 'Somente leitura';
    }
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
    const allIds = new Set<string>();

    // 1. Walk tree for basic checks + collect all IDs
    this.walk(tree, 0, slugs, allIds, errors, warnings);

    // 2. Circular reference detection (parent_id pointing to descendant)
    this.detectCircularRefs(tree, errors);

    // 3. Orphan detection (parent_id references a non-existent node)
    this.detectOrphans(tree, allIds, errors);

    return { valid: errors.length === 0, errors, warnings };
  }

  /** Auto-fix common validation errors. Returns the fixed tree + list of fixes applied. */
  autoFix(tree: MenuTreeNode[]): { fixed: MenuTreeNode[]; fixes: string[] } {
    const result = structuredClone(tree);
    const fixes: string[] = [];
    const slugs = new Set<string>();

    const fixWalk = (nodes: MenuTreeNode[], depth: number, parentId: string | null) => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];

        // Fix parent_id sync
        if (n.parent_id !== parentId) {
          n.parent_id = parentId;
        }

        // Fix depth
        n.depth_level = depth;
        n.order_index = i;

        // Fix empty slug
        if (!n.slug || n.slug.trim() === '') {
          n.slug = `/${n.id}`;
          fixes.push(`Slug vazio corrigido para "${n.label}" → ${n.slug}`);
        }

        // Fix duplicate slug
        if (slugs.has(n.slug)) {
          const original = n.slug;
          n.slug = `${n.slug}-${n.id.slice(0, 4)}`;
          fixes.push(`Slug duplicado "${original}" renomeado → ${n.slug}`);
        }
        slugs.add(n.slug);

        // Fix max depth: move nodes exceeding max depth up to their grandparent
        if (depth >= MAX_TREE_DEPTH && n.children && n.children.length > 0) {
          fixes.push(`Filhos de "${n.label}" promovidos (profundidade ${depth + 1} > max ${MAX_TREE_DEPTH})`);
          // Promote children to current level
          nodes.splice(i + 1, 0, ...n.children.map(c => ({ ...c, parent_id: parentId, depth_level: depth })));
          n.children = [];
        }

        if (n.children && n.children.length > 0) {
          fixWalk(n.children, depth + 1, n.id);
        }
      }
    };

    fixWalk(result, 0, null);
    return { fixed: result, fixes };
  }

  /** Detect circular loops: a node whose parent_id is one of its own descendants */
  private detectCircularRefs(tree: MenuTreeNode[], errors: MenuValidationError[]): void {
    const flat = this.flatten(tree);
    const childrenMap = new Map<string, string[]>();
    for (const n of flat) {
      if (n.parent_id) {
        const list = childrenMap.get(n.parent_id) ?? [];
        list.push(n.id);
        childrenMap.set(n.parent_id, list);
      }
    }

    const getDescendants = (id: string, visited: Set<string>): boolean => {
      if (visited.has(id)) return true; // loop detected
      visited.add(id);
      for (const childId of childrenMap.get(id) ?? []) {
        if (getDescendants(childId, visited)) return true;
      }
      return false;
    };

    for (const n of flat) {
      if (n.parent_id) {
        const visited = new Set<string>();
        visited.add(n.id);
        // Check if parent_id eventually leads back to this node
        const parentChildren = childrenMap.get(n.id) ?? [];
        for (const childId of parentChildren) {
          const path = new Set<string>([n.id]);
          if (getDescendants(childId, path) && path.has(n.parent_id)) {
            errors.push({ nodeId: n.id, message: `Loop circular detectado: "${n.label}" referencia um ancestral como pai`, type: 'circular' });
            break;
          }
        }
      }
    }
  }

  /** Detect orphan nodes: parent_id points to a node that doesn't exist in the tree */
  private detectOrphans(tree: MenuTreeNode[], allIds: Set<string>, errors: MenuValidationError[]): void {
    const flat = this.flatten(tree);
    for (const n of flat) {
      if (n.parent_id && !allIds.has(n.parent_id)) {
        errors.push({ nodeId: n.id, message: `Nó órfão: parent_id "${n.parent_id}" não existe na árvore`, type: 'orphan' });
      }
    }
  }

  private walk(
    nodes: MenuTreeNode[],
    depth: number,
    slugs: Set<string>,
    allIds: Set<string>,
    errors: MenuValidationError[],
    warnings: MenuValidationWarning[],
  ): void {
    for (const n of nodes) {
      allIds.add(n.id);

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
        this.walk(n.children, depth + 1, slugs, allIds, errors, warnings);
      }
    }
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
