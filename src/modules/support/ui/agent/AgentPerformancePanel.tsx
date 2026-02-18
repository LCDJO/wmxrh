/**
 * AgentPerformancePanel — Enhanced agent metrics with SLA tracking and trends.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, CheckCircle2, Clock, Star, TrendingUp,
  Target, Zap, Award, Loader2, Timer, MessageSquare,
} from 'lucide-react';
import { TicketService } from '@/domains/support/ticket-service';
import { EvaluationService } from '@/domains/support/evaluation-service';
import type { SupportTicket, SupportEvaluation } from '@/domains/support/types';
import { toast } from 'sonner';

interface AgentMetrics {
  totalAssigned: number;
  resolved: number;
  resolutionRate: number;
  avgResponseMin: number | null;
  avgResolutionHours: number | null;
  avgScore: number;
  totalEvaluations: number;
  positiveRate: number;
  slaCompliance: number;
  activeNow: number;
  todayResolved: number;
  weekResolved: number;
}

function computeMetrics(tickets: SupportTicket[], evaluations: SupportEvaluation[], userId: string): AgentMetrics {
  const myTickets = tickets.filter(t => t.assigned_to === userId);
  const resolved = myTickets.filter(t => t.status === 'resolved' || t.status === 'closed');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Response times
  const responseTimes = myTickets
    .filter(t => t.first_response_at)
    .map(t => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 60000);
  const avgResponseMin = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  // Resolution times
  const resolutionTimes = resolved
    .filter(t => t.resolved_at)
    .map(t => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000);
  const avgResolutionHours = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : null;

  // SLA compliance (responded within 30min)
  const slaCompliant = responseTimes.filter(t => t <= 30).length;
  const slaCompliance = responseTimes.length > 0 ? (slaCompliant / responseTimes.length) * 100 : 100;

  // Evaluations
  const myEvals = evaluations.filter(e => e.agent_id === userId);
  const avgScore = myEvals.length > 0
    ? myEvals.reduce((s, e) => s + (e.agent_score ?? 0), 0) / myEvals.length
    : 0;
  const positiveRate = myEvals.length > 0
    ? (myEvals.filter(e => (e.agent_score ?? 0) >= 4).length / myEvals.length) * 100
    : 0;

  return {
    totalAssigned: myTickets.length,
    resolved: resolved.length,
    resolutionRate: myTickets.length > 0 ? (resolved.length / myTickets.length) * 100 : 0,
    avgResponseMin: avgResponseMin !== null ? Math.round(avgResponseMin) : null,
    avgResolutionHours: avgResolutionHours !== null ? Math.round(avgResolutionHours * 10) / 10 : null,
    avgScore: Math.round(avgScore * 10) / 10,
    totalEvaluations: myEvals.length,
    positiveRate: Math.round(positiveRate),
    slaCompliance: Math.round(slaCompliance),
    activeNow: myTickets.filter(t => t.status === 'in_progress').length,
    todayResolved: resolved.filter(t => t.resolved_at && new Date(t.resolved_at) >= today).length,
    weekResolved: resolved.filter(t => t.resolved_at && new Date(t.resolved_at) >= weekAgo).length,
  };
}

function formatTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}min`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function AgentPerformancePanel({ userId }: { userId: string }) {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([TicketService.listAll(), EvaluationService.listAll()])
      .then(([tickets, evals]) => setMetrics(computeMetrics(tickets, evals, userId)))
      .catch(() => toast.error('Erro ao carregar métricas'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || !metrics) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const slaColor = metrics.slaCompliance >= 90 ? 'hsl(145 60% 42%)' : metrics.slaCompliance >= 70 ? 'hsl(35 80% 50%)' : 'hsl(0 70% 50%)';

  return (
    <div className="space-y-5">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: 'Ativos Agora', value: metrics.activeNow, color: 'hsl(200 70% 50%)' },
          { icon: CheckCircle2, label: 'Hoje', value: metrics.todayResolved, color: 'hsl(145 60% 42%)' },
          { icon: TrendingUp, label: 'Semana', value: metrics.weekResolved, color: 'hsl(280 60% 55%)' },
          { icon: Target, label: 'Total Resolvidos', value: metrics.resolved, color: 'hsl(210 65% 50%)' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="py-4 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" style={{ color: k.color }} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-3xl font-bold text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SLA Compliance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" /> SLA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <p className="text-4xl font-bold" style={{ color: slaColor }}>{metrics.slaCompliance}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">Respondidos em ≤30min</p>
            </div>
            <Progress value={metrics.slaCompliance} className="h-2" />
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{formatTime(metrics.avgResponseMin)}</p>
                <p className="text-[9px] text-muted-foreground">Tempo Médio Resposta</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">{metrics.avgResolutionHours !== null ? `${metrics.avgResolutionHours}h` : '—'}</p>
                <p className="text-[9px] text-muted-foreground">Tempo Médio Resolução</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolution Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Taxa de Resolução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground">{Math.round(metrics.resolutionRate)}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">{metrics.resolved} de {metrics.totalAssigned} tickets</p>
            </div>
            <Progress value={metrics.resolutionRate} className="h-2" />
            <div className="flex justify-center gap-3 pt-2 border-t border-border">
              <Badge variant="secondary" className="text-[10px]">
                <MessageSquare className="h-3 w-3 mr-1" /> {metrics.totalAssigned} atribuídos
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Customer Satisfaction */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Satisfação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center">
              <p className="text-4xl font-bold text-foreground">{metrics.avgScore > 0 ? metrics.avgScore : '—'}</p>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    className="h-4 w-4"
                    fill={metrics.avgScore >= n ? 'hsl(45 90% 55%)' : 'transparent'}
                    stroke="hsl(45 90% 55%)"
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{metrics.totalEvaluations} avaliações</p>
            </div>
            <div className="flex justify-center gap-3 pt-2 border-t border-border">
              <Badge
                variant="secondary"
                className="text-[10px]"
                style={{
                  backgroundColor: metrics.positiveRate >= 80 ? 'hsl(145 60% 42%/0.1)' : 'hsl(35 80% 50%/0.1)',
                  color: metrics.positiveRate >= 80 ? 'hsl(145 60% 42%)' : 'hsl(35 80% 50%)',
                }}
              >
                {metrics.positiveRate}% positivas (≥4★)
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
