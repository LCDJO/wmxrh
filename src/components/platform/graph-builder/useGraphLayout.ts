/**
 * useGraphLayout — Converts platform data into positioned graph nodes and edges.
 */
import { useMemo } from 'react';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission, PlatformAccessScope } from '@/pages/platform/PlatformSecurity';
import type { GraphNode, GraphEdge } from './types';

interface LayoutInput {
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  scopes: PlatformAccessScope[];
}

export function useGraphLayout({ roles, permissions, rolePerms, scopes }: LayoutInput) {
  return useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const ROLE_X = 80;
    const PERM_X = 480;
    const SCOPE_X = 280;

    // Group permissions by module for vertical ordering
    const moduleOrder = new Map<string, number>();
    const permsByModule = new Map<string, PlatformPermissionDef[]>();
    permissions.forEach(p => {
      if (!permsByModule.has(p.module)) {
        moduleOrder.set(p.module, moduleOrder.size);
        permsByModule.set(p.module, []);
      }
      permsByModule.get(p.module)!.push(p);
    });

    // Role nodes — left column
    roles.forEach((role, i) => {
      nodes.push({
        id: `role-${role.id}`,
        type: 'role',
        label: role.name,
        sublabel: role.slug,
        x: ROLE_X,
        y: 60 + i * 90,
        entityId: role.id,
        meta: { slug: role.slug, isSystem: role.is_system_role },
      });

      // Inheritance edges
      if (role.inherits_role_ids?.length) {
        role.inherits_role_ids.forEach(parentId => {
          edges.push({
            id: `inherit-${role.id}-${parentId}`,
            type: 'inherits_role',
            sourceId: `role-${role.id}`,
            targetId: `role-${parentId}`,
          });
        });
      }
    });

    // Permission nodes — right column, grouped by module
    let permY = 40;
    for (const [, perms] of permsByModule) {
      perms.forEach(perm => {
        nodes.push({
          id: `perm-${perm.id}`,
          type: 'permission',
          label: perm.code,
          sublabel: perm.description ?? undefined,
          x: PERM_X,
          y: permY,
          entityId: perm.id,
          meta: { module: perm.module, resource: perm.resource, action: perm.action },
        });
        permY += 46;
      });
      permY += 20; // module gap
    }

    // Scope nodes — middle column
    scopes.forEach((scope, i) => {
      const roleName = roles.find(r => r.id === scope.role_id)?.name ?? '';
      nodes.push({
        id: `scope-${scope.id}`,
        type: 'scope',
        label: scope.scope_type === 'global' ? 'Global' : scope.scope_id ?? 'Section',
        sublabel: roleName,
        x: SCOPE_X,
        y: 60 + i * 70,
        entityId: scope.id,
        meta: { scopeType: scope.scope_type, roleId: scope.role_id },
      });
    });

    // grants_permission edges
    rolePerms.forEach(rp => {
      edges.push({
        id: `grant-${rp.role_id}-${rp.permission_id}`,
        type: 'grants_permission',
        sourceId: `role-${rp.role_id}`,
        targetId: `perm-${rp.permission_id}`,
      });
    });

    return { nodes, edges };
  }, [roles, permissions, rolePerms, scopes]);
}
