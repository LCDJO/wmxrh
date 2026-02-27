/**
 * Chaos Engineering — Execution Logs
 */
import { useQuery } from '@tanstack/react-query';
import { getChaosEngine } from '@/domains/chaos-engineering/chaos-engine';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock, CheckCircle2, XCircle, Ban, Play, ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import type { ChaosExperiment } from '@/domains/chaos-engineering/types';
import { supabase } from '@/integrations/supabase/client';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending:        { color: 'bg-muted text-muted-foreground', icon: <Clock className="h-3 w-3" />, label: 'Pendente' },
  approved:       { color: 'bg-blue-500/10 text-blue-400', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Aprovado' },
  running:        { color: 'bg-amber-500/10 text-amber-400', icon: <Play className="h-3 w-3" />, label: 'Em execução' },
  completed:      { color: 'bg-emerald-500/10 text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Concluído' },
  failed:         { color: 'bg-red-500/10 text-red-400', icon: <XCircle className="h-3 w-3" />, label: 'Falhou' },
  aborted:        { color: 'bg-muted text-muted-foreground', icon: <Ban className="h-3 w-3" />, label: 'Abortado' },
  safety_stopped: { color: 'bg-red-500/10 text-red-400', icon: <ShieldAlert className="h-3 w-3" />, label: 'Safety Stop' },
};

export default function ChaosExecutionLogs() {
  const engine = getChaosEngine();

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['chaos-experiments'],
    queryFn: () => engine.getExperiments(100),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['chaos-audit-logs'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('chaos_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Experiments timeline */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Execuções</h2>
        {experiments.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma execução registrada.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {experiments.map(exp => {
              const cfg = statusConfig[exp.status] ?? statusConfig.pending;
              return (
                <Card key={exp.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{exp.name}</span>
                          <Badge variant="outline" className={cfg.color}>
                            <span className="flex items-center gap-1">{cfg.icon}{cfg.label}</span>
                          </Badge>
                          <Badge variant="outline">{exp.fault_type}</Badge>
                          <Badge variant="outline">{exp.blast_radius}</Badge>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                          <span>Início: {exp.started_at ? new Date(exp.started_at).toLocaleString('pt-BR') : '—'}</span>
                          <span>Fim: {exp.completed_at ? new Date(exp.completed_at).toLocaleString('pt-BR') : '—'}</span>
                          {exp.target_module && <span>Módulo: {exp.target_module}</span>}
                          {exp.resilience_score != null && <span>Resilience: {exp.resilience_score}/10</span>}
                          {exp.impact_score != null && <span>Impact: {exp.impact_score}/10</span>}
                          {exp.safety_stopped && <Badge variant="outline" className="text-red-400">Safety Stop: {exp.safety_stop_reason}</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Audit log */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Audit Log</h2>
        {auditLogs.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum registro de auditoria.</CardContent></Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card text-sm">
                <Badge variant="outline" className={
                  log.severity === 'critical' ? 'text-red-400 border-red-500/30' :
                  log.severity === 'warning' ? 'text-amber-400 border-amber-500/30' :
                  'text-muted-foreground'
                }>
                  {log.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{log.event_type}</span>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {JSON.stringify(log.details)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
