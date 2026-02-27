/**
 * ScimProvisionedGroupsTab — View provisioned groups from SCIM sync.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ScimProvisionedGroupsTab() {
  const { currentTenant } = useTenant();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['scim_provisioned_groups', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_provisioned_groups')
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
            <TableHead>Nome do Grupo</TableHead>
            <TableHead>External ID</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Membros</TableHead>
            <TableHead>Role Mapeado</TableHead>
            <TableHead>Último Sync</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups?.map(g => (
            <TableRow key={g.id}>
              <TableCell className="font-medium text-sm">{g.display_name}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{g.external_id}</TableCell>
              <TableCell className="text-xs">{(g as any).scim_clients?.name || '—'}</TableCell>
              <TableCell>
                <Badge variant="outline">{Array.isArray(g.members) ? g.members.length : 0}</Badge>
              </TableCell>
              <TableCell className="text-xs">{g.mapped_role || '—'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(g.last_synced_at).toLocaleString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
          {groups?.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                Nenhum grupo provisionado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
