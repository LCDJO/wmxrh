/**
 * ScimLogsTab — Provisioning audit logs.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ScimLogsTab() {
  const { currentTenant } = useTenant();

  const { data: logs, isLoading } = useQuery({
    queryKey: ['scim_provisioning_logs', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_provisioning_logs')
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

  const statusColor = (status: number) => {
    if (status < 300) return 'default';
    if (status < 500) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Operação</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duração</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs?.map(l => (
            <TableRow key={l.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(l.created_at).toLocaleString('pt-BR')}
              </TableCell>
              <TableCell className="text-xs">{(l as any).scim_clients?.name || '—'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{l.operation}</Badge>
              </TableCell>
              <TableCell className="text-xs">
                {l.resource_type}
                {l.resource_id && <span className="text-muted-foreground ml-1">({l.resource_id.slice(0, 8)}...)</span>}
              </TableCell>
              <TableCell>
                <Badge variant={statusColor(l.response_status) as any}>{l.response_status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {l.duration_ms != null ? `${l.duration_ms}ms` : '—'}
              </TableCell>
              <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                {l.error_message || '—'}
              </TableCell>
            </TableRow>
          ))}
          {logs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                Nenhum log de provisioning.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
