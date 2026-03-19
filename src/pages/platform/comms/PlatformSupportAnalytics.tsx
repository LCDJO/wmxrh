import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Loader2, Trophy, Users, BarChart3, Clock, CheckCircle, Timer, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { EvaluationService } from '@/domains/support/evaluation-service';
import type { SupportEvaluation, SystemRating } from '@/domains/support/types';

interface AgentStats {
  agentId: string;
  name: string;
  avgScore: number;
  totalEvals: number;
  positiveCount: number;
}

interface CategoryStats {
  category: string;
  label: string;
  totalTickets: number;
  resolvedTickets: number;
  avgResolutionMin: number | null;
  resolutionRate: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  billing: 'Financeiro',
  technical: 'Técnico',
  feature_request: 'Sugestão',
  bug_report: 'Bug Report',
  account: 'Conta',
  general: 'Geral',
};

export default function PlatformSupportAnalytics() {
  const [evaluations, setEvaluations] = useState<SupportEvaluation[]>([]);
  const [systemRatings, setSystemRatings] = useState<SystemRating[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [resolvedTickets, setResolvedTickets] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [evals, sysRatings, ticketsRes] = await Promise.all([
          EvaluationService.listAll(),
          EvaluationService.listSystemRatings(),
          supabase.from('support_tickets').select('id, category, status, assigned_to, created_at, resolved_at'),
        ]);

        setEvaluations(evals);
        setSystemRatings(sysRatings);

        const tickets = ticketsRes.data ?? [];
        setTotalTickets(tickets.length);
        const resolved = tickets.filter(t => t.resolved_at);
        setResolvedTickets(resolved.length);

        // ── Agent stats ──
        const agentMap = new Map<string, { scores: number[]; id: string }>();
        evals.forEach(ev => {
          if (!ev.agent_id || ev.agent_score == null) return;
          const entry = agentMap.get(ev.agent_id) ?? { scores: [], id: ev.agent_id };
          entry.scores.push(ev.agent_score);
          agentMap.set(ev.agent_id, entry);
        });

        const agentIds = [...agentMap.keys()];
        let nameMap = new Map<string, string>();
        if (agentIds.length > 0) {
          const { data: agents } = await supabase
            .from('platform_users')
            .select('id, display_name, email')
            .in('id', agentIds);
          nameMap = new Map((agents ?? []).map(a => [a.id, a.display_name || a.email]));
        }

        setAgentStats(
          [...agentMap.entries()]
            .map(([id, { scores }]) => ({
              agentId: id,
              name: nameMap.get(id) ?? id.slice(0, 8),
              avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
              totalEvals: scores.length,
              positiveCount: scores.filter(s => s >= 4).length,
            }))
            .sort((a, b) => b.avgScore - a.avgScore),
        );

        // ── Category stats (tempo médio por módulo + taxa resolução) ──
        const byCat: Record<string, { total: number; resolved: number; resTimes: number[] }> = {};
        for (const t of tickets) {
          const cat = t.category ?? 'general';
          if (!byCat[cat]) byCat[cat] = { total: 0, resolved: 0, resTimes: [] };
          byCat[cat].total++;
          if (t.resolved_at) {
            byCat[cat].resolved++;
            const mins = (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 60000;
            if (mins > 0) byCat[cat].resTimes.push(mins);
          }
        }

        setCategoryStats(
          Object.entries(byCat)
            .map(([cat, d]) => ({
              category: cat,
              label: CATEGORY_LABELS[cat] ?? cat,
              totalTickets: d.total,
              resolvedTickets: d.resolved,
              avgResolutionMin: d.resTimes.length > 0
                ? Math.round(d.resTimes.reduce((a, b) => a + b, 0) / d.resTimes.length)
                : null,
              resolutionRate: d.total > 0 ? Math.round((d.resolved / d.total) * 100) : 0,
            }))
            .sort((a, b) => b.totalTickets - a.totalTickets),
        );
      } catch {
        toast.error('Erro ao carregar analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const globalAgentAvg = evaluations.length > 0
    ? evaluations.reduce((s, e) => s + (e.agent_score ?? 0), 0) / evaluations.filter(e => e.agent_score != null).length
    : 0;

  const globalSystemAvg = systemRatings.length > 0
    ? systemRatings.reduce((s, r) => s + r.rating, 0) / systemRatings.length
    : 0;

  const globalResolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics de Suporte</h1>
          <p className="text-sm text-muted-foreground">Avaliações, tempos e taxas de resolução</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard
          stars
          starColor="hsl(45 90% 55%)"
          value={globalAgentAvg > 0 ? globalAgentAvg.toFixed(1) : '—'}
          avgValue={globalAgentAvg}
          label="Nota Média Atendentes"
        />
        <KPICard
          stars
          starColor="hsl(200 70% 50%)"
          value={globalSystemAvg > 0 ? globalSystemAvg.toFixed(1) : '—'}
          avgValue={globalSystemAvg}
          label="Nota Média Sistema"
        />
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-3xl font-bold text-foreground">{globalResolutionRate}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Resolução</p>
            <p className="text-[9px] text-muted-foreground">{resolvedTickets}/{totalTickets} tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{evaluations.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Avaliações</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-4 text-center">
            <p className="text-3xl font-bold text-foreground">{agentStats.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              <Users className="h-3 w-3 inline mr-1" />Atendentes Avaliados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tempo Médio por Módulo / Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" /> Tempo Médio e Resolução por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum ticket registrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Tickets</TableHead>
                  <TableHead className="text-center">Resolvidos</TableHead>
                  <TableHead className="text-center">
                    <span className="flex items-center justify-center gap-1"><Timer className="h-3 w-3" />Tempo Médio</span>
                  </TableHead>
                  <TableHead className="text-right">Taxa Resolução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryStats.map(cat => (
                  <TableRow key={cat.category}>
                    <TableCell className="font-medium text-sm">{cat.label}</TableCell>
                    <TableCell className="text-center text-sm">{cat.totalTickets}</TableCell>
                    <TableCell className="text-center text-sm">{cat.resolvedTickets}</TableCell>
                    <TableCell className="text-center text-sm">
                      {cat.avgResolutionMin !== null ? formatDuration(cat.avgResolutionMin) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <ResolutionBadge rate={cat.resolutionRate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Atendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Ranking de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação registrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Nota Média</TableHead>
                  <TableHead className="text-center">Avaliações</TableHead>
                  <TableHead className="text-center">Positivas (≥4★)</TableHead>
                  <TableHead className="text-right">Satisfação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentStats.map((agent, i) => {
                  const satisfaction = agent.totalEvals > 0 ? Math.round((agent.positiveCount / agent.totalEvals) * 100) : 0;
                  return (
                    <TableRow key={agent.agentId}>
                      <TableCell>
                        {i === 0 ? <span className="text-lg">🥇</span>
                          : i === 1 ? <span className="text-lg">🥈</span>
                          : i === 2 ? <span className="text-lg">🥉</span>
                          : <span className="text-sm text-muted-foreground font-mono">{i + 1}</span>}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{agent.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <Star
                                key={n}
                                className="h-3 w-3"
                                fill={agent.avgScore >= n ? 'hsl(45 90% 55%)' : 'transparent'}
                                stroke={agent.avgScore >= n ? 'hsl(45 90% 55%)' : 'hsl(var(--muted-foreground))'}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold text-foreground">{agent.avgScore.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{agent.totalEvals}</TableCell>
                      <TableCell className="text-center text-sm">{agent.positiveCount}</TableCell>
                      <TableCell className="text-right">
                        <ResolutionBadge rate={satisfaction} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Helper components ──

function KPICard({ stars, starColor, value, avgValue, label }: {
  stars?: boolean; starColor?: string; value: string; avgValue?: number; label: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4 text-center">
        {stars && (
          <div className="flex justify-center gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map(n => (
              <Star key={n} className="h-4 w-4" fill={(avgValue ?? 0) >= n ? starColor : 'transparent'} stroke={starColor} />
            ))}
          </div>
        )}
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ResolutionBadge({ rate }: { rate: number }) {
  const bg = rate >= 80 ? 'hsl(145 60% 42% / 0.1)' : rate >= 50 ? 'hsl(45 90% 55% / 0.1)' : 'hsl(0 70% 55% / 0.1)';
  const fg = rate >= 80 ? 'hsl(145 60% 42%)' : rate >= 50 ? 'hsl(45 90% 55%)' : 'hsl(0 70% 55%)';
  return (
    <Badge variant="secondary" className="text-xs" style={{ backgroundColor: bg, color: fg }}>
      {rate}%
    </Badge>
  );
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
