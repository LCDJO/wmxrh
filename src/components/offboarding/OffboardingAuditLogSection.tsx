/**
 * OffboardingAuditLogSection — Visual timeline of all offboarding audit events
 *
 * Shows: etapa, usuario, timestamp, decisão, justificativa
 */

import { useQuery } from '@tanstack/react-query';
import {
  listOffboardingAuditLog,
  OFFBOARDING_AUDIT_ACTIONS,
  OFFBOARDING_ETAPAS,
  DECISAO_VARIANTS,
} from '@/domains/automated-offboarding/offboarding-audit.service';
import type { OffboardingAuditEntry } from '@/domains/automated-offboarding/offboarding-audit.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ScrollText, Filter, Loader2, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useMemo } from 'react';

interface Props {
  tenantId: string;
  workflowId?: string;
  /** Show as standalone card (true) or inline table (false) */
  asCard?: boolean;
}

export function OffboardingAuditLogSection({ tenantId, workflowId, asCard = true }: Props) {
  const [filter, setFilter] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['offboarding_audit_log', tenantId, workflowId],
    queryFn: () => listOffboardingAuditLog(tenantId, workflowId, { limit: 500 }),
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(log =>
      (OFFBOARDING_AUDIT_ACTIONS[log.action] || log.action).toLowerCase().includes(q) ||
      (log.etapa && (OFFBOARDING_ETAPAS[log.etapa] || log.etapa).toLowerCase().includes(q)) ||
      (log.decisao || '').toLowerCase().includes(q) ||
      (log.justificativa || '').toLowerCase().includes(q)
    );
  }, [logs, filter]);

  const content = (
    <>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrar por ação, etapa, decisão..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30">
                <TableHead className="text-xs">Data/Hora</TableHead>
                <TableHead className="text-xs">Etapa</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
                <TableHead className="text-xs">Decisão</TableHead>
                <TableHead className="text-xs">Justificativa</TableHead>
                <TableHead className="text-xs">Usuário</TableHead>
                <TableHead className="text-xs">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(log => (
                <AuditRow key={log.id} log={log} />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </>
  );

  if (!asCard) return content;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-primary" />
          Auditoria do Desligamento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Registro imutável de todas as ações, decisões e justificativas do workflow.
        </p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function AuditRow({ log }: { log: OffboardingAuditEntry }) {
  const actionLabel = OFFBOARDING_AUDIT_ACTIONS[log.action] || log.action;
  const etapaLabel = log.etapa ? (OFFBOARDING_ETAPAS[log.etapa] || log.etapa) : '—';
  const decisaoVariant = log.decisao ? (DECISAO_VARIANTS[log.decisao] ?? 'outline') : undefined;

  // Extract summary from new_value changes
  const changeSummary = useMemo(() => {
    if (!log.old_value && !log.new_value) return null;
    if (log.new_value && !log.old_value) {
      const keys = Object.keys(log.new_value).filter(k => !['id', 'tenant_id', 'created_at'].includes(k));
      return keys.length > 0 ? keys.slice(0, 3).join(', ') : null;
    }
    if (log.old_value && log.new_value) {
      const changed: string[] = [];
      for (const key of Object.keys(log.new_value)) {
        if (JSON.stringify(log.old_value[key]) !== JSON.stringify(log.new_value[key])) {
          changed.push(key);
        }
      }
      return changed.length > 0 ? changed.slice(0, 3).join(', ') : null;
    }
    return null;
  }, [log.old_value, log.new_value]);

  return (
    <TableRow>
      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
        {format(parseISO(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}
      </TableCell>
      <TableCell>
        {log.etapa ? (
          <Badge variant="secondary" className="text-[10px]">{etapaLabel}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs font-medium text-foreground">{actionLabel}</TableCell>
      <TableCell>
        {log.decisao ? (
          <Badge variant={decisaoVariant} className="text-[10px]">{log.decisao}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={log.justificativa || undefined}>
        {log.justificativa || '—'}
      </TableCell>
      <TableCell className="text-xs font-mono text-muted-foreground">
        {log.actor_id?.slice(0, 8) ?? '—'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={changeSummary || undefined}>
        {changeSummary || '—'}
      </TableCell>
    </TableRow>
  );
}
