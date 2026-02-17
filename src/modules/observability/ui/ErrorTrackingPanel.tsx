/**
 * Error Tracking — Error aggregation with severity and source breakdown.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getErrorTracker } from '@/domains/observability/error-tracker';
import type { ErrorSummary, TrackedError, ErrorSeverity } from '@/domains/observability/types';
import { Bug, RefreshCw, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const severityConfig: Record<ErrorSeverity, { label: string; color: string; variant: 'destructive' | 'secondary' | 'outline' | 'default' }> = {
  fatal: { label: 'Fatal', color: 'text-destructive', variant: 'destructive' },
  high: { label: 'Alto', color: 'text-destructive', variant: 'destructive' },
  medium: { label: 'Médio', color: 'text-[hsl(38_92%_40%)]', variant: 'secondary' },
  low: { label: 'Baixo', color: 'text-muted-foreground', variant: 'outline' },
};

export default function ErrorTrackingPanel() {
  const { toast } = useToast();
  const [errors, setErrors] = useState<ErrorSummary | null>(null);
  const [allErrors, setAllErrors] = useState<TrackedError[]>([]);

  const refresh = useCallback(() => {
    const tracker = getErrorTracker();
    setErrors(tracker.getSummary());
    setAllErrors(tracker.getErrors({ resolved: false }));
  }, []);

  useEffect(() => {
    refresh();
    const unsub = getErrorTracker().onUpdate(refresh);
    const interval = setInterval(refresh, 10000);
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
      {/* KPIs */}
      {errors && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{errors.total_errors_1h}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 1h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{errors.total_errors_24h}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros / 24h</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{errors.error_rate_per_min}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Erros/min</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 text-center">
              <p className="text-2xl font-bold text-foreground">{Object.keys(errors.by_source).length}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Fontes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Severity breakdown */}
      {errors && Object.keys(errors.by_severity).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(errors.by_severity).map(([sev, count]) => {
            const cfg = severityConfig[sev as ErrorSeverity] ?? severityConfig.medium;
            return (
              <Badge key={sev} variant={cfg.variant} className="text-xs">
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

      {/* Error list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            Erros Ativos
          </CardTitle>
          <CardDescription>Erros não resolvidos ordenados por ocorrências</CardDescription>
        </CardHeader>
        <CardContent>
          {allErrors.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {allErrors.sort((a, b) => b.count - a.count).map(err => {
                  const cfg = severityConfig[err.severity] ?? severityConfig.medium;
                  return (
                    <div key={err.id} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono text-foreground break-all">{err.message}</p>
                          {err.stack && (
                            <pre className="text-[10px] text-muted-foreground mt-1 max-h-16 overflow-hidden">
                              {err.stack.slice(0, 200)}
                            </pre>
                          )}
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => handleResolve(err.id)} className="shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={cfg.variant} className="text-[10px]">{cfg.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">×{err.count}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{err.source}</Badge>
                        {err.module_id && <Badge variant="secondary" className="text-[10px]">{err.module_id}</Badge>}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(err.last_seen).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
