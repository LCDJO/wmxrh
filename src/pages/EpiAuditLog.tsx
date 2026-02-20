import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { ScrollText, Search, Filter, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const ACTION_LABELS: Record<string, string> = {
  entrega: 'Entrega',
  assinatura: 'Assinatura',
  substituicao: 'Substituição',
  devolucao: 'Devolução',
  vencimento_detectado: 'Vencimento',
  extravio: 'Extravio',
  invalidacao_assinatura: 'Invalidação',
};

const actionVariant = (a: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (a === 'extravio' || a === 'invalidacao_assinatura') return 'destructive';
  if (a === 'entrega' || a === 'assinatura') return 'default';
  return 'secondary';
};

export default function EpiAuditLog() {
  const { currentTenant } = useTenant();
  const currentTenantId = currentTenant?.id;
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['epi-audit-log', currentTenantId, actionFilter],
    queryFn: async () => {
      let q = supabase
        .from('epi_audit_log' as any)
        .select(`
          id, tenant_id, delivery_id, employee_id, action, executor,
          executor_user_id, entity_type, entity_id, details, metadata,
          ip_address, hash_documento, epi_catalog_id, created_at,
          employee:employee_id(name),
          epi_catalog:epi_catalog_id(nome)
        `)
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (actionFilter !== 'all') q = q.eq('action', actionFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!currentTenantId,
  });

  const filtered = logs.filter((log: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.employee?.name?.toLowerCase().includes(s) ||
      log.epi_catalog?.nome?.toLowerCase().includes(s) ||
      log.details?.toLowerCase().includes(s) ||
      log.hash_documento?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Auditoria Legal EPI</h1>
          <p className="text-sm text-muted-foreground">Registro imutável de todas as operações de EPI — prova jurídica</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador, EPI ou hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Ações</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Colaborador</TableHead>
              <TableHead>EPI</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Hash Documento</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <ScrollText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  Nenhum registro encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(log.action)}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{log.employee?.name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{log.epi_catalog?.nome ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {log.executor_user_id ? log.executor_user_id.slice(0, 8) + '…' : log.executor}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{log.ip_address ?? '—'}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
                    {log.hash_documento ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    {log.details ? (
                      <details className="text-xs text-muted-foreground cursor-pointer">
                        <summary className="hover:text-card-foreground truncate">{log.details.slice(0, 40)}…</summary>
                        <p className="mt-1 whitespace-pre-wrap">{log.details}</p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <pre className="mt-1 p-2 bg-secondary rounded text-[10px] overflow-auto max-h-32">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </details>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
