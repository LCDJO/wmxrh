/**
 * Chaos Engineering — Reports
 */
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getChaosEngine } from '@/domains/chaos-engineering/chaos-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileText, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Shield, Target,
} from 'lucide-react';
import type { ChaosReport } from '@/domains/chaos-engineering/types';

export default function ChaosReports() {
  const engine = getChaosEngine();
  const [selectedReport, setSelectedReport] = useState<ChaosReport | null>(null);

  const { data: experiments = [] } = useQuery({
    queryKey: ['chaos-experiments'],
    queryFn: () => engine.getExperiments(50),
  });

  const completedExperiments = experiments.filter(e => e.status === 'completed' || e.status === 'safety_stopped');

  const generateMutation = useMutation({
    mutationFn: async (experimentId: string) => {
      return await engine.reports.generate(experimentId);
    },
    onSuccess: (report) => {
      setSelectedReport(report);
      toast.success('Relatório gerado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const MetBadge = ({ met }: { met: boolean | null }) => {
    if (met === null) return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
    return met
      ? <Badge variant="outline" className="text-emerald-400"><CheckCircle2 className="h-3 w-3 mr-1" />Cumprido</Badge>
      : <Badge variant="outline" className="text-red-400"><XCircle className="h-3 w-3 mr-1" />Violado</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Experiment list for report generation */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Gerar Relatório</h2>
        {completedExperiments.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum experimento concluído para gerar relatório.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {completedExperiments.map(exp => (
              <Card key={exp.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{exp.name}</p>
                    <p className="text-xs text-muted-foreground">{exp.fault_type} · {exp.blast_radius} · {exp.target_module ?? 'system'}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generateMutation.mutate(exp.id)}
                    disabled={generateMutation.isPending}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {generateMutation.isPending ? 'Gerando...' : 'Gerar'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Report detail */}
      {selectedReport && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Relatório</h2>

          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground">{selectedReport.summary}</p>
              <p className="text-xs text-muted-foreground mt-1">Gerado em: {new Date(selectedReport.generated_at).toLocaleString('pt-BR')}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Scenario */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cenário</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Nome:</span> {selectedReport.scenario.name}</p>
                <p><span className="text-muted-foreground">Tipo:</span> {selectedReport.scenario.fault_type}</p>
                <p><span className="text-muted-foreground">Módulo:</span> {selectedReport.scenario.target_module ?? '—'}</p>
                <p><span className="text-muted-foreground">Blast Radius:</span> {selectedReport.scenario.blast_radius}</p>
                <p><span className="text-muted-foreground">Duração:</span> {selectedReport.scenario.duration_minutes}min</p>
              </CardContent>
            </Card>

            {/* Impact */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Target className="h-4 w-4" />Impacto</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Impact Score:</span> {selectedReport.impact.score}/10</p>
                <p><span className="text-muted-foreground">Resilience Score:</span> {selectedReport.impact.resilience_score}/10</p>
                <p><span className="text-muted-foreground">Tenants afetados:</span> {selectedReport.impact.affected_tenant_count}</p>
                <p><span className="text-muted-foreground">Incidentes criados:</span> {selectedReport.impact.incidents_created}</p>
                <p><span className="text-muted-foreground">Degradação latência:</span> {selectedReport.impact.latency_degradation_pct}%</p>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Self-Healing:</span>
                  {selectedReport.impact.self_healing_triggered
                    ? <Badge variant="outline" className="text-emerald-400">Ativado</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Não ativado</Badge>}
                </div>
              </CardContent>
            </Card>

            {/* SLA Performance */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Shield className="h-4 w-4" />SLA Performance</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Overall:</span> <MetBadge met={selectedReport.sla_performance.overall_met} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Response:</span> <MetBadge met={selectedReport.sla_performance.response_met} />
                  <span className="text-xs text-muted-foreground">{selectedReport.sla_performance.response_actual_ms}ms / {selectedReport.sla_performance.response_target_ms}ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Resolution:</span> <MetBadge met={selectedReport.sla_performance.resolution_met} />
                  <span className="text-xs text-muted-foreground">{selectedReport.sla_performance.resolution_actual_min}min / {selectedReport.sla_performance.resolution_target_min}min</span>
                </div>
                <p><span className="text-muted-foreground">Uptime:</span> {selectedReport.sla_performance.uptime_pct}% / {selectedReport.sla_performance.target_uptime_pct}%</p>
              </CardContent>
            </Card>

            {/* RTO Performance */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">RTO/RPO Performance</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">RTO:</span> <MetBadge met={selectedReport.rto_performance.rto_met} />
                  <span className="text-xs text-muted-foreground">{selectedReport.rto_performance.rto_actual_minutes}min / {selectedReport.rto_performance.rto_target_minutes}min</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">RPO:</span> <MetBadge met={selectedReport.rto_performance.rpo_met} />
                  <span className="text-xs text-muted-foreground">{selectedReport.rto_performance.rpo_actual_minutes}min / {selectedReport.rto_performance.rpo_target_minutes}min</span>
                </div>
                <p><span className="text-muted-foreground">Downtime total:</span> {selectedReport.rto_performance.total_downtime_minutes}min</p>
                <p><span className="text-muted-foreground">Política:</span> {selectedReport.rto_performance.policy_source}</p>
              </CardContent>
            </Card>
          </div>

          {/* Findings */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Falhas Detectadas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedReport.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className={
                    f.severity === 'critical' ? 'text-red-400 border-red-500/30' :
                    f.severity === 'warning' ? 'text-amber-400 border-amber-500/30' :
                    'text-muted-foreground'
                  }>
                    {f.severity}
                  </Badge>
                  <span className="text-foreground">{f.finding}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recomendações</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {selectedReport.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className={
                    r.priority === 'urgent' ? 'text-red-400 border-red-500/30' :
                    r.priority === 'high' ? 'text-amber-400 border-amber-500/30' :
                    'text-muted-foreground'
                  }>
                    {r.priority}
                  </Badge>
                  <span className="text-foreground">{r.recommendation}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
