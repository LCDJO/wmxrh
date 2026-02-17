/**
 * /platform/security/access-graph — Preview de acesso efetivo: Usuário → Cargo → Permissões.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AccessGraphView } from '@/components/platform/AccessGraphView';
import { Loader2, GitBranch } from 'lucide-react';
import type { PlatformUser, PlatformRole, PlatformPermissionDef, PlatformRolePermission } from './PlatformSecurity';

export default function PlatformSecurityAccessGraph() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [usersRes, rolesRes, permsRes, rpRes] = await Promise.all([
        supabase.from('platform_users').select('*, platform_roles(*)').order('created_at', { ascending: false }),
        supabase.from('platform_roles').select('*').order('name'),
        supabase.from('platform_permission_definitions').select('*').order('module, code'),
        supabase.from('platform_role_permissions').select('*'),
      ]);
      setUsers((usersRes.data as PlatformUser[]) ?? []);
      setRoles((rolesRes.data as PlatformRole[]) ?? []);
      setPermissions((permsRes.data as PlatformPermissionDef[]) ?? []);
      setRolePerms((rpRes.data as PlatformRolePermission[]) ?? []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <GitBranch className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Access Graph</h1>
          <p className="text-sm text-muted-foreground">
            Preview do acesso efetivo de cada usuário: caminho Usuário → Cargo → Permissões.
          </p>
        </div>
      </div>

      <AccessGraphView
        users={users}
        roles={roles}
        permissions={permissions}
        rolePerms={rolePerms}
      />
    </div>
  );
}
