/**
 * ScimProvisionedUsersTab — View provisioned users from SCIM sync.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ScimProvisionedUsersTab() {
  const { currentTenant } = useTenant();

  const { data: users, isLoading } = useQuery({
    queryKey: ['scim_provisioned_users', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_provisioned_users')
        .select('*, scim_clients(name)')
        .eq('tenant_id', currentTenant!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando...</p>;

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>External ID</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map(u => (
            <TableRow key={u.id}>
              <TableCell className="font-medium text-sm">{u.display_name || '—'}</TableCell>
              <TableCell className="text-sm">{u.email || '—'}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{u.external_id}</TableCell>
              <TableCell className="text-xs">{(u as any).scim_clients?.name || '—'}</TableCell>
              <TableCell>
                <Badge variant={u.active ? 'default' : 'secondary'}>
                  {u.active ? 'Ativo' : 'Desativado'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(u.last_synced_at).toLocaleString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
          {users?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                Nenhum usuário provisionado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
