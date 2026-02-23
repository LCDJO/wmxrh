/**
 * EmployeeAuditLog Section — Ficha do Trabalhador
 *
 * Shows immutable change history: campo_alterado, valor_anterior, valor_novo, usuario, timestamp.
 * Reads from audit_logs table filtered by entity_id = employeeId.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollText, ArrowRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  employeeId: string;
  tenantId: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string | null;
  active_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
  insert: 'Inserção',
  upsert: 'Atualização',
};

const ACTION_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  insert: 'default',
  update: 'outline',
  upsert: 'outline',
  delete: 'destructive',
};

/** Extract changed fields by diffing old_value vs new_value */
function extractChanges(entry: AuditEntry): Array<{ campo: string; anterior: string; novo: string }> {
  const oldVal = (entry.old_value ?? {}) as Record<string, unknown>;
  const newVal = (entry.new_value ?? {}) as Record<string, unknown>;

  // For creates, show all new fields
  if (entry.action === 'create' || entry.action === 'insert') {
    return Object.entries(newVal)
      .filter(([k]) => !['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at'].includes(k))
      .slice(0, 8)
      .map(([k, v]) => ({
        campo: k,
        anterior: '—',
        novo: formatValue(v),
      }));
  }

  // For updates, diff fields
  const changes: Array<{ campo: string; anterior: string; novo: string }> = [];
  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);

  for (const key of allKeys) {
    if (['id', 'tenant_id', 'created_at', 'updated_at', 'deleted_at'].includes(key)) continue;
    const prev = oldVal[key];
    const next = newVal[key];
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes.push({
        campo: key,
        anterior: formatValue(prev),
        novo: formatValue(next),
      });
    }
  }

  return changes;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function EmployeeAuditLogSection({ employeeId, tenantId }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['employee_audit_log', employeeId],
    queryFn: async () => {
      // Fetch audit logs for this employee across all entity types
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('entity_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando histórico de auditoria...</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado para este colaborador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Registro imutável de todas as alterações na ficha do colaborador.
      </p>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/30">
              <TableHead className="text-xs">Data/Hora</TableHead>
              <TableHead className="text-xs">Ação</TableHead>
              <TableHead className="text-xs">Entidade</TableHead>
              <TableHead className="text-xs">Campo Alterado</TableHead>
              <TableHead className="text-xs">Valor Anterior</TableHead>
              <TableHead className="text-xs">Valor Novo</TableHead>
              <TableHead className="text-xs">Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const changes = extractChanges(log);
              if (changes.length === 0) {
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANTS[log.action] ?? 'secondary'} className="text-[10px]">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.entity_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs text-muted-foreground">—</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {(log.active_user_id ?? log.user_id)?.slice(0, 8) ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              }
              return changes.map((change, idx) => (
                <TableRow key={`${log.id}-${idx}`}>
                  {idx === 0 ? (
                    <>
                      <TableCell rowSpan={changes.length} className="text-xs text-muted-foreground whitespace-nowrap align-top">
                        {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell rowSpan={changes.length} className="align-top">
                        <Badge variant={ACTION_VARIANTS[log.action] ?? 'secondary'} className="text-[10px]">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell rowSpan={changes.length} className="text-xs text-muted-foreground align-top">
                        {log.entity_type}
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell className="text-xs font-medium text-card-foreground">{change.campo}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{change.anterior}</TableCell>
                  <TableCell className="text-xs text-card-foreground max-w-[150px] truncate">{change.novo}</TableCell>
                  {idx === 0 ? (
                    <TableCell rowSpan={changes.length} className="text-xs font-mono text-muted-foreground align-top">
                      {(log.active_user_id ?? log.user_id)?.slice(0, 8) ?? '—'}
                    </TableCell>
                  ) : null}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
