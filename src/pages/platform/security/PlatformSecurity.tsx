/**
 * Platform Security — Users + Roles & Permissions management for the SaaS platform.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformPermissions } from '@/domains/platform/use-platform-permissions';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Users, Key } from 'lucide-react';
import { PlatformUsersTab } from '@/components/platform/PlatformUsersTab';
import { PlatformRolesTab } from '@/components/platform/PlatformRolesTab';

export interface PlatformRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system_role: boolean;
  inherits_role_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformUser {
  id: string;
  user_id: string;
  email: string;
  display_name: string | null;
  role: string;
  role_id: string;
  status: string;
  created_at: string;
  /** Joined from platform_roles */
  platform_roles?: PlatformRole;
}

export interface PlatformPermissionDef {
  id: string;
  code: string;
  module: string;
  resource: string;
  action: string;
  domain: string;
  description: string | null;
}

export interface PlatformRolePermission {
  id: string;
  role: string;
  role_id: string;
  permission_id: string;
}

export interface PlatformAccessScope {
  id: string;
  role_id: string;
  scope_type: 'global' | 'platform_section';
  scope_id: string | null;
  created_at: string;
}

export default function PlatformSecurity() {
  const { user } = useAuth();
  const { can } = usePlatformPermissions();
  const { identity } = usePlatformIdentity();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [permissions, setPermissions] = useState<PlatformPermissionDef[]>([]);
  const [rolePerms, setRolePerms] = useState<PlatformRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = identity?.role === 'platform_super_admin';

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

  useEffect(() => { fetchAll(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Segurança & Acessos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários da plataforma, cargos e permissões do SaaS.
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Key className="h-4 w-4" /> Cargos & Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <PlatformUsersTab
            users={users}
            roles={roles}
            loading={loading}
            isSuperAdmin={isSuperAdmin}
            currentUserId={user?.id}
            onRefresh={fetchAll}
          />
        </TabsContent>

        <TabsContent value="roles">
          <PlatformRolesTab
            roles={roles}
            permissions={permissions}
            rolePerms={rolePerms}
            loading={loading}
            isSuperAdmin={isSuperAdmin}
            onRefresh={fetchAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
