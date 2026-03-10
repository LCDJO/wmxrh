/**
 * AlertsPanel — Security alerts panel with actions (resolve, investigate, block).
 * Generates alerts from suspicious session flags + risk scores.
 */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertTriangle, ShieldCheck, Search as SearchIcon, Ban,
  CheckCircle, Eye, ShieldAlert
} from 'lucide-react';

// ═══════════════════════════════
// TYPES
// ═══════════════════════════════

export interface SessionAlert {
  id: string;
  sessionId: string;
  userId: string;
  tenantId: string | null;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  ip: string;
  timestamp: Date;
  details: string;
  status: 'open' | 'investigating' | 'resolved' | 'blocked';
}

interface AlertsPanelProps {
  sessions: Array<{
    id: string;
    user_id: string;
    tenant_id: string | null;
    ip_address: string | null;
    city: string | null;
    country: string | null;
    login_at: string;
    status: string;
  }>;
  flags: Map<string, Array<{
    type: string;
    label: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details?: string;
  }>>;
  riskScores: Map<string, { score: number; level: string; factors: Array<{ label: string; points: number }> }>;
}

// ═══════════════════════════════
// COMPONENT
// ═══════════════════════════════

export function AlertsPanel({ sessions, flags, riskScores }: AlertsPanelProps) {
  const [alertStatuses, setAlertStatuses] = useState<Map<string, SessionAlert['status']>>(new Map());
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [blockConfirm, setBlockConfirm] = useState<SessionAlert | null>(null);

  // Generate alerts from flags + risk scores
  const alerts = useMemo<SessionAlert[]>(() => {
    const result: SessionAlert[] = [];
    let counter = 0;

    flags.forEach((sessionFlags, sessionId) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;

      sessionFlags.forEach(flag => {
        counter++;
        result.push({
          id: `alert-${counter}`,
          sessionId,
          userId: session.user_id,
          tenantId: session.tenant_id,
          alertType: flag.label,
          severity: flag.severity,
          location: [session.city, session.country].filter(Boolean).join(', ') || '—',
          ip: session.ip_address ?? '—',
          timestamp: new Date(session.login_at),
          details: flag.details ?? '',
          status: alertStatuses.get(`alert-${counter}`) ?? 'open',
        });
      });
    });

    // Also generate alerts for high-risk sessions without flags
    sessions.forEach(s => {
      const risk = riskScores.get(s.id);
      if (risk && risk.level === 'high' && !flags.has(s.id)) {
        counter++;
        result.push({
          id: `alert-${counter}`,
          sessionId: s.id,
          userId: s.user_id,
          tenantId: s.tenant_id,
          alertType: `Score de Risco Alto (${risk.score})`,
          severity: 'high',
          location: [s.city, s.country].filter(Boolean).join(', ') || '—',
          ip: s.ip_address ?? '—',
          timestamp: new Date(s.login_at),
          details: risk.factors.map(f => `${f.label}: +${f.points}`).join(', '),
          status: alertStatuses.get(`alert-${counter}`) ?? 'open',
        });
      }
    });

    // Sort: critical first, then by timestamp
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return result.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9) || b.timestamp.getTime() - a.timestamp.getTime());
  }, [sessions, flags, riskScores, alertStatuses]);

  const filtered = useMemo(() => {
    let result = alerts;
    if (typeFilter !== 'all') result = result.filter(a => a.alertType === typeFilter);
    if (severityFilter !== 'all') result = result.filter(a => a.severity === severityFilter);
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    return result;
  }, [alerts, typeFilter, severityFilter, statusFilter]);

  const alertTypes = useMemo(() => [...new Set(alerts.map(a => a.alertType))].sort(), [alerts]);

  const setStatus = useCallback((alertId: string, status: SessionAlert['status']) => {
    setAlertStatuses(prev => new Map(prev).set(alertId, status));
  }, []);

  const handleResolve = useCallback((alert: SessionAlert) => {
    setStatus(alert.id, 'resolved');
    toast.success('Alerta marcado como resolvido.');
  }, [setStatus]);

  const handleInvestigate = useCallback((alert: SessionAlert) => {
    setStatus(alert.id, 'investigating');
    toast.info('Alerta em investigação.');
  }, [setStatus]);

  const handleBlock = useCallback(async (alert: SessionAlert) => {
    try {
      // Terminate the session by setting status to 'expired'
      const { error } = await supabase
        .from('user_sessions')
        .update({ status: 'expired', logout_at: new Date().toISOString() })
        .eq('id', alert.sessionId);

      if (error) throw error;

      setStatus(alert.id, 'blocked');
      toast.success('Sessão bloqueada com sucesso.');
    } catch (err: any) {
      toast.error(`Erro ao bloquear sessão: ${err.message}`);
    }
    setBlockConfirm(null);
  }, [setStatus]);

  const statusBadge = (status: SessionAlert['status']) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      open: { label: 'Aberto', variant: 'destructive' },
      investigating: { label: 'Investigando', variant: 'secondary' },
      resolved: { label: 'Resolvido', variant: 'outline' },
      blocked: { label: 'Bloqueado', variant: 'default' },
    };
    const c = config[status] ?? config.open;
    return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
  };

  const sevBadge = (sev: string) => {
    const variant: 'default' | 'secondary' | 'outline' | 'destructive' =
      sev === 'critical' || sev === 'high' ? 'destructive' : sev === 'medium' ? 'secondary' : 'outline';
    return <Badge variant={variant} className="text-[10px] uppercase">{sev}</Badge>;
  };

  const openCount = alerts.filter(a => a.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <span className="text-sm font-medium">
          {openCount} alerta{openCount !== 1 ? 's' : ''} aberto{openCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-muted-foreground">
          · {alerts.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="investigating">Investigando</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="medium">Médio</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de Alerta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {alertTypes.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum alerta encontrado.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Severidade</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Tipo de Alerta</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(alert => (
                    <TableRow key={alert.id}>
                      <TableCell>{statusBadge(alert.status)}</TableCell>
                      <TableCell>{sevBadge(alert.severity)}</TableCell>
                      <TableCell className="font-mono text-xs">{alert.userId.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{alert.tenantId?.slice(0, 8) ?? '—'}…</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <span className="font-medium">{alert.alertType}</span>
                          {alert.details && (
                            <p className="text-muted-foreground text-[10px] mt-0.5">{alert.details}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{alert.location}</TableCell>
                      <TableCell className="text-xs font-mono">{alert.ip}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(alert.timestamp, 'dd/MM HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {alert.status === 'open' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => handleInvestigate(alert)}
                              title="Investigar"
                            >
                              <Eye className="h-3 w-3 mr-1" /> Investigar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => handleResolve(alert)}
                              title="Resolver"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                              onClick={() => setBlockConfirm(alert)}
                              title="Bloquear sessão"
                            >
                              <Ban className="h-3 w-3 mr-1" /> Bloquear
                            </Button>
                          </div>
                        )}
                        {alert.status === 'investigating' && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => handleResolve(alert)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                              onClick={() => setBlockConfirm(alert)}
                            >
                              <Ban className="h-3 w-3 mr-1" /> Bloquear
                            </Button>
                          </div>
                        )}
                        {(alert.status === 'resolved' || alert.status === 'blocked') && (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Block confirmation dialog */}
      <AlertDialog open={!!blockConfirm} onOpenChange={() => setBlockConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso encerrará imediatamente a sessão do usuário{' '}
              <span className="font-mono font-medium">{blockConfirm?.userId.slice(0, 8)}…</span>.
              A sessão será marcada como expirada e o usuário precisará fazer login novamente.
              <br /><br />
              <strong>Alerta:</strong> {blockConfirm?.alertType}
              <br />
              <strong>IP:</strong> {blockConfirm?.ip}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockConfirm && handleBlock(blockConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirmar Bloqueio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
