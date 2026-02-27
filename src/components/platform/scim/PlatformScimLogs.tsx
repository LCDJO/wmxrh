/**
 * PlatformScimLogs — Cross-tenant SCIM provisioning logs viewer.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function PlatformScimLogs() {
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['platform-scim-logs', search, opFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('scim_provisioning_logs')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (opFilter !== 'all') query = query.eq('operation', opFilter);
      if (search.trim()) query = query.ilike('external_id', `%${search.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const opVariant = (op: string) => {
    if (op === 'CREATE') return 'default';
    if (op === 'DEACTIVATE' || op === 'DELETE') return 'destructive';
    return 'secondary';
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por external_id..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Operações</SelectItem>
            <SelectItem value="CREATE">CREATE</SelectItem>
            <SelectItem value="UPDATE">UPDATE</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
            <SelectItem value="DEACTIVATE">DEACTIVATE</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="LIST">LIST</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm">{l.tenants?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={opVariant(l.operation)}>{l.operation}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.resource_type}</TableCell>
                  <TableCell className="text-xs font-mono">{l.external_id ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={l.response_status < 300 ? 'default' : 'destructive'}>
                      {l.response_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{l.duration_ms}ms</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.ip_address ?? '—'}</TableCell>
                </TableRow>
              ))}
              {!isLoading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
