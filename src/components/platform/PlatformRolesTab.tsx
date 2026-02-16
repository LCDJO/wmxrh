/**
 * Platform Roles Tab — View roles, permission matrix, toggle permissions per role.
 */
import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlatformPermissionDef, PlatformRolePermission } from '@/pages/platform/PlatformSecurity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Shield, Lock, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PLATFORM_ROLES = [
  { key: 'platform_super_admin', label: 'Super Admin', description: 'Acesso total à plataforma', locked: true },
  { key: 'platform_operations', label: 'Operações', description: 'Gestão de tenants e módulos' },
  { key: 'platform_support', label: 'Suporte', description: 'Visualização e impersonação' },
  { key: 'platform_finance', label: 'Financeiro', description: 'Faturamento e billing' },
  { key: 'platform_read_only', label: 'Somente Leitura', description: 'Apenas visualização' },
];

const MODULE_LABELS: Record<string, string> = {
  tenants: 'Tenants',
  modulos: 'Módulos',
  auditoria: 'Auditoria',
  financeiro: 'Financeiro',
  usuarios: 'Usuários',
  seguranca: 'Segurança',
};

interface Props {
  permissions: PlatformPermissionDef[];
  rolePerms: PlatformRolePermission[];
  loading: boolean;
  isSuperAdmin: boolean;
  onRefresh: () => void;
}

export function PlatformRolesTab({ permissions, rolePerms, loading, isSuperAdmin, onRefresh }: Props) {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>('platform_super_admin');
  const [toggling, setToggling] = useState<string | null>(null);

  // Group permissions by module
  const groupedPerms = useMemo(() => {
    const map = new Map<string, PlatformPermissionDef[]>();
    permissions.forEach(p => {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    });
    return map;
  }, [permissions]);

  // Current role's permission IDs
  const currentRolePermIds = useMemo(() => {
    return new Set(rolePerms.filter(rp => rp.role === selectedRole).map(rp => rp.permission_id));
  }, [rolePerms, selectedRole]);

  const isLocked = selectedRole === 'platform_super_admin';

  const handleToggle = async (permId: string, currently: boolean) => {
    if (isLocked || !isSuperAdmin) return;
    setToggling(permId);

    if (currently) {
      // Remove
      const { error } = await supabase
        .from('platform_role_permissions')
        .delete()
        .eq('role', selectedRole as any)
        .eq('permission_id', permId);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // Add
      const { error } = await supabase
        .from('platform_role_permissions')
        .insert({ role: selectedRole, permission_id: permId } as any);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }

    setToggling(null);
    onRefresh();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Role cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLATFORM_ROLES.map(role => {
          const permCount = rolePerms.filter(rp => rp.role === role.key).length;
          const isActive = selectedRole === role.key;
          return (
            <Card
              key={role.key}
              className={`cursor-pointer transition-all ${isActive ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-sm'}`}
              onClick={() => setSelectedRole(role.key)}
            >
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {role.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Shield className="h-3.5 w-3.5 text-primary" />}
                    <span className="text-sm font-semibold">{role.label}</span>
                  </div>
                  {role.locked && <Badge variant="secondary" className="text-[9px]">Fixo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{role.description}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {permCount}/{permissions.length} permissões
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Permissões: {PLATFORM_ROLES.find(r => r.key === selectedRole)?.label}
              </CardTitle>
              <CardDescription>
                {isLocked
                  ? 'Super Admin possui todas as permissões (não editável).'
                  : isSuperAdmin
                    ? 'Clique para ativar/desativar permissões deste cargo.'
                    : 'Somente Super Admins podem editar permissões.'
                }
              </CardDescription>
            </div>
            {!isSuperAdmin && (
              <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" /> Visualização</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from(groupedPerms.entries()).map(([module, perms]) => (
              <div key={module}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {MODULE_LABELS[module] || module}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {perms.map(perm => {
                    const hasIt = currentRolePermIds.has(perm.id);
                    const isTogglingThis = toggling === perm.id;
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                          isLocked || !isSuperAdmin
                            ? 'cursor-default'
                            : 'cursor-pointer hover:bg-muted/50'
                        } ${hasIt ? 'border-primary/30 bg-primary/5' : 'border-border'}`}
                      >
                        <Checkbox
                          checked={hasIt}
                          disabled={isLocked || !isSuperAdmin || isTogglingThis}
                          onCheckedChange={() => handleToggle(perm.id, hasIt)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{perm.code}</p>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                          )}
                        </div>
                        {isTogglingThis && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
