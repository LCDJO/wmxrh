/**
 * PlatformScimConfigs — Cross-tenant SCIM configuration overview.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function PlatformScimConfigs() {
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['platform-scim-configs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('scim_configs')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando...</p>;

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Auto-Create</TableHead>
              <TableHead>Auto-Deactivate</TableHead>
              <TableHead>Sync Groups</TableHead>
              <TableHead>Default Role</TableHead>
              <TableHead>Rules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.tenants?.name ?? c.tenant_id}</TableCell>
                <TableCell>
                  <Badge variant={c.is_enabled ? 'default' : 'secondary'}>
                    {c.is_enabled ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>{c.auto_create_users ? '✓' : '—'}</TableCell>
                <TableCell>{c.auto_deactivate_users ? '✓' : '—'}</TableCell>
                <TableCell>{c.sync_groups_to_roles ? '✓' : '—'}</TableCell>
                <TableCell><Badge variant="outline">{c.default_role}</Badge></TableCell>
                <TableCell>{Array.isArray(c.role_mapping_rules) ? c.role_mapping_rules.length : 0}</TableCell>
              </TableRow>
            ))}
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma configuração SCIM encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
