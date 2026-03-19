/**
 * AccessPreview — Right panel: shows effective permissions for a selected role or perm details.
 */
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Shield, Lock, Eye, CheckCircle2, ArrowRight, Globe, Layers,
} from 'lucide-react';
import type { GraphNode, GraphEdge } from './types';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission, PlatformAccessScope } from '@/pages/platform/security/PlatformSecurity';

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants', modulos: 'Módulos', auditoria: 'Auditoria',
  financeiro: 'Financeiro', fiscal: 'Fiscal', suporte: 'Suporte',
  usuarios: 'Usuários', seguranca: 'Segurança',
};

interface Props {
  selectedNodeId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  roles: PlatformRole[];
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  scopes: PlatformAccessScope[];
}

export function AccessPreview({ selectedNodeId, nodes, edges, roles, permissions, rolePerms, scopes }: Props) {
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // If a role is selected, show its effective permissions
  const rolePermsDetail = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'role') return null;
    const roleId = selectedNode.entityId;
    const permIds = new Set(rolePerms.filter(rp => rp.role_id === roleId).map(rp => rp.permission_id));
    const perms = permissions.filter(p => permIds.has(p.id));
    const scope = scopes.find(s => s.role_id === roleId);

    // Group by module
    const grouped = new Map<string, PlatformPermissionDef[]>();
    perms.forEach(p => {
      const list = grouped.get(p.module) || [];
      list.push(p);
      grouped.set(p.module, list);
    });

    return { perms, grouped, scope, total: permissions.length };
  }, [selectedNode, rolePerms, permissions, scopes]);

  // If a permission is selected, show which roles have it
  const permRolesDetail = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'permission') return null;
    const permId = selectedNode.entityId;
    const roleIds = new Set(rolePerms.filter(rp => rp.permission_id === permId).map(rp => rp.role_id));
    return roles.filter(r => roleIds.has(r.id));
  }, [selectedNode, rolePerms, roles]);

  // If a scope is selected, show scope info
  const scopeDetail = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'scope') return null;
    const scope = scopes.find(s => s.id === selectedNode.entityId);
    if (!scope) return null;
    const role = roles.find(r => r.id === scope.role_id);
    return { scope, role };
  }, [selectedNode, scopes, roles]);

  if (!selectedNode) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted mb-3">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">Access Preview</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Selecione um nó no grafo para ver detalhes de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Access Preview
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant={selectedNode.type === 'role' ? 'default' : selectedNode.type === 'scope' ? 'secondary' : 'outline'} className="text-[9px]">
            {selectedNode.type === 'role' ? 'Cargo' : selectedNode.type === 'permission' ? 'Permissão' : 'Escopo'}
          </Badge>
          <span className="text-sm font-semibold truncate">{selectedNode.label}</span>
        </div>
        {selectedNode.sublabel && (
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedNode.sublabel}</p>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3">
        {/* ── Role selected ── */}
        {rolePermsDetail && (
          <div className="py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Permissões Efetivas</span>
              <Badge variant="secondary" className="text-[9px]">
                {rolePermsDetail.perms.length}/{rolePermsDetail.total}
              </Badge>
            </div>

            {rolePermsDetail.scope && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Globe className="h-3 w-3" />
                Escopo: <span className="font-medium text-foreground">{rolePermsDetail.scope.scope_type}</span>
              </div>
            )}

            {Array.from(rolePermsDetail.grouped.entries()).map(([module, perms]) => (
              <div key={module}>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {MODULE_LABELS[module] || module}
                </p>
                <div className="space-y-0.5">
                  {perms.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      <span className="font-mono">{p.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Permission selected ── */}
        {permRolesDetail && (
          <div className="py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Concedida a</span>
              <Badge variant="secondary" className="text-[9px]">{permRolesDetail.length} cargos</Badge>
            </div>

            <div className="space-y-1.5">
              {permRolesDetail.map(role => (
                <div key={role.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 text-xs">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{role.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{role.slug}</p>
                  </div>
                  {role.is_system_role && <Badge variant="secondary" className="text-[8px]">Sistema</Badge>}
                </div>
              ))}
            </div>

            {typeof selectedNode.meta?.module === 'string' && (
              <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t border-border">
                <p>Módulo: <span className="font-medium text-foreground">{MODULE_LABELS[String(selectedNode.meta.module)] || String(selectedNode.meta.module)}</span></p>
                <p>Resource: <span className="font-mono text-foreground">{String(selectedNode.meta.resource)}</span></p>
                <p>Action: <span className="font-mono text-foreground">{String(selectedNode.meta.action)}</span></p>
              </div>
            )}
          </div>
        )}

        {/* ── Scope selected ── */}
        {scopeDetail && (
          <div className="py-3 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">Tipo:</span>
                <span>{scopeDetail.scope.scope_type}</span>
              </div>
              {scopeDetail.scope.scope_id && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">ID:</span>
                  <span className="font-mono">{scopeDetail.scope.scope_id}</span>
                </div>
              )}
              {scopeDetail.role && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Cargo:</span>
                  <span>{scopeDetail.role.name}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
