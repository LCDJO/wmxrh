import { describe, it, expect } from 'vitest';
import { MenuLayoutValidator } from '../menu-structure-engine';
import type { MenuTreeNode } from '../types';

const node = (id: string, slug: string, overrides: Partial<MenuTreeNode> = {}): MenuTreeNode => ({
  id,
  label: id,
  slug,
  parent_id: null,
  order_index: 0,
  depth_level: 0,
  role_permissions: [],
  ...overrides,
});

describe('MenuLayoutValidator', () => {
  const validator = new MenuLayoutValidator();

  // ── validate() ──

  describe('validate()', () => {
    it('returns valid for a correct flat tree', () => {
      const tree = [node('a', '/a'), node('b', '/b')];
      const result = validator.validate(tree);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects duplicate slugs', () => {
      const tree = [node('a', '/dup'), node('b', '/dup')];
      const result = validator.validate(tree);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'duplicate_path')).toBe(true);
    });

    it('detects empty slugs', () => {
      const tree = [node('a', ''), node('b', '/ok')];
      const result = validator.validate(tree);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'missing_path')).toBe(true);
    });

    it('detects max depth exceeded', () => {
      // MAX_TREE_DEPTH = 3, so depth_level 3 should error
      const child: MenuTreeNode = node('c', '/c', { depth_level: 3 });
      const mid: MenuTreeNode = node('b', '/b', { depth_level: 2, children: [child] });
      const root: MenuTreeNode = node('a', '/a', { depth_level: 1, children: [mid] });
      const top: MenuTreeNode = node('top', '/top', { children: [root] });
      const result = validator.validate([top]);
      expect(result.errors.some(e => e.type === 'max_depth')).toBe(true);
    });

    it('detects orphan nodes (parent_id referencing non-existent node)', () => {
      const tree = [node('a', '/a', { parent_id: 'ghost' })];
      const result = validator.validate(tree);
      expect(result.errors.some(e => e.type === 'orphan')).toBe(true);
    });

    it('warns on deep nesting (depth >= 2)', () => {
      const deep = node('d', '/d', { depth_level: 2 });
      const mid = node('m', '/m', { depth_level: 1, children: [deep] });
      const root = node('r', '/r', { children: [mid] });
      const result = validator.validate([root]);
      expect(result.warnings.some(w => w.type === 'deep_nesting')).toBe(true);
    });

    it('warns on too many children', () => {
      const children = Array.from({ length: 16 }, (_, i) => node(`c${i}`, `/c${i}`));
      const root = node('r', '/r', { children });
      const result = validator.validate([root]);
      expect(result.warnings.some(w => w.type === 'too_many_children')).toBe(true);
    });

    it('warns when node has no role_permissions', () => {
      const tree = [node('a', '/a', { role_permissions: [] })];
      const result = validator.validate(tree);
      expect(result.warnings.some(w => w.type === 'no_permission')).toBe(true);
    });

    it('does not warn when node has role_permissions', () => {
      const tree = [node('a', '/a', { role_permissions: ['Admin'] })];
      const result = validator.validate(tree);
      expect(result.warnings.filter(w => w.type === 'no_permission')).toHaveLength(0);
    });
  });

  // ── autoFix() ──

  describe('autoFix()', () => {
    it('fixes duplicate slugs by appending id suffix', () => {
      const tree = [node('abc1', '/dup'), node('xyz2', '/dup')];
      const { fixed, fixes } = validator.autoFix(tree);
      const slugs = fixed.map(n => n.slug);
      expect(new Set(slugs).size).toBe(2);
      expect(fixes.length).toBeGreaterThan(0);
    });

    it('fixes empty slugs', () => {
      const tree = [node('a', '  ')];
      const { fixed, fixes } = validator.autoFix(tree);
      expect(fixed[0].slug).not.toBe('');
      expect(fixes.some(f => f.includes('Slug vazio'))).toBe(true);
    });

    it('promotes children exceeding max depth', () => {
      // MAX_TREE_DEPTH=3, promotion triggers when node at depth>=3 HAS children
      const d4 = node('d4', '/d4');
      const d3 = node('d3', '/d3', { children: [d4] });
      const d2 = node('d2', '/d2', { children: [d3] });
      const d1 = node('d1', '/d1', { children: [d2] });
      const d0 = node('d0', '/d0', { children: [d1] });
      const { fixes } = validator.autoFix([d0]);
      expect(fixes.some(f => f.includes('promovidos'))).toBe(true);
    });

    it('does not fix role warnings when fixWarnings=false', () => {
      const tree = [node('a', '/a', { role_permissions: [] })];
      const { fixed } = validator.autoFix(tree, false);
      expect(fixed[0].role_permissions).toHaveLength(0);
    });

    it('assigns default roles to root nodes when fixWarnings=true', () => {
      const tree = [node('a', '/a', { role_permissions: [] })];
      const { fixed, fixes } = validator.autoFix(tree, true);
      expect(fixed[0].role_permissions.length).toBeGreaterThan(0);
      expect(fixes.some(f => f.includes('roles padrão'))).toBe(true);
    });

    it('inherits parent roles to children when fixWarnings=true', () => {
      const child = node('c', '/c', { role_permissions: [] });
      const parent = node('p', '/p', { role_permissions: ['Admin'], children: [child] });
      const { fixed } = validator.autoFix([parent], true);
      const fixedChild = fixed[0].children![0];
      expect(fixedChild.role_permissions).toContain('Admin');
    });

    it('produces a valid tree after autoFix on broken input', () => {
      const tree = [
        node('a', '/dup', { role_permissions: [] }),
        node('b', '/dup', { role_permissions: [] }),
        node('c', '', { role_permissions: [] }),
      ];
      const { fixed } = validator.autoFix(tree, true);
      const result = validator.validate(fixed);
      expect(result.errors).toHaveLength(0);
      // All no_permission warnings should be gone
      expect(result.warnings.filter(w => w.type === 'no_permission')).toHaveLength(0);
    });
  });
});
