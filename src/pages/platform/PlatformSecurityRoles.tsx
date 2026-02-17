/**
 * /platform/security/roles — Criar e editar cargos da plataforma com matrix de permissões.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { PlatformPermissionMatrix } from '@/components/platform/PlatformPermissionMatrix';
import { Loader2, Shield } from 'lucide-react';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission } from './PlatformSecurity';

export default function PlatformSecurityRoles() {
  const { identity } = usePlatformIdentity();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchAll = async () => {
    setLoading(true);
    const [rolesRes, permsRes, rpRes] = await Promise.all([
      supabase.from('platform_roles').select('*').order('name'),
      supabase.from('platform_permission_definitions').select('*').order('module, code'),
      supabase.from('platform_role_permissions').select('*'),
    ]);
    setRoles((rolesRes.data as PlatformRole[]) ?? []);
    setPermissions((permsRes.data as PlatformPermissionDef[]) ?? []);
    setRolePerms((rpRes.data as PlatformRolePermission[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-platform-accent">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Cargos & Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Crie cargos, edite permissões e gerencie a matrix de acesso da plataforma.
          </p>
        </div>
      </div>

      <PlatformPermissionMatrix
        roles={roles}
        permissions={permissions}
        rolePerms={rolePerms}
        isSuperAdmin={isSuperAdmin}
        onRefresh={fetchAll}
      />
    </div>
  );
}
