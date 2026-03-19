/**
 * PlatformIAM — Platform-level Identity & Access Management.
 *
 * Four tabs:
 *   1. Roles & Permissions — CRUD + matrix
 *   2. Graph Builder — Visual interactive permission graph
 *   3. Permission Graph — Static Role → Permission view
 *   4. Access Graph — User → Role → Permissions effective paths
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Network, GitBranch, Loader2, Workflow } from 'lucide-react';
import { PlatformRolesTab } from '@/components/platform/PlatformRolesTab';
import { PermissionGraphView } from '@/components/platform/PermissionGraphView';
import { AccessGraphView } from '@/components/platform/AccessGraphView';
import { PlatformPermissionGraphBuilder } from '@/components/platform/graph-builder/PlatformPermissionGraphBuilder';
import type { PlatformUser, PlatformRole, PlatformPermissionDef, PlatformRolePermission, PlatformAccessScope } from './security/PlatformSecurity';

export default function PlatformIAM() {
  const { user } = useAuth();
  const { identity } = usePlatformIdentity();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [scopes, setScopes] = useState<PlatformAccessScope[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchAll = async () => {
    setLoading(true);
    const [usersRes, rolesRes, permsRes, rpRes, scopesRes] = await Promise.all([
      supabase.from('platform_users').select('*, platform_roles(*)').order('created_at', { ascending: false }),
      supabase.from('platform_roles').select('*').order('name'),
      supabase.from('platform_permission_definitions').select('*').order('module, code'),
      supabase.from('platform_role_permissions').select('*'),
      supabase.from('platform_access_scopes').select('*'),
    ]);
    setUsers((usersRes.data as PlatformUser[]) ?? []);
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Key className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">
            IAM da Plataforma
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão de identidade e acesso do nível SaaS — independente de tenants.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="graph-builder" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph-builder" className="gap-1.5">
            <Workflow className="h-4 w-4" /> Graph Builder
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Key className="h-4 w-4" /> Cargos & Permissões
          </TabsTrigger>
          <TabsTrigger value="permission-graph" className="gap-1.5">
            <Network className="h-4 w-4" /> Permission Graph
          </TabsTrigger>
          <TabsTrigger value="access-graph" className="gap-1.5">
            <GitBranch className="h-4 w-4" /> Access Graph
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

        <TabsContent value="roles">
          <PlatformRolesTab
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
            loading={false}
            isSuperAdmin={isSuperAdmin}
            onRefresh={fetchAll}
          />
        </TabsContent>

        <TabsContent value="permission-graph">
          <PermissionGraphView
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
          />
        </TabsContent>

        <TabsContent value="access-graph">
          <AccessGraphView
            users={users}
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
