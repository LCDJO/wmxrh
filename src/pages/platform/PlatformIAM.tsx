/**
 * PlatformIAM — Platform-level Identity & Access Management.
 *
 * Three tabs:
 *   1. Roles & Permissions — CRUD + matrix (reuses PlatformRolesTab)
 *   2. Permission Graph — Visual Role → Permission graph
 *   3. Access Graph — User → Role → Permissions effective paths
 *
 * SECURITY: Platform-only. No tenant_id involved.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Network, GitBranch, Loader2 } from 'lucide-react';
import { PlatformRolesTab } from '@/components/platform/PlatformRolesTab';
import { PermissionGraphView } from '@/components/platform/PermissionGraphView';
import { AccessGraphView } from '@/components/platform/AccessGraphView';
import type { PlatformUser, PlatformPermissionDef, PlatformRolePermission } from './PlatformSecurity';

export default function PlatformIAM() {
  const { user } = useAuth();
  const { identity } = usePlatformIdentity();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchAll = async () => {
    setLoading(true);
    const [usersRes, permsRes, rpRes] = await Promise.all([
      supabase.from('platform_users').select('*').order('created_at', { ascending: false }),
      supabase.from('platform_permission_definitions').select('*').order('module, code'),
      supabase.from('platform_role_permissions').select('*'),
    ]);
    setUsers((usersRes.data as PlatformUser[]) ?? []);
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
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
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

        <TabsContent value="roles">
          <PlatformRolesTab
            permissions={permissions}
            rolePerms={rolePerms}
            loading={false}
            isSuperAdmin={isSuperAdmin}
            onRefresh={fetchAll}
          />
        </TabsContent>

        <TabsContent value="permission-graph">
          <PermissionGraphView
            permissions={permissions}
            rolePerms={rolePerms}
          />
        </TabsContent>

        <TabsContent value="access-graph">
          <AccessGraphView
            users={users}
            permissions={permissions}
            rolePerms={rolePerms}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
