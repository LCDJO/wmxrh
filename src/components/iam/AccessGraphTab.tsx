/**
 * Access Graph — Visual permission inheritance tree (Admin only)
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { iamService, type CustomRole, type PermissionDefinition, type UserCustomRole, type TenantUser } from '@/domains/iam/iam.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, User, ChevronRight, Building2, Network, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

const SCOPE_LABELS: Record<string, string> = { tenant: 'Tenant', company_group: 'Grupo', company: 'Empresa' };

interface Props {
  members: TenantUser[];
  assignments: UserCustomRole[];
  roles: CustomRole[];
  permissions: PermissionDefinition[];
  tenantId: string;
}

interface UserNode {
  member: TenantUser;
  roleAssignments: {
    role: CustomRole;
    scopeType: string;
    scopeId: string | null;
    permCount: number;
  }[];
}

export function AccessGraphTab({ members, assignments, roles, permissions, tenantId }: Props) {
  // Load all role permissions
  const roleIds = roles.map(r => r.id);
  const { data: allRolePerms = [] } = useQuery({
    queryKey: ['iam_all_role_perms', tenantId],
    queryFn: async () => {
      const results = await Promise.all(roleIds.map(id => iamService.listRolePermissions(id)));
      return roleIds.map((id, i) => ({ roleId: id, perms: results[i] }));
    },
    enabled: roleIds.length > 0,
  });

  const rolePermCounts = useMemo(() => {
    const map = new Map<string, number>();
    allRolePerms.forEach(rp => map.set(rp.roleId, rp.perms.length));
    return map;
  }, [allRolePerms]);

  const rolesMap = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  const userNodes: UserNode[] = useMemo(() => {
    return members.map(m => {
      const userAssigns = assignments.filter(a => a.user_id === m.user_id);
      return {
        member: m,
        roleAssignments: userAssigns.map(a => ({
          role: rolesMap.get(a.role_id) || { id: a.role_id, name: a.role_id.slice(0, 8), slug: '', tenant_id: '', description: null, is_system: false, is_active: true, created_by: null, created_at: '', updated_at: '' },
          scopeType: a.scope_type,
          scopeId: a.scope_id,
          permCount: rolePermCounts.get(a.role_id) || 0,
        })),
      };
    }).sort((a, b) => b.roleAssignments.length - a.roleAssignments.length);
  }, [members, assignments, rolesMap, rolePermCounts]);

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Network className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>Nenhum membro encontrado para visualizar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Grafo de Acesso</h2>
        <p className="text-sm text-muted-foreground">Visualize a herança de permissões por usuário → cargo → escopo.</p>
      </div>

      <div className="space-y-3">
        {userNodes.map(node => (
          <Card key={node.member.user_id} className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium truncate">{node.member.name || node.member.email || 'Sem nome'}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate">{node.member.email || '—'}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {node.member.role}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="py-3 px-4">
              {node.roleAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum cargo customizado atribuído</p>
              ) : (
                <div className="space-y-2">
                  {node.roleAssignments.map((ra, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium text-foreground">{ra.role.name}</span>
                      <Badge variant={ra.scopeType === 'tenant' ? 'default' : ra.scopeType === 'company_group' ? 'outline' : 'secondary'} className="text-[10px]">
                        {SCOPE_LABELS[ra.scopeType] || ra.scopeType}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Key className="h-3 w-3" />{ra.permCount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
              <p className="text-xs text-muted-foreground">Usuários</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{roles.length}</p>
              <p className="text-xs text-muted-foreground">Cargos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{permissions.length}</p>
              <p className="text-xs text-muted-foreground">Permissões</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
