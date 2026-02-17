/**
 * SupportHealthOverview — Control Plane widget for support system health.
 * Shows avg agent score, avg system score, and ticket resolution time.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones, Star, Monitor, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { EvaluationService } from '@/domains/support/evaluation-service';
import { TicketService } from '@/domains/support/ticket-service';
import type { SupportEvaluation, SystemRating } from '@/domains/support/types';
import type { SupportTicket } from '@/domains/support/types';

interface SupportMetrics {
  avgAgentScore: number;
  avgSystemScore: number;
  avgResolutionTimeMin: number | null;
  totalEvaluations: number;
  totalSystemRatings: number;
  resolvedTickets: number;
}

function computeMetrics(
  evals: SupportEvaluation[],
  sysRatings: SystemRating[],
  tickets: SupportTicket[],
): SupportMetrics {
  const agentScores = evals.filter(e => e.agent_score != null).map(e => e.agent_score!);
  const avgAgentScore = agentScores.length > 0
    ? agentScores.reduce((a, b) => a + b, 0) / agentScores.length
    : 0;

  const sysScores = sysRatings.map(r => r.rating);
  const avgSystemScore = sysScores.length > 0
    ? sysScores.reduce((a, b) => a + b, 0) / sysScores.length
    : 0;

  const resolved = tickets.filter(t => t.resolved_at);
  const resolutionTimes = resolved.map(t =>
    (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 60000,
  );
  const avgResolutionTimeMin = resolutionTimes.length > 0
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : null;

  return {
    avgAgentScore: Math.round(avgAgentScore * 10) / 10,
    avgSystemScore: Math.round(avgSystemScore * 10) / 10,
    avgResolutionTimeMin: avgResolutionTimeMin != null ? Math.round(avgResolutionTimeMin) : null,
    totalEvaluations: evals.length,
    totalSystemRatings: sysRatings.length,
    resolvedTickets: resolved.length,
  };
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 4)
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/25 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />Excelente</Badge>;
  if (score >= 3)
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/25 text-[10px]"><Minus className="h-3 w-3 mr-1" />Regular</Badge>;
  return <Badge className="bg-destructive/15 text-destructive border-destructive/25 text-[10px]"><TrendingDown className="h-3 w-3 mr-1" />Baixo</Badge>;
}

export function SupportHealthOverview() {
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      EvaluationService.listAll(),
      EvaluationService.listSystemRatings(),
      TicketService.listAll(),
    ])
      .then(([evals, sys, tickets]) => setMetrics(computeMetrics(evals, sys, tickets)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resLabel = metrics?.avgResolutionTimeMin != null
    ? metrics.avgResolutionTimeMin < 60
      ? `${metrics.avgResolutionTimeMin}min`
      : `${(metrics.avgResolutionTimeMin / 60).toFixed(1)}h`
    : '—';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Headphones className="h-4 w-4 text-primary" />
          Suporte — Health Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-6">Carregando métricas…</div>
        ) : !metrics ? (
          <div className="text-xs text-muted-foreground text-center py-6">Sem dados disponíveis</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Avg Agent Score */}
            <div className="text-center py-3 bg-muted/50 rounded-lg space-y-1">
              <Star className="h-5 w-5 mx-auto" style={{ color: 'hsl(45 90% 55%)' }} />
              <p className="text-2xl font-bold text-foreground">{metrics.avgAgentScore || '—'}</p>
              <p className="text-[10px] text-muted-foreground">Nota Média Atendentes</p>
              {metrics.avgAgentScore > 0 && <ScoreBadge score={metrics.avgAgentScore} />}
              <p className="text-[9px] text-muted-foreground">{metrics.totalEvaluations} avaliações</p>
            </div>

            {/* Avg System Score */}
            <div className="text-center py-3 bg-muted/50 rounded-lg space-y-1">
              <Monitor className="h-5 w-5 mx-auto" style={{ color: 'hsl(200 70% 50%)' }} />
              <p className="text-2xl font-bold text-foreground">{metrics.avgSystemScore || '—'}</p>
              <p className="text-[10px] text-muted-foreground">Nota Média Sistema</p>
              {metrics.avgSystemScore > 0 && <ScoreBadge score={metrics.avgSystemScore} />}
              <p className="text-[9px] text-muted-foreground">{metrics.totalSystemRatings} ratings</p>
            </div>

            {/* Avg Resolution Time */}
            <div className="text-center py-3 bg-muted/50 rounded-lg space-y-1">
              <Clock className="h-5 w-5 mx-auto" style={{ color: 'hsl(265 60% 55%)' }} />
              <p className="text-2xl font-bold text-foreground">{resLabel}</p>
              <p className="text-[10px] text-muted-foreground">Tempo Médio Resolução</p>
              <p className="text-[9px] text-muted-foreground">{metrics.resolvedTickets} tickets resolvidos</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
