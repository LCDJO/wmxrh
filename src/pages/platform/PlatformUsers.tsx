/**
 * /platform/users — Dedicated platform users management page.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { useNavigate } from 'react-router-dom';
import { PlatformUsersTab } from '@/components/platform/PlatformUsersTab';
import { Button } from '@/components/ui/button';
import { Users, KeyRound } from 'lucide-react';
import type { PlatformUser, PlatformRole } from './PlatformSecurity';

export default function PlatformUsers() {
  const { user } = useAuth();
  const { identity } = usePlatformIdentity();
  const navigate = useNavigate();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchUsers = async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.all([
      supabase.from('platform_users').select('*, platform_roles(*)').order('created_at', { ascending: false }),
      supabase.from('platform_roles').select('*').order('name'),
    ]);
    setUsers((usersRes.data as PlatformUser[]) ?? []);
    setRoles((rolesRes.data as PlatformRole[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Usuários da Plataforma</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie quem tem acesso à gestão do SaaS.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/platform/iam')}>
          <KeyRound className="h-4 w-4" />
          Gerenciar Cargos & Permissões
        </Button>
      </div>

      <PlatformUsersTab
        users={users}
        roles={roles}
        loading={loading}
        isSuperAdmin={isSuperAdmin}
        currentUserId={user?.id}
        onRefresh={fetchUsers}
      />
    </div>
  );
}
