/**
 * ScimQueueTab — View provisioning queue status.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ScimQueueTab() {
  const { currentTenant } = useTenant();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['scim_provisioning_queue', currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scim_provisioning_queue')
        .select('*, scim_clients(name)')
        .eq('tenant_id', currentTenant!.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 10_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground mt-4">Carregando...</p>;

  const statusVariant = (s: string) => {
    switch (s) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'processing': return 'outline';
      case 'failed': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Criado em</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Operação</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>External ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tentativas</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs?.map(j => (
            <TableRow key={j.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(j.created_at).toLocaleString('pt-BR')}
              </TableCell>
              <TableCell className="text-xs">{(j as any).scim_clients?.name || '—'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{j.operation}</Badge>
              </TableCell>
              <TableCell className="text-xs">{j.resource_type}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">{j.external_id}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(j.status) as any}>{j.status}</Badge>
              </TableCell>
              <TableCell className="text-xs text-center">{j.attempts}/{j.max_attempts}</TableCell>
              <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                {j.error_message || '—'}
              </TableCell>
            </TableRow>
          ))}
          {jobs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                Nenhum job na fila.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
