/**
 * /platform/security/permissions — Visualizar herança e grafo de permissões.
 * Inclui o Permission Graph e o Graph Builder visual.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Network, Workflow, Loader2, Key } from 'lucide-react';
import { PermissionGraphView } from '@/components/platform/PermissionGraphView';
import { PlatformPermissionGraphBuilder } from '@/components/platform/graph-builder/PlatformPermissionGraphBuilder';
import type { PlatformRole, PlatformPermissionDef, PlatformRolePermission, PlatformAccessScope } from './PlatformSecurity';

export default function PlatformSecurityPermissions() {
  const { identity } = usePlatformIdentity();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [scopes, setScopes] = useState<PlatformAccessScope[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchAll = async () => {
    setLoading(true);
    const [rolesRes, permsRes, rpRes, scopesRes] = await Promise.all([
      supabase.from('platform_roles').select('*').order('name'),
      supabase.from('platform_permission_definitions').select('*').order('module, code'),
      supabase.from('platform_role_permissions').select('*'),
      supabase.from('platform_access_scopes').select('*'),
    ]);
    setRoles((rolesRes.data as PlatformRole[]) ?? []);
    setPermissions((permsRes.data as PlatformPermissionDef[]) ?? []);
    setRolePerms((rpRes.data as PlatformRolePermission[]) ?? []);
    setScopes((scopesRes.data as PlatformAccessScope[]) ?? []);
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
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Key className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Permissões & Herança</h1>
          <p className="text-sm text-muted-foreground">
            Visualize e edite o grafo de permissões, herança entre cargos e escopos de acesso.
          </p>
        </div>
      </div>

      <Tabs defaultValue="graph-builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph-builder" className="gap-1.5">
            <Workflow className="h-4 w-4" /> Graph Builder
          </TabsTrigger>
          <TabsTrigger value="permission-graph" className="gap-1.5">
            <Network className="h-4 w-4" /> Permission Graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graph-builder">
          <PlatformPermissionGraphBuilder
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
            scopes={scopes}
            isSuperAdmin={isSuperAdmin}
          />
        </TabsContent>

        <TabsContent value="permission-graph">
          <PermissionGraphView
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
