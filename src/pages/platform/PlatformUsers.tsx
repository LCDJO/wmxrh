/**
 * /platform/users — Dedicated platform users management page.
 * Re-uses PlatformUsersTab with its own data fetching.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformIdentity } from '@/domains/platform/PlatformGuard';
import { PlatformUsersTab } from '@/components/platform/PlatformUsersTab';
import { Users } from 'lucide-react';
import type { PlatformUser } from './PlatformSecurity';

export default function PlatformUsers() {
  const { user } = useAuth();
  const { identity } = usePlatformIdentity();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = identity?.role === 'platform_super_admin';

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('platform_users').select('*').order('created_at', { ascending: false });
    setUsers((data as PlatformUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
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

      <PlatformUsersTab
        users={users}
        loading={loading}
        isSuperAdmin={isSuperAdmin}
        currentUserId={user?.id}
        onRefresh={fetchUsers}
      />
    </div>
  );
}
