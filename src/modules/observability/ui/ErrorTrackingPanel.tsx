/**
 * Error Tracking — ApplicationError aggregation with severity, error_type, and source breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import type { ErrorSummary, TrackedError, ErrorSeverity } from '@/domains/observability/types';
import { Bug, RefreshCw, CheckCircle2, Trash2, Info, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const severityConfig: Record<ErrorSeverity, { label: string; color: string; bg: string; icon: typeof Info; variant: 'destructive' | 'secondary' | 'outline' | 'default' }> = {
  info:     { label: 'Info',     color: 'text-primary',            bg: 'bg-primary/10',     icon: Info,          variant: 'outline' },
  warning:  { label: 'Warning',  color: 'text-[hsl(38_92%_40%)]', bg: 'bg-[hsl(38_92%_50%)]/10', icon: AlertTriangle, variant: 'secondary' },
  error:    { label: 'Error',    color: 'text-destructive',        bg: 'bg-destructive/10', icon: XCircle,       variant: 'destructive' },
  critical: { label: 'Critical', color: 'text-destructive',        bg: 'bg-destructive/15', icon: ShieldAlert,   variant: 'destructive' },
};

export default function ErrorTrackingPanel() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<ErrorSummary | null>(null);
  const [allErrors, setAllErrors] = useState<TrackedError[]>([]);

  const refresh = useCallback(() => {
    const tracker = getErrorTracker();
    setSummary(tracker.getSummary());
    setAllErrors(tracker.getErrors({ resolved: false }));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = getErrorTracker().onUpdate(refresh);
    const interval = setInterval(refresh, 10_000);
    return () => { unsub(); clearInterval(interval); };
  }, [refresh]);

  const handleResolve = useCallback((id: string) => {
    getErrorTracker().resolve(id);
    toast({ title: 'Resolvido', description: 'Erro marcado como resolvido.' });
  }, [toast]);

  const handleClear = useCallback(() => {
    getErrorTracker().clear();
    toast({ title: 'Limpo', description: 'Todos os erros foram removidos.' });
  }, [toast]);

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{summary.total_errors_1h}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 1h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{summary.total_errors_24h}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 24h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{summary.error_rate_per_min}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros/min</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{Object.keys(summary.by_module).length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Módulos Afetados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Severity breakdown */}
      {summary && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-muted-foreground mr-1">Severidade:</span>
          {(['critical', 'error', 'warning', 'info'] as ErrorSeverity[]).map(sev => {
            const count = summary.by_severity[sev] ?? 0;
            const cfg = severityConfig[sev];
            return (
              <Badge key={sev} variant={cfg.variant} className="text-[10px] gap-1">
                {cfg.label}: {count}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
        <Button onClick={handleClear} variant="outline" size="sm">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar Todos
        </Button>
      </div>

      {/* Error table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            ApplicationError Registry
          </CardTitle>
          <CardDescription>Erros ativos ordenados por ocorrências</CardDescription>
        </CardHeader>
        <CardContent>
          {allErrors.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[90px]">Severity</TableHead>
                    <TableHead className="w-[90px]">Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[90px]">Módulo</TableHead>
                    <TableHead className="w-[80px]">Fonte</TableHead>
                    <TableHead className="w-[50px] text-right">×</TableHead>
                    <TableHead className="w-[80px]">Hora</TableHead>
                    <TableHead className="w-[40px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allErrors.sort((a, b) => b.count - a.count).map(err => {
                    const cfg = severityConfig[err.severity];
                    const SevIcon = cfg.icon;
                    return (
                      <TableRow key={err.id}>
                        <TableCell>
                          <div className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.bg)}>
                            <SevIcon className={cn('h-3 w-3', cfg.color)} />
                            <span className={cfg.color}>{cfg.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {err.error_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="text-xs font-mono text-foreground truncate">{err.message}</p>
                            {err.stack && (
                              <p className="text-[9px] text-muted-foreground truncate mt-0.5">{err.stack.split('\n')[0]}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-mono text-muted-foreground">{err.module_id ?? '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{err.source}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-bold text-foreground">{err.count}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(err.last_seen).toLocaleTimeString('pt-BR')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => handleResolve(err.id)} className="h-6 w-6 p-0">
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground hover:text-emerald-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bug className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhum erro registrado. 🎉</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
