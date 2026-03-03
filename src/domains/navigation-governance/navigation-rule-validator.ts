/**
 * NavigationRuleValidator
 *
 * Enforces structural rules on the navigation tree:
 *   1. Max 4 hierarchy levels
 *   2. No circular menu dependencies
 *   3. No orphan modules (every module must belong to a group)
 *   4. Every module must have a category (domain)
 */

import type { MenuNode, MenuHierarchy } from './menu-hierarchy-builder';
import type { ModuleDomain } from './menu-domain-classifier';

// ── Types ────────────────────────────────────────────────────

export type RuleSeverity = 'error' | 'warning';

export interface RuleViolation {
  rule: string;
  severity: RuleSeverity;
  message: string;
  node_id?: string;
  node_label?: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: RuleViolation[];
  stats: {
    max_depth_found: number;
    total_nodes: number;
    orphan_count: number;
    missing_category_count: number;
    circular_refs: number;
  };
}

// ── Constants ────────────────────────────────────────────────

const MAX_DEPTH = 4;

// ── Rule: Max 4 Levels ───────────────────────────────────────

function checkMaxDepth(nodes: MenuNode[], currentDepth: number, violations: RuleViolation[], maxFound: { value: number }) {
  for (const node of nodes) {
    const depth = currentDepth + 1;
    if (depth > maxFound.value) maxFound.value = depth;

    if (depth > MAX_DEPTH) {
      violations.push({
        rule: 'max_depth',
        severity: 'error',
        message: `"${node.label}" excede o limite de ${MAX_DEPTH} níveis (nível ${depth})`,
        node_id: node.id,
        node_label: node.label,
        details: `Profundidade atual: ${depth}. Máximo permitido: ${MAX_DEPTH}.`,
      });
    }

    if (node.children.length > 0) {
      checkMaxDepth(node.children, depth, violations, maxFound);
    }
  }
}

// ── Rule: No Circular Dependencies ───────────────────────────

function checkCircularDependencies(nodes: MenuNode[], violations: RuleViolation[]): number {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  let circularCount = 0;

  function dfs(node: MenuNode, path: string[]) {
    if (inStack.has(node.id)) {
      circularCount++;
      violations.push({
        rule: 'no_circular',
        severity: 'error',
        message: `Dependência circular detectada: ${[...path, node.id].join(' → ')}`,
        node_id: node.id,
        node_label: node.label,
        details: `Caminho circular: ${path.join(' → ')} → ${node.id}`,
      });
      return;
    }

    if (visited.has(node.id)) return;

    visited.add(node.id);
    inStack.add(node.id);

    for (const child of node.children) {
      dfs(child, [...path, node.id]);
    }

    inStack.delete(node.id);
  }

  for (const node of nodes) {
    dfs(node, []);
  }

  return circularCount;
}

// ── Rule: No Orphan Modules ──────────────────────────────────

function checkOrphanModules(hierarchy: MenuHierarchy, violations: RuleViolation[]): number {
  let orphanCount = 0;

  function findOrphans(nodes: MenuNode[], parentIsGroup: boolean) {
    for (const node of nodes) {
      // A leaf node (moduleKey set) that has no parent group is orphan
      if (node.moduleKey && !parentIsGroup && !node.id.startsWith('group:')) {
        orphanCount++;
        violations.push({
          rule: 'no_orphans',
          severity: 'error',
          message: `Módulo órfão: "${node.label}" não pertence a nenhum grupo`,
          node_id: node.id,
          node_label: node.label,
          details: 'Todo módulo deve estar vinculado a um grupo funcional.',
        });
      }
      if (node.children.length > 0) {
        findOrphans(node.children, node.id.startsWith('group:'));
      }
    }
  }

  // Top-level modules without a group parent are orphans
  const allTopLevel = [...hierarchy.platform, ...hierarchy.tenant];
  for (const node of allTopLevel) {
    if (node.moduleKey && !node.id.startsWith('group:')) {
      orphanCount++;
      violations.push({
        rule: 'no_orphans',
        severity: 'error',
        message: `Módulo órfão: "${node.label}" está no nível raiz sem grupo`,
        node_id: node.id,
        node_label: node.label,
        details: 'Módulos devem estar dentro de um grupo funcional (domain group).',
      });
    }
    if (node.children.length > 0) {
      findOrphans(node.children, node.id.startsWith('group:'));
    }
  }

  return orphanCount;
}

// ── Rule: Category Required ──────────────────────────────────

function checkCategoryRequired(nodes: MenuNode[], violations: RuleViolation[]): number {
  let missingCount = 0;

  function walk(list: MenuNode[]) {
    for (const node of list) {
      // Skip group headers — they define the category
      if (node.id.startsWith('group:')) {
        walk(node.children);
        continue;
      }

      if (!node.domain) {
        missingCount++;
        violations.push({
          rule: 'category_required',
          severity: 'error',
          message: `"${node.label}" não possui categoria (domain) definida`,
          node_id: node.id,
          node_label: node.label,
          details: 'Cada módulo deve ter uma categoria funcional atribuída.',
        });
      }

      walk(node.children);
    }
  }

  walk(nodes);
  return missingCount;
}

// ── Count nodes ──────────────────────────────────────────────

function countNodes(nodes: MenuNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count++;
    count += countNodes(n.children);
  }
  return count;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Validate a MenuHierarchy against all structural rules.
 */
export function validateNavigationRules(hierarchy: MenuHierarchy): ValidationResult {
  const violations: RuleViolation[] = [];
  const allNodes = [...hierarchy.platform, ...hierarchy.tenant];
  const maxFound = { value: 0 };

  // Rule 1: Max depth
  checkMaxDepth(allNodes, 0, violations, maxFound);

  // Rule 2: No circular dependencies
  const circularRefs = checkCircularDependencies(allNodes, violations);

  // Rule 3: No orphan modules
  const orphanCount = checkOrphanModules(hierarchy, violations);

  // Rule 4: Category required
  const missingCategoryCount = checkCategoryRequired(allNodes, violations);

  const totalNodes = countNodes(allNodes);

  return {
    valid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    stats: {
      max_depth_found: maxFound.value,
      total_nodes: totalNodes,
      orphan_count: orphanCount,
      missing_category_count: missingCategoryCount,
      circular_refs: circularRefs,
    },
  };
}

/**
 * The 4 structural rules, exported for documentation / UI.
 */
export const NAVIGATION_RULES = [
  {
    id: 'max_depth',
    label: 'Máximo 4 níveis hierárquicos',
    description: `A árvore de navegação não pode exceder ${MAX_DEPTH} níveis de profundidade.`,
  },
  {
    id: 'no_circular',
    label: 'Sem dependência circular',
    description: 'Nenhum nó pode referenciar um ancestral, criando um ciclo.',
  },
  {
    id: 'no_orphans',
    label: 'Módulos órfãos proibidos',
    description: 'Todo módulo deve pertencer a um grupo funcional (domain group).',
  },
  {
    id: 'category_required',
    label: 'Categoria obrigatória',
    description: 'Cada módulo deve ter uma categoria (domain) definida.',
  },
] as const;
