/**
 * IncidentsPanel — Self-Healing incidents monitoring.
 * Shows incident_id, affected module, recovery actions, and status.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelfHealingStatus } from '@/hooks/use-self-healing-status';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, XCircle, Loader2, ShieldAlert, Clock } from 'lucide-react';
import type { Incident, HealingAuditEntry } from '@/domains/self-healing/types';

const severityConfig = {
  minor:    { label: 'Minor',    variant: 'secondary'   as const, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  major:    { label: 'Major',    variant: 'default'     as const, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  critical: { label: 'Crítico',  variant: 'destructive' as const, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  detected:   { label: 'Detectado',   icon: AlertTriangle, className: 'text-amber-500' },
  recovering: { label: 'Recuperando', icon: Loader2,       className: 'text-blue-500 animate-spin' },
  recovered:  { label: 'Recuperado',  icon: CheckCircle2,  className: 'text-emerald-500' },
  failed:     { label: 'Falhou',      icon: XCircle,       className: 'text-destructive' },
  escalated:  { label: 'Escalado',    icon: ShieldAlert,   className: 'text-amber-600' },
};

export default function IncidentsPanel() {
  const { activeIncidents } = useSelfHealingStatus();
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [auditLog, setAuditLog] = useState<HealingAuditEntry[]>([]);

  const refresh = useCallback(() => {
    try {
      const { getSelfHealingEngine } = require('@/domains/self-healing/self-healing-engine') as {
        getSelfHealingEngine: () => {
          getState: () => {
            active_incidents: Incident[];
            resolved_incidents: Incident[];
            audit_log: HealingAuditEntry[];
          };
        } | null;
      };
      const engine = getSelfHealingEngine();
      if (!engine) return;
      const state = engine.getState();
      setAllIncidents([...state.active_incidents, ...state.resolved_incidents]);
      setAuditLog(state.audit_log);
    } catch {
      // Engine not ready
    }
  }, []);

  useEffect(() => {
    refresh();
    try {
      const { getSelfHealingEngine } = require('@/domains/self-healing/self-healing-engine') as {
        getSelfHealingEngine: () => { onUpdate: (fn: () => void) => () => void } | null;
      };
      const engine = getSelfHealingEngine();
      if (engine) return engine.onUpdate(refresh);
    } catch { /* noop */ }
  }, [refresh]);

  const incidents = allIncidents.length > 0
    ? allIncidents.sort((a, b) => b.detected_at - a.detected_at)
    : [];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ativos" value={activeIncidents.length} className="text-amber-500" />
        <SummaryCard label="Recuperados" value={incidents.filter(i => i.status === 'recovered').length} className="text-emerald-500" />
        <SummaryCard label="Escalados" value={incidents.filter(i => i.status === 'escalated').length} className="text-amber-600" />
        <SummaryCard label="Ações no Log" value={auditLog.length} className="text-primary" />
      </div>

      {/* Incidents table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Incidentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/40" />
              <p className="text-sm font-medium">Nenhum incidente registrado</p>
              <p className="text-xs mt-1">O sistema está operando normalmente.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">ID</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Módulo(s)</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Ações</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map(incident => {
                    const sev = severityConfig[incident.severity];
                    const st = statusConfig[incident.status] ?? statusConfig.detected;
                    const StatusIcon = st.icon;
                    const actionsText = incident.recovery_actions
                      .map(a => a.type.replace(/_/g, ' '))
                      .join(', ') || '—';

                    return (
                      <TableRow key={incident.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {incident.id.slice(0, 16)}
                        </TableCell>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">
                          {incident.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {incident.affected_modules.map(m => (
                              <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sev.variant} className={sev.className}>
                            {sev.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                          {actionsText}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <StatusIcon className={`h-3.5 w-3.5 ${st.className}`} />
                            <span className="text-xs font-medium">{st.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <div className="flex items-center justify-end gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(incident.detected_at)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${className ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
